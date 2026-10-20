"use strict";

const fs = require("node:fs");
const path = require("node:path");

function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return utcDay(date);
}
function emptyState() {
  return { version: 1, updatedAt: new Date().toISOString(), guilds: {} };
}
function freshGuild() {
  return {
    members: { joins: 0, leaves: 0, daily: {}, snapshots: {} },
    messages: { total: 0, daily: {} },
    games: { totalSessions: 0, totalAnswers: 0, totalCorrect: 0, totalWins: 0, byGame: {}, daily: {} },
    economy: { earned: 0, spent: 0, transfers: 0, daily: {}, users: {} },
    users: {},
    channels: {},
  };
}
function freshUser() {
  return {
    messages: 0,
    gamesPlayed: 0,
    answers: 0,
    correctAnswers: 0,
    wins: 0,
    lastActiveAt: null,
    joinedAt: null,
    leftAt: null,
    bestStreak: 0,
    byGame: {},
  };
}
function ensureObject(parent, key, createValue) {
  if (!parent[key] || typeof parent[key] !== "object" || Array.isArray(parent[key])) {
    parent[key] = createValue();
  }
  return parent[key];
}

class StatsRepository {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(__dirname, "..", "data", "stats.json");
    this.historyDays = Math.max(7, Number(options.historyDays) || 90);
    this.saveDebounceMs = Math.max(100, Number(options.saveDebounceMs) || 750);
    this._timer = null;
    this._saveChain = Promise.resolve();
    this.state = this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return emptyState();
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      if (!parsed || typeof parsed !== "object" || !parsed.guilds || typeof parsed.guilds !== "object") {
        throw new Error("Unexpected stats database format");
      }
      if (!parsed.version) parsed.version = 1;
      return parsed;
    } catch (error) {
      console.error(`[STATS] Could not load stats database: ${error.message}`);
      console.error("[STATS] A fresh in-memory store will be used. Back up and inspect the existing JSON file before replacing it.");
      return emptyState();
    }
  }

  _scheduleSave() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush().catch((error) => console.error(`[STATS] Save failed: ${error.message}`));
    }, this.saveDebounceMs);
    if (typeof this._timer.unref === "function") this._timer.unref();
  }

  async flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    const snapshot = JSON.stringify({ ...this.state, updatedAt: new Date().toISOString() }, null, 2);
    this._saveChain = this._saveChain.catch(() => {}).then(async () => {
      await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.promises.writeFile(temporaryPath, snapshot, "utf8");
      await fs.promises.rename(temporaryPath, this.filePath);
    });
    return this._saveChain;
  }

  _guild(guildId) {
    if (!guildId) throw new TypeError("guildId is required");
    const guilds = this.state.guilds;
    if (!guilds[guildId]) guilds[guildId] = freshGuild();
    const g = guilds[guildId];
    // Migrate databases made by earlier versions without discarding existing data.
    for (const [key, create] of Object.entries({
      members: () => freshGuild().members,
      messages: () => freshGuild().messages,
      games: () => freshGuild().games,
      economy: () => freshGuild().economy,
      users: () => ({}),
      channels: () => ({}),
    })) ensureObject(g, key, create);
    ensureObject(g.members, "daily", () => ({}));
    ensureObject(g.members, "snapshots", () => ({}));
    ensureObject(g.messages, "daily", () => ({}));
    ensureObject(g.games, "daily", () => ({}));
    ensureObject(g.games, "byGame", () => ({}));
    ensureObject(g.economy, "daily", () => ({}));
    ensureObject(g.economy, "users", () => ({}));
    if (!Number.isFinite(g.messages.total)) g.messages.total = 0;
    for (const key of ["totalSessions", "totalAnswers", "totalCorrect", "totalWins"]) if (!Number.isFinite(g.games[key])) g.games[key] = 0;
    for (const key of ["earned", "spent", "transfers"]) if (!Number.isFinite(g.economy[key])) g.economy[key] = 0;
    return g;
  }

  _user(guild, userId) {
    if (!userId) throw new TypeError("userId is required");
    if (!guild.users[userId]) guild.users[userId] = freshUser();
    const u = guild.users[userId];
    for (const [key, value] of Object.entries(freshUser())) {
      if (typeof u[key] === "undefined") u[key] = value;
    }
    if (!u.byGame || typeof u.byGame !== "object") u.byGame = {};
    return u;
  }

  _day(guild, section, day = utcDay()) {
    const daily = ensureObject(guild[section], "daily", () => ({}));
    if (!daily[day]) {
      if (section === "messages") daily[day] = { total: 0, channels: {}, users: {}, hours: {} };
      else if (section === "members") daily[day] = { joins: 0, leaves: 0, memberCount: null };
      else if (section === "games") daily[day] = { sessions: 0, answers: 0, correct: 0, wins: 0, byGame: {} };
      else if (section === "economy") daily[day] = { earned: 0, spent: 0, transfers: 0 };
    }
    return daily[day];
  }

  _trim(guild) {
    const cutoff = addDays(utcDay(), -this.historyDays);
    for (const section of ["members", "messages", "games", "economy"]) {
      if (!guild[section].daily) continue;
      for (const day of Object.keys(guild[section].daily)) {
        if (day < cutoff) delete guild[section].daily[day];
      }
    }
    for (const day of Object.keys(guild.members.snapshots || {})) {
      if (day < cutoff) delete guild.members.snapshots[day];
    }
  }

  recordMessage({ guildId, userId, channelId, timestamp = Date.now() }) {
    if (!guildId || !userId || !channelId) return false;
    const g = this._guild(guildId);
    const date = new Date(timestamp);
    const dayKey = utcDay(date);
    const day = this._day(g, "messages", dayKey);
    const hour = String(date.getUTCHours()).padStart(2, "0");
    day.total += 1;
    day.channels[channelId] = (day.channels[channelId] || 0) + 1;
    day.users[userId] = (day.users[userId] || 0) + 1;
    day.hours[hour] = (day.hours[hour] || 0) + 1;
    g.messages.total += 1;
    g.channels[channelId] = (g.channels[channelId] || 0) + 1;
    const user = this._user(g, userId);
    user.messages += 1;
    user.lastActiveAt = new Date(timestamp).toISOString();
    this._trim(g);
    this._scheduleSave();
    return true;
  }

  recordMemberJoin({ guildId, userId, memberCount, timestamp = Date.now() }) {
    if (!guildId) return false;
    const g = this._guild(guildId);
    const dayKey = utcDay(new Date(timestamp));
    const day = this._day(g, "members", dayKey);
    day.joins += 1;
    if (Number.isFinite(memberCount)) day.memberCount = memberCount;
    g.members.joins += 1;
    if (Number.isFinite(memberCount)) g.members.snapshots[dayKey] = memberCount;
    if (userId) this._user(g, userId).joinedAt = new Date(timestamp).toISOString();
    this._trim(g);
    this._scheduleSave();
    return true;
  }

  recordMemberLeave({ guildId, userId, memberCount, timestamp = Date.now() }) {
    if (!guildId) return false;
    const g = this._guild(guildId);
    const dayKey = utcDay(new Date(timestamp));
    const day = this._day(g, "members", dayKey);
    day.leaves += 1;
    if (Number.isFinite(memberCount)) day.memberCount = memberCount;
    g.members.leaves += 1;
    if (Number.isFinite(memberCount)) g.members.snapshots[dayKey] = memberCount;
    if (userId) this._user(g, userId).leftAt = new Date(timestamp).toISOString();
    this._trim(g);
    this._scheduleSave();
    return true;
  }

  recordGame({ guildId, userId, gameId, gameName, answers = 0, correct = 0, wins = 0, participants = 1, durationMs = 0, bestStreak = 0, timestamp = Date.now() }) {
    if (!guildId || !userId || !gameId) return false;
    const g = this._guild(guildId);
    const dayKey = utcDay(new Date(timestamp));
    const name = String(gameName || gameId).slice(0, 80);
    const safeAnswers = Math.max(0, Number(answers) || 0);
    const safeCorrect = Math.min(safeAnswers, Math.max(0, Number(correct) || 0));
    const safeWins = Math.max(0, Number(wins) || 0);
    const game = ensureObject(g.games.byGame, String(gameId), () => ({ name, sessions: 0, answers: 0, correct: 0, wins: 0, participants: 0, durationMsTotal: 0, durationSamples: 0 }));
    game.name = name;
    game.sessions += 1;
    game.answers += safeAnswers;
    game.correct += safeCorrect;
    game.wins += safeWins;
    game.participants += Math.max(1, Number(participants) || 1);
    if (Number(durationMs) > 0) { game.durationMsTotal += Number(durationMs); game.durationSamples += 1; }
    g.games.totalSessions += 1;
    g.games.totalAnswers += safeAnswers;
    g.games.totalCorrect += safeCorrect;
    g.games.totalWins += safeWins;
    const day = this._day(g, "games", dayKey);
    day.sessions += 1;
    day.answers += safeAnswers;
    day.correct += safeCorrect;
    day.wins += safeWins;
    if (!day.byGame[gameId]) day.byGame[gameId] = { name, sessions: 0, answers: 0, correct: 0, wins: 0 };
    Object.assign(day.byGame[gameId], { name });
    day.byGame[gameId].sessions += 1;
    day.byGame[gameId].answers += safeAnswers;
    day.byGame[gameId].correct += safeCorrect;
    day.byGame[gameId].wins += safeWins;
    const user = this._user(g, userId);
    user.gamesPlayed += 1;
    user.answers += safeAnswers;
    user.correctAnswers += safeCorrect;
    user.wins += safeWins;
    user.lastActiveAt = new Date(timestamp).toISOString();
    user.bestStreak = Math.max(user.bestStreak || 0, Math.max(0, Number(bestStreak) || 0));
    if (!user.byGame[gameId]) user.byGame[gameId] = { name, sessions: 0, answers: 0, correct: 0, wins: 0 };
    Object.assign(user.byGame[gameId], { name });
    user.byGame[gameId].sessions += 1;
    user.byGame[gameId].answers += safeAnswers;
    user.byGame[gameId].correct += safeCorrect;
    user.byGame[gameId].wins += safeWins;
    this._trim(g);
    this._scheduleSave();
    return true;
  }

  recordEconomy({ guildId, userId, type, amount, peerUserId, timestamp = Date.now() }) {
    if (!guildId || !userId) return false;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return false;
    const normalized = String(type || "").toLowerCase();
    if (!["earned", "spent", "transfer", "received"].includes(normalized)) return false;
    const g = this._guild(guildId);
    const day = this._day(g, "economy", utcDay(new Date(timestamp)));
    const user = this._user(g, userId);
    const eu = ensureObject(g.economy.users, userId, () => ({ earned: 0, spent: 0, transfersOut: 0, transfersIn: 0 }));
    if (normalized === "earned") { g.economy.earned += value; day.earned += value; eu.earned += value; }
    if (normalized === "spent") { g.economy.spent += value; day.spent += value; eu.spent += value; }
    if (normalized === "transfer") {
      g.economy.transfers += value; day.transfers += value; eu.transfersOut += value;
      if (peerUserId) {
        const recipient = ensureObject(g.economy.users, peerUserId, () => ({ earned: 0, spent: 0, transfersOut: 0, transfersIn: 0 }));
        recipient.transfersIn += value;
      }
    }
    if (normalized === "received") { eu.transfersIn += value; }
    this._trim(g);
    this._scheduleSave();
    return true;
  }

  getUser(guildId, userId) {
    const g = this._guild(guildId);
    const raw = g.users[userId] || freshUser();
    const economy = g.economy.users[userId] || { earned: 0, spent: 0, transfersOut: 0, transfersIn: 0 };
    return { ...JSON.parse(JSON.stringify(raw)), economy: { ...economy } };
  }

  getUserActivity(guildId, userId, days = 7) {
    const g = this._guild(guildId);
    const daily = [];
    for (let i = Math.max(1, days) - 1; i >= 0; i--) {
      const dayKey = addDays(utcDay(), -i);
      const item = g.messages.daily[dayKey];
      daily.push({ date: dayKey, messages: item?.users?.[userId] || 0 });
    }
    return daily;
  }

  getLeaderboard(guildId, metric = "wins", limit = 10) {
    const g = this._guild(guildId);
    const allowed = { wins: "wins", games: "gamesPlayed", correct: "correctAnswers", messages: "messages" };
    const key = allowed[metric] || "wins";
    return Object.entries(g.users)
      .map(([userId, stats]) => ({ userId, value: Number(stats[key]) || 0, stats }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, Math.min(100, Math.max(1, Number(limit) || 10)));
  }

  getSummary(guildId, days = 7, memberCount = null) {
    const g = this._guild(guildId);
    const period = Math.min(this.historyDays, Math.max(1, Number(days) || 7));
    const result = {
      periodDays: period,
      messages: 0,
      joins: 0,
      leaves: 0,
      gameSessions: 0,
      answers: 0,
      correct: 0,
      wins: 0,
      earned: 0,
      spent: 0,
      transfers: 0,
      activeMembers: 0,
      channels: {},
      messageUsers: {},
      games: {},
      hourly: {},
      daily: [],
      memberCount: Number.isFinite(memberCount) ? memberCount : null,
      totalMembersKnown: Number.isFinite(memberCount) ? memberCount : null,
      totalMessages: g.messages.total || 0,
      totalGameSessions: g.games.totalSessions || 0,
      totalAnswers: g.games.totalAnswers || 0,
      totalCorrect: g.games.totalCorrect || 0,
      totalWins: g.games.totalWins || 0,
      totalEarned: g.economy.earned || 0,
      totalSpent: g.economy.spent || 0,
    };
    const activeSince = Date.now() - period * 24 * 60 * 60 * 1000;
    for (let i = period - 1; i >= 0; i--) {
      const dayKey = addDays(utcDay(), -i);
      const m = g.messages.daily[dayKey] || {};
      const mb = g.members.daily[dayKey] || {};
      const gm = g.games.daily[dayKey] || {};
      const ec = g.economy.daily[dayKey] || {};
      result.messages += m.total || 0;
      result.joins += mb.joins || 0;
      result.leaves += mb.leaves || 0;
      result.gameSessions += gm.sessions || 0;
      result.answers += gm.answers || 0;
      result.correct += gm.correct || 0;
      result.wins += gm.wins || 0;
      result.earned += ec.earned || 0;
      result.spent += ec.spent || 0;
      result.transfers += ec.transfers || 0;
      for (const [id, count] of Object.entries(m.channels || {})) result.channels[id] = (result.channels[id] || 0) + count;
      for (const [id, count] of Object.entries(m.users || {})) result.messageUsers[id] = (result.messageUsers[id] || 0) + count;
      for (const [id, item] of Object.entries(gm.byGame || {})) {
        if (!result.games[id]) result.games[id] = { name: item.name || id, sessions: 0, answers: 0, correct: 0, wins: 0 };
        for (const metric of ["sessions", "answers", "correct", "wins"]) result.games[id][metric] += item[metric] || 0;
      }
      for (const [hour, count] of Object.entries(m.hours || {})) result.hourly[hour] = (result.hourly[hour] || 0) + count;
      result.daily.push({ date: dayKey, messages: m.total || 0, joins: mb.joins || 0, leaves: mb.leaves || 0, gameSessions: gm.sessions || 0, answers: gm.answers || 0, correct: gm.correct || 0, wins: gm.wins || 0, earned: ec.earned || 0, spent: ec.spent || 0, transfers: ec.transfers || 0 });
    }
    result.activeMembers = Object.values(g.users).filter((u) => u.lastActiveAt && Date.parse(u.lastActiveAt) >= activeSince).length;
    result.topChannels = Object.entries(result.channels).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    result.topMessageUsers = Object.entries(result.messageUsers).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 10);
    result.topGames = Object.entries(result.games).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.sessions - a.sessions).slice(0, 10);
    result.busiestHour = Object.entries(result.hourly).map(([hour, count]) => ({ hour, count })).sort((a, b) => b.count - a.count)[0] || null;
    result.netGrowth = result.joins - result.leaves;
    return result;
  }

  getEconomyLeaderboard(guildId, metric = "earned", limit = 10) {
    const g = this._guild(guildId);
    return Object.entries(g.economy.users || {}).map(([userId, data]) => ({ userId, value: Number(data[metric]) || 0 }))
      .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, limit);
  }
}

module.exports = { StatsRepository, utcDay };
