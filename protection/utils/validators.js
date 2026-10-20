'use strict';

function isSnowflake(value) {
  return typeof value === 'string' && /^\d{17,20}$/.test(value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

module.exports = { isSnowflake, clampNumber };
