"use strict";

function comparePeriods(summary, previousSummary) {
  const metrics = ["messages", "joins", "leaves", "gameSessions", "answers", "correct", "earned", "spent"];
  const result = {};
  for (const key of metrics) {
    const current = Number(summary?.[key]) || 0;
    const previous = Number(previousSummary?.[key]) || 0;
    const change = current - previous;
    result[key] = {
      current,
      previous,
      change,
      percent: previous === 0 ? (current === 0 ? 0 : null) : Math.round((change / previous) * 1000) / 10,
    };
  }
  return result;
}

function detectActivitySignals(summary, previousSummary) {
  const comparison = comparePeriods(summary, previousSummary);
  const signals = [];
  for (const key of ["messages", "gameSessions", "joins"]) {
    const item = comparison[key];
    if (item.previous >= 20 && item.percent !== null && item.percent <= -40) {
      signals.push({ type: "drop", metric: key, percent: item.percent, current: item.current, previous: item.previous });
    } else if (item.previous >= 20 && item.percent !== null && item.percent >= 100) {
      signals.push({ type: "spike", metric: key, percent: item.percent, current: item.current, previous: item.previous });
    }
  }
  return signals;
}

module.exports = { comparePeriods, detectActivitySignals };
