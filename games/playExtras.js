'use strict';

const { PREFIX, SESSION_TTL_MS, gameEmbed, stopButton, makeRow, buildExtraGamesRow } = require('./shared/ui');
const games = [
    require('./quiz'),
    require('./riddles'),
    require('./word-scramble'),
    require('./tic-tac-toe'),
    require('./number-guess'),
];

const definitions = games.map(game => game.definition);
const gamesById = new Map(games.map(game => [game.definition.id, game]));
const sessions = new Map();
const timers = new Map();
const registeredClients = new WeakSet();

function buildExtraGamesRowForPlay(ownerId) {
    return buildExtraGamesRow(ownerId, definitions);
}

function clearSession(messageId) {
    const timer = timers.get(messageId);
    if (timer) clearTimeout(timer);
    timers.delete(messageId);
    sessions.delete(messageId);
}

function refreshExpiry(session) {
    const previous = timers.get(session.messageId);
    if (previous) clearTimeout(previous);

    const timer = setTimeout(() => clearSession(session.messageId), SESSION_TTL_MS);
    timer.unref?.();
    timers.set(session.messageId, timer);
}

async function notifyCompletion(session, options) {
    if (session.completionNotified) return;
    session.completionNotified = true;

    if (typeof options.onGameComplete !== 'function') return;

    try {
        await options.onGameComplete({
            gameId: session.gameId,
            userId: session.ownerId,
            players: session.gameId === 'ttt'
                ? [session.playerX, session.playerO].filter(Boolean)
                : [session.ownerId],
            score: session.score || 0,
            correctAnswers: session.correctAnswers || 0,
            totalQuestions: session.questions?.length || null,
            winnerId: session.winner || null,
            won: session.gameId === 'ttt'
                ? Boolean(session.winner)
                : Boolean(session.score > 0),
            completed: true,
        });
    } catch (error) {
        (options.logger || console).error?.('Play-extra completion callback failed.', error);
    }
}

async function replyEphemeral(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content, ephemeral: true }).catch(() => {});
        return;
    }
    await interaction.reply({ content, ephemeral: true }).catch(() => {});
}

async function startGameFromSelection(interaction, gameId, ownerId = interaction.user.id) {
    const game = gamesById.get(gameId);
    if (!game) {
        await replyEphemeral(interaction, 'اللعبة المحددة غير معروفة.');
        return false;
    }

    const messageId = interaction.message?.id;
    if (!messageId) {
        await replyEphemeral(interaction, 'تعذر تحديد رسالة القائمة. افتح /play من جديد.');
        return false;
    }

    clearSession(messageId);
    const session = game.createSession(ownerId);
    session.messageId = messageId;
    session.busy = false;
    sessions.set(messageId, session);
    refreshExpiry(session);

    await interaction.update(game.render(session));
    return true;
}

async function handlePlayExtrasInteraction(interaction, options = {}) {
    const customId = interaction.customId;
    if (typeof customId !== 'string' || !customId.startsWith(`${PREFIX}:`)) return false;

    if (interaction.isStringSelectMenu?.() && customId.startsWith(`${PREFIX}:select:`)) {
        const ownerId = customId.slice(`${PREFIX}:select:`.length);
        if (interaction.user.id !== ownerId) {
            await replyEphemeral(interaction, 'هذه القائمة تخص الشخص الذي استخدم /play.');
            return true;
        }

        const gameId = interaction.values?.[0];
        const game = gamesById.get(gameId);
        if (!game) {
            await replyEphemeral(interaction, 'اللعبة المحددة غير معروفة.');
            return true;
        }

        await startGameFromSelection(interaction, gameId, ownerId);
        return true;
    }

    if (!interaction.isButton?.() || !customId.startsWith(`${PREFIX}:action:`)) return false;

    const action = customId.slice(`${PREFIX}:action:`.length);
    const messageId = interaction.message?.id;
    const session = sessions.get(messageId);

    if (!session) {
        await replyEphemeral(interaction, 'انتهت صلاحية هذه اللعبة. افتح /play وابدأ لعبة جديدة.');
        return true;
    }

    if (session.busy) {
        await replyEphemeral(interaction, 'جارٍ معالجة الحركة السابقة، حاول بعد لحظة.');
        return true;
    }

    if (session.finished) {
        await replyEphemeral(interaction, 'انتهت هذه اللعبة بالفعل.');
        return true;
    }

    if (action === 'stop') {
        if (session.gameId === 'ttt') {
            const players = [session.playerX, session.playerO].filter(Boolean);
            if (!players.includes(interaction.user.id)) {
                await replyEphemeral(interaction, 'يمكن لأحد لاعبي هذه الجولة إنهاؤها فقط.');
                return true;
            }
        } else if (interaction.user.id !== session.ownerId) {
            await replyEphemeral(interaction, 'هذه اللعبة تخص الشخص الذي بدأها.');
            return true;
        }

        session.finished = true;
        clearSession(messageId);
        await interaction.update({
            embeds: [gameEmbed('تم إنهاء اللعبة', `أنهى <@${interaction.user.id}> اللعبة. لم تُمنح مكافأة لإيقاف اللعبة قبل اكتمالها.`)],
            components: [],
            allowedMentions: { parse: [] },
        });
        return true;
    }

    if (session.gameId !== 'ttt' && interaction.user.id !== session.ownerId) {
        await replyEphemeral(interaction, 'هذه اللعبة تخص الشخص الذي بدأها.');
        return true;
    }

    const game = gamesById.get(session.gameId);
    if (!game) {
        clearSession(messageId);
        await replyEphemeral(interaction, 'لم تعد هذه اللعبة متاحة. افتح /play من جديد.');
        return true;
    }

    session.busy = true;
    try {
        refreshExpiry(session);
        const result = game.handleAction(session, action, interaction.user.id);

        if (result?.error) {
            await replyEphemeral(interaction, result.error);
            return true;
        }

        await interaction.update(game.render(session));

        if (result?.completed || session.finished) {
            await notifyCompletion(session, options);
            clearSession(messageId);
        }

        return true;
    } finally {
        if (sessions.has(messageId)) session.busy = false;
    }
}

function registerPlayExtras(client, options = {}) {
    if (!client || typeof client.on !== 'function') {
        throw new TypeError('registerPlayExtras requires a Discord.js client.');
    }

    if (registeredClients.has(client)) return () => {};
    registeredClients.add(client);

    const onInteraction = async interaction => {
        try {
            await handlePlayExtrasInteraction(interaction, {
                ...options,
                logger: options.logger || console,
            });
        } catch (error) {
            (options.logger || console).error?.('Play extras interaction failed.', error);
            if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'حدث خطأ أثناء تشغيل اللعبة. جرّب فتح /play من جديد.',
                    ephemeral: true,
                }).catch(() => {});
            }
        }
    };

    client.on('interactionCreate', onInteraction);
    return () => {
        client.off('interactionCreate', onInteraction);
        registeredClients.delete(client);
    };
}

module.exports = {
    GAME_DEFINITIONS: definitions,
    buildExtraGamesRow: buildExtraGamesRowForPlay,
    startGameFromSelection,
    handlePlayExtrasInteraction,
    registerPlayExtras,
};
