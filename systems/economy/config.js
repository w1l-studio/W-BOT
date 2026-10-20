// إعدادات اقتصاد Trivia BOT — مصممة لاقتصاد نادر ومتوازن.
module.exports = {
  currencyName: 'كوينز',
  currencyEmoji: '🪙',
  dailyRewards: [25, 35, 45, 55, 65, 75, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200, 205, 210, 215],
  dailyCooldownMs: 24 * 60 * 60 * 1000,
  dailyStreakGraceMs: 48 * 60 * 60 * 1000,
  payMin: 1,
  payFeePercent: 0.02,
  leaderboardLimit: 10,
  stock: {
    minBet: 1,
    cooldownMs: 30 * 60 * 1000,
    winChance: 0.40,
    // عند الفوز: إجمالي العائد ضعف الرهان (صافي الربح يساوي الرهان).
    winMultiplier: 2,
    // عند الخسارة: يخسر اللاعب 30% من قيمة الرهان فقط.
    lossMultiplier: 0.30,
  },
  admin: {
    // يتطابق مع OWNER_ID في index.js دون تغيير معرف المالك.
    ownerOnly: true,
  },
};
