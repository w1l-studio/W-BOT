"use strict";

function number(value) { return (Number(value) || 0).toLocaleString("en-US"); }
function percent(numerator, denominator) {
  const n = Number(numerator) || 0;
  const d = Number(denominator) || 0;
  return d > 0 ? `${Math.round((n / d) * 1000) / 10}%` : "—";
}
function duration(ms) {
  const seconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (seconds < 60) return `${seconds} ثانية`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes} د ${rest} ث` : `${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours} س ${rem} د` : `${hours} ساعة`;
}
function shortDate(value) {
  if (!value) return "غير متوفر";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "غير متوفر";
  return d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
function safeInline(value, max = 100) {
  return String(value ?? "—").replace(/[`*_~|]/g, "\\$&").slice(0, max);
}
module.exports = { number, percent, duration, shortDate, safeInline };
