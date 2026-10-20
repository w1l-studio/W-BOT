'use strict';

const { EmbedBuilder } = require('discord.js');

function createEmbed(title, description, fields = [], color = 0x5865F2) {
  return new EmbedBuilder().setColor(color).setTitle(String(title).slice(0, 256))
    .setDescription(String(description || '').slice(0, 4096))
    .addFields(fields.slice(0, 25).map((field) => ({
      name: String(field.name || 'معلومة').slice(0, 256),
      value: String(field.value || '—').slice(0, 1024),
      inline: Boolean(field.inline),
    }))).setTimestamp();
}

async function sendGuildLog(manager, guild, title, description, fields = [], color = 0x5865F2) {
  return manager.log(guild, title, description, fields, color);
}

module.exports = { createEmbed, sendGuildLog };
