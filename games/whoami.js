const {
    EmbedBuilder
} = require("discord.js");

const characters = require("./characters.json");

// الألعاب النشطة
const activeGames = new Map();

function normalizeAnswer(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[\s_\-'.،,؟?!]/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه");
}

// الكلمات التي تعتبر طلب تلميح
function isHintRequest(text) {
    const value = String(text)
        .toLowerCase()
        .trim()
        .replace(/[؟?!.,،]/g, "");

    return [
        "تلميح",
        "التلميح",
        "عطني تلميح",
        "عطني التلميح",
        "اعطني تلميح",
        "اعطني التلميح",
        "hint"
    ].includes(value);
}

// الكلمات التي تبدأ شخصية جديدة
function isNextRequest(text) {
    const value = String(text)
        .toLowerCase()
        .trim()
        .replace(/[؟?!.,،]/g, "");

    return [
        "التالي",
        "التالى",
        "شخصية جديدة",
        "شخصيه جديده",
        "next"
    ].includes(value);
}

function isCorrectAnswer(input, character) {
    const userAnswer = normalizeAnswer(input);

    const answers = [
        character.answer,
        character.name,
        character.name_ar,
        ...(character.answer_variants || [])
    ];

    return answers.some(answer => {
        return normalizeAnswer(answer) === userAnswer;
    });
}

function getRandomCharacter(previousCharacter = null) {
    if (characters.length <= 1) {
        return characters[0];
    }

    let character;

    do {
        character =
            characters[
                Math.floor(
                    Math.random() * characters.length
                )
            ];
    } while (
        previousCharacter &&
        character.answer === previousCharacter.answer
    );

    return character;
}

function createGameData(channelId, previousCharacter = null) {
    const character =
        getRandomCharacter(previousCharacter);

    const gameId =
        `${channelId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    return {
        gameId,
        character,
        hintIndex: 0,
        startedAt: Date.now(),
        winner: null
    };
}

function buildGameEmbed(game) {
    const firstHint =
        game.character.hints?.[0] ||
        "🟢 التلميح 1: حاول معرفة الشخصية من المعلومات المتاحة.";

    return new EmbedBuilder()
        .setTitle("🕵️ W BOT | من أنا؟")
        .setDescription(
            "🎭 **خمن الشخصية!**\n\n" +
            `${firstHint}\n\n` +
            "💬 اكتب إجابتك في الشات.\n" +
            "💡 تريد تلميحًا؟ اكتب **تلميح**\n" +
            "➡️ تريد شخصية جديدة؟ اكتب **التالي**"
        )
        .setColor(0x2B2D42)
        .setFooter({
            text: "W BOT • من أنا؟"
        })
        .setTimestamp();
}

async function startWhoAmIGame(interaction) {
    const channelId = interaction.channel.id;

    if (activeGames.has(channelId)) {
        return interaction.reply({
            content:
                "❌ توجد لعبة **من أنا؟** تعمل بالفعل في هذا الروم.",
            ephemeral: true
        });
    }

    if (!characters.length) {
        return interaction.reply({
            content:
                "❌ لا توجد شخصيات داخل characters.json.",
            ephemeral: true
        });
    }

    const game = createGameData(channelId);

    activeGames.set(channelId, game);

    await interaction.reply({
        embeds: [buildGameEmbed(game)]
    });
}

async function handleMessage(message) {
    if (message.author.bot) {
        return false;
    }

    const game =
        activeGames.get(message.channel.id);

    if (!game) {
        return false;
    }

    const content =
        message.content.trim();

    if (!content || content.startsWith("/")) {
        return false;
    }

    // ==========================================
    // التالي = شخصية عشوائية جديدة
    // ==========================================
    if (isNextRequest(content)) {

        const oldCharacter =
            game.character;

        const newGame =
            createGameData(
                message.channel.id,
                oldCharacter
            );

        activeGames.set(
            message.channel.id,
            newGame
        );

        await message.channel.send({
            embeds: [
                buildGameEmbed(newGame)
            ]
        });

        return true;
    }

    // ==========================================
    // تلميح = إظهار التلميح التالي
    // ==========================================
    if (isHintRequest(content)) {

        const nextHintIndex =
            game.hintIndex + 1;

        if (
            nextHintIndex >= 6 ||
            !game.character.hints?.[nextHintIndex]
        ) {
            await message.channel.send({
                content:
                    "🔥 **خلصت كل التلميحات!**\n" +
                    "💭 حاول تخمن الشخصية أو اكتب **التالي** لشخصية جديدة."
            });

            return true;
        }

        game.hintIndex =
            nextHintIndex;

        const hint =
            game.character.hints[
                nextHintIndex
            ];

        const embed =
            new EmbedBuilder()
                .setTitle(
                    `💡 التلميح ${nextHintIndex + 1}`
                )
                .setDescription(
                    `${hint}\n\n` +
                    "💬 **اكتب إجابتك في الشات.**\n" +
                    "💡 تلميح آخر؟ اكتب **تلميح**\n" +
                    "➡️ شخصية جديدة؟ اكتب **التالي**"
                )
                .setColor(0xFEE75C)
                .setFooter({
                    text: "W BOT • من أنا؟"
                })
                .setTimestamp();

        await message.channel.send({
            embeds: [embed]
        });

        return true;
    }

    // ==========================================
    // الإجابة
    // ==========================================
    if (
        isCorrectAnswer(
            content,
            game.character
        )
    ) {
        const winner =
            message.author;

        game.winner =
            winner.id;

        const duration =
            Math.floor(
                (Date.now() -
                    game.startedAt) /
                1000
            );

        const minutes =
            Math.floor(
                duration / 60
            );

        const seconds =
            duration % 60;

        const timeText =
            minutes > 0
                ? `${minutes} دقيقة و ${seconds} ثانية`
                : `${seconds} ثانية`;

        const embed =
            new EmbedBuilder()
                .setTitle(
                    "🎉 إجابة صحيحة!"
                )
                .setDescription(
                    `🏆 الفائز: ${winner}\n\n` +
                    `🎭 الشخصية: **${game.character.name}**\n` +
                    `🇸🇦 بالعربي: **${game.character.name_ar}**\n\n` +
                    `⏱️ الوقت: **${timeText}**\n\n` +
                    "➡️ اكتب **التالي** للانتقال إلى شخصية جديدة."
                )
                .setColor(0x57F287)
                .setFooter({
                    text: "W BOT • من أنا؟"
                })
                .setTimestamp();

        // لا نحذف اللعبة؛ نخلي "التالي" يشتغل
        game.winner =
            winner.id;

        await message.channel.send({
            embeds: [embed]
        });

        return true;
    }

    return false;
}

async function stopWhoAmIGame(interaction) {
    const game =
        activeGames.get(
            interaction.channel.id
        );

    if (!game) {
        return interaction.reply({
            content:
                "❌ لا توجد لعبة من أنا؟ تعمل حاليًا.",
            ephemeral: true
        });
    }

    activeGames.delete(
        interaction.channel.id
    );

    const embed =
        new EmbedBuilder()
            .setTitle(
                "🛑 انتهت لعبة من أنا؟"
            )
            .setDescription(
                `🎭 الشخصية كانت: **${game.character.name}**\n` +
                `🇸🇦 بالعربي: **${game.character.name_ar}**`
            )
            .setColor(0xED4245)
            .setTimestamp();

    await interaction.reply({
        embeds: [embed]
    });
}

module.exports = {
    startWhoAmIGame,
    handleMessage,
    stopWhoAmIGame
};
