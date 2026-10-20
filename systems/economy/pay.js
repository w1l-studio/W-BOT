const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const { formatCoins } = require('./helpers');
async function execute(interaction) {
  const target = interaction.options.getUser('user');
  const amount = interaction.options.getInteger('amount');
  if (!target || target.bot || target.id === interaction.user.id) return interaction.reply({ content: 'يا زول اختار لاعب تاني، ما بتحوّل لبوت ولا لنفسك.', ephemeral: true });
  if (!Number.isSafeInteger(amount) || amount < config.payMin) return interaction.reply({ content: `يا زول أقل تحويل ${config.payMin} كوينز.`, ephemeral: true });
  const sender = storage.getUser(interaction.user.id);
  const receiver = storage.getUser(target.id);
  const fee = Math.ceil(amount * config.payFeePercent);
  const total = amount + fee;
  if (sender.balance < total) return interaction.reply({ content: `رصيدك ما مكفّي يا زول. محتاج ${formatCoins(total)} بالرسوم، ومعاك ${formatCoins(sender.balance)}.`, ephemeral: true });
  // الخصم والإضافة تحفظان معًا في نفس العملية قبل الكتابة.
  sender.balance -= total;
  receiver.balance += amount;
  storage.record('pay', interaction.user.id, target.id, amount, `fee:${fee}`);
  storage.persist();
  const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('💸 التحويل تم يا زول')
    .setDescription(`حوّلت لـ ${target} مبلغ **${formatCoins(amount)}**.\nرسوم التحويل: **${formatCoins(fee)}**\nالخصم الكلّي من رصيدك: **${formatCoins(total)}**\nالباقي معاك: **${formatCoins(sender.balance)}**`);
  return interaction.reply({ embeds: [embed] });
}
module.exports = { execute };
