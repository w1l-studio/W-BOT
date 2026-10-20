'use strict';

const URL_RE = /(?:(?:https?:\/\/|www\.)[^\s<>]+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>]*)?)/ig;
const INVITE_RE = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)[^\s<>]+/i;

function extractHosts(content) {
  const hosts = [];
  for (const raw of String(content || '').match(URL_RE) || []) {
    const candidate = raw.replace(/[),.!?]+$/g, '');
    try {
      const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      hosts.push(url.hostname.toLowerCase());
    } catch { /* Ignore malformed URL tokens. */ }
  }
  // Treat bare Discord invite patterns as URLs too.
  const invite = String(content || '').match(INVITE_RE)?.[0];
  if (invite) {
    try { hosts.push(new URL(`https://${invite}`).hostname.toLowerCase()); } catch { /* Ignore malformed invite. */ }
  }
  return [...new Set(hosts)];
}

function isAllowedHost(hosts, allowLinks) {
  const allowedDomains = (allowLinks || []).map((item) => String(item).toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]).filter(Boolean);
  return hosts.length > 0 && hosts.every((host) => allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
}

async function onLinkMessage(manager, message) {
  if (!message.guild || !message.member || message.author.bot) return;
  const config = await manager.getConfig(message.guild.id);
  if (!config.enabled || !config.antiLink.enabled || manager.isChannelWhitelisted(message.channelId, config)) return;
  if (await manager.isTrusted(message.member, config)) return;

  const content = message.content || '';
  const hasInvite = config.antiLink.blockInvites && INVITE_RE.test(content);
  const hosts = extractHosts(content);
  const hasBlockedLink = config.antiLink.blockAllLinks && hosts.length > 0;
  if (!hasInvite && !hasBlockedLink) return;
  if (isAllowedHost(hosts, config.antiLink.allowLinks)) return;

  const enforced = manager.canEnforce(config);
  let deletionResult = null;
  if (enforced && ['delete', 'delete_timeout'].includes(config.antiLink.response)) {
    try { await message.delete(); deletionResult = true; }
    catch (error) { deletionResult = false; manager.logger.warn('Anti-Link could not delete a message', error); }
  }
  const alertKey = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const lastAlert = manager.linkAlerts.get(alertKey) || 0;
  if (now - lastAlert < config.antiLink.alertCooldownMs) return;
  manager.linkAlerts.set(alertKey, now);
  await manager.recordIncident(message.guild, 'ANTI_LINK', `${enforced ? 'تم التعامل مع' : 'تم رصد'} رابط مخالف من <@${message.author.id}>.`, [
    { name: 'العضو', value: `${message.author.tag} (${message.author.id})`, inline: false },
    { name: 'القناة', value: `<#${message.channelId}>`, inline: true },
    { name: 'نوع الرابط', value: hasInvite ? 'دعوة Discord' : 'رابط', inline: true },
    { name: 'الوضع', value: enforced ? 'تنفيذ' : 'مراقبة فقط', inline: true },
  ], enforced ? 'medium' : 'low', { actorId: message.author.id, channelId: message.channelId, hosts });
  if (enforced && ['timeout', 'delete_timeout'].includes(config.antiLink.response)) {
    await manager.punishments.timeout(message.member, 60_000, 'Anti-Link: prohibited link');
  }
}

module.exports = { onLinkMessage, URL_RE, INVITE_RE, extractHosts, isAllowedHost };
