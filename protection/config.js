'use strict';

const { ANTI_NUKE_DEFAULTS } = require('./modules/antiNuke/config');

// Safe-by-default configuration. Detection is enabled, but enforcement stays off
// until a server administrator explicitly changes operatingMode to "enforce".
const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  operatingMode: 'monitor', // monitor | enforce
  logChannelId: null,
  dashboardRoleIds: [],
  whitelistUserIds: [],
  whitelistRoleIds: [],
  whitelistChannelIds: [],
  antiNuke: { ...ANTI_NUKE_DEFAULTS },
  antiSpam: {
    enabled: true,
    windowMs: 6_000,
    maxMessages: 6,
    duplicateWindowMs: 12_000,
    maxDuplicates: 3,
    response: 'delete', // delete | timeout | delete_timeout
    timeoutMs: 60_000,
    alertCooldownMs: 15_000,
    ignoreBots: true,
    ignoreAttachments: false,
  },
  antiRaid: {
    enabled: true,
    windowMs: 15_000,
    maxJoins: 8,
    alertCooldownMs: 30_000,
    response: 'alert', // alert | lockdown
    lockdownDurationMs: 5 * 60 * 1000,
  },
  antiLink: {
    enabled: false,
    allowLinks: [],
    blockInvites: true,
    blockAllLinks: false,
    response: 'delete',
    alertCooldownMs: 10_000,
  },
  antiRole: {
    enabled: true,
    protectAdministrator: true,
    protectMentionEveryone: true,
    protectedPermissions: [
      'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels',
      'ManageWebhooks', 'BanMembers', 'KickMembers', 'MentionEveryone'
    ],
  },
  antiChannel: { enabled: true, alertOnDelete: true, alertOnCreate: false },
  antiWebhook: { enabled: true, alertOnCreate: true, alertOnDelete: true, alertOnUpdate: true },
  emergency: {
    enabled: false,
    activatedAt: null,
    activatedBy: null,
    autoExpiresAt: null,
    snapshot: [],
    failedChannelIds: [],
  },
});

module.exports = { DEFAULT_CONFIG };
