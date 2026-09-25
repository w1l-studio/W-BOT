const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const mafia = require("./mafia");


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
    }


    // --------------------------------------------------
    // MAFIA BUTTONS / MENUS
    // --------------------------------------------------

    return await mafia.handleInteraction(
        interaction
    );
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