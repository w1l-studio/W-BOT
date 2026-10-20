const { EmbedBuilder } = require("discord.js");

const characters = require("./characters.json");

// ==========================================
// الألعاب النشطة
// ==========================================

const activeGames = new Map();

// ==========================================
// تنظيف الإجابات
// ==========================================

function normalizeAnswer(text) {
    return String(text ?? "")
        .toLowerCase()
        .trim()
        .replace(/[\s_\-'.،,؟?!:؛]/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي");
}

function getAllAnswerVariants(character) {
    return [
        character?.answer,
        character?.name,
        character?.name_ar,
        ...(Array.isArray(character?.answer_variants)
            ? character.answer_variants
            : [])
    ].filter(Boolean);
}

function isUniqueShortName(shortName, currentCharacter) {
    let matches = 0;

    for (const character of characters) {
        const values = getAllAnswerVariants(character);
        const parts = new Set();

        for (const value of values) {
            String(value)
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .forEach(part => {
                    parts.add(normalizeAnswer(part));
                });
        }

        if (parts.has(shortName)) {
            matches++;

            if (matches > 1) {
                return false;
            }
        }
    }

    if (matches === 1) {
        return true;
    }

    return getAllAnswerVariants(currentCharacter).some(value =>
        String(value)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .some(part => normalizeAnswer(part) === shortName)
    );
}

function buildCharacterAnswers(character) {
    const answers = new Set();

    for (const value of getAllAnswerVariants(character)) {
        const normalized = normalizeAnswer(value);

        if (normalized) {
            answers.add(normalized);
        }

        const parts = String(value)
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (parts.length > 1) {
            for (const part of parts) {
                const shortName = normalizeAnswer(part);

                if (
                    shortName.length >= 3 &&
                    isUniqueShortName(shortName, character)
                ) {
                    answers.add(shortName);
                }
            }
        }
    }

    return answers;
}

function isCorrectAnswer(input, character) {
    return buildCharacterAnswers(character).has(
        normalizeAnswer(input)
    );
}

// ==========================================
// طلب التلميح
// ==========================================

function isHintRequest(text) {
    const value = String(text ?? "")
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

// ==========================================
// طلب شخصية جديدة
// ==========================================

function isNextRequest(text) {
    const value = String(text ?? "")
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

// ==========================================
// اختيار شخصية
// ==========================================

function getRandomCharacter(previousCharacter = null) {
    if (!Array.isArray(characters) || characters.length === 0) {
        return null;
    }

    if (characters.length === 1) {
        return characters[0];
    }

    let character;

    do {
        character =
            characters[
                Math.floor(Math.random() * characters.length)
            ];
    } while (
        previousCharacter &&
        character.answer === previousCharacter.answer
    );

    return character;
}

// ==========================================
// بيانات اللعبة
// ==========================================

function createGameData(channelId, previousCharacter = null) {
    const character = getRandomCharacter(previousCharacter);

    if (!character) {
        return null;
    }

    const image =
        typeof character.image === "string" &&
        character.image.trim()
            ? character.image.trim()
            : null;

    return {
        gameId:
            `${channelId}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        character,
        image,
        hintIndex: 0,
        startedAt: Date.now(),
        winner: null
    };
}

// ==========================================
// Embed اللعبة
// ==========================================

function buildGameEmbed(game) {
    const firstHint =
        game.character.hints?.[0] ||
        "🟢 التلميح 1: حاول معرفة الشخصية من المعلومات المتاحة.";

    const embed =
        new EmbedBuilder()
            .setTitle("🕵️ Trivia BOT | من أنا؟")
            .setDescription(
                "🎭 **خمن الشخصية!**\n\n" +
                `${firstHint}\n\n` +
                "💬 اكتب إجابتك في الشات.\n" +
                "💡 تريد تلميحًا؟ اكتب **تلميح**\n" +
                "➡️ تريد شخصية جديدة؟ اكتب **التالي**"
            )
            .setColor(0x2B2D42)
            .setFooter({ text: "Trivia BOT • من أنا؟" })
            .setTimestamp();

    // الصورة الكبيرة محفوظة مسبقًا داخل characters.json.
    if (game.image) {
        embed.setImage(game.image);
    }

    return embed;
}

// ==========================================
// بدء اللعبة
// ==========================================

async function startWhoAmIGame(interaction) {
    const channelId = interaction.channel.id;

    if (activeGames.has(channelId)) {
        return interaction.reply({
            content:
                "❌ توجد لعبة **من أنا؟** تعمل بالفعل في هذا الروم.",
            ephemeral: true
        });
    }

    if (!Array.isArray(characters) || characters.length === 0) {
        return interaction.reply({
            content:
                "❌ لا توجد شخصيات داخل characters.json.",
            ephemeral: true
        });
    }

    const game = createGameData(channelId);

    if (!game) {
        return interaction.reply({
            content: "❌ تعذر إنشاء اللعبة.",
            ephemeral: true
        });
    }

    activeGames.set(channelId, game);

    console.log(
        `🎭 Who Am I | ${game.character.name || game.character.answer} | صورة: ${
            game.image ? "✅ موجودة" : "❌ غير موجودة"
        }`
    );

    await interaction.reply({
        embeds: [buildGameEmbed(game)]
    });
}

// ==========================================
// استقبال رسائل اللعبة
// ==========================================

async function handleMessage(message) {
    if (message.author.bot) {
        return false;
    }

    const game = activeGames.get(message.channel.id);

    if (!game) {
        return false;
    }

    const content = String(message.content || "").trim();

    if (!content || content.startsWith("/")) {
        return false;
    }

    // ==========================================
    // التالي
    // ==========================================

    if (isNextRequest(content)) {
        const newGame = createGameData(
            message.channel.id,
            game.character
        );

        if (!newGame) {
            await message.channel.send({
                content: "❌ تعذر إنشاء شخصية جديدة."
            });

            return true;
        }

        activeGames.set(message.channel.id, newGame);

        console.log(
            `🎭 Who Am I | ${newGame.character.name || newGame.character.answer} | صورة: ${
                newGame.image ? "✅ موجودة" : "❌ غير موجودة"
            }`
        );

        await message.channel.send({
            embeds: [buildGameEmbed(newGame)]
        });

        return true;
    }

    // ==========================================
    // تلميح
    // ==========================================

    if (isHintRequest(content)) {
        const nextHintIndex = game.hintIndex + 1;

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

        game.hintIndex = nextHintIndex;

        const hint = game.character.hints[nextHintIndex];

        const embed =
            new EmbedBuilder()
                .setTitle(`💡 التلميح ${nextHintIndex + 1}`)
                .setDescription(
                    `${hint}\n\n` +
                    "💬 **اكتب إجابتك في الشات.**\n" +
                    "💡 تلميح آخر؟ اكتب **تلميح**\n" +
                    "➡️ شخصية جديدة؟ اكتب **التالي**"
                )
                .setColor(0xFEE75C)
                .setFooter({ text: "Trivia BOT • من أنا؟" })
                .setTimestamp();

        if (game.image) {
            embed.setImage(game.image);
        }

        await message.channel.send({
            embeds: [embed]
        });

        return true;
    }

    // ==========================================
    // الإجابة
    // ==========================================

    if (isCorrectAnswer(content, game.character)) {
        const winner = message.author;

        game.winner = winner.id;

        const duration = Math.floor(
            (Date.now() - game.startedAt) / 1000
        );

        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;

        const timeText =
            minutes > 0
                ? `${minutes} دقيقة و ${seconds} ثانية`
                : `${seconds} ثانية`;

        const embed =
            new EmbedBuilder()
                .setTitle("🎉 إجابة صحيحة!")
                .setDescription(
                    `🏆 الفائز: ${winner}\n\n` +
                    `🎭 الشخصية: **${game.character.name}**\n` +
                    `🇸🇦 بالعربي: **${game.character.name_ar}**\n\n` +
                    `⏱️ الوقت: **${timeText}**\n\n` +
                    "➡️ اكتب **التالي** للانتقال إلى شخصية جديدة."
                )
                .setColor(0x57F287)
                .setFooter({ text: "Trivia BOT • من أنا؟" })
                .setTimestamp();

        if (game.image) {
            embed.setImage(game.image);
        }

        await message.channel.send({
            embeds: [embed]
        });

        return true;
    }

    return false;
}

// ==========================================
// إيقاف اللعبة
// ==========================================

async function stopWhoAmIGame(interaction) {
    const game = activeGames.get(interaction.channel.id);

    if (!game) {
        return interaction.reply({
            content: "❌ لا توجد لعبة من أنا؟ تعمل حاليًا.",
            ephemeral: true
        });
    }

    activeGames.delete(interaction.channel.id);

    const embed =
        new EmbedBuilder()
            .setTitle("🛑 انتهت لعبة من أنا؟")
            .setDescription(
                `🎭 الشخصية كانت: **${game.character.name}**\n` +
                `🇸🇦 بالعربي: **${game.character.name_ar}**`
            )
            .setColor(0xED4245)
            .setTimestamp();

    if (game.image) {
        embed.setImage(game.image);
    }

    await interaction.reply({
        embeds: [embed]
    });
}

module.exports = {
    startWhoAmIGame,
    handleMessage,
    stopWhoAmIGame
};
