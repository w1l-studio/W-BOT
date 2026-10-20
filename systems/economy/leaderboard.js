const { EmbedBuilder } = require('discord.js');
const storage = require('./storage');
const { formatCoins } = require('./helpers');
async function execute(interaction) {
  const state = storage.getState();
  const rows = Object.entries(state.users).sort((a, b) => b[1].balance - a[1].balance).slice(0, 10);
  const lines = rows.length ? rows.map(([id, u], i) => `${['🥇','🥈','🥉'][i] || `**${i+1}.**`} <@${id}> — **${formatCoins(u.balance)}**`).join('\n') : 'لسه ما في أرصدة، خلّوا اللعب يبدأ يا جماعة.';
  const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🏆 ناس الرصيد التقيل').setDescription(lines).setFooter({ text: 'الترتيب على حسب الرصيد الموجود هسه.' }).setTimestamp();
  return interaction.reply({ embeds: [embed] });
}
module.exports = { execute };
