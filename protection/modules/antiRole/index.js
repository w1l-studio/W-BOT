'use strict';

const { PermissionFlagsBits } = require('discord.js');

async function onRoleUpdate(manager, oldRole, newRole) {
  const config = await manager.getConfig(newRole.guild.id);
  if (!config.enabled || !config.antiRole.enabled) return;
  const added = newRole.permissions.bitfield & ~oldRole.permissions.bitfield;
  let protectedPermissions = Array.isArray(config.antiRole.protectedPermissions) ? config.antiRole.protectedPermissions : [];
  if (!config.antiRole.protectAdministrator) protectedPermissions = protectedPermissions.filter((name) => name !== 'Administrator');
  if (!config.antiRole.protectMentionEveryone) protectedPermissions = protectedPermissions.filter((name) => name !== 'MentionEveryone');
  const dangerous = [];
  for (const name of protectedPermissions) {
    const flag = PermissionFlagsBits[name];
    if (flag !== undefined && (added & flag) === flag) dangerous.push(name);
  }
  if (!dangerous.length) return;

  await manager.recordIncident(newRole.guild, 'ANTI_ROLE', `تمت إضافة صلاحيات حساسة إلى الرتبة ${newRole.name}.`, [
    { name: 'الرتبة', value: `${newRole.name} (${newRole.id})`, inline: false },
    { name: 'الصلاحيات المضافة', value: dangerous.join(', '), inline: true },
    { name: 'الملاحظة', value: 'هذا تنبيه؛ لم يتم تغيير صلاحيات الرتبة تلقائيًا.', inline: false },
  ], dangerous.includes('Administrator') ? 'high' : 'medium', { roleId: newRole.id, dangerousPermissions: dangerous });
}

module.exports = { onRoleUpdate };
