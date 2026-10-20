const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const storage = require('./storage');
const { formatCoins } = require('./helpers');

async function execute(interaction) {
  const bet = interaction.options.getInteger('amount');
  const user = storage.getUser(interaction.user.id);
  const now = Date.now();
  const remaining = config.stock.cooldownMs - (now - (user.lastStock || 0));
  if (remaining > 0) {
    const mins = Math.ceil(remaining / 60000);
    return interaction.reply({ content: `يا زول السوق لسه ما فتح ليك تاني 😅 أرجع بعد **${mins} دقيقة** وجرب حظك.`, ephemeral: true });
  }
  if (!Number.isSafeInteger(bet) || bet < config.stock.minBet)
    return interaction.reply({ content: 'أدخل مبلغ صاح يا زول، أقل حاجة كوين واحد.', ephemeral: true });
  if (user.balance < bet)
    return interaction.reply({ content: `رصيدك ما بكفّي يا زول، معاك ${formatCoins(user.balance)} بس.`, ephemeral: true });

  user.lastStock = now;
  user.sharesPlayed = (user.sharesPlayed || 0) + 1;
  const won = Math.random() < config.stock.winChance;
  let delta;
  let resultText;
  if (won) {
    // ضعف الرهان كعائد إجمالي: الرهان الأصلي + ربح بنفس قيمته.
    delta = bet;
    user.balance += delta;
    user.totalEarned += delta;
    user.sharesWins = (user.sharesWins || 0) + 1;
    resultText = `يا سلام يا زول! السوق ضحك ليك 😎
دخلت بـ **${formatCoins(bet)}** وربحت **${formatCoins(delta)}** زيادة، وبقى معاك **${formatCoins(user.balance)}**.`;
  } else {
    delta = -Math.floor(bet * config.stock.lossMultiplier);
    user.balance += delta;
    user.sharesLosses = (user.sharesLosses || 0) + 1;
    resultText = `يا خسارة يا زول، السوق ما ظبط المرة دي 😅
خسرت **${formatCoins(-delta)}** من رهانك، وبقى معاك **${formatCoins(user.balance)}**.`;
  }
  user.sharesProfit = (user.sharesProfit || 0) + delta;
  storage.record('shares', interaction.user.id, null, Math.abs(delta), won ? 'win' : 'loss');
  storage.persist();
  const played = user.sharesPlayed;
  const wins = user.sharesWins;
  const losses = user.sharesLosses;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const embed = new EmbedBuilder()
    .setColor(won ? 0x2ECC71 : 0xE74C3C)
    .setTitle(won ? '📈 السوق ضحك ليك يا زول!' : '📉 السوق غلبك المرة دي يا زول')
    .setDescription(`جرب حظك في السوق، وممكن تكسب وممكن تخسر!

${resultText}`)
    .addFields(
      { name: '📊 جرّبت كم مرة', value: `${played}`, inline: true },
      { name: '✅ كسبت كم مرة', value: `${wins}`, inline: true },
      { name: '❌ خسرت كم مرة', value: `${losses}`, inline: true },
      { name: '🎯 نسبة فوزك', value: `${winRate}%`, inline: true },
      { name: '💹 صافي حساب السوق', value: `${user.sharesProfit >= 0 ? '+' : '-'}${formatCoins(Math.abs(user.sharesProfit))}`, inline: true },
      { name: '🪙 القروش المعاك هسه', value: formatCoins(user.balance), inline: true }
    )
    .setFooter({ text: 'خليك حريف، والسوق يوم فوق ويوم تحت.' })
    .setTimestamp();
  return interaction.reply({ embeds: [embed] });
}
module.exports = { execute };
