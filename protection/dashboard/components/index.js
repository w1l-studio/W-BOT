'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const FEATURES = ['antiNuke', 'antiSpam', 'antiRaid', 'antiLink', 'antiRole', 'antiChannel', 'antiWebhook'];
const SHORT_LABELS = {
  antiNuke: 'Anti-Nuke', antiSpam: 'Anti-Spam', antiRaid: 'Anti-Raid',
  antiLink: 'Anti-Link', antiRole: 'Anti-Role', antiChannel: 'القنوات', antiWebhook: 'Webhooks',
};

function buildFeatureToggleRows(status) {
  const rows = [];
  for (let index = 0; index < FEATURES.length; index += 4) {
    rows.push(new ActionRowBuilder().addComponents(...FEATURES.slice(index, index + 4).map((key) => new ButtonBuilder()
      .setCustomId(`protection:toggle:${key}`)
      .setLabel(`${status.features[key] ? 'إيقاف' : 'تشغيل'} ${SHORT_LABELS[key]}`)
      .setStyle(status.features[key] ? ButtonStyle.Danger : ButtonStyle.Success))));
  }
  return rows;
}

module.exports = { buildFeatureToggleRows, FEATURES, SHORT_LABELS };
