"use strict";

const { PermissionFlagsBits } = require("discord.js");
const DEFAULT_PERMISSION_BITS = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageGuild].filter(Boolean);

function hasAdminAccess(interaction, config = {}) {
  if (!interaction?.guild || !interaction?.member) return false;
  const permissions = interaction.memberPermissions || interaction.member?.permissions;
  if (permissions?.has) {
    const configured = (config.adminPermissions || ["Administrator", "ManageGuild"])
      .map((name) => PermissionFlagsBits[name])
      .filter(Boolean);
    const bits = configured.length ? configured : DEFAULT_PERMISSION_BITS;
    if (bits.some((bit) => permissions.has(bit))) return true;
  }
  const roleIds = config.adminRoleIds || [];
  if (!roleIds.length) return false;
  const cache = interaction.member?.roles?.cache;
  if (cache?.some) return roleIds.some((roleId) => cache.has(roleId));
  const raw = interaction.member?.roles;
  if (Array.isArray(raw)) return roleIds.some((roleId) => raw.includes(roleId));
  return false;
}
module.exports = { hasAdminAccess };
