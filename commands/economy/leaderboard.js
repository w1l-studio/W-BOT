const { SlashCommandBuilder } = require('discord.js');
const handler = require('../../systems/economy/leaderboard');
module.exports = { data: new SlashCommandBuilder().setName('leaderboard').setDescription('عرض أغنى اللاعبين في السيرفر'), execute: handler.execute };
