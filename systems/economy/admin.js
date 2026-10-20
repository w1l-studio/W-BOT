const { EmbedBuilder } = require('discord.js');
const storage = require('./storage');
const { formatCoins } = require('./helpers');
async function execute(interaction, ownerId) {
  if (interaction.user.id !== ownerId) return interaction.reply({ content: 'يا زول، الأمر دا للمالك بس.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('user');
  if (!target || target.bot) return interaction.reply({ content: 'اختار عضو صاح من السيرفر يا زول.', ephemeral: true });
  const user = storage.getUser(target.id);
  if (sub === 'add') {
    const amount = interaction.options.getInteger('amount');
    if (!Number.isSafeInteger(amount) || amount <= 0) return interaction.reply({ content: 'المبلغ لازم يكون أكبر من صفر يا زول.', ephemeral: true });
    user.balance += amount;
    user.totalEarned += amount;
    storage.record('admin_add', interaction.user.id, target.id, amount, 'daily-admin');
    storage.persist();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ زدنا رصيد العضو').setDescription(`ضفنا ${formatCoins(amount)} لرصيد ${target}.\nرصيده هسه: **${formatCoins(user.balance)}**`)], ephemeral: true });
  }
  if (sub === 'set') {
    const amount = interaction.options.getInteger('amount');
    if (!Number.isSafeInteger(amount) || amount < 0) return interaction.reply({ content: 'المبلغ ما ممكن يكون بالسالب يا زول.', ephemeral: true });
    const previous = user.balance;
    user.balance = amount;
    storage.record('admin_set', interaction.user.id, target.id, amount, `previous:${previous}`);
    storage.persist();
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('🛠️ عدّلنا الرصيد').setDescription(`رصيد ${target} اتغيّر من **${formatCoins(previous)}** لـ **${formatCoins(amount)}**` )], ephemeral: true });
  }
  if (sub === 'reset') {
    user.balance = 0; user.totalEarned = 0; user.streak = 0; user.lastDaily = 0; user.lastDailyDate = ''; user.lastStock = 0; user.sharesPlayed = 0; user.sharesWins = 0; user.sharesLosses = 0; user.sharesProfit = 0;
    storage.record('admin_reset', interaction.user.id, target.id, 0, 'daily-admin');
    storage.persist();
    return interaction.reply({ content: `♻️ صفّرنا بيانات اقتصاد ${target}.` , ephemeral: true });
  }
}
module.exports = { execute };
