const { SlashCommandBuilder } = require('discord.js');
const handler = require('../../systems/economy/pay');
module.exports = { data: new SlashCommandBuilder().setName('pay').setDescription('تحويل كوينز إلى لاعب آخر').addUserOption(o => o.setName('user').setDescription('المستلم').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('مبلغ التحويل').setMinValue(1).setRequired(true)), execute: handler.execute };
