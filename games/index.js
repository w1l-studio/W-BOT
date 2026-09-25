const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const mafia = require("./mafia");
const flags = require("./flags");

// ======================================================
// /PLAY
// ======================================================

const playCommand =
    new SlashCommandBuilder()
        .setName("play")
        .setDescription("اختيار لعبة للعب");

// ======================================================
// HANDLE GAMES
// ======================================================

async function handleInteraction(interaction) {
    // --------------------------------------------------
    // /play
    // --------------------------------------------------

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
                .setColor(0x0000FF)
                .setFooter({
                    text: "W BOT • Games"
                })
                .setTimestamp();


        const menu =
            new StringSelectMenuBuilder()
                .setCustomId("play_games")
                .setPlaceholder(
                    "🎮 اختر لعبة"
                )
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


    // --------------------------------------------------
    // SELECT MENU
    // --------------------------------------------------

    if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "play_games"
    ) {

        const game =
            interaction.values[0];


        // -------------------------
        // MAFIA
        // -------------------------

        if (game === "mafia") {

            await mafia.createGame(
                interaction
            );

            return true;
        }


        // -------------------------
        // FLAGS
        // -------------------------

        if (game === "flags") {

            // Acknowledge the select-menu interaction silently (no visible
            // message), then let startFlagsGame post the real public
            // announcement in the channel — visible to everyone, not just
            // the player who opened /play.
            await interaction.deferUpdate();

            await flags.startFlagsGame(interaction);

            return true;
        }
    }


    // --------------------------------------------------
    // MAFIA BUTTONS / MENUS
    // --------------------------------------------------

    const handledByMafia = await mafia.handleInteraction(
        interaction
    );

    if (handledByMafia) {
        return true;
    }


    // --------------------------------------------------
    // FLAGS has no interaction-based components (answers are typed as
    // plain messages via its own collector), so nothing else to route
    // here — but kept as an explicit fallback for future additions.
    // --------------------------------------------------

    return false;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
    commands: [
        playCommand
    ],

    handleInteraction
};
