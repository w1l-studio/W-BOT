"use strict";

function bar(value, maxValue, width = 10) {
  const total = Math.max(1, Number(maxValue) || 1);
  const size = Math.max(1, Number(width) || 10);
  const filled = Math.max(0, Math.min(size, Math.round((Math.max(0, Number(value) || 0) / total) * size)));
  return `${"█".repeat(filled)}${"░".repeat(size - filled)}`;
}
function sparkline(values) {
  const chars = "▁▂▃▄▅▆▇█";
  const numbers = (values || []).map((x) => Math.max(0, Number(x) || 0));
  const max = Math.max(1, ...numbers);
  return numbers.map((n) => chars[Math.min(chars.length - 1, Math.round((n / max) * (chars.length - 1)))]).join("");
}
module.exports = { bar, sparkline };
