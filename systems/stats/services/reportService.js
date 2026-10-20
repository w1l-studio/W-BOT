"use strict";

const { comparePeriods } = require("./statsAnalyzer");

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function buildReport(repository, guildId, days = 7, memberCount = null) {
  const periodDays = Math.max(1, Number(days) || 7);
  const current = repository.getSummary(guildId, periodDays, memberCount);
  const previous = repository.getSummary(guildId, periodDays * 2, memberCount);
  // Separate the preceding window using daily rows where possible.
  const currentKeys = new Set(current.daily.map((row) => row.date));
  const all = previous.daily || [];
  const priorRows = all.filter((row) => !currentKeys.has(row.date));
  const prior = {
    messages: priorRows.reduce((s, x) => s + x.messages, 0),
    joins: priorRows.reduce((s, x) => s + x.joins, 0),
    leaves: priorRows.reduce((s, x) => s + x.leaves, 0),
    gameSessions: priorRows.reduce((s, x) => s + x.gameSessions, 0),
    answers: priorRows.reduce((s, x) => s + (x.answers || 0), 0),
    correct: priorRows.reduce((s, x) => s + (x.correct || 0), 0),
    earned: priorRows.reduce((s, x) => s + (x.earned || 0), 0),
    spent: priorRows.reduce((s, x) => s + (x.spent || 0), 0),
    transfers: priorRows.reduce((s, x) => s + (x.transfers || 0), 0),
  };
  return { current, previous: prior, comparison: comparePeriods(current, prior), periodDays };
}

function reportToCsv(report) {
  const lines = ["date,messages,joins,leaves,game_sessions"];
  for (const day of report.current.daily) {
    lines.push([day.date, day.messages, day.joins, day.leaves, day.gameSessions].map(csvEscape).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function formatReportText(report) {
  const s = report.current;
  const rows = [
    `Trivia BOT — تقرير آخر ${report.periodDays} يوم`,
    `الرسائل: ${s.messages}`,
    `الأعضاء الجدد: ${s.joins}`,
    `المغادرون: ${s.leaves}`,
    `صافي النمو: ${s.netGrowth >= 0 ? "+" : ""}${s.netGrowth}`,
    `جولات اللعب: ${s.gameSessions}`,
    `الإجابات الصحيحة: ${s.correct}`,
    `الكوينز المكتسبة: ${s.earned}`,
    `الكوينز المصروفة: ${s.spent}`,
    `أكثر لعبة استخدامًا: ${s.topGames[0]?.name || "لا توجد بيانات مسجلة"}`,
  ];
  return rows.join("\n");
}

module.exports = { buildReport, reportToCsv, formatReportText };
