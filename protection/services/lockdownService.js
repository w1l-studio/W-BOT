'use strict';

const { PermissionFlagsBits } = require('discord.js');

const LOCKDOWN_PERMISSIONS = [
  ['SendMessages', PermissionFlagsBits.SendMessages],
  ['SendMessagesInThreads', PermissionFlagsBits.SendMessagesInThreads],
  ['CreatePublicThreads', PermissionFlagsBits.CreatePublicThreads],
  ['CreatePrivateThreads', PermissionFlagsBits.CreatePrivateThreads],
];

function permissionState(overwrite, bit) {
  if (!overwrite) return null;
  if (overwrite.allow.has(bit)) return true;
  if (overwrite.deny.has(bit)) return false;
  return null;
}

class LockdownService {
  constructor(manager) { this.manager = manager; }

  async listTextChannels(guild) {
    let channels = guild.channels.cache;
    try {
      const fetched = await guild.channels.fetch();
      if (fetched?.size) channels = fetched;
    } catch (error) {
      this.manager.logger.warn('Could not fetch every guild channel before lockdown', error);
    }
    return [...channels.values()].filter((channel) =>
      channel?.guild?.id === guild.id && channel.isTextBased?.() && !channel.isThread?.()
      && channel.permissionOverwrites?.edit
    );
  }

  async activate(guild, actorId = null, reason = 'Manual security lockdown', autoDurationMs = null) {
    const config = await this.manager.getConfig(guild.id);
    if (config.emergency.enabled && config.emergency.snapshot?.length) {
      return { alreadyActive: true, applied: 0, failed: config.emergency.failedChannelIds || [] };
    }

    const channels = (await this.listTextChannels(guild)).filter((channel) => channel.id !== config.logChannelId);
    const snapshot = channels.map((channel) => {
      const overwrite = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
      const permissions = Object.fromEntries(LOCKDOWN_PERMISSIONS.map(([name, bit]) => [name, permissionState(overwrite, bit)]));
      return { channelId: channel.id, hadOverwrite: Boolean(overwrite), permissions };
    });

    // Persist the complete snapshot before changing any permissions.
    await this.manager.updateConfig(guild.id, (current) => {
      current.emergency.enabled = true;
      current.emergency.activatedAt = new Date().toISOString();
      current.emergency.activatedBy = actorId;
      current.emergency.autoExpiresAt = Number(autoDurationMs) > 0 ? new Date(Date.now() + Number(autoDurationMs)).toISOString() : null;
      current.emergency.snapshot = snapshot;
      current.emergency.failedChannelIds = snapshot.map((item) => item.channelId);
      return current;
    });

    let applied = 0;
    const failed = [];
    for (const channel of channels) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        }, { reason });
        applied += 1;
      } catch (error) {
        failed.push(channel.id);
        this.manager.logger.warn(`Lockdown failed for channel ${channel.id}`, error);
      }
    }

    const appliedIds = new Set(channels.filter((channel) => !failed.includes(channel.id)).map((channel) => channel.id));
    await this.manager.updateConfig(guild.id, (current) => {
      // Only restore channels where the lockdown edit succeeded. This avoids clearing
      // permission bits on channels the system never changed.
      current.emergency.snapshot = snapshot.filter((item) => appliedIds.has(item.channelId));
      current.emergency.failedChannelIds = failed;
      return current;
    });
    await this.manager.recordIncident(guild, 'LOCKDOWN_ENABLED', 'تم تفعيل وضع الطوارئ ومحاولة منع إرسال الرسائل في القنوات النصية.', [
      { name: 'بواسطة', value: actorId ? `<@${actorId}>` : 'النظام', inline: true },
      { name: 'قنوات تم تأمينها', value: String(applied), inline: true },
      { name: 'قنوات لم تنجح', value: String(failed.length), inline: true },
    ], failed.length ? 'high' : 'medium', { actorId, failedChannelIds: failed });

    return { alreadyActive: false, applied, failed };
  }

  async deactivate(guild, actorId = null, reason = 'Security lockdown disabled') {
    const config = await this.manager.getConfig(guild.id);
    const snapshot = Array.isArray(config.emergency.snapshot) ? config.emergency.snapshot : [];
    if (!config.emergency.enabled && !snapshot.length) {
      return { alreadyInactive: true, restored: 0, failed: [] };
    }

    let restored = 0;
    const failed = [];
    const remaining = [];
    for (const item of snapshot) {
      try {
        const channel = guild.channels.cache.get(item.channelId)
          || await guild.channels.fetch(item.channelId).catch(() => null);
        // A deleted channel has no remaining permissions to restore.
        if (!channel) {
          restored += 1;
          continue;
        }
        if (!channel.permissionOverwrites) {
          failed.push(item.channelId);
          remaining.push(item);
          continue;
        }
        // Restore only the four permission bits used by lockdown. This avoids
        // deleting unrelated @everyone overwrites that an admin may have changed meanwhile.
        await channel.permissionOverwrites.edit(guild.roles.everyone, item.permissions, { reason });
        restored += 1;
      } catch (error) {
        failed.push(item.channelId);
        remaining.push(item);
        this.manager.logger.warn(`Lockdown restore failed for channel ${item.channelId}`, error);
      }
    }

    await this.manager.updateConfig(guild.id, (current) => {
      current.emergency.enabled = remaining.length > 0;
      current.emergency.snapshot = remaining;
      current.emergency.failedChannelIds = failed;
      if (!remaining.length) {
        current.emergency.activatedAt = null;
        current.emergency.activatedBy = null;
        current.emergency.autoExpiresAt = null;
        current.emergency.failedChannelIds = [];
      }
      return current;
    });
    await this.manager.recordIncident(guild, remaining.length ? 'LOCKDOWN_PARTIAL_RESTORE' : 'LOCKDOWN_DISABLED',
      remaining.length ? 'انتهت محاولة فك الطوارئ جزئيًا؛ بقيت قنوات تحتاج إلى استعادة. أعد المحاولة بعد تصحيح الصلاحيات.' : 'تم إنهاء وضع الطوارئ واستعادة الصلاحيات السابقة المحفوظة.', [
        { name: 'بواسطة', value: actorId ? `<@${actorId}>` : 'النظام', inline: true },
        { name: 'قنوات تمت استعادتها', value: String(restored), inline: true },
        { name: 'قنوات تحتاج مراجعة', value: String(failed.length), inline: true },
      ], remaining.length ? 'high' : 'low', { actorId, failedChannelIds: failed });
    return { alreadyInactive: false, restored, failed };
  }
}

module.exports = { LockdownService, LOCKDOWN_PERMISSIONS, permissionState };
