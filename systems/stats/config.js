"use strict";

const path = require("node:path");

module.exports = {
  // Data is stored separately from source code and is created on first run.
  dataFile: path.join(__dirname, "data", "stats.json"),
  historyDays: 90,
  saveDebounceMs: 750,
  // Admin access: Administrator or ManageGuild by default, OR one of these role IDs.
  // Add your own staff role IDs before deployment if desired.
  adminRoleIds: [],
  adminPermissions: ["Administrator", "ManageGuild"],
  defaultReportDays: 7,
  maxReportDays: 90,
  embedColor: 0x2B2D42,
  accentColor: 0x8B5CF6,
  footerText: "Trivia BOT • Stats System",
};
