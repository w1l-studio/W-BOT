const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function formatCoins(value) {
  return `${config.currencyEmoji} ${Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US')}`;
}
function userTag(user) {
  return user?.globalName || user?.username || 'مستخدم';
}
function economyEmbed(title, description, color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
}
function safeReply(interaction, payload) {
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}
module.exports = { formatCoins, userTag, economyEmbed, safeReply };
