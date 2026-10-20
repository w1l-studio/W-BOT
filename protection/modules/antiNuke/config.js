'use strict';

const ANTI_NUKE_DEFAULTS = Object.freeze({
  enabled: true,
  windowMs: 12_000,
  maxActions: 4,
  cooldownMs: 60_000,
  actions: [
    'ChannelDelete', 'ChannelCreate', 'ChannelUpdate',
    'RoleDelete', 'RoleCreate', 'RoleUpdate',
    'Ban', 'Kick', 'WebhookCreate', 'WebhookDelete', 'WebhookUpdate', 'BotAdd',
  ],
  response: 'log', // log | strip_roles | timeout
  timeoutMs: 10 * 60 * 1000,
  exemptOwner: true,
});

module.exports = { ANTI_NUKE_DEFAULTS };
