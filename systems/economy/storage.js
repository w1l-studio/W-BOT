const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const FILE = path.join(DATA_DIR, 'economy.json');
const LEGACY = path.join(DATA_DIR, 'daily.json');
const MIGRATED = path.join(DATA_DIR, 'daily.json.migrated');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function blank() {
  return { version: 1, users: {}, stockCooldowns: {}, transactions: [] };
}
function normalize(raw) {
  const out = blank();
  if (raw && typeof raw === 'object') {
    if (raw.users && typeof raw.users === 'object') out.users = raw.users;
    if (raw.stockCooldowns && typeof raw.stockCooldowns === 'object') out.stockCooldowns = raw.stockCooldowns;
    if (Array.isArray(raw.transactions)) out.transactions = raw.transactions.slice(-500);
  }
  for (const [id, user] of Object.entries(out.users)) {
    if (!user || typeof user !== 'object') { delete out.users[id]; continue; }
    user.balance = Math.max(0, Math.floor(Number(user.balance ?? user.coins ?? user.money) || 0));
    user.totalEarned = Math.max(0, Math.floor(Number(user.totalEarned) || user.balance));
    user.streak = Math.max(0, Math.floor(Number(user.streak) || 0));
    user.lastDaily = Number(user.lastDaily) || 0;
    user.lastDailyDate = typeof user.lastDailyDate === 'string' ? user.lastDailyDate : '';
    user.lastStock = Number(user.lastStock) || 0;
    user.sharesPlayed = Math.max(0, Math.floor(Number(user.sharesPlayed) || 0));
    user.sharesWins = Math.max(0, Math.floor(Number(user.sharesWins) || 0));
    user.sharesLosses = Math.max(0, Math.floor(Number(user.sharesLosses) || 0));
    user.sharesProfit = Math.floor(Number(user.sharesProfit) || 0);
    user.createdAt = Number(user.createdAt) || Date.now();
  }
  return out;
}
function migrateLegacy(data) {
  if (!fs.existsSync(LEGACY) || fs.existsSync(MIGRATED)) return data;
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY, 'utf8'));
    const records = legacy.users && typeof legacy.users === 'object' ? legacy.users : legacy;
    for (const [id, old] of Object.entries(records || {})) {
      if (!old || typeof old !== 'object' || !/^\d{15,22}$/.test(id)) continue;
      const existing = data.users[id] || {};
      const coins = Number(old.balance ?? old.coins ?? old.money ?? old.cash ?? old.wallet ?? old.points);
      const lastDaily = Number(old.lastDaily ?? old.lastClaim ?? old.lastClaimed ?? old.last_daily) || 0;
      const streak = Number(old.streak ?? old.dailyStreak) || 0;
      data.users[id] = {
        ...existing,
        balance: Math.max(existing.balance || 0, Math.max(0, Math.floor(coins || 0))),
        totalEarned: Math.max(existing.totalEarned || 0, Math.max(0, Math.floor(coins || 0))),
        streak: Math.max(existing.streak || 0, Math.floor(streak)),
        lastDaily: Math.max(existing.lastDaily || 0, lastDaily),
        lastDailyDate: existing.lastDailyDate || '',
        lastStock: existing.lastStock || 0,
        createdAt: existing.createdAt || Date.now(),
      };
    }
    // إعادة تسمية الملف القديم بعد حفظ نسخة بياناته داخل الاقتصاد الجديد.
    save(data);
    fs.renameSync(LEGACY, MIGRATED);
    return data;
  } catch (error) {
    console.error('[Economy] تعذرت ترحلة daily.json؛ تم ترك الملف القديم كما هو:', error);
    return data;
  }
}
function load() {
  ensureDir();
  let data = blank();
  if (fs.existsSync(FILE)) {
    try { data = normalize(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
    catch (error) { console.error('[Economy] ملف economy.json غير صالح، سيتم استخدام بيانات فارغة دون حذف الملف:', error); }
  }
  return migrateLegacy(data);
}
function save(data) {
  ensureDir();
  const temp = `${FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, FILE);
}
let state = load();
function getState() { return state; }
function persist() { save(state); }
function getUser(userId) {
  if (!state.users[userId]) {
    state.users[userId] = { balance: 0, totalEarned: 0, streak: 0, lastDaily: 0, lastDailyDate: '', lastStock: 0, sharesPlayed: 0, sharesWins: 0, sharesLosses: 0, sharesProfit: 0, createdAt: Date.now() };
    persist();
  }
  return state.users[userId];
}
function record(type, from, to, amount, note = '') {
  state.transactions.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, from: from || null, to: to || null, amount: Math.floor(amount), note, at: Date.now() });
  state.transactions = state.transactions.slice(-500);
}
module.exports = { getState, persist, getUser, record };
