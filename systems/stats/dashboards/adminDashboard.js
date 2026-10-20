"use strict";

const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { number, percent } = require("../utils/formatters");
const { bar } = require("../utils/charts");
const { makeAdminMenu } = require("../components/menus");
const { makeRefreshButton, makeAdminExportButton } = require("../components/buttons");

const TITLES = {
  overview: "نظرة عامة على السيرفر",
  members: "نمو المجتمع والأعضاء",
  activity: "نشاط الشات والقنوات",
  games: "تحليلات الألعاب",
  economy: "تحليلات الاقتصاد",
  reports: "التقارير والمقارنات",
};
function formatComparison(value) {
  if (!value || value.percent === null) return "لا توجد فترة سابقة للمقارنة";
  const symbol = value.change > 0 ? "↗️" : value.change < 0 ? "↘️" : "➡️";
  const pct = `${value.percent > 0 ? "+" : ""}${value.percent}%`;
  return `${symbol} ${pct} (${value.change > 0 ? "+" : ""}${number(value.change)}) مقارنة بالفترة السابقة`;
}
function buildAdminDashboard({ guild, repository, page = "overview", reportService }) {
  const selectedPage = Object.prototype.hasOwnProperty.call(TITLES, page) ? page : "overview";
  const summary7 = repository.getSummary(guild.id, 7, guild.memberCount);
  const summary30 = repository.getSummary(guild.id, 30, guild.memberCount);
  const embed = new EmbedBuilder().setColor(config.accentColor).setTitle(`Trivia BOT | 🛡️ ${TITLES[selectedPage]}`)
    .setDescription(`السيرفر: **${guild.name}**\nالفترة الافتراضية: آخر 7 أيام · التوقيت اليومي UTC`)
    .setFooter({ text: `${config.footerText} • لوحة إدارية` }).setTimestamp(new Date());
  let components = [makeAdminMenu("owner-placeholder", selectedPage)[0]];

  if (selectedPage === "overview") {
    embed.addFields(
      { name: "👥 الأعضاء الحاليون", value: number(guild.memberCount), inline: true },
      { name: "🆕 انضمامات · 7 أيام", value: number(summary7.joins), inline: true },
      { name: "🚪 مغادرات · 7 أيام", value: number(summary7.leaves), inline: true },
      { name: "📈 صافي النمو", value: `${summary7.netGrowth > 0 ? "+" : ""}${number(summary7.netGrowth)}`, inline: true },
      { name: "💬 رسائل · 7 أيام", value: number(summary7.messages), inline: true },
      { name: "👤 أعضاء نشطون · 7 أيام", value: number(summary7.activeMembers), inline: true },
      { name: "🎮 جولات · 7 أيام", value: number(summary7.gameSessions), inline: true },
      { name: "✅ إجابات صحيحة · 7 أيام", value: number(summary7.correct), inline: true },
      { name: "📊 نمو 30 يومًا", value: `${number(summary30.joins)} انضمام • ${number(summary30.leaves)} مغادرة • صافي ${summary30.netGrowth > 0 ? "+" : ""}${number(summary30.netGrowth)}`, inline: false },
    );
  } else if (selectedPage === "members") {
    const leaders = repository.getLeaderboard(guild.id, "messages", 10);
    embed.addFields(
      { name: "الأعضاء الحاليون", value: number(guild.memberCount), inline: true },
      { name: "الانضمامات", value: number(summary7.joins), inline: true },
      { name: "المغادرات", value: number(summary7.leaves), inline: true },
      { name: "صافي النمو", value: `${summary7.netGrowth > 0 ? "+" : ""}${number(summary7.netGrowth)}`, inline: true },
      { name: "الأعضاء الأكثر إرسالًا للرسائل · إجمالي مسجل", value: leaders.length ? leaders.map((x, i) => `**${i + 1}.** <@${x.userId}> — ${number(x.value)} رسالة`).join("\n") : "لا توجد بيانات بعد.", inline: false },
      { name: "أعضاء نشطون خلال 7 أيام", value: number(summary7.activeMembers), inline: true },
    );
  } else if (selectedPage === "activity") {
    const messageReport = reportService.buildReport(repository, guild.id, 7, guild.memberCount);
    embed.addFields(
      { name: "الرسائل · 7 أيام", value: number(summary7.messages), inline: true },
      { name: "الرسائل · 30 يومًا", value: number(summary30.messages), inline: true },
      { name: "مقارنة بالأسبوع السابق", value: formatComparison(messageReport.comparison.messages), inline: false },
      { name: "أكثر القنوات نشاطًا · 7 أيام", value: summary7.topChannels.length ? summary7.topChannels.slice(0, 8).map((x, i) => `**${i + 1}.** <#${x.id}> — ${number(x.count)} رسالة`).join("\n") : "لا توجد بيانات قنوات مسجّلة.", inline: false },
      { name: "ساعة الذروة (UTC)", value: summary7.busiestHour ? `${summary7.busiestHour.hour}:00 UTC — ${number(summary7.busiestHour.count)} رسالة` : "لا توجد بيانات كافية", inline: true },
    );
  } else if (selectedPage === "games") {
    embed.addFields(
      { name: "جولات اللعب · 7 أيام", value: number(summary7.gameSessions), inline: true },
      { name: "جولات اللعب · 30 يومًا", value: number(summary30.gameSessions), inline: true },
      { name: "الإجابات الصحيحة", value: number(summary7.correct), inline: true },
      { name: "إجمالي الإجابات", value: number(summary7.answers), inline: true },
      { name: "دقة الإجابات", value: percent(summary7.correct, summary7.answers), inline: true },
      { name: "الانتصارات المسجلة", value: number(summary7.wins), inline: true },
      { name: "الألعاب الأكثر استخدامًا", value: summary7.topGames.length ? summary7.topGames.slice(0, 8).map((x, i) => `**${i + 1}. ${String(x.name).slice(0, 40)}** — ${number(x.sessions)} جولة\n${bar(x.sessions, summary7.topGames[0].sessions, 12)}`).join("\n") : "لا توجد بيانات ألعاب بعد. اربط أنظمة اللعب بدالة recordGame.", inline: false },
    );
  } else if (selectedPage === "economy") {
    const earners = repository.getEconomyLeaderboard(guild.id, "earned", 5);
    const spenders = repository.getEconomyLeaderboard(guild.id, "spent", 5);
    embed.addFields(
      { name: "كوينز مكتسبة · 7 أيام", value: number(summary7.earned), inline: true },
      { name: "كوينز مصروفة · 7 أيام", value: number(summary7.spent), inline: true },
      { name: "قيمة التحويلات · 7 أيام", value: number(summary7.transfers), inline: true },
      { name: "أعلى المكتسبين · إجمالي مسجل", value: earners.length ? earners.map((x, i) => `**${i + 1}.** <@${x.userId}> — ${number(x.value)}`).join("\n") : "لا توجد بيانات اقتصاد مربوطة.", inline: false },
      { name: "أعلى المصروفين · إجمالي مسجل", value: spenders.length ? spenders.map((x, i) => `**${i + 1}.** <@${x.userId}> — ${number(x.value)}`).join("\n") : "لا توجد بيانات اقتصاد مربوطة.", inline: false },
      { name: "ملاحظة", value: "البيانات لا تشمل معاملات الاقتصاد إلا بعد استدعاء recordEconomy من نظام الاقتصاد الحالي.", inline: false },
    );
  } else if (selectedPage === "reports") {
    const report = reportService ? reportService.buildReport(repository, guild.id, 7, guild.memberCount) : null;
    const s = report?.current || summary7;
    embed.addFields(
      { name: "ملخص 7 أيام", value: `الرسائل: **${number(s.messages)}**\nالانضمامات: **${number(s.joins)}**\nالمغادرات: **${number(s.leaves)}**\nصافي النمو: **${s.netGrowth > 0 ? "+" : ""}${number(s.netGrowth)}**\nجولات اللعب: **${number(s.gameSessions)}**`, inline: false },
      { name: "مقارنة الفترات", value: "استخدم تصدير CSV لتنزيل ملخص يومي. مقارنة الفترات تعتمد على بيانات الأيام المسجّلة بعد تفعيل النظام.", inline: false },
    );
    components.push(makeAdminExportButton("owner-placeholder", 7)[0]);
  }

  return { embeds: [embed], components };
}
module.exports = { buildAdminDashboard, ADMIN_PAGE_TITLES: TITLES };
