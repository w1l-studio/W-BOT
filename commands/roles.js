const {
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const {
  buildGameRolesPanel,
} = require("../systems/gameRoles");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roles")
    .setDescription("إرسال لوحة رولات الألعاب")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles.toString()
    ),

  async execute(interaction) {
    await interaction.channel.send(
      buildGameRolesPanel()
    );

    await interaction.reply({
      content: "✅ تم إرسال لوحة رولات الألعاب.",
      ephemeral: true,
    });
  },
};