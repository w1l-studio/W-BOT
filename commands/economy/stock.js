const { SlashCommandBuilder } = require('discord.js');
const handler = require('../../systems/economy/stock');
module.exports = {
  data: new SlashCommandBuilder()
    .setName('shares')
    .setDescription('جرّب حظك في سوق الأسهم')
    .addIntegerOption(o => o.setName('amount').setDescription('المبلغ البتجرب بيهو حظك').setMinValue(1).setRequired(true)),
  execute: handler.execute
};
