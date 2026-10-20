"use strict";

const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { number, percent, shortDate } = require("../utils/formatters");
const { sparkline } = require("../utils/charts");
const { makeMemberMenu } = require("../components/menus");
const { makeRefreshButton } = require("../components/buttons");

const TITLES = {
  overview: "👤 الملف الشخصي",
  games: "🎮 الألعاب والأداء",
  activity: "📈 النشاط الشخصي",
  achievements: "🏅 الإنجازات والأرقام القياسية",
  economy: "💰 سجل الاقتصاد",
  leaderboard: "🏆 المتصدرون",
};

function buildMemberDashboard({ guild, user, repository, page = "overview" }) {
  const allowed = Object.keys(TITLES);
  const selectedPage = allowed.includes(page) ? page : "overview";
  const stats = repository.getUser(guild.id, user.id);
  const activity7 = repository.getUserActivity(guild.id, user.id, 7);
  const activity30 = repository.getUserActivity(guild.id, user.id, 30);
  const summary7 = repository.getSummary(guild.id, 7, guild.memberCount);
  const rank = repository.getLeaderboard(guild.id, "wins", 100).findIndex((x) => x.userId === user.id) + 1;
  const embed = new EmbedBuilder().setColor(config.embedColor).setTitle(`Trivia BOT | ${TITLES[selectedPage]}`)
    .setThumbnail(user.displayAvatarURL?.({ size: 128 }) || null)
    .setDescription(`إحصائيات <@${user.id}>\n*الأرقام المتاحة تعتمد على البيانات المسجّلة منذ تفعيل النظام.*`)
    .setFooter({ text: config.footerText }).setTimestamp(new Date());

  if (selectedPage === "overview") {
    embed.addFields(
      { name: "🎮 جولات اللعب", value: number(stats.gamesPlayed), inline: true },
      { name: "🏆 الانتصارات", value: number(stats.wins), inline: true },
      { name: "✅ إجابات صحيحة", value: number(stats.correctAnswers), inline: true },
      { name: "🧠 إجمالي الإجابات", value: number(stats.answers), inline: true },
      { name: "🎯 دقة الإجابات", value: percent(stats.correctAnswers, stats.answers), inline: true },
      { name: "🥇 ترتيب الانتصارات", value: rank > 0 ? `#${rank}` : "لا يوجد ترتيب بعد", inline: true },
      { name: "💬 الرسائل المسجلة", value: number(stats.messages), inline: true },
      { name: "🔥 أفضل سلسلة مسجلة", value: number(stats.bestStreak), inline: true },
      { name: "📅 آخر نشاط", value: stats.lastActiveAt ? `<t:${Math.floor(Date.parse(stats.lastActiveAt) / 1000)}:R>` : "لا توجد بيانات بعد", inline: true },
    );
  } else if (selectedPage === "games") {
    const rows = Object.values(stats.byGame || {}).sort((a, b) => b.sessions - a.sessions).slice(0, 8);
    embed.addFields(
      { name: "الجولات", value: number(stats.gamesPlayed), inline: true },
      { name: "الانتصارات", value: number(stats.wins), inline: true },
      { name: "نسبة الفوز التقريبية", value: percent(stats.wins, stats.gamesPlayed), inline: true },
      { name: "أفضل الألعاب", value: rows.length ? rows.map((g, i) => `**${i + 1}. ${String(g.name).slice(0, 42)}** — ${number(g.sessions)} جولة · ${number(g.wins)} فوز · دقة ${percent(g.correct, g.answers)}`).join("\n") : "لا توجد جولات مسجّلة بعد.", inline: false },
    );
  } else if (selectedPage === "activity") {
    embed.addFields(
      { name: "رسائل خلال 7 أيام", value: number(activity7.reduce((s, x) => s + x.messages, 0)), inline: true },
      { name: "رسائل خلال 30 يومًا", value: number(activity30.reduce((s, x) => s + x.messages, 0)), inline: true },
      { name: "آخر نشاط", value: shortDate(stats.lastActiveAt), inline: true },
      { name: "نشاط الرسائل · آخر 7 أيام", value: `\`${sparkline(activity7.map((x) => x.messages))}\``, inline: false },
      { name: "توضيح", value: "لا يتم حفظ محتوى رسائلك؛ النظام يحصي الأعداد فقط.", inline: false },
    );
  } else if (selectedPage === "achievements") {
    const achievements = [];
    if (stats.gamesPlayed >= 1) achievements.push("🎮 أول جولة لعب");
    if (stats.wins >= 10) achievements.push("🏆 10 انتصارات");
    if (stats.wins >= 50) achievements.push("👑 50 انتصارًا");
    if (stats.correctAnswers >= 100) achievements.push("🧠 موسوعة المعرفة · 100 إجابة صحيحة");
    if (stats.correctAnswers >= 500) achievements.push("💎 خبير الأسئلة · 500 إجابة صحيحة");
    if (stats.messages >= 100) achievements.push("💬 عضو نشط · 100 رسالة");
    embed.addFields(
      { name: "الإنجازات المكتسبة", value: achievements.length ? achievements.join("\n") : "لسه البداية يا بطل؛ العب وابدأ اجمع إنجازاتك!", inline: false },
      { name: "أفضل سلسلة مسجلة", value: number(stats.bestStreak), inline: true },
      { name: "الإجابات الصحيحة", value: number(stats.correctAnswers), inline: true },
    );
  } else if (selectedPage === "economy") {
    embed.addFields(
      { name: "💸 كوينز مكتسبة ومسجلة", value: number(stats.economy.earned), inline: true },
      { name: "🛒 كوينز مصروفة ومسجلة", value: number(stats.economy.spent), inline: true },
      { name: "📤 تحويلات مرسلة", value: number(stats.economy.transfersOut), inline: true },
      { name: "📥 تحويلات مستلمة", value: number(stats.economy.transfersIn), inline: true },
      { name: "ملاحظة", value: "هذه حركة الكوينز التي تُرسل للنظام عبر التكامل؛ ليست رصيد المحفظة الحالي ما لم تربطه بنظام الاقتصاد الحالي.", inline: false },
    );
  } else if (selectedPage === "leaderboard") {
    const leaders = repository.getLeaderboard(guild.id, "wins", 10);
    embed.addFields(
      { name: "🏆 أفضل 10 أعضاء حسب الانتصارات", value: leaders.length ? leaders.map((x, i) => `**${i + 1}.** <@${x.userId}> — ${number(x.value)} فوز`).join("\n") : "لا توجد بيانات كافية حتى الآن.", inline: false },
      { name: "ترتيبك", value: rank > 0 ? `#${rank}` : "لم تدخل الترتيب بعد", inline: true },
      { name: "انتصاراتك", value: number(stats.wins), inline: true },
    );
  }

  embed.addFields({ name: "ملخص السيرفر · آخر 7 أيام", value: `🎮 ${number(summary7.gameSessions)} جولة • 💬 ${number(summary7.messages)} رسالة`, inline: false });
  return { embeds: [embed], components: [...makeMemberMenu(user.id, selectedPage), makeRefreshButton("m", user.id, selectedPage)] };
}

module.exports = { buildMemberDashboard, MEMBER_PAGE_TITLES: TITLES };
