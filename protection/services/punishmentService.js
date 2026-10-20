'use strict';

const { PermissionFlagsBits } = require('discord.js');

class PunishmentService {
  constructor(manager) { this.manager = manager; }

  async timeout(member, durationMs, reason) {
    if (!member?.moderatable) return false;
    const safeDuration = Math.max(1_000, Math.min(Number(durationMs) || 60_000, 28 * 24 * 60 * 60 * 1000));
    try {
      await member.timeout(safeDuration, reason);
      return true;
    } catch (error) {
      this.manager.logger.warn('Timeout failed', error);
      return false;
    }
  }

  async stripManageRoles(member, reason) {
    if (!member?.manageable) return false;
    const botMember = member.guild.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
    const removable = member.roles.cache.filter((role) =>
      role.id !== member.guild.id &&
      role.position < botMember.roles.highest.position &&
      !role.managed &&
      (role.permissions.has(PermissionFlagsBits.Administrator) ||
       role.permissions.has(PermissionFlagsBits.ManageGuild) ||
       role.permissions.has(PermissionFlagsBits.ManageRoles) ||
       role.permissions.has(PermissionFlagsBits.ManageChannels) ||
       role.permissions.has(PermissionFlagsBits.ManageWebhooks))
    );
    if (!removable.size) return false;
    try {
      await member.roles.remove(removable, reason);
      return true;
    } catch (error) {
      this.manager.logger.warn('Role stripping failed', error);
      return false;
    }
  }
}

module.exports = { PunishmentService };
