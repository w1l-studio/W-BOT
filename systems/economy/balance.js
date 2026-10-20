const { EmbedBuilder } = require('discord.js');
const storage = require('./storage');
const { formatCoins, userTag } = require('./helpers');
async function execute(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const user = storage.getUser(target.id);
  const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`💰 رصيد ${userTag(target)}`)
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'رصيدك هسه', value: `**${formatCoins(user.balance)}**`, inline: true },
      { name: 'إجمالي الكسب', value: formatCoins(user.totalEarned), inline: true },
      { name: 'سلسلة اليومي', value: `${user.streak || 0}/30 يوم`, inline: true },
      { name: '📈 مرات تجربة السوق', value: `${user.sharesPlayed || 0}`, inline: true },
      { name: '✅ مرات كسبت', value: `${user.sharesWins || 0}`, inline: true },
      { name: '❌ مرات خسرت', value: `${user.sharesLosses || 0}`, inline: true },
      { name: '💹 صافي السوق', value: `${(user.sharesProfit || 0) >= 0 ? '+' : '-'}${formatCoins(Math.abs(user.sharesProfit || 0))}`, inline: true }
    ).setTimestamp();
  return interaction.reply({ embeds: [embed] });
}
module.exports = { execute };
