'use strict';

async function applyResponse(manager, guild, executor, config, context = {}) {
  const guildConfig = await manager.getConfig(guild.id);
  if (!manager.canEnforce(guildConfig)) return { enforced: false, action: 'monitor' };

  let success = false;
  if (config.response === 'timeout' && executor) {
    success = await manager.punishments.timeout(executor, config.timeoutMs, 'Anti-Nuke: suspicious administrative activity');
  } else if (config.response === 'strip_roles' && executor) {
    success = await manager.punishments.stripManageRoles(executor, 'Anti-Nuke: suspicious administrative activity');
  }

  if (config.response !== 'log') {
    await manager.recordIncident(guild, 'ANTI_NUKE_RESPONSE', success ? 'تم تنفيذ استجابة Anti-Nuke.' : 'لم تنجح استجابة Anti-Nuke؛ تحقق من صلاحيات البوت وترتيب الرتب.', [
      { name: 'الإجراء المطلوب', value: String(config.response), inline: true },
      { name: 'المنفذ', value: context.actorId ? `<@${context.actorId}>` : (executor?.id || 'غير معروف'), inline: true },
    ], success ? 'high' : 'critical', { ...context, response: config.response, success });
  }
  return { enforced: true, action: config.response, success };
}

module.exports = { applyResponse };
