"use strict";

const path = require("node:path");
const defaultConfig = require("./config");
const { StatsRepository } = require("./database/statsRepository");
const { attachStatsCollector } = require("./services/statsCollector");
const { makeMemberMenu, makeAdminMenu } = require("./components/menus");
const { makeRefreshButton, makeAdminExportButton } = require("./components/buttons");
const { buildMemberDashboard } = require("./dashboards/memberDashboard");
const { buildAdminDashboard } = require("./dashboards/adminDashboard");
const { hasAdminAccess } = require("./utils/permissions");
const reportService = require("./services/reportService");

function getStatsSystem(client) {
  return client?.__triviaStatsSystem || null;
}

function isAdmin(interaction, system) {
  return hasAdminAccess(interaction, system.config);
}

async function handleStatsComponent(interaction, system) {
  const customId = interaction.customId || "";
  if (!customId.startsWith("ts:")) return false;
  const parts = customId.split(":");
  const action = parts[1];

  if (action === "menu") {
    const kind = parts[2];
    const ownerId = parts[3];
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "هذه لوحة إحصائيات خاصة بالشخص الذي فتحها.", ephemeral: true });
      return true;
    }
    if (kind === "admin" && !isAdmin(interaction, system)) {
      await interaction.reply({ content: "⛔ لم تعد تملك صلاحية فتح لوحة الإدارة.", ephemeral: true });
      return true;
    }
    const page = interaction.values?.[0] || "overview";
    const payload = kind === "admin"
      ? buildAdminDashboard({ guild: interaction.guild, repository: system.repository, page, reportService })
      : buildMemberDashboard({ guild: interaction.guild, user: interaction.user, repository: system.repository, page });
    payload.components = kind === "admin"
      ? [makeAdminMenu(interaction.user.id, page)[0], makeRefreshButton("a", interaction.user.id, page)]
      : [makeMemberMenu(interaction.user.id, page)[0], makeRefreshButton("m", interaction.user.id, page)];
    if (kind === "admin" && page === "reports") payload.components.push(makeAdminExportButton(interaction.user.id, 7)[0]);
    await interaction.update(payload);
    return true;
  }

  if (action === "refresh") {
    const kind = parts[2]; const ownerId = parts[3]; const page = parts[4] || "overview";
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "هذه لوحة خاصة بالشخص الذي فتحها.", ephemeral: true });
      return true;
    }
    if (kind === "a" && !isAdmin(interaction, system)) {
      await interaction.reply({ content: "⛔ لا تملك صلاحية لوحة الإدارة.", ephemeral: true });
      return true;
    }
    const payload = kind === "a"
      ? buildAdminDashboard({ guild: interaction.guild, repository: system.repository, page, reportService })
      : buildMemberDashboard({ guild: interaction.guild, user: interaction.user, repository: system.repository, page });
    payload.components = kind === "a"
      ? [makeAdminMenu(interaction.user.id, page)[0], makeRefreshButton("a", interaction.user.id, page)]
      : [makeMemberMenu(interaction.user.id, page)[0], makeRefreshButton("m", interaction.user.id, page)];
    if (kind === "a" && page === "reports") payload.components.push(makeAdminExportButton(interaction.user.id, 7)[0]);
    await interaction.update(payload);
    return true;
  }

  if (action === "close") {
    const kind = parts[2]; const ownerId = parts[3];
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "يمكن لصاحب اللوحة إغلاقها فقط.", ephemeral: true });
      return true;
    }
    await interaction.update({ content: "تم إغلاق لوحة الإحصائيات.", embeds: [], components: [] });
    return true;
  }

  if (action === "export") {
    const ownerId = parts[2]; const days = Math.max(1, Math.min(system.config.maxReportDays || 90, Number(parts[3]) || 7));
    if (interaction.user.id !== ownerId || !isAdmin(interaction, system)) {
      await interaction.reply({ content: "⛔ هذا التقرير متاح للإدارة التي فتحت اللوحة فقط.", ephemeral: true });
      return true;
    }
    const { AttachmentBuilder } = require("discord.js");
    const report = reportService.buildReport(system.repository, interaction.guild.id, days, interaction.guild.memberCount);
    const csv = reportService.reportToCsv(report);
    const attachment = new AttachmentBuilder(Buffer.from(csv, "utf8"), { name: `trivia-stats-${days}d-${new Date().toISOString().slice(0, 10)}.csv` });
    await interaction.reply({ content: `📄 تقرير الإحصائيات لآخر ${days} أيام.`, files: [attachment], ephemeral: true });
    return true;
  }

  return false;
}

function registerStatsSystem(client, options = {}) {
  if (!client) throw new TypeError("registerStatsSystem(client) requires a Discord client");
  if (client.__triviaStatsSystem) return client.__triviaStatsSystem;
  const config = { ...defaultConfig, ...options };
  config.adminRoleIds = Array.isArray(options.adminRoleIds) ? options.adminRoleIds : defaultConfig.adminRoleIds;
  const dataFile = options.dataFile || options.filePath || defaultConfig.dataFile;
  const repository = new StatsRepository({ filePath: path.resolve(dataFile), historyDays: config.historyDays, saveDebounceMs: config.saveDebounceMs });
  const system = { client, config, repository, startedAt: new Date().toISOString() };
  client.__triviaStatsSystem = system;
  attachStatsCollector(client, repository, options.logger || console);
  client.on("interactionCreate", async (interaction) => {
    if (!(interaction.isButton?.() || interaction.isStringSelectMenu?.())) return;
    try { await handleStatsComponent(interaction, system); }
    catch (error) {
      (options.logger || console).error(`[STATS] Component interaction failed: ${error.stack || error.message}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "حدث خطأ أثناء تحديث لوحة الإحصائيات. جرّب مرة أخرى.", ephemeral: true }).catch(() => {});
      }
    }
  });
  if (typeof client.on === "function") {
    client.on("error", (error) => (options.logger || console).error(`[STATS] Discord client error: ${error.message}`));
  }
  console.log("[STATS] Stats system registered. Run slash-command registration separately using your existing command loader.");
  return system;
}

function recordGame(client, data) {
  const system = getStatsSystem(client);
  if (!system) throw new Error("Stats system is not registered. Call registerStatsSystem(client) first.");
  return system.repository.recordGame(data);
}
function recordEconomy(client, data) {
  const system = getStatsSystem(client);
  if (!system) throw new Error("Stats system is not registered. Call registerStatsSystem(client) first.");
  return system.repository.recordEconomy(data);
}
async function flushStats(client) {
  const system = getStatsSystem(client);
  if (!system) return;
  await system.repository.flush();
}

module.exports = { registerStatsSystem, getStatsSystem, recordGame, recordEconomy, flushStats, handleStatsComponent };
