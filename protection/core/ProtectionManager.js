'use strict';

const { Events } = require('discord.js');
const { EventRegistry } = require('./EventRegistry');
const { ModuleLoader } = require('./ModuleLoader');
const { Logger } = require('../utils/logger');
const { clone, mergeDefaults } = require('../utils/object');
const { createEmbed } = require('../services/auditLogService');
const { IncidentService } = require('../services/incidentService');
const { NotificationService } = require('../services/notificationService');
const { PermissionManager } = require('./PermissionManager');
const { PunishmentService } = require('../services/punishmentService');
const { LockdownService } = require('../services/lockdownService');

const FEATURES = ['antiNuke', 'antiSpam', 'antiRaid', 'antiLink', 'antiRole', 'antiChannel', 'antiWebhook'];
const MODES = ['monitor', 'enforce'];

class ProtectionManager {
  constructor(client, options = {}) {
    this.client = client;
    this.storage = options.storage;
    this.defaults = options.defaults;
    this.logger = options.logger || new Logger('Protection');
    this.registry = new EventRegistry(client, this.logger);
    this.moduleLoader = new ModuleLoader(this);
    this.notifications = new NotificationService(this);
    this.incidents = new IncidentService(this);
    this.permissions = new PermissionManager(this);
    this.punishments = new PunishmentService(this);
    this.lockdownService = new LockdownService(this);
    this.guildConfigs = new Map();
    this.messageWindows = new Map();
    this.joinWindows = new Map();
    this.raidAlerts = new Map();
    this.nukeWindows = new Map();
    this.nukeCooldowns = new Map();
    this.spamAlerts = new Map();
    this.linkAlerts = new Map();
    this.webhookAlerts = new Map();
    this.punishmentCooldowns = new Map();
    this.autoLockdownTimers = new Map();
    this.started = false;
  }

  async getConfig(guildId) {
    if (this.guildConfigs.has(guildId)) return this.guildConfigs.get(guildId);
    const stored = await this.storage.get(guildId);
    const config = mergeDefaults(stored || {}, this.defaults);
    // Migrate older data safely to the new monitor-first policy.
    if (!['monitor', 'enforce'].includes(config.operatingMode)) config.operatingMode = 'monitor';
    for (const key of ['whitelistUserIds', 'whitelistRoleIds', 'whitelistChannelIds', 'dashboardRoleIds']) {
      if (!Array.isArray(config[key])) config[key] = [];
    }
    if (!Array.isArray(config.antiNuke.actions)) config.antiNuke.actions = [...this.defaults.antiNuke.actions];
    if (!Array.isArray(config.antiLink.allowLinks)) config.antiLink.allowLinks = [];
    if (!Array.isArray(config.emergency.snapshot)) config.emergency.snapshot = [];
    if (!Array.isArray(config.emergency.failedChannelIds)) config.emergency.failedChannelIds = [];
    this.guildConfigs.set(guildId, config);
    return config;
  }

  async saveConfig(guildId, config) {
    this.guildConfigs.set(guildId, config);
    await this.storage.set(guildId, config);
  }

  async updateConfig(guildId, updater) {
    const current = clone(await this.getConfig(guildId));
    const next = await updater(current);
    await this.saveConfig(guildId, next || current);
    return this.getConfig(guildId);
  }

  canEnforce(config) {
    return Boolean(config?.enabled && config.operatingMode === 'enforce');
  }

  isChannelWhitelisted(channelId, config) {
    return Array.isArray(config.whitelistChannelIds) && config.whitelistChannelIds.includes(channelId);
  }

  async isTrusted(member, config, options = {}) {
    return this.permissions.isTrusted(member, config, options);
  }

  async isDashboardAdmin(interaction, config) {
    return this.permissions.isDashboardAdmin(interaction, config);
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.moduleLoader.loadBuiltins();
    this.registry.on(Events.ClientReady, () => {
      this.resumeAutoLockdowns().catch((error) => this.logger.error('Could not resume automatic lockdown timers', error));
    });
    if (this.client.isReady?.()) {
      this.resumeAutoLockdowns().catch((error) => this.logger.error('Could not resume automatic lockdown timers', error));
    }
    this.logger.info('Protection manager started in monitor-first mode.');
  }

  async stop() {
    this.registry.removeAll();
    for (const timer of this.autoLockdownTimers.values()) clearTimeout(timer);
    this.autoLockdownTimers.clear();
    this.started = false;
  }

  async log(guild, title, description, fields = [], color = 0x5865F2) {
    const config = await this.getConfig(guild.id);
    if (!config.logChannelId) return false;
    const channel = guild.channels.cache.get(config.logChannelId)
      || await guild.channels.fetch(config.logChannelId).catch(() => null);
    if (!channel?.isTextBased?.() || !channel.send) return false;
    const embed = createEmbed(title, description, fields, color);
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })
      .catch((error) => this.logger.warn('Could not send protection log', error));
    return true;
  }

  async setFeature(guildId, feature, enabled) {
    if (!FEATURES.includes(feature)) throw new Error('Unknown protection feature.');
    return this.updateConfig(guildId, (config) => {
      config[feature].enabled = Boolean(enabled);
      return config;
    });
  }

  async setSystemEnabled(guildId, enabled) {
    return this.updateConfig(guildId, (config) => {
      config.enabled = Boolean(enabled);
      return config;
    });
  }

  async setOperatingMode(guildId, mode) {
    if (!MODES.includes(mode)) throw new Error('Mode must be monitor or enforce.');
    return this.updateConfig(guildId, (config) => {
      config.operatingMode = mode;
      return config;
    });
  }

  async setLogChannel(guildId, channelId) {
    return this.updateConfig(guildId, (config) => {
      config.logChannelId = channelId;
      return config;
    });
  }

  async setDashboardRole(guildId, roleId, enabled) {
    return this.updateConfig(guildId, (config) => {
      const ids = new Set(config.dashboardRoleIds);
      if (enabled) ids.add(roleId); else ids.delete(roleId);
      config.dashboardRoleIds = [...ids];
      return config;
    });
  }

  async setAllowedDomain(guildId, domain, enabled) {
    return this.updateConfig(guildId, (config) => {
      const domains = new Set(config.antiLink.allowLinks.map((item) => String(item).toLowerCase()));
      if (enabled) domains.add(domain.toLowerCase()); else domains.delete(domain.toLowerCase());
      config.antiLink.allowLinks = [...domains];
      return config;
    });
  }

  async setWhitelist(guildId, kind, id, enabled) {
    const keys = { user: 'whitelistUserIds', role: 'whitelistRoleIds', channel: 'whitelistChannelIds' };
    const key = keys[kind];
    if (!key) throw new Error('Unsupported whitelist type.');
    return this.updateConfig(guildId, (config) => {
      const ids = new Set(config[key]);
      if (enabled) ids.add(id); else ids.delete(id);
      config[key] = [...ids];
      return config;
    });
  }

  async setEmergency(guild, enabled, actorId = null, reason = 'Manual security lockdown', options = {}) {
    if (enabled) {
      const result = await this.lockdownService.activate(guild, actorId, reason, options.autoDurationMs || null);
      const config = await this.getConfig(guild.id);
      if (config.emergency.autoExpiresAt) this.scheduleAutoLockdown(guild, config.emergency.autoExpiresAt);
      return result;
    }
    const timer = this.autoLockdownTimers.get(guild.id);
    if (timer) clearTimeout(timer);
    this.autoLockdownTimers.delete(guild.id);
    return this.lockdownService.deactivate(guild, actorId, reason);
  }

  scheduleAutoLockdown(guild, expiresAt) {
    const previous = this.autoLockdownTimers.get(guild.id);
    if (previous) clearTimeout(previous);
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const timer = setTimeout(async () => {
      try {
        const config = await this.getConfig(guild.id);
        if (config.emergency.enabled && config.emergency.autoExpiresAt === expiresAt) {
          await this.setEmergency(guild, false, this.client.user?.id || null, 'Automatic security lockdown expiry');
        }
      } catch (error) {
        this.logger.error(`Automatic lockdown expiry failed for guild ${guild.id}`, error);
      } finally {
        this.autoLockdownTimers.delete(guild.id);
      }
    }, delay);
    timer.unref?.();
    this.autoLockdownTimers.set(guild.id, timer);
  }

  async resumeAutoLockdowns() {
    if (typeof this.storage.getAll !== 'function') return;
    const all = await this.storage.getAll();
    for (const [guildId, config] of Object.entries(all)) {
      if (!config?.emergency?.enabled || !config.emergency.autoExpiresAt) continue;
      const guild = this.client.guilds.cache.get(guildId)
        || await this.client.guilds.fetch(guildId).catch(() => null);
      if (guild) this.scheduleAutoLockdown(guild, config.emergency.autoExpiresAt);
    }
  }

  async recordIncident(guild, type, description, fields = [], severity = 'medium', metadata = {}) {
    return this.incidents.record(guild, { type, description, fields, severity, metadata });
  }

  async getStatus(guildId) {
    const config = await this.getConfig(guildId);
    return {
      enabled: config.enabled,
      operatingMode: config.operatingMode,
      features: Object.fromEntries(FEATURES.map((key) => [key, config[key]?.enabled === true])),
      emergency: config.emergency.enabled,
      emergencyChannelCount: Array.isArray(config.emergency.snapshot) ? config.emergency.snapshot.length : 0,
      failedChannelIds: config.emergency.failedChannelIds || [],
      logChannelId: config.logChannelId,
      whitelistUsers: config.whitelistUserIds.length,
      whitelistRoles: config.whitelistRoleIds.length,
    };
  }
}

module.exports = { ProtectionManager, FEATURES, MODES };
