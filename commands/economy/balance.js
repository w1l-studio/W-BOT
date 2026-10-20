const { SlashCommandBuilder } = require('discord.js');
const handler = require('../../systems/economy/balance');
module.exports = { data: new SlashCommandBuilder().setName('balance').setDescription('عرض رصيدك أو رصيد لاعب آخر').addUserOption(o => o.setName('user').setDescription('اللاعب المراد عرض رصيده').setRequired(false)), execute: handler.execute };
