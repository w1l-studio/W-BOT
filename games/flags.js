const { EmbedBuilder } = require("discord.js");
const countries = require("./data/countries.js");

// ======================================================
// STATE
// ======================================================
// Keyed by channelId — the game is scoped to the channel it started in.
const activeGames = new Map();

const COLORS = {
    BLUE: 0x0000FF,
    GREEN: 0x00FF7F,
    GOLD: 0xFFD700,
    RED: 0xFF0000
};

const ROUND_TIME = 60 * 1000; // 60 ثانية لكل علم

// ======================================================
// HELPERS
// ======================================================

function createEmbed(title, description, color = COLORS.BLUE) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: "W BOT • Flags Game" })
        .setTimestamp();
}

function isChannelBusy(channelId) {
    return activeGames.has(channelId);
}

// Normalizes text for comparison: lowercases, strips diacritics/tatweel,
// removes "ال" prefix, unifies alef/ta marbuta variants, strips punctuation
// and all whitespace. This lets "Saudi Arabia", "SaudiArabia", "السعودية"
// and "سعوديه" all match the same country without accepting unrelated names.
function normalize(text) {
    if (!text) return "";

    return text
        .toString()
        .trim()
        .toLowerCase()
        // Arabic diacritics
        .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
        // Unify alef forms
        .replace(/[إأآا]/g, "ا")
        // Unify ta marbuta / ha
        .replace(/ة/g, "ه")
        // Unify ya forms
        .replace(/ى/g, "ي")
        // Drop leading "ال" (definite article) once
        .replace(/^ال/, "")
        // Strip punctuation/symbols (keep letters/numbers/arabic/spaces)
        .replace(/[^\p{L}\p{N}\s]/gu, "")
        // Collapse all whitespace
        .replace(/\s+/g, "");
}

// Builds a lookup map once: normalized string -> country object.
function buildLookup() {
    const map = new Map();

    for (const country of countries) {
        const candidates = [
            country.name_ar,
            country.name_en,
            ...(country.aliases || [])
        ];

        for (const candidate of candidates) {
            const key = normalize(candidate);
            if (key && !map.has(key)) {
                map.set(key, country);
            }
        }
    }

    return map;
}

const answerLookup = buildLookup();

function matchCountry(rawInput) {
    const key = normalize(rawInput);
    if (!key) return null;
    return answerLookup.get(key) || null;
}

function isSkipCommand(rawInput) {
    const key = normalize(rawInput);
    return key === "skip" || key === "سكب";
}

// Picks a random country, avoiding immediate repeats within the session
// and avoiding the just-skipped/just-shown flag directly.
function pickRandomCountry(game) {
    let pool = countries.filter(c => c.name_en !== game.lastFlag);

    // If the session has shown almost everything, allow repeats again
    // (excluding only the immediate last one) to keep the game going.
    if (pool.length === 0) {
        pool = countries.filter(c => c.name_en !== game.lastFlag) || countries;
    }

    const country = pool[Math.floor(Math.random() * pool.length)];
    game.lastFlag = country.name_en;
    return country;
}

// ======================================================
// CLEANUP
// ======================================================

function cleanupGame(channelId) {
    const game = activeGames.get(channelId);
    if (!game) return;

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    if (game.collector) {
        game.collector.stop();
        game.collector = null;
    }

    activeGames.delete(channelId);
}

// ======================================================
// ROUND FLOW
// ======================================================

async function sendFlag(game) {
    const country = pickRandomCountry(game);

    game.currentCountry = country;
    game.roundActive = true;
    game.startedAt = Date.now();

    await game.channel.send({
        embeds: [
            createEmbed(
                "🏳️ خمن الدولة!",
                `${country.flag}\n\n` +
                "اكتب اسم الدولة في الشات (عربي أو إنجليزي).\n" +
                "⏭️ إذا ما عرفت، اكتب `skip` أو `سكب`\n\n" +
                `⏱️ الوقت المتاح: **${ROUND_TIME / 1000} ثانية**`,
                COLORS.BLUE
            )
        ]
    });

    // Reset the round timer — guarantees only one timer per round ever runs.
    if (game.timer) clearTimeout(game.timer);
    game.timer = setTimeout(() => handleTimeout(game), ROUND_TIME);
}

async function handleTimeout(game) {
    if (!activeGames.has(game.channel.id)) return;
    if (!game.roundActive) return; // already resolved by an answer/skip

    game.roundActive = false;
    game.timer = null;

    const country = game.currentCountry;

    await game.channel.send({
        embeds: [
            createEmbed(
                "⏱️ انتهى الوقت!",
                `${country.flag} الإجابة الصحيحة كانت: **${country.name_ar} (${country.name_en})**\n\n` +
                "🏳️ نروح لعلم جديد...",
                COLORS.GOLD
            )
        ]
    });

    await sendFlag(game);
}

async function handleSkip(game, message) {
    game.roundActive = false;

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    await message.channel.send({
        embeds: [createEmbed("⏭️ تم تخطي العلم!", "نروح لعلم جديد...", COLORS.GOLD)]
    });

    await sendFlag(game);
}

async function handleCorrectAnswer(game, message, country) {
    game.roundActive = false;

    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }

    const elapsedMs = Date.now() - game.startedAt;
    const elapsedSeconds = (elapsedMs / 1000).toFixed(2);

    await message.channel.send({
        embeds: [
            createEmbed(
                "🎉 إجابة صحيحة!",
                `كفو عليك يا <@${message.author.id}>!\n\n` +
                `🏳️ الإجابة الصحيحة: **${country.name_ar}**\n` +
                `⏱️ جاوبت خلال **${elapsedSeconds} ثانية**`,
                COLORS.GREEN
            )
        ]
    });

    await sendFlag(game);
}

// ======================================================
// START GAME
// ======================================================

async function startFlagsGame(interactionOrMessage) {
    const channel = interactionOrMessage.channel;
    const guild = interactionOrMessage.guild;

    if (isChannelBusy(channel.id)) {
        const payload = {
            content: "❌ توجد لعبة تخمين أعلام شغالة بالفعل في هذه القناة.",
            ephemeral: true
        };

        if (typeof interactionOrMessage.reply === "function") {
            await interactionOrMessage.reply(payload).catch(() => {});
        }

        return;
    }

    const game = {
        channelId: channel.id,
        channel,
        guildId: guild ? guild.id : null,
        currentCountry: null,
        lastFlag: null,
        roundActive: false,
        startedAt: null,
        timer: null,
        collector: null
    };

    activeGames.set(channel.id, game);

    await channel.send({
        embeds: [
            createEmbed(
                "🏳️ تخمين الأعلام",
                "خمن اسم الدولة من العلم!\n" +
                "⏭️ إذا ما عرفت، اكتب `skip` أو `سكب`",
                COLORS.BLUE
            )
        ]
    });

    // Collector filtered to this channel only, with no idle time limit
    // (the game itself manages rounds/timeouts). Cleared fully on cleanup.
    const collector = channel.createMessageCollector({
        filter: m => !m.author.bot
    });

    game.collector = collector;

    collector.on("collect", async (message) => {
        // If the game was cleaned up mid-flight, stop reacting entirely.
        if (!activeGames.has(channel.id)) return;

        const content = message.content;

        if (isSkipCommand(content)) {
            await handleSkip(game, message);
            return;
        }

        if (!game.roundActive) {
            // No round in flight (race between round transitions) — ignore silently.
            return;
        }

        const matched = matchCountry(content);

        if (!matched) {
            // Wrong/irrelevant answer — completely ignored, per spec.
            return;
        }

        if (matched.name_en !== game.currentCountry.name_en) {
            // Matched a different valid country than the current flag —
            // still wrong for this round, ignore silently.
            return;
        }

        await handleCorrectAnswer(game, message, matched);
    });

    await sendFlag(game);
}

function stopFlagsGame(channelId) {
    cleanupGame(channelId);
}

module.exports = {
    startFlagsGame,
    stopFlagsGame,
    isChannelBusy
};
