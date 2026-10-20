'use strict';

function detectBurst(manager, guildId, actorId, actionName, targetId, config) {
  const key = `${guildId}:${actorId}`;
  const now = Date.now();
  const cooldownUntil = manager.nukeCooldowns.get(key) || 0;
  if (cooldownUntil > now) return { triggered: false, count: 0, cooldown: true };

  const window = (manager.nukeWindows.get(key) || []).filter((item) => now - item.time <= config.windowMs);
  window.push({ time: now, actionName, targetId });
  manager.nukeWindows.set(key, window);
  if (window.length < config.maxActions) return { triggered: false, count: window.length, cooldown: false };

  manager.nukeCooldowns.set(key, now + config.cooldownMs);
  manager.nukeWindows.delete(key);
  if (manager.nukeCooldowns.size > 5_000) {
    for (const [entryKey, until] of manager.nukeCooldowns) if (until <= now) manager.nukeCooldowns.delete(entryKey);
  }
  return { triggered: true, count: window.length, cooldown: false };
}

module.exports = { detectBurst };
