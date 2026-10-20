const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const { formatCoins } = require('./helpers');

function nextDailyMs(user, now = Date.now()) {
  return Math.max(0, config.dailyCooldownMs - (now - user.lastDaily));
}
async function execute(interaction) {
  const user = storage.getUser(interaction.user.id);
  const now = Date.now();
  const remaining = nextDailyMs(user, now);
  if (remaining > 0) {
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.ceil((remaining % 3600000) / 60000);
    const embed = new EmbedBuilder().setColor(0xE67E22).setTitle('⏳ يا زول، إنت استلمت يوميتك خلاص')
      .setDescription(`أرجع لينا بعد **${hours} ساعة و${minutes} دقيقة** وبتلقى يوميتك جاهزة.`)
      .setFooter({ text: 'اليومية مرة واحدة كل 24 ساعة يا حبيبنا.' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
  const elapsed = now - (user.lastDaily || 0);
  if (!user.lastDaily || elapsed > config.dailyStreakGraceMs) user.streak = 0;
  user.streak = Math.min(30, (user.streak || 0) + 1);
  const reward = config.dailyRewards[user.streak - 1] || config.dailyRewards[0];
  user.balance += reward;
  user.totalEarned += reward;
  user.lastDaily = now;
  user.lastDailyDate = new Date(now).toISOString().slice(0, 10);
  storage.record('daily', null, interaction.user.id, reward, `streak:${user.streak}`);
  storage.persist();
  const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('🎁 يوميتك وصلت يا زول')
    .setDescription(`أبشر يا زول، استلمت **${formatCoins(reward)}**!\nرصيدك هسه: **${formatCoins(user.balance)}**\n🔥 اليوم رقم **${user.streak} من 30** في سلسلة اليومي.`)
    .setFooter({ text: 'واصل دخولك كل يوم، ومكافأتك بتزيد مع الاستمرار.' }).setTimestamp();
  return interaction.reply({ embeds: [embed] });
}
module.exports = { execute, nextDailyMs };
