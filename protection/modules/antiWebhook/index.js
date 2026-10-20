'use strict';

const { AuditLogEvent } = require('discord.js');

async function onWebhookAudit(manager, entry, guild) {
  if (!guild || !entry?.executorId) return;
  if (![AuditLogEvent.WebhookCreate, AuditLogEvent.WebhookDelete, AuditLogEvent.WebhookUpdate].includes(entry.action)) return;
  const config = await manager.getConfig(guild.id);
  if (!config.enabled || !config.antiWebhook.enabled) return;
  const action = entry.action === AuditLogEvent.WebhookCreate ? 'إنشاء' : entry.action === AuditLogEvent.WebhookDelete ? 'حذف' : 'تعديل';
  if (action === 'إنشاء' && !config.antiWebhook.alertOnCreate) return;
  if (action === 'حذف' && !config.antiWebhook.alertOnDelete) return;
  if (action === 'تعديل' && !config.antiWebhook.alertOnUpdate) return;
  const executor = await guild.members.fetch(entry.executorId).catch(() => null);
  if (executor && await manager.isTrusted(executor, config)) return;
  if (entry.executorId === guild.ownerId || entry.executorId === manager.client.user?.id) return;
  const cooldownKey = `${guild.id}:${entry.executorId}`;
  const now = Date.now();
  const lastAlert = manager.webhookAlerts.get(cooldownKey) || 0;
  if (now - lastAlert < 10_000) return;
  manager.webhookAlerts.set(cooldownKey, now);
  if (manager.webhookAlerts.size > 5_000) {
    for (const [key, time] of manager.webhookAlerts) if (now - time > 60_000) manager.webhookAlerts.delete(key);
  }
  await manager.recordIncident(guild, 'WEBHOOK', `تم رصد ${action} Webhook.`, [
    { name: 'المنفذ', value: executor ? `${executor.user.tag} (${executor.id})` : entry.executorId, inline: false },
    { name: 'الإجراء', value: action, inline: true },
  ], 'high');
}

module.exports = { onWebhookAudit };
