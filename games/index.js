const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const mafia = require("./mafia");
const flags = require("./flags");
const whoami = require("./whoami");

const playCommand =
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("اختيار لعبة للعب");

async function handleInteraction(interaction) {

    // ================================
    // /play
    // ================================
    if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "play"
    ) {
        const embed =
            new EmbedBuilder()
                .setTitle("🎮 W BOT | الألعاب")
                .setDescription(
                    "اختر اللعبة التي تريد لعبها من القائمة بالأسفل."
                )
                .setColor(0x2B2D42)
                .setFooter({ text: "W BOT" })
                .setTimestamp();

        const menu =
            new StringSelectMenuBuilder()
                .setCustomId("play_games")
                .setPlaceholder("🎮 اختر لعبة")
                .addOptions([
                    {
                        label: "المافيا",
                        description: "لعبة المافيا الجماعية",
                        value: "mafia",
                        emoji: "🎭"
                    },
                    {
                        label: "تخمين الأعلام",
                        description: "خمن اسم الدولة من العلم",
                        value: "flags",
                        emoji: "🏳️"
                    },
                    {
                        label: "من أنا؟",
                        description: "خمن الشخصية من التلميحات",
                        value: "whoami",
                        emoji: "🕵️"
                    }
                ]);

        const row =
            new ActionRowBuilder()
                .addComponents(menu);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        return true;
    }

    // ================================
    // اختيار اللعبة
    // ================================
    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "play_games"
    ) {
        const game = interaction.values[0];

        // المافيا
        if (game === "mafia") {
            await mafia.createGame(interaction);
            return true;
        }

        // الأعلام
        if (game === "flags") {
            await interaction.deferUpdate();
            await flags.startFlagsGame(interaction);
            return true;
        }

        // من أنا؟
        if (game === "whoami") {
            await whoami.startWhoAmIGame(interaction);
            return true;
        }
    }

    // ================================
    // تفاعلات المافيا
    // ================================
    const handledByMafia =
        await mafia.handleInteraction(interaction);

    if (handledByMafia) {
        return true;
    }

    // ================================
    // أزرار لعبة من أنا؟
    // ================================
    const handledByWhoAmI =
        await whoami.handleButton(interaction);

    if (handledByWhoAmI) {
        return true;
    }

    return false;
}

// ================================
// رسائل لعبة من أنا؟
// ================================
async function handleMessage(message) {

    const handledByWhoAmI =
        await whoami.handleMessage(message);

    if (handledByWhoAmI) {
        return true;
    }

    return false;
}

module.exports = {
    commands: [playCommand],
    handleInteraction,
    handleMessage
};
