'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

class IncidentService {
  constructor(manager) {
    this.manager = manager;
    this.recent = new Map();
    this.maxPerGuild = 100;
    this.filePath = path.join(manager.storage.dataDir || path.join(__dirname, '..', 'data'), 'incidents.json');
    this.loaded = false;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      for (const [guildId, entries] of Object.entries(parsed || {})) {
        if (Array.isArray(entries)) this.recent.set(guildId, entries.slice(0, this.maxPerGuild));
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        if (error instanceof SyntaxError) {
          const recoveryPath = `${this.filePath}.corrupt-${Date.now()}`;
          await fs.rename(this.filePath, recoveryPath).catch(() => {});
          this.manager.logger.error(`Incident history was invalid JSON and was moved to ${recoveryPath}.`, error);
        } else {
          this.loaded = false;
          throw error;
        }
      }
    }
  }

  async persist() {
    const payload = JSON.stringify(Object.fromEntries(this.recent), null, 2);
    const task = async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.tmp`;
      await fs.writeFile(temp, payload, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temp, this.filePath);
    };
    this.writeQueue = this.writeQueue.then(task, task);
    return this.writeQueue;
  }

  async record(guild, incident) {
    await this.load();
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      severity: ['low', 'medium', 'high', 'critical'].includes(incident.severity) ? incident.severity : 'medium',
      type: String(incident.type || 'UNKNOWN').slice(0, 100),
      description: String(incident.description || 'Protection event').slice(0, 1500),
      fields: Array.isArray(incident.fields) ? incident.fields.slice(0, 20) : [],
      metadata: incident.metadata && typeof incident.metadata === 'object' ? incident.metadata : {},
    };
    const list = this.recent.get(guild.id) || [];
    list.unshift(item);
    this.recent.set(guild.id, list.slice(0, this.maxPerGuild));
    await this.persist();
    await this.manager.notifications.incident(guild, item);
    this.manager.logger.info(`[${guild.id}] ${item.type}: ${item.description}`);
    return item;
  }

  async getRecent(guildId, limit = 10) {
    await this.load();
    return (this.recent.get(guildId) || []).slice(0, Math.max(1, Math.min(Number(limit) || 10, 25)));
  }
}

module.exports = { IncidentService };
