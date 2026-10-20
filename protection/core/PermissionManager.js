'use strict';

const { PermissionFlagsBits } = require('discord.js');

class PermissionManager {
  constructor(manager) { this.manager = manager; }

  async isTrusted(member, config, options = {}) {
    if (!member) return false;
    if (!options.ignoreOwner && member.id === member.guild?.ownerId) return true;
    if (config.whitelistUserIds.includes(member.id)) return true;
    const roles = member.roles?.cache;
    if (roles?.some) return roles.some((role) => config.whitelistRoleIds.includes(role.id));
    if (Array.isArray(member.roles)) return member.roles.some((id) => config.whitelistRoleIds.includes(id));
    return false;
  }

  async isDashboardAdmin(interaction, config) {
    if (!interaction.member) return false;
    if (interaction.guild?.ownerId === interaction.user.id) return true;
    if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;
    const roles = interaction.member.roles?.cache;
    if (roles?.has) return config.dashboardRoleIds.some((id) => roles.has(id));
    if (Array.isArray(interaction.member.roles)) return config.dashboardRoleIds.some((id) => interaction.member.roles.includes(id));
    return false;
  }
}

module.exports = { PermissionManager };
