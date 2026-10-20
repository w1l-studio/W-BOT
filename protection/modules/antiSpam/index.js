'use strict';

async function onMessage(manager, message) {
  if (!message.guild || !message.member || !message.author) return;
  const config = await manager.getConfig(message.guild.id);
  if (!config.enabled || !config.antiSpam.enabled || manager.isChannelWhitelisted(message.channelId, config)) return;
  if (config.antiSpam.ignoreBots && message.author.bot) return;
  if (await manager.isTrusted(message.member, config)) return;
  if (config.antiSpam.ignoreAttachments && message.attachments.size) return;

  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;
  const maxWindow = Math.max(config.antiSpam.windowMs, config.antiSpam.duplicateWindowMs);
  const normalized = normalize(message.content);
  const entries = (manager.messageWindows.get(key) || []).filter((item) => now - item.time <= maxWindow);
  entries.push({ time: now, content: normalized, messageId: message.id, channelId: message.channelId });
  manager.messageWindows.set(key, entries);
  // Keep the process memory bounded even if the server receives a large volume of messages.
  if (manager.messageWindows.size > 10_000) {
    for (const [entryKey, values] of manager.messageWindows) {
      if (!values.length || now - values[values.length - 1].time > maxWindow * 2) manager.messageWindows.delete(entryKey);
    }
  }

  const recent = entries.filter((item) => now - item.time <= config.antiSpam.windowMs);
  const duplicateCount = normalized
    ? entries.filter((item) => item.content === normalized && now - item.time <= config.antiSpam.duplicateWindowMs).length
    : 0;
  const triggered = recent.length >= config.antiSpam.maxMessages || duplicateCount >= config.antiSpam.maxDuplicates;
  if (!triggered) return;

  const alertKey = `${message.guild.id}:${message.author.id}`;
  const lastAlert = manager.spamAlerts.get(alertKey) || 0;
  const shouldAlert = now - lastAlert >= config.antiSpam.alertCooldownMs;
  if (shouldAlert) {
    manager.spamAlerts.set(alertKey, now);
    await manager.recordIncident(message.guild, 'ANTI_SPAM', `تم رصد نمط رسائل قد يكون مزعجًا من <@${message.author.id}>.`, [
      { name: 'العضو', value: `${message.author.tag} (${message.author.id})`, inline: false },
      { name: 'عدد الرسائل في النافذة', value: String(recent.length), inline: true },
      { name: 'التكرارات', value: String(duplicateCount), inline: true },
      { name: 'القناة', value: `<#${message.channelId}>`, inline: true },
      { name: 'الوضع', value: manager.canEnforce(config) ? 'تنفيذ' : 'مراقبة فقط', inline: true },
    ], manager.canEnforce(config) ? 'medium' : 'low', { actorId: message.author.id, channelId: message.channelId });
  }

  // Monitor mode records detections only. Real moderation requires an explicit mode change.
  if (!manager.canEnforce(config)) return;
  const response = config.antiSpam.response;
  if (['delete', 'delete_timeout'].includes(response)) {
    await message.delete().catch((error) => manager.logger.warn('Anti-Spam could not delete a message', error));
  }
  if (['timeout', 'delete_timeout'].includes(response)) {
    const punishmentKey = `${message.guild.id}:${message.author.id}`;
    const cooldownUntil = manager.punishmentCooldowns.get(punishmentKey) || 0;
    if (now >= cooldownUntil) {
      manager.punishmentCooldowns.set(punishmentKey, now + Math.max(config.antiSpam.timeoutMs, 60_000));
      if (manager.punishmentCooldowns.size > 10_000) {
        for (const [entryKey, until] of manager.punishmentCooldowns) if (until <= now) manager.punishmentCooldowns.delete(entryKey);
      }
      await manager.punishments.timeout(message.member, config.antiSpam.timeoutMs, 'Anti-Spam: repeated messages');
    }
  }
}

function normalize(content) {
  return String(content || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = { onMessage, normalize };
