"use strict";

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { buildAdminDashboard } = require("../dashboards/adminDashboard");
const { hasAdminAccess } = require("../utils/permissions");
const { getStatsSystem } = require("../index");
const { makeRefreshButton } = require("../components/buttons");
const reportService = require("../services/reportService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats-admin")
    .setDescription("فتح لوحة تحليلات الإدارة في Trivia BOT")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild) return interaction.reply({ content: "هذا الأمر متاح داخل السيرفر فقط.", ephemeral: true });
    const system = getStatsSystem(interaction.client);
    if (!system) return interaction.reply({ content: "نظام الإحصائيات غير مسجّل بعد. أضف registerStatsSystem(client) إلى ملف تشغيل البوت.", ephemeral: true });
    if (!hasAdminAccess(interaction, system.config)) return interaction.reply({ content: "⛔ هذا الأمر مخصص للإدارة المخوّلة فقط.", ephemeral: true });
    const payload = buildAdminDashboard({ guild: interaction.guild, repository: system.repository, page: "overview", reportService });
    // Bind the interactive menu to the administrator who opened the private panel.
    payload.components = payload.components.map((row) => {
      for (const component of row.components || []) {
        const id = component.data?.custom_id;
        if (id?.includes("owner-placeholder")) component.setCustomId(id.replace("owner-placeholder", interaction.user.id));
      }
      return row;
    });
    payload.components.push(makeRefreshButton("a", interaction.user.id, "overview"));
    return interaction.reply({ ...payload, ephemeral: true });
  },
};
