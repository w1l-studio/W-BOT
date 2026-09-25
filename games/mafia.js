const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require("discord.js");

const games = new Map();

const COLORS = {
    RED: 0xFF0000,
    BLUE: 0x0000FF,
    BLACK: 0x000000,
    WHITE: 0xFFFFFF,
    GREEN: 0x00FF7F,
    GOLD: 0xFFD700
};

const MIN_PLAYERS = 7;
const MAX_PLAYERS = 20;

const NIGHT_TIME = 60 * 1000;          // دقيقة
const DISCUSSION_TIME = 3 * 60 * 1000; // 3 دقائق
const VOTE_TIME = 60 * 1000;           // دقيقة
const INTERMISSION_TIME = 5 * 1000;    // فاصل بين الجولات

// ======================================================
// COMMAND
// ======================================================

const mafiaCommand = new SlashCommandBuilder()
    .setName("mafia")
    .setDescription("لعبة المافيا")
    .addSubcommand(sub =>
        sub
            .setName("start")
            .setDescription("إنشاء لعبة مافيا")
    );

// ======================================================
// HELPERS - GENERAL
// ======================================================

function createEmbed(title, description, color = COLORS.BLUE) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: "W BOT • Mafia Game" })
        .setTimestamp();
}

function getGame(guildId) {
    return games.get(guildId);
}

function alivePlayers(game) {
    return [...game.players.values()].filter(p => p.alive);
}

function isAlive(game, userId) {
    const player = game.players.get(userId);
    return !!player && player.alive;
}

function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes <= 0) {
        return `${seconds} ثانية`;
    }

    return `${minutes} دقيقة و ${seconds} ثانية`;
}

// Clears any pending phase timer to guarantee only one timer ever runs per game.
function clearGameTimer(game) {
    if (game.timer) {
        clearTimeout(game.timer);
        game.timer = null;
    }
}

// Safely replies to (or follows up on) an interaction so nothing ever
// surfaces as "This interaction failed" to the user.
async function safeReply(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch {
        // Interaction likely expired/already acknowledged elsewhere — ignore.
    }
}

async function safeDeferUpdate(interaction) {
    try {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }
    } catch {}
}

async function safeSend(channel, payload) {
    try {
        return await channel.send(payload);
    } catch {
        return null;
    }
}

async function safeDM(user, payload) {
    try {
        return await user.send(payload);
    } catch {
        return null;
    }
}

async function safeEditMessage(message, payload) {
    if (!message) return;
    try {
        await message.edit(payload);
    } catch {}
}

// ======================================================
// ROLE BALANCING (7 -> 20 players)
// ======================================================

function getRoleCounts(playerCount) {
    // Mafia scales roughly to ~1/4 of the lobby, always leaving the
    // civilian/investigative side with a majority.
    let mafia = 2;

    if (playerCount >= 9) mafia = 3;
    if (playerCount >= 13) mafia = 4;
    if (playerCount >= 17) mafia = 5;

    let detective = 1;
    let doctor = 1;

    if (playerCount >= 12) detective = 2;
    if (playerCount >= 16) doctor = 2;

    // Safety net: never let special roles eat more than ~70% of the lobby.
    while (mafia + detective + doctor > Math.floor(playerCount * 0.7)) {
        if (doctor > 1) doctor--;
        else if (detective > 1) detective--;
        else if (mafia > 2) mafia--;
        else break;
    }

    const civilian = playerCount - mafia - detective - doctor;

    return { mafia, detective, doctor, civilian };
}

function assignRoles(game) {
    const users = [...game.players.values()];
    const counts = getRoleCounts(users.length);
    const roles = [];

    for (let i = 0; i < counts.mafia; i++) roles.push("mafia");
    for (let i = 0; i < counts.detective; i++) roles.push("detective");
    for (let i = 0; i < counts.doctor; i++) roles.push("doctor");
    while (roles.length < users.length) roles.push("civilian");

    // Fisher-Yates shuffle
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    users.forEach((player, index) => {
        player.role = roles[index];
    });
}

function roleName(role) {
    switch (role) {
        case "mafia": return "🔪 المافيا";
        case "detective": return "🕵️ المحقق";
        case "doctor": return "👨‍⚕️ الطبيب";
        default: return "👤 مواطن";
    }
}

function roleDescription(role) {
    switch (role) {
        case "mafia":
            return (
                "أنت من **المافيا** 🔪\n\n" +
                "في كل ليلة تختارون هدفًا معًا لقتله.\n" +
                "هدفكم التخلص من جميع الأبرياء."
            );
        case "detective":
            return (
                "أنت **المحقق** 🕵️\n\n" +
                "في كل ليلة يمكنك فحص لاعب واحد " +
                "لمعرفة هل هو من المافيا أم لا."
            );
        case "doctor":
            return (
                "أنت **الطبيب** 👨‍⚕️\n\n" +
                "في كل ليلة تختار لاعبًا واحدًا لحمايته من القتل " +
                "(لا يمكنك حماية نفسك)."
            );
        default:
            return (
                "أنت **مواطن** 👤\n\n" +
                "ليس لديك قدرة خاصة.\n" +
                "ساعد المدينة في اكتشاف المافيا."
            );
    }
}

function checkWinner(game) {
    const alive = alivePlayers(game);
    const mafia = alive.filter(p => p.role === "mafia").length;
    const civilians = alive.filter(p => p.role !== "mafia").length;

    if (mafia === 0) return "civilians";
    if (mafia >= civilians) return "mafia";
    return null;
}

async function endGame(game, winner) {
    if (!game) return;

    clearGameTimer(game);
    games.delete(game.guildId);

    const winnerText = winner === "mafia"
        ? "🔪 **فريق المافيا فاز!**"
        : "🕵️ **فريق المواطنين فاز!**";

    const mafiaList = [...game.players.values()]
        .filter(p => p.role === "mafia")
        .map(p => `• ${p.user.username}`)
        .join("\n") || "لا يوجد";

    const townList = [...game.players.values()]
        .filter(p => p.role !== "mafia")
        .map(p => `• ${p.user.username} — ${roleName(p.role)}`)
        .join("\n") || "لا يوجد";

    const duration = game.startedAt
        ? formatDuration(Date.now() - game.startedAt)
        : null;

    const description =
        `${winnerText}\n\n` +
        `👥 عدد اللاعبين: **${game.players.size}**\n` +
        (duration ? `⏱️ مدة اللعبة: **${duration}**\n` : "") +
        `\n**🔪 فريق المافيا**\n${mafiaList}\n\n` +
        `**🕵️ فريق المواطنين**\n${townList}`;

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                "🏆 انتهت لعبة المافيا",
                description,
                winner === "mafia" ? COLORS.RED : COLORS.BLUE
            )
        ]
    });
}

// ======================================================
// SEND ROLE
// ======================================================

async function sendRole(player, game) {
    let extra = "";

    if (player.role === "mafia") {
        const teammates = [...game.players.values()]
            .filter(p => p.role === "mafia" && p.user.id !== player.user.id)
            .map(p => `• ${p.user.username}`)
            .join("\n");

        if (teammates) {
            extra = `\n\n**👥 زملاؤك في المافيا:**\n${teammates}`;
        }
    }

    const embed = createEmbed(
        "🎭 دورك في المافيا",
        roleDescription(player.role) + extra +
        `\n\n👥 عدد اللاعبين: **${game.players.size}**`,
        player.role === "mafia" ? COLORS.RED : COLORS.BLUE
    );

    const sent = await safeDM(player.user, { embeds: [embed] });
    return !!sent;
}

// ======================================================
// NIGHT ACTION MENU
// ======================================================

async function sendNightMenu(player, game) {
    const targets = alivePlayers(game).filter(target => {
        if (target.user.id === player.user.id) return false;

        // Mafia can't target other mafia members.
        if (player.role === "mafia" && target.role === "mafia") return false;

        return true;
    });

    if (!targets.length) return;

    let placeholder = "اختر لاعبًا";
    if (player.role === "mafia") placeholder = "اختر من تريد قتله";
    if (player.role === "doctor") placeholder = "اختر من تريد حمايته";
    if (player.role === "detective") placeholder = "اختر من تريد التحقيق معه";

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`mafia_night_${game.guildId}`)
        .setPlaceholder(placeholder)
        .addOptions(
            targets.map(target => ({
                label: target.user.username.slice(0, 100),
                value: target.user.id,
                description: "اختيار هذا اللاعب"
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    const message = await safeDM(player.user, {
        content: "🌙 **بدأ الليل**\nاختر هدفك خلال الوقت المتاح:",
        components: [row]
    });

    // Track the DM so we can edit it once the player confirms a choice,
    // and so we know not to resend the same menu twice.
    if (message) {
        game.nightMessages.set(player.user.id, message);
    }
}

// ======================================================
// NIGHT
// ======================================================

async function startNight(game) {
    if (!games.has(game.guildId)) return;

    const winner = checkWinner(game);
    if (winner) {
        await endGame(game, winner);
        return;
    }

    game.phase = "night";
    game.round += 1;

    game.mafiaVotes.clear();
    game.detectiveTargets.clear();
    game.doctorTarget = null;
    game.nightMessages.clear();
    game.nightActed.clear();

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                `🌙 الليلة ${game.round}`,
                "الجميع يدخل وضع الصمت.\n\n" +
                "🔪 المافيا تختار هدفها.\n" +
                "👨‍⚕️ الطبيب يختار من يحمي.\n" +
                "🕵️ المحقق يختار من يفحص.\n\n" +
                `تم إرسال الخيارات في الخاص.\n⏱️ الوقت: **${NIGHT_TIME / 1000} ثانية**`,
                COLORS.BLACK
            )
        ]
    });

    for (const player of alivePlayers(game)) {
        if (["mafia", "doctor", "detective"].includes(player.role)) {
            await sendNightMenu(player, game);
        }
    }

    clearGameTimer(game);
    game.timer = setTimeout(() => finishNight(game), NIGHT_TIME);
}

// ======================================================
// FINISH NIGHT
// ======================================================

function resolveMafiaTarget(game) {
    if (game.mafiaVotes.size === 0) return null;

    const counts = {};
    for (const targetId of game.mafiaVotes.values()) {
        counts[targetId] = (counts[targetId] || 0) + 1;
    }

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topVotes = entries[0][1];
    const tied = entries.filter(e => e[1] === topVotes);

    // A tie among mafia targets results in no kill.
    if (tied.length > 1) return null;

    return entries[0][0];
}

async function finishNight(game) {
    if (!games.has(game.guildId)) return;

    game.timer = null;

    const killedUserId = resolveMafiaTarget(game);
    const saved = game.doctorTarget;

    let message = "☀️ **أشرقت الشمس!**\n\n";
    let victimUsername = null;

    if (killedUserId && killedUserId !== saved) {
        const victim = game.players.get(killedUserId);

        if (victim && victim.alive) {
            victim.alive = false;
            victimUsername = victim.user.username;
            message += `💀 تم العثور على **${victim.user.username}** مقتولًا.\n`;
        } else {
            message += "✨ لم يمت أحد الليلة.\n";
        }
    } else {
        message += "✨ لم يمت أحد الليلة.\n";
    }

    const winner = checkWinner(game);

    if (winner) {
        await safeSend(game.channel, {
            embeds: [createEmbed("☀️ نتيجة الليل", message, COLORS.RED)]
        });

        await endGame(game, winner);
        return;
    }

    game.phase = "discussion";

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                "☀️ صباح الخير",
                message +
                `\n\n🗣️ أمامكم **${DISCUSSION_TIME / 60000} دقائق** للنقاش.\n` +
                `بعدها يبدأ التصويت مباشرة.`,
                COLORS.WHITE
            )
        ]
    });

    clearGameTimer(game);
    game.timer = setTimeout(() => startVoting(game), DISCUSSION_TIME);
}

// ======================================================
// VOTING
// ======================================================

async function startVoting(game) {
    if (!games.has(game.guildId)) return;

    game.phase = "voting";
    game.votes.clear();

    const players = alivePlayers(game);
    if (!players.length) return;

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`mafia_vote_${game.guildId}`)
        .setPlaceholder("اختر الشخص الذي تريد التصويت ضده")
        .addOptions(
            players.map(player => ({
                label: player.user.username.slice(0, 100),
                value: player.user.id,
                description: "التصويت لخروج هذا اللاعب"
            }))
        );

    const row = new ActionRowBuilder().addComponents(menu);

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                "🗳️ بدأ التصويت",
                "اختر اللاعب الذي تريد التصويت ضده.\n" +
                "لن تُعلن الأصوات إلا بعد انتهاء الوقت.\n\n" +
                `🕐 وقت التصويت: **${VOTE_TIME / 1000} ثانية**`,
                COLORS.BLUE
            )
        ],
        components: [row]
    });

    clearGameTimer(game);
    game.timer = setTimeout(() => finishVoting(game), VOTE_TIME);
}

// ======================================================
// FINISH VOTING
// ======================================================

async function finishVoting(game) {
    if (!games.has(game.guildId)) return;

    game.timer = null;

    const counts = {};
    for (const targetId of game.votes.values()) {
        counts[targetId] = (counts[targetId] || 0) + 1;
    }

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    const tally = entries.length
        ? entries.map(([id, count]) => {
            const p = game.players.get(id);
            const name = p ? p.user.username : "لاعب غير معروف";
            return `• ${name}: **${count}** صوت`;
        }).join("\n")
        : "لم يصوت أحد.";

    let message = `**📊 نتائج الأصوات:**\n${tally}\n\n`;

    if (!entries.length) {
        message += "⚖️ لم يصوت أحد. لم يخرج أي لاعب.";
    } else {
        const topVotes = entries[0][1];
        const tied = entries.filter(e => e[1] === topVotes);

        if (tied.length > 1) {
            message += "⚖️ حدث تعادل في التصويت. لم يخرج أي لاعب.";
        } else {
            const eliminatedId = entries[0][0];
            const eliminated = game.players.get(eliminatedId);

            if (eliminated) {
                eliminated.alive = false;
                message += `🚪 تم إخراج **${eliminated.user.username}**.\n` +
                    `🎭 دوره كان: **${roleName(eliminated.role)}**`;
            }
        }
    }

    const winner = checkWinner(game);

    if (winner) {
        await safeSend(game.channel, {
            embeds: [createEmbed("🗳️ نتيجة التصويت", message, COLORS.RED)]
        });

        await endGame(game, winner);
        return;
    }

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                "🗳️ نتيجة التصويت",
                message + `\n\n🌙 تستعدون الآن لليل جديد...`,
                COLORS.BLUE
            )
        ]
    });

    clearGameTimer(game);
    game.timer = setTimeout(() => startNight(game), INTERMISSION_TIME);
}

// ======================================================
// START GAME
// ======================================================

async function startGame(game) {
    if (!games.has(game.guildId)) return;

    if (game.players.size < MIN_PLAYERS) {
        await safeSend(game.channel, {
            embeds: [
                createEmbed(
                    "❌ لا يمكن بدء اللعبة",
                    `الحد الأدنى هو **${MIN_PLAYERS} لاعبين**.`,
                    COLORS.RED
                )
            ]
        });
        return;
    }

    assignRoles(game);

    for (const player of game.players.values()) {
        const sent = await sendRole(player, game);

        if (!sent) {
            await safeSend(game.channel, {
                embeds: [
                    createEmbed(
                        "❌ تعذر بدء اللعبة",
                        `لم أستطع إرسال الدور الخاص إلى **${player.user.username}**.\n` +
                        "تأكد أن الرسائل الخاصة مفتوحة.",
                        COLORS.RED
                    )
                ]
            });

            games.delete(game.guildId);
            return;
        }
    }

    const counts = getRoleCounts(game.players.size);

    game.phase = "starting";
    game.startedAt = Date.now();

    await safeSend(game.channel, {
        embeds: [
            createEmbed(
                "🎭 بدأت لعبة المافيا",
                `👥 عدد اللاعبين: **${game.players.size}**\n\n` +
                `🔪 المافيا: **${counts.mafia}**\n` +
                `🕵️ المحقق: **${counts.detective}**\n` +
                `👨‍⚕️ الطبيب: **${counts.doctor}**\n` +
                `👤 المواطنون: **${counts.civilian}**\n\n` +
                `🎭 تم إرسال الأدوار في الخاص.\n` +
                `🌙 أول ليلة تبدأ الآن.`,
                COLORS.RED
            )
        ]
    });

    clearGameTimer(game);
    game.timer = setTimeout(() => startNight(game), INTERMISSION_TIME);
}

// ======================================================
// CREATE GAME
// ======================================================

async function createGame(interaction) {
    if (games.has(interaction.guild.id)) {
        await safeReply(interaction, {
            content: "❌ توجد لعبة مافيا شغالة حاليًا في هذا السيرفر.",
            ephemeral: true
        });
        return;
    }

    const game = {
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        channel: interaction.channel,
        hostId: interaction.user.id,
        players: new Map(),
        phase: "lobby",
        round: 0,
        startedAt: null,

        votes: new Map(),
        mafiaVotes: new Map(),
        detectiveTargets: new Map(),
        doctorTarget: null,

        nightMessages: new Map(), // userId -> DM message (for edit-on-confirm)
        nightActed: new Set(),    // userIds that already locked in a night action

        timer: null,
        lobbyMessage: null
    };

    game.players.set(interaction.user.id, {
        user: interaction.user,
        alive: true,
        role: null
    });

    games.set(interaction.guild.id, game);

    const embed = createEmbed(
        "🎭 لعبة المافيا",
        "تم إنشاء لعبة جديدة!\n\n" +
        `👥 اللاعبين: **1/${MAX_PLAYERS}**\n` +
        `📌 الحد الأدنى للبدء: **${MIN_PLAYERS}**\n\n` +
        "اضغط **دخول اللعبة** للانضمام.\n" +
        "منشئ اللعبة فقط يستطيع الضغط على **بدء اللعبة**.",
        COLORS.RED
    );

    const row = buildLobbyRow(game);

    await interaction.reply({ embeds: [embed], components: [row] });
    game.lobbyMessage = await interaction.fetchReply();
}

// ======================================================
// LOBBY UI
// ======================================================

function buildLobbyRow(game) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`mafia_join_${game.guildId}`)
            .setLabel("دخول اللعبة")
            .setEmoji("🎭")
            .setStyle(ButtonStyle.Success)
            .setDisabled(game.players.size >= MAX_PLAYERS),

        new ButtonBuilder()
            .setCustomId(`mafia_leave_${game.guildId}`)
            .setLabel("خروج")
            .setEmoji("🚪")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId(`mafia_start_${game.guildId}`)
            .setLabel("بدء اللعبة")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(game.players.size < MIN_PLAYERS)
    );
}

async function updateLobby(game) {
    const names = [...game.players.values()]
        .map((player, index) => {
            const hostTag = player.user.id === game.hostId ? " 👑" : "";
            return `${index + 1}. <@${player.user.id}>${hostTag}`;
        })
        .join("\n");

    const embed = createEmbed(
        "🎭 لعبة المافيا",
        `👥 اللاعبين: **${game.players.size}/${MAX_PLAYERS}**\n\n` +
        `${names || "لا يوجد لاعبون"}\n\n` +
        `📌 تحتاج **${MIN_PLAYERS}** لاعبين على الأقل للبدء.`,
        COLORS.RED
    );

    const row = buildLobbyRow(game);

    await safeEditMessage(game.lobbyMessage, { embeds: [embed], components: [row] });
}

// ======================================================
// INTERACTION HANDLER
// ======================================================

async function handleMafiaInteraction(interaction) {
    // -----------------------------------------------
    // SLASH COMMAND
    // -----------------------------------------------
    if (interaction.isChatInputCommand() && interaction.commandName === "mafia") {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "start") {
            await createGame(interaction);
            return true;
        }
    }

    // -----------------------------------------------
    // BUTTONS
    // -----------------------------------------------
    if (interaction.isButton() && interaction.customId.startsWith("mafia_")) {
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const guildId = parts[2];
        const game = games.get(guildId);

        if (!game) {
            await safeReply(interaction, {
                content: "❌ هذه اللعبة انتهت أو لم تعد موجودة.",
                ephemeral: true
            });
            return true;
        }

        // JOIN
        if (action === "join") {
            if (game.phase !== "lobby") {
                await safeReply(interaction, { content: "❌ اللعبة بدأت بالفعل.", ephemeral: true });
                return true;
            }

            if (game.players.has(interaction.user.id)) {
                await safeReply(interaction, { content: "✅ أنت داخل اللعبة بالفعل.", ephemeral: true });
                return true;
            }

            if (game.players.size >= MAX_PLAYERS) {
                await safeReply(interaction, { content: "❌ اللعبة ممتلئة.", ephemeral: true });
                return true;
            }

            game.players.set(interaction.user.id, {
                user: interaction.user,
                alive: true,
                role: null
            });

            await safeReply(interaction, { content: "✅ دخلت لعبة المافيا.", ephemeral: true });
            await updateLobby(game);
            return true;
        }

        // LEAVE
        if (action === "leave") {
            if (game.phase !== "lobby") {
                await safeReply(interaction, { content: "❌ لا يمكنك الخروج بعد بدء اللعبة.", ephemeral: true });
                return true;
            }

            if (!game.players.has(interaction.user.id)) {
                await safeReply(interaction, { content: "❌ أنت لست داخل اللعبة.", ephemeral: true });
                return true;
            }

            const wasHost = interaction.user.id === game.hostId;
            game.players.delete(interaction.user.id);

            await safeReply(interaction, { content: "🚪 خرجت من اللعبة.", ephemeral: true });

            if (game.players.size === 0) {
                games.delete(game.guildId);

                await safeEditMessage(game.lobbyMessage, {
                    embeds: [createEmbed("❌ انتهت اللعبة", "خرج جميع اللاعبين.", COLORS.RED)],
                    components: []
                });

                return true;
            }

            // Host migration instead of cancelling the lobby.
            if (wasHost) {
                const newHost = [...game.players.values()][0];
                game.hostId = newHost.user.id;

                await safeSend(game.channel, {
                    embeds: [
                        createEmbed(
                            "👑 تغيير المضيف",
                            `أصبح <@${newHost.user.id}> هو مضيف اللعبة الجديد.`,
                            COLORS.GOLD
                        )
                    ]
                });
            }

            await updateLobby(game);
            return true;
        }

        // START
        if (action === "start") {
            if (interaction.user.id !== game.hostId) {
                await safeReply(interaction, { content: "❌ فقط منشئ اللعبة يستطيع بدءها.", ephemeral: true });
                return true;
            }

            if (game.phase !== "lobby") {
                await safeReply(interaction, { content: "❌ اللعبة بدأت بالفعل.", ephemeral: true });
                return true;
            }

            if (game.players.size < MIN_PLAYERS) {
                await safeReply(interaction, {
                    content: `❌ تحتاج على الأقل **${MIN_PLAYERS} لاعبين**.`,
                    ephemeral: true
                });
                return true;
            }

            await safeDeferUpdate(interaction);
            await startGame(game);
            return true;
        }
    }

    // -----------------------------------------------
    // NIGHT SELECT
    // -----------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("mafia_night_")) {
        const guildId = interaction.customId.replace("mafia_night_", "");
        const game = games.get(guildId);

        if (!game) {
            await safeReply(interaction, { content: "❌ اللعبة انتهت.", ephemeral: true });
            return true;
        }

        if (game.phase !== "night") {
            await safeReply(interaction, { content: "❌ ليس وقت اختيار هدف الآن.", ephemeral: true });
            return true;
        }

        const player = game.players.get(interaction.user.id);

        if (!player || !player.alive) {
            await safeReply(interaction, { content: "❌ أنت لست لاعبًا حيًا.", ephemeral: true });
            return true;
        }

        // Lock the choice once confirmed for this night — no changing mid-round.
        if (game.nightActed.has(interaction.user.id)) {
            await safeReply(interaction, {
                content: "✅ لقد سجّلت اختيارك بالفعل لهذه الليلة.",
                ephemeral: true
            });
            return true;
        }

        const targetId = interaction.values[0];
        const target = game.players.get(targetId);

        if (!target || !target.alive) {
            await safeReply(interaction, { content: "❌ هذا اللاعب غير متاح.", ephemeral: true });
            return true;
        }

        if (player.role === "mafia" && target.role === "mafia") {
            await safeReply(interaction, {
                content: "❌ لا يمكنك استهداف زميلك في المافيا.",
                ephemeral: true
            });
            return true;
        }

        let confirmText = "";

        if (player.role === "mafia") {
            game.mafiaVotes.set(interaction.user.id, targetId);
            confirmText = `🔪 تم اختيار **${target.user.username}** كهدف.`;
        } else if (player.role === "doctor") {
            game.doctorTarget = targetId;
            confirmText = `👨‍⚕️ ستحمي **${target.user.username}** الليلة.`;
        } else if (player.role === "detective") {
            game.detectiveTargets.set(interaction.user.id, targetId);
            const result = target.role === "mafia"
                ? "🔪 نعم، هذا اللاعب من المافيا."
                : "✅ لا، هذا اللاعب ليس من المافيا.";
            confirmText = `أنت حققت في **${target.user.username}**.\n\n${result}`;
        }

        game.nightActed.add(interaction.user.id);

        await safeDeferUpdate(interaction);

        // Edit the original DM in place so the menu can't be reused, and to
        // clearly show the confirmation instead of just an ephemeral reply.
        const dmMessage = game.nightMessages.get(interaction.user.id);

        if (dmMessage) {
            await safeEditMessage(dmMessage, {
                content: "✅ **تم تسجيل اختيارك.**",
                embeds: player.role === "detective"
                    ? [createEmbed("🕵️ نتيجة التحقيق", confirmText, COLORS.BLUE)]
                    : [],
                components: []
            });
        }

        if (player.role !== "detective") {
            await safeDM(player.user, { content: confirmText });
        }

        return true;
    }

    // -----------------------------------------------
    // VOTE SELECT
    // -----------------------------------------------
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("mafia_vote_")) {
        const guildId = interaction.customId.replace("mafia_vote_", "");
        const game = games.get(guildId);

        if (!game) {
            await safeReply(interaction, { content: "❌ اللعبة انتهت.", ephemeral: true });
            return true;
        }

        if (game.phase !== "voting") {
            await safeReply(interaction, { content: "❌ ليس وقت التصويت.", ephemeral: true });
            return true;
        }

        if (!isAlive(game, interaction.user.id)) {
            await safeReply(interaction, { content: "❌ اللاعب الميت لا يستطيع التصويت.", ephemeral: true });
            return true;
        }

        const targetId = interaction.values[0];

        if (targetId === interaction.user.id) {
            await safeReply(interaction, { content: "❌ لا يمكنك التصويت لنفسك.", ephemeral: true });
            return true;
        }

        if (!isAlive(game, targetId)) {
            await safeReply(interaction, { content: "❌ هذا اللاعب غير متاح.", ephemeral: true });
            return true;
        }

        game.votes.set(interaction.user.id, targetId);

        const target = game.players.get(targetId);

        await safeReply(interaction, {
            content: `🗳️ تم تسجيل تصويتك ضد **${target.user.username}**. (لن يظهر تصويتك للآخرين حتى انتهاء الوقت)`,
            ephemeral: true
        });

        return true;
    }

    return false;
}

module.exports = {
    createGame,
    handleInteraction: handleMafiaInteraction
};

