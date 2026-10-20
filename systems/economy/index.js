const dailyCommand = require('../../commands/economy/daily');
const balanceCommand = require('../../commands/economy/balance');
const leaderboardCommand = require('../../commands/economy/leaderboard');
const payCommand = require('../../commands/economy/pay');
const stockCommand = require('../../commands/economy/stock');
const adminCommand = require('../../commands/economy/admin');
const storage = require('./storage');

const commandModules = new Map([
  ['daily', dailyCommand],
  ['balance', balanceCommand],
  ['leaderboard', leaderboardCommand],
  ['pay', payCommand],
  ['shares', stockCommand],
  ['daily-admin', adminCommand],
]);
const commands = [...commandModules.values()].map(command => command.data);

async function handleInteraction(interaction, ownerId) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName === 'daily-admin') {
    await adminCommand.execute(interaction, ownerId);
    return true;
  }
  const command = commandModules.get(interaction.commandName);
  if (!command) return false;
  await command.execute(interaction);
  return true;
}
module.exports = { commands, handleInteraction, storage };
