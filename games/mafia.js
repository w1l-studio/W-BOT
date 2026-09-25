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
    WHITE: 0xFFFFFF
};

const MIN_PLAYERS = 6;
const MAX_PLAYERS = 15;

const NIGHT_TIME = 60 * 1000;      // دقيقة
const DISCUSSION_TIME = 3 * 60 * 1000; // 3 دقائق
const VOTE_TIME = 60 * 1000;       // دقيقة


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
// HELPERS
// ======================================================

function createEmbed(title, description, color = COLORS.BLUE) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({
            text: "W BOT • Mafia Game"
        })
        .setTimestamp();
}


function getGame(guildId) {
    return games.get(guildId);
}


function alivePlayers(game) {
    return [...game.players.values()]
        .filter(player => player.alive);
}


function isAlive(game, userId) {
    const player = game.players.get(userId);

    return !!player && player.alive;
}


function getRoleCounts(playerCount) {
    let mafia = 2;
    let detective = 1;
    let doctor = 1;

    if (playerCount >= 10) {
        mafia = 3;
    }

    if (playerCount >= 13) {
        detective = 2;
    }

    const civilians =
        playerCount - mafia - detective - doctor;

    return {
        mafia,
        detective,
        doctor,
        civilian: civilians
    };
}


function assignRoles(game) {

    const users = [...game.players.values()];

    const roles = [];

    const counts =
        getRoleCounts(users.length);

    for (let i = 0; i < counts.mafia; i++) {
        roles.push("mafia");
    }

    for (let i = 0; i < counts.detective; i++) {
        roles.push("detective");
    }

    for (let i = 0; i < counts.doctor; i++) {
        roles.push("doctor");
    }

    while (roles.length < users.length) {
        roles.push("civilian");
    }

    // خلط الأدوار
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [roles[i], roles[j]] =
            [roles[j], roles[i]];
    }

    users.forEach((player, index) => {
        player.role = roles[index];
    });
}


function roleName(role) {

    switch (role) {

        case "mafia":
            return "🔪 المافيا";

        case "detective":
            return "🕵️ المحقق";

        case "doctor":
            return "👨‍⚕️ الطبيب";

        default:
            return "👤 مواطن";
    }
}


function roleDescription(role) {

    switch (role) {

        case "mafia":
            return (
                "أنت من **المافيا** 🔪\n\n" +
                "في الليل تختار شخصًا لقتله.\n" +
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
                "في كل ليلة تختار لاعبًا واحدًا لحمايته " +
                "من القتل."
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

    const alive =
        alivePlayers(game);

    const mafia =
        alive.filter(
            p => p.role === "mafia"
        ).length;

    const civilians =
        alive.filter(
            p => p.role !== "mafia"
        ).length;

    if (mafia === 0) {
        return "civilians";
    }

    if (mafia >= civilians) {
        return "mafia";
    }

    return null;
}


async function endGame(game, winner) {

    if (!game) return;

    if (game.timer) {
        clearTimeout(game.timer);
    }

    games.delete(game.guildId);

    const winnerText =
        winner === "mafia"
            ? "🔪 **فريق المافيا فاز!**"
            : "🕵️ **فريق المواطنين فاز!**";

    const roles = [...game.players.values()]
        .map(player =>
            `👤 ${player.user.username} → ${roleName(player.role)}`
        )
        .join("\n");

    await game.channel.send({
        embeds: [
            createEmbed(
                "🏆 انتهت لعبة المافيا",
                `${winnerText}\n\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `**الأدوار:**\n${roles}`,
                winner === "mafia"
                    ? COLORS.RED
                    : COLORS.BLUE
            )
        ]
    });
}


// ======================================================
// SEND ROLE
// ======================================================

async function sendRole(player, game) {

    try {

        const embed =
            createEmbed(
                "🎭 دورك في المافيا",
                roleDescription(player.role) +
                `\n\n` +
                `━━━━━━━━━━━━━━━━━━\n\n` +
                `👥 عدد اللاعبين: **${game.players.size}**`,
                player.role === "mafia"
                    ? COLORS.RED
                    : COLORS.BLUE
            );

        await player.user.send({
            embeds: [embed]
        });

        return true;

    } catch {

        return false;
    }
}


// ======================================================
// NIGHT ACTION MENU
// ======================================================

async function sendNightMenu(player, game) {

    const targets =
        alivePlayers(game)
            .filter(target =>
                target.user.id !== player.user.id
            );

    if (!targets.length) {
        return;
    }

    let placeholder = "اختر لاعبًا";

    if (player.role === "mafia") {
        placeholder = "اختر من تريد قتله";
    }

    if (player.role === "doctor") {
        placeholder = "اختر من تريد حمايته";
    }

    if (player.role === "detective") {
        placeholder = "اختر من تريد التحقيق معه";
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `mafia_night_${game.guildId}`
            )
            .setPlaceholder(
                placeholder
            )
            .addOptions(
                targets.map(target => ({
                    label: target.user.username.slice(0, 100),
                    value: target.user.id,
                    description: "اختيار هذا اللاعب"
                }))
            );

    const row =
        new ActionRowBuilder()
            .addComponents(menu);

    try {

        await player.user.send({
            content:
                "🌙 **بدأ الليل**\nاختر هدفك:",
            components: [row]
        });

    } catch {}
}


// ======================================================
// NIGHT
// ======================================================

async function startNight(game) {

    if (!games.has(game.guildId)) {
        return;
    }

    const winner =
        checkWinner(game);

    if (winner) {
        await endGame(game, winner);
        return;
    }

    game.phase = "night";

    game.mafiaVotes.clear();
    game.detectiveTarget = null;
    game.doctorTarget = null;

    await game.channel.send({
        embeds: [
            createEmbed(
                "🌙 بدأ الليل",
                "الجميع يدخل وضع الصمت.\n\n" +
                "🔪 المافيا تختار هدفها.\n" +
                "👨‍⚕️ الطبيب يختار من يحمي.\n" +
                "🕵️ المحقق يختار من يفحص.\n\n" +
                "تم إرسال الخيارات في الخاص.",
                COLORS.BLACK
            )
        ]
    });

    for (const player of alivePlayers(game)) {

        if (
            player.role === "mafia" ||
            player.role === "doctor" ||
            player.role === "detective"
        ) {

            await sendNightMenu(
                player,
                game
            );
        }
    }

    game.timer =
        setTimeout(
            () => finishNight(game),
            NIGHT_TIME
        );
}


// ======================================================
// FINISH NIGHT
// ======================================================

async function finishNight(game) {

    if (!games.has(game.guildId)) {
        return;
    }

    let killedUserId = null;

    if (game.mafiaVotes.size > 0) {

        const votes = {};

        for (
            const targetId
            of game.mafiaVotes.values()
        ) {

            votes[targetId] =
                (votes[targetId] || 0) + 1;
        }

        killedUserId =
            Object.entries(votes)
                .sort(
                    (a, b) =>
                        b[1] - a[1]
                )[0][0];
    }

    const saved =
        game.doctorTarget;

    let message =
        "☀️ **أشرقت الشمس!**\n\n";

    if (
        killedUserId &&
        killedUserId !== saved
    ) {

        const victim =
            game.players.get(
                killedUserId
            );

        if (victim) {

            victim.alive = false;

            message +=
                `💀 تم العثور على **${victim.user.username}** مقتولًا.\n`;

        }

    } else {

        message +=
            "✨ لم يمت أحد الليلة.\n";
    }

    const winner =
        checkWinner(game);

    if (winner) {

        await game.channel.send({
            embeds: [
                createEmbed(
                    "☀️ نتيجة الليل",
                    message,
                    COLORS.RED
                )
            ]
        });

        await endGame(
            game,
            winner
        );

        return;
    }

    game.phase = "discussion";

    await game.channel.send({
        embeds: [
            createEmbed(
                "☀️ صباح الخير",
                message +
                `\n\n` +
                `🗣️ أمامكم **3 دقائق** للنقاش.\n` +
                `بعدها يبدأ التصويت.`,
                COLORS.WHITE
            )
        ]
    });

    game.timer =
        setTimeout(
            () => startVoting(game),
            DISCUSSION_TIME
        );
}


// ======================================================
// VOTING
// ======================================================

async function startVoting(game) {

    if (!games.has(game.guildId)) {
        return;
    }

    game.phase = "voting";
    game.votes.clear();

    const players =
        alivePlayers(game);

    if (!players.length) {
        return;
    }

    const menu =
        new StringSelectMenuBuilder()
            .setCustomId(
                `mafia_vote_${game.guildId}`
            )
            .setPlaceholder(
                "اختر الشخص الذي تريد التصويت ضده"
            )
            .addOptions(
                players.map(player => ({
                    label:
                        player.user.username.slice(0, 100),
                    value:
                        player.user.id,
                    description:
                        "التصويت لخروج هذا اللاعب"
                }))
            );

    const row =
        new ActionRowBuilder()
            .addComponents(menu);

    await game.channel.send({
        embeds: [
            createEmbed(
                "🗳️ بدأ التصويت",
                "اختر اللاعب الذي تريد التصويت ضده.\n\n" +
                "🕐 وقت التصويت: **60 ثانية**",
                COLORS.BLUE
            )
        ],
        components: [row]
    });

    game.voteMessage =
        await game.channel.messages.fetch({
            limit: 1
        }).catch(() => null);

    game.timer =
        setTimeout(
            () => finishVoting(game),
            VOTE_TIME
        );
}


// ======================================================
// FINISH VOTING
// ======================================================

async function finishVoting(game) {

    if (!games.has(game.guildId)) {
        return;
    }

    const counts = {};

    for (
        const targetId
        of game.votes.values()
    ) {

        counts[targetId] =
            (counts[targetId] || 0) + 1;
    }

    const entries =
        Object.entries(counts)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );

    let message = "";

    if (!entries.length) {

        message =
            "⚖️ لم يصوت أحد.\n" +
            "لم يخرج أي لاعب.";

    } else {

        const topVotes =
            entries[0][1];

        const tied =
            entries.filter(
                entry =>
                    entry[1] === topVotes
            );

        if (tied.length > 1) {

            message =
                "⚖️ حدث تعادل في التصويت.\n" +
                "لم يخرج أي لاعب.";

        } else {

            const eliminatedId =
                entries[0][0];

            const eliminated =
                game.players.get(
                    eliminatedId
                );

            if (eliminated) {

                eliminated.alive = false;

                message =
                    `🚪 تم إخراج **${eliminated.user.username}**.\n\n` +
                    `🎭 دوره كان: **${roleName(eliminated.role)}**`;
            }
        }
    }

    const winner =
        checkWinner(game);

    if (winner) {

        await game.channel.send({
            embeds: [
                createEmbed(
                    "🗳️ نتيجة التصويت",
                    message,
                    COLORS.RED
                )
            ]
        });

        await endGame(
            game,
            winner
        );

        return;
    }

    await game.channel.send({
        embeds: [
            createEmbed(
                "🗳️ نتيجة التصويت",
                message +
                `\n\n🌙 تستعدون الآن لليل جديد...`,
                COLORS.BLUE
            )
        ]
    });

    game.timer =
        setTimeout(
            () => startNight(game),
            3000
        );
}


// ======================================================
// START GAME
// ======================================================

async function startGame(game) {

    if (!games.has(game.guildId)) {
        return;
    }

    if (
        game.players.size <
        MIN_PLAYERS
    ) {

        await game.channel.send({
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

        const sent =
            await sendRole(
                player,
                game
            );

        if (!sent) {

            await game.channel.send({
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

    const counts =
        getRoleCounts(
            game.players.size
        );

    game.phase = "starting";

    await game.channel.send({
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

    setTimeout(
        () => startNight(game),
        3000
    );
}


// ======================================================
// CREATE GAME
// ======================================================

async function createGame(interaction) {

    if (games.has(interaction.guild.id)) {

        await interaction.reply({
            content:
                "❌ توجد لعبة مافيا شغالة حاليًا في هذا السيرفر.",
            ephemeral: true
        });

        return;
    }

    const game = {

        guildId: interaction.guild.id,

        channelId:
            interaction.channel.id,

        channel:
            interaction.channel,

        hostId:
            interaction.user.id,

        players:
            new Map(),

        phase:
            "lobby",

        votes:
            new Map(),

        mafiaVotes:
            new Map(),

        detectiveTarget:
            null,

        doctorTarget:
            null,

        timer:
            null
    };

    game.players.set(
        interaction.user.id,
        {
            user: interaction.user,
            alive: true,
            role: null
        }
    );

    games.set(
        interaction.guild.id,
        game
    );

    const embed =
        createEmbed(
            "🎭 لعبة المافيا",
            "تم إنشاء لعبة جديدة!\n\n" +
            `👥 اللاعبين: **1/${MAX_PLAYERS}**\n` +
            `📌 الحد الأدنى للبدء: **${MIN_PLAYERS}**\n\n` +
            "اضغط **دخول اللعبة** للانضمام.\n" +
            "وعندما يكتمل العدد اضغط **بدء اللعبة**.",
            COLORS.RED
        );

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_join_${interaction.guild.id}`
                    )
                    .setLabel(
                        "دخول اللعبة"
                    )
                    .setEmoji("🎭")
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_leave_${interaction.guild.id}`
                    )
                    .setLabel(
                        "خروج"
                    )
                    .setEmoji("🚪")
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_start_${interaction.guild.id}`
                    )
                    .setLabel(
                        "بدء اللعبة"
                    )
                    .setEmoji("▶️")
                    .setStyle(
                        ButtonStyle.Primary
                    )

            );

    await interaction.reply({
        embeds: [embed],
        components: [row]
    });

    game.lobbyMessage =
        await interaction.fetchReply();
}


// ======================================================
// UPDATE LOBBY
// ======================================================

async function updateLobby(game) {

    const names =
        [...game.players.values()]
            .map(
                (player, index) =>
                    `${index + 1}. <@${player.user.id}>`
            )
            .join("\n");

    const embed =
        createEmbed(
            "🎭 لعبة المافيا",
            `👥 اللاعبين: **${game.players.size}/${MAX_PLAYERS}**\n\n` +
            `${names || "لا يوجد لاعبون"}\n\n` +
            `📌 تحتاج **${MIN_PLAYERS}** لاعبين على الأقل للبدء.`,
            COLORS.RED
        );

    const row =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_join_${game.guildId}`
                    )
                    .setLabel(
                        "دخول اللعبة"
                    )
                    .setEmoji("🎭")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setDisabled(
                        game.players.size >= MAX_PLAYERS
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_leave_${game.guildId}`
                    )
                    .setLabel(
                        "خروج"
                    )
                    .setEmoji("🚪")
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        `mafia_start_${game.guildId}`
                    )
                    .setLabel(
                        "بدء اللعبة"
                    )
                    .setEmoji("▶️")
                    .setStyle(
                        ButtonStyle.Primary
                    )

            );

    try {

        await game.lobbyMessage.edit({
            embeds: [embed],
            components: [row]
        });

    } catch {}
}


// ======================================================
// INTERACTION HANDLER
// ======================================================

async function handleMafiaInteraction(interaction) {

    // -----------------------------------------------
    // SLASH COMMAND
    // -----------------------------------------------

    if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "mafia"
    ) {

        const subcommand =
            interaction.options.getSubcommand();

        if (
            subcommand === "start"
        ) {

            await createGame(
                interaction
            );

            return true;
        }
    }


    // -----------------------------------------------
    // BUTTONS
    // -----------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId.startsWith("mafia_")
    ) {

        const parts =
            interaction.customId.split("_");

        const action =
            parts[1];

        const guildId =
            parts[2];

        const game =
            games.get(guildId);

        if (!game) {

            await interaction.reply({
                content:
                    "❌ هذه اللعبة انتهت.",
                ephemeral: true
            });

            return true;
        }


        // -------------------------
        // JOIN
        // -------------------------

        if (
            action === "join"
        ) {

            if (
                game.phase !== "lobby"
            ) {

                await interaction.reply({
                    content:
                        "❌ اللعبة بدأت بالفعل.",
                    ephemeral: true
                });

                return true;
            }

            if (
                game.players.has(
                    interaction.user.id
                )
            ) {

                await interaction.reply({
                    content:
                        "✅ أنت داخل اللعبة بالفعل.",
                    ephemeral: true
                });

                return true;
            }

            if (
                game.players.size >= MAX_PLAYERS
            ) {

                await interaction.reply({
                    content:
                        "❌ اللعبة ممتلئة.",
                    ephemeral: true
                });

                return true;
            }

            game.players.set(
                interaction.user.id,
                {
                    user:
                        interaction.user,
                    alive: true,
                    role: null
                }
            );

            await interaction.reply({
                content:
                    "✅ دخلت لعبة المافيا.",
                ephemeral: true
            });

            await updateLobby(game);

            return true;
        }


        // -------------------------
        // LEAVE
        // -------------------------

        if (
            action === "leave"
        ) {

            if (
                game.phase !== "lobby"
            ) {

                await interaction.reply({
                    content:
                        "❌ لا يمكنك الخروج بعد بدء اللعبة.",
                    ephemeral: true
                });

                return true;
            }

            if (
                !game.players.has(
                    interaction.user.id
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ أنت لست داخل اللعبة.",
                    ephemeral: true
                });

                return true;
            }

            game.players.delete(
                interaction.user.id
            );

            await interaction.reply({
                content:
                    "🚪 خرجت من اللعبة.",
                ephemeral: true
            });

            if (
                game.players.size === 0
            ) {

                games.delete(
                    game.guildId
                );

                try {
                    await game.lobbyMessage.edit({
                        embeds: [
                            createEmbed(
                                "❌ انتهت اللعبة",
                                "خرج جميع اللاعبين.",
                                COLORS.RED
                            )
                        ],
                        components: []
                    });
                } catch {}

                return true;
            }

            await updateLobby(game);

            return true;
        }


        // -------------------------
        // START
        // -------------------------

        if (
            action === "start"
        ) {

            if (
                interaction.user.id !==
                game.hostId
            ) {

                await interaction.reply({
                    content:
                        "❌ فقط منشئ اللعبة يستطيع بدءها.",
                    ephemeral: true
                });

                return true;
            }

            if (
                game.players.size <
                MIN_PLAYERS
            ) {

                await interaction.reply({
                    content:
                        `❌ تحتاج على الأقل **${MIN_PLAYERS} لاعبين**.`,
                    ephemeral: true
                });

                return true;
            }

            await interaction.deferUpdate();

            await startGame(game);

            return true;
        }
    }


    // -----------------------------------------------
    // NIGHT SELECT
    // -----------------------------------------------

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            "mafia_night_"
        )
    ) {

        const guildId =
            interaction.customId.replace(
                "mafia_night_",
                ""
            );

        const game =
            games.get(guildId);

        if (!game) {

            await interaction.reply({
                content:
                    "❌ اللعبة انتهت.",
                ephemeral: true
            });

            return true;
        }

        if (
            game.phase !== "night"
        ) {

            await interaction.reply({
                content:
                    "❌ ليس وقت اختيار هدف الآن.",
                ephemeral: true
            });

            return true;
        }

        const player =
            game.players.get(
                interaction.user.id
            );

        if (
            !player ||
            !player.alive
        ) {

            await interaction.reply({
                content:
                    "❌ أنت لست لاعبًا حيًا.",
                ephemeral: true
            });

            return true;
        }

        const targetId =
            interaction.values[0];

        const target =
            game.players.get(
                targetId
            );

        if (
            !target ||
            !target.alive
        ) {

            await interaction.reply({
                content:
                    "❌ هذا اللاعب غير متاح.",
                ephemeral: true
            });

            return true;
        }


        // MAFIA
        if (
            player.role === "mafia"
        ) {

            game.mafiaVotes.set(
                interaction.user.id,
                targetId
            );

            await interaction.reply({
                content:
                    `🔪 تم اختيار **${target.user.username}** كهدف.`,
                ephemeral: true
            });

            return true;
        }


        // DOCTOR
        if (
            player.role === "doctor"
        ) {

            game.doctorTarget =
                targetId;

            await interaction.reply({
                content:
                    `👨‍⚕️ ستحمي **${target.user.username}** الليلة.`,
                ephemeral: true
            });

            return true;
        }


        // DETECTIVE
        if (
            player.role === "detective"
        ) {

            game.detectiveTarget =
                targetId;

            const result =
                target.role === "mafia"
                    ? "🔪 نعم، هذا اللاعب من المافيا."
                    : "✅ لا، هذا اللاعب ليس من المافيا.";

            await interaction.reply({
                embeds: [
                    createEmbed(
                        "🕵️ نتيجة التحقيق",
                        `أنت حققت في **${target.user.username}**.\n\n${result}`,
                        COLORS.BLUE
                    )
                ],
                ephemeral: true
            });

            return true;
        }
    }


    // -----------------------------------------------
    // VOTE SELECT
    // -----------------------------------------------

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith(
            "mafia_vote_"
        )
    ) {

        const guildId =
            interaction.customId.replace(
                "mafia_vote_",
                ""
            );

        const game =
            games.get(guildId);

        if (!game) {

            await interaction.reply({
                content:
                    "❌ اللعبة انتهت.",
                ephemeral: true
            });

            return true;
        }

        if (
            game.phase !== "voting"
        ) {

            await interaction.reply({
                content:
                    "❌ ليس وقت التصويت.",
                ephemeral: true
            });

            return true;
        }

        if (
            !isAlive(
                game,
                interaction.user.id
            )
        ) {

            await interaction.reply({
                content:
                    "❌ اللاعب الميت لا يستطيع التصويت.",
                ephemeral: true
            });

            return true;
        }

        const targetId =
            interaction.values[0];

        if (
            !isAlive(
                game,
                targetId
            )
        ) {

            await interaction.reply({
                content:
                    "❌ هذا اللاعب غير متاح.",
                ephemeral: true
            });

            return true;
        }

        game.votes.set(
            interaction.user.id,
            targetId
        );

        const target =
            game.players.get(
                targetId
            );

        await interaction.reply({
            content:
                `🗳️ تم تسجيل تصويتك ضد **${target.user.username}**.`,
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