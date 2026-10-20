const { MAX_HISTORY } = require("./config");

// In-memory only. Data is cleared when the Node.js process restarts.
const memory = new Map();

function getHistory(memoryKey) {
  return memory.get(memoryKey) || [];
}

function addMessage(memoryKey, role, content) {
  if (!memory.has(memoryKey)) memory.set(memoryKey, []);

  const history = memory.get(memoryKey);
  history.push({ role, content });

  // Keep the most recent MAX_HISTORY messages for this member/server context.
  memory.set(memoryKey, history.slice(-MAX_HISTORY));
}

function clearHistory(memoryKey) {
  memory.delete(memoryKey);
}

module.exports = { getHistory, addMessage, clearHistory };
