"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { buildMemberDashboard } = require("../dashboards/memberDashboard");
const { getStatsSystem } = require("../index");

module.exports = {
  data: new SlashCommandBuilder().setName("stats").setDescription("عرض إحصائياتك الشخصية في Trivia BOT"),
  async execute(interaction) {
    if (!interaction.guildId || !interaction.guild || !interaction.user) {
      return interaction.reply({ content: "هذا الأمر متاح داخل السيرفر فقط.", ephemeral: true });
    }
    const system = getStatsSystem(interaction.client);
    if (!system) return interaction.reply({ content: "نظام الإحصائيات غير مسجّل بعد. أضف registerStatsSystem(client) إلى ملف تشغيل البوت.", ephemeral: true });
    const payload = buildMemberDashboard({ guild: interaction.guild, user: interaction.user, repository: system.repository });
    return interaction.reply({ ...payload, ephemeral: true });
  },
};
