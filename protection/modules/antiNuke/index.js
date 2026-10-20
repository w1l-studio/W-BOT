'use strict';

const { AuditLogEvent } = require('discord.js');
const { detectBurst } = require('./detector');
const { applyResponse } = require('./executor');

const ACTION_NAMES = new Map([
  [AuditLogEvent.ChannelDelete, 'ChannelDelete'],
  [AuditLogEvent.ChannelCreate, 'ChannelCreate'],
  [AuditLogEvent.ChannelUpdate, 'ChannelUpdate'],
  [AuditLogEvent.RoleDelete, 'RoleDelete'],
  [AuditLogEvent.RoleCreate, 'RoleCreate'],
  [AuditLogEvent.RoleUpdate, 'RoleUpdate'],
  [AuditLogEvent.MemberBanAdd, 'Ban'],
  [AuditLogEvent.MemberKick, 'Kick'],
  [AuditLogEvent.WebhookCreate, 'WebhookCreate'],
  [AuditLogEvent.WebhookDelete, 'WebhookDelete'],
  [AuditLogEvent.WebhookUpdate, 'WebhookUpdate'],
  [AuditLogEvent.BotAdd, 'BotAdd'],
].filter(([action]) => action !== undefined));

async function onAuditEntry(manager, entry, guild) {
  if (!guild || !entry?.executorId || !ACTION_NAMES.has(entry.action)) return;
  const config = await manager.getConfig(guild.id);
  if (!config.enabled || !config.antiNuke.enabled) return;
  const actionName = ACTION_NAMES.get(entry.action);
  if (!config.antiNuke.actions.includes(actionName)) return;
  if (entry.executorId === manager.client.user?.id) return;

  const executor = await guild.members.fetch(entry.executorId).catch(() => null);
  if (executor) {
    if (config.antiNuke.exemptOwner && executor.id === guild.ownerId) return;
    if (await manager.isTrusted(executor, config, { ignoreOwner: true })) return;
  } else if (config.antiNuke.exemptOwner && entry.executorId === guild.ownerId) {
    return;
  }

  const result = detectBurst(manager, guild.id, entry.executorId, actionName, entry.targetId || null, config.antiNuke);
  if (!result.triggered) return;
  await manager.recordIncident(guild, 'ANTI_NUKE', `تم رصد نشاط إداري كثيف من ${executor?.user?.tag || entry.executorId}.`, [
    { name: 'المنفذ', value: `${executor?.user?.tag || 'تعذّر جلب العضو'} (${entry.executorId})`, inline: false },
    { name: 'الإجراءات خلال النافذة', value: String(result.count), inline: true },
    { name: 'آخر إجراء', value: actionName, inline: true },
    { name: 'الوضع', value: manager.canEnforce(config) ? 'تنفيذ' : 'مراقبة فقط', inline: true },
  ], 'high', { actorId: entry.executorId, actionName, targetId: entry.targetId || null });
  await applyResponse(manager, guild, executor, config.antiNuke, { actorId: entry.executorId, actionName });
}

module.exports = { onAuditEntry, ACTION_NAMES };
