"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function makeRefreshButton(kind, ownerId, page) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ts:refresh:${kind}:${ownerId}:${page}`).setLabel("تحديث").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ts:close:${kind}:${ownerId}`).setLabel("إغلاق").setEmoji("✖️").setStyle(ButtonStyle.Danger),
  );
}
function makeAdminExportButton(ownerId, days = 7) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ts:export:${ownerId}:${days}`).setLabel(`تصدير CSV · ${days} أيام`).setEmoji("📄").setStyle(ButtonStyle.Primary),
  );
}
module.exports = { makeRefreshButton, makeAdminExportButton };
