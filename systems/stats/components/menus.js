"use strict";

const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const MEMBER_PAGES = [
  { label: "نظرة عامة", value: "overview", description: "ملخص ملفك الشخصي" },
  { label: "الألعاب والأداء", value: "games", description: "الجولات والإجابات والانتصارات" },
  { label: "النشاط", value: "activity", description: "نشاطك خلال الفترات الأخيرة" },
  { label: "الإنجازات", value: "achievements", description: "الشارات والأرقام القياسية" },
  { label: "الاقتصاد", value: "economy", description: "الكوينز المكتسبة والمصروفة المسجلة" },
  { label: "المتصدرون", value: "leaderboard", description: "ترتيب أفضل الأعضاء" },
];
const ADMIN_PAGES = [
  { label: "نظرة عامة", value: "overview", description: "ملخص السيرفر" },
  { label: "الأعضاء والنمو", value: "members", description: "الانضمامات والمغادرات والنشاط" },
  { label: "الشات والقنوات", value: "activity", description: "الرسائل والقنوات وأوقات الذروة" },
  { label: "الألعاب", value: "games", description: "جلسات اللعب ونتائجها" },
  { label: "الاقتصاد", value: "economy", description: "حركة الكوينز المسجلة" },
  { label: "التقارير", value: "reports", description: "مقارنات وتقرير قابل للتصدير" },
];

function makeMenuRow(kind, ownerId, selected = "overview") {
  const pages = kind === "admin" ? ADMIN_PAGES : MEMBER_PAGES;
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ts:menu:${kind}:${ownerId}`)
    .setPlaceholder("اختر قسم الإحصائيات…")
    .setMinValues(1).setMaxValues(1)
    .addOptions(pages.map((page) => ({ ...page, default: page.value === selected })));
  return new ActionRowBuilder().addComponents(menu);
}

function makeMemberMenu(ownerId, selected) { return [makeMenuRow("member", ownerId, selected)]; }
function makeAdminMenu(ownerId, selected) { return [makeMenuRow("admin", ownerId, selected)]; }

module.exports = { MEMBER_PAGES, ADMIN_PAGES, makeMemberMenu, makeAdminMenu };
