const { SlashCommandBuilder } = require('discord.js');
const handler = require('../../systems/economy/daily');
module.exports = { data: new SlashCommandBuilder().setName('daily').setDescription('استلام المكافأة اليومية'), execute: handler.execute };
