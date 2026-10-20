'use strict';

async function onChannelDelete(manager, channel) {
  if (!channel.guild) return;
  const config = await manager.getConfig(channel.guild.id);
  if (!config.enabled || !config.antiChannel.enabled || !config.antiChannel.alertOnDelete) return;
  await manager.recordIncident(channel.guild, 'CHANNEL_DELETE', `تم حذف قناة: ${channel.name || channel.id}.`, [
    { name: 'القناة المحذوفة', value: `${channel.name || 'غير معروف'} (${channel.id})`, inline: false },
    { name: 'النوع', value: String(channel.type), inline: true },
  ], 'medium');
}

async function onChannelCreate(manager, channel) {
  if (!channel.guild) return;
  const config = await managerConfig(manager, channel.guild.id);
  if (!config.enabled || !config.antiChannel.enabled || !config.antiChannel.alertOnCreate) return;
  await manager.recordIncident(channel.guild, 'CHANNEL_CREATE', `تم إنشاء قناة: ${channel.name || channel.id}.`, [
    { name: 'القناة', value: `${channel.name || 'غير معروف'} (${channel.id})`, inline: false },
  ], 'low');
}

// Kept separate to make future event-specific checks straightforward.
async function managerConfig(manager, guildId) { return manager.getConfig(guildId); }

module.exports = { onChannelDelete, onChannelCreate };
