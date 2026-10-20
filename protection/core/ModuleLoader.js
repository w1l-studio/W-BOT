'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const { onMessage } = require('../modules/antiSpam');
const { onJoin } = require('../modules/antiRaid');
const { onLinkMessage } = require('../modules/antiLink');
const { onAuditEntry } = require('../modules/antiNuke');
const { onRoleUpdate } = require('../modules/antiRole');
const { onChannelDelete, onChannelCreate } = require('../modules/antiChannel');
const { onWebhookAudit } = require('../modules/antiWebhook');

class ModuleLoader {
  constructor(manager) { this.manager = manager; }

  loadBuiltins() {
    const { registry, logger } = this.manager;
    registry.on(Events.MessageCreate, (message) => this.guard('antiSpam', () => onMessage(this.manager, message)));
    registry.on(Events.MessageCreate, (message) => this.guard('antiLink', () => onLinkMessage(this.manager, message)));
    registry.on(Events.GuildMemberAdd, (member) => this.guard('antiRaid', () => onJoin(this.manager, member)));
    registry.on(Events.GuildAuditLogEntryCreate, (entry, guild) => this.guard('antiNuke', () => onAuditEntry(this.manager, entry, guild)));
    registry.on(Events.GuildAuditLogEntryCreate, (entry, guild) => this.guard('antiWebhook', () => onWebhookAudit(this.manager, entry, guild)));
    registry.on(Events.GuildRoleUpdate, (oldRole, newRole) => this.guard('antiRole', () => onRoleUpdate(this.manager, oldRole, newRole)));
    registry.on(Events.ChannelDelete, (channel) => this.guard('antiChannel', () => onChannelDelete(this.manager, channel)));
    registry.on(Events.ChannelCreate, (channel) => this.guard('antiChannel', () => onChannelCreate(this.manager, channel)));
    logger.info('Built-in protection modules loaded.');
  }

  async guard(name, task) {
    try { await task(); }
    catch (error) { this.manager.logger.error(`Module ${name} failed`, error); }
  }
}

module.exports = { ModuleLoader };
