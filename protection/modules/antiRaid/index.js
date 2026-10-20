'use strict';

async function onJoin(manager, member) {
  const guild = member.guild;
  const config = await manager.getConfig(guild.id);
  if (!config.enabled || !config.antiRaid.enabled) return;
  if (await manager.isTrusted(member, config)) return;
  const now = Date.now();
  const joins = (manager.joinWindows.get(guild.id) || []).filter((time) => now - time <= config.antiRaid.windowMs);
  joins.push(now);
  manager.joinWindows.set(guild.id, joins);
  if (joins.length < config.antiRaid.maxJoins) return;

  if (manager.raidAlerts.has(guild.id) && now - manager.raidAlerts.get(guild.id) < config.antiRaid.alertCooldownMs) return;
  manager.raidAlerts.set(guild.id, now);
  const canEnforce = manager.canEnforce(config);
  await manager.recordIncident(guild, 'ANTI_RAID', 'تم تجاوز حد دخول الأعضاء خلال فترة قصيرة.', [
    { name: 'عدد الانضمامات', value: String(joins.length), inline: true },
    { name: 'النافذة', value: `${config.antiRaid.windowMs / 1000} ثانية`, inline: true },
    { name: 'آخر عضو', value: `${member.user.tag} (${member.id})`, inline: false },
    { name: 'الوضع', value: canEnforce ? 'تنفيذ' : 'مراقبة فقط', inline: true },
  ], 'high', { actorId: member.id });

  if (canEnforce && config.antiRaid.response === 'lockdown') {
    await manager.setEmergency(guild, true, manager.client.user?.id || null, 'Anti-Raid threshold reached', {
      autoDurationMs: config.antiRaid.lockdownDurationMs,
    });
  }
}

module.exports = { onJoin };
