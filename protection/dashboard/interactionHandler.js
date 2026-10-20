'use strict';

const { MessageFlags } = require('discord.js');
const { LABELS, buildMainPanel } = require('./mainPanel');

async function handleDashboardInteraction(interaction, manager) {
  if (!interaction.isButton?.()) return false;
  const match = /^protection:toggle:(antiNuke|antiSpam|antiRaid|antiLink|antiRole|antiChannel|antiWebhook)$/.exec(interaction.customId || '');
  if (!match) return false;
  if (!interaction.guild) {
    await interaction.reply({ content: 'هذا الزر يعمل داخل السيرفر فقط.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const config = await manager.getConfig(interaction.guild.id);
  if (!await manager.isDashboardAdmin(interaction, config)) {
    await interaction.reply({ content: 'ليس لديك صلاحية إدارة الحماية.', flags: MessageFlags.Ephemeral });
    return true;
  }
  const feature = match[1];
  const enabled = !config[feature].enabled;
  await manager.setFeature(interaction.guild.id, feature, enabled);
  await manager.recordIncident(interaction.guild, 'CONFIG_FEATURE', `تم ${enabled ? 'تفعيل' : 'إيقاف'} ${LABELS[feature]}.`, [
    { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
  ], 'low', { actorId: interaction.user.id, feature, enabled });
  const updatedStatus = await manager.getStatus(interaction.guild.id);
  const panel = buildMainPanel(updatedStatus);
  await interaction.update(panel);
  return true;
}

module.exports = { handleDashboardInteraction };
