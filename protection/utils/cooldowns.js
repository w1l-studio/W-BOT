'use strict';

class Cooldowns {
  constructor() { this.items = new Map(); }
  has(key, now = Date.now()) {
    const until = this.items.get(key) || 0;
    if (until <= now) { this.items.delete(key); return false; }
    return true;
  }
  set(key, durationMs, now = Date.now()) { this.items.set(key, now + Math.max(0, durationMs)); }
  sweep(now = Date.now()) {
    for (const [key, until] of this.items) if (until <= now) this.items.delete(key);
  }
}

module.exports = { Cooldowns };
