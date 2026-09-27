const { getConfig, setRaidMode } = require("./config");

// ======================================================
// RAID DETECTION
// ======================================================
// يراقب سرعة انضمام الأعضاء وإضافة البوتات، ويحسب مستوى الخطورة.
// لا ينفذ عقوبات مباشرة على أعضاء عاديين — القرار (raid suspected/
// confirmed) يُرجع للمستدعي (index.js) ليقرر تفعيل Raid Mode والتنبيه.
// ======================================================

// Tracking قصير المدى فقط — قائمة أوقات الانضمام لكل Guild.
const joinTimestamps = new Map();   // guildId -> [timestamps]
const botJoinTimestamps = new Map(); // guildId -> [timestamps]

const MAX_TRACKED_JOINS = 100;

function pushJoin(map, guildId) {
    if (!map.has(guildId)) {
        map.set(guildId, []);
    }

    const list = map.get(guildId);
    list.push(Date.now());

    while (list.length > MAX_TRACKED_JOINS) {
        list.shift();
    }

    return list;
}

function countRecent(list, windowMs) {
    const now = Date.now();
    return list.filter(t => now - t <= windowMs).length;
}

// دوري: يمنع تراكم timestamps قديمة لسيرفرات غير نشطة.
function cleanupStaleJoins(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();

    for (const map of [joinTimestamps, botJoinTimestamps]) {
        for (const [guildId, list] of map.entries()) {
            const filtered = list.filter(t => now - t <= maxAgeMs);

            if (filtered.length === 0) {
                map.delete(guildId);
            } else {
                map.set(guildId, filtered);
            }
        }
    }
}

// ------------------------------------------------------
// MEMBER JOIN ANALYSIS
// ------------------------------------------------------

function isNewAccount(user, maxAgeMs) {
    const accountAge = Date.now() - user.createdTimestamp;
    return accountAge <= maxAgeMs;
}

// يسجل انضمام عضو ويرجع تحليل الوضع الحالي لهذا الـ Guild.
// level: "normal" | "warning" | "suspected" | "critical"
function analyzeMemberJoin(guildId, member) {
    const config = getConfig(guildId);
    const raidConfig = config.raid;

    const list = pushJoin(joinTimestamps, guildId);
    const recentJoins = countRecent(list, raidConfig.windowMs);

    const accountIsNew = isNewAccount(member.user, raidConfig.newAccountAgeMs);

    let level = "normal";

    if (recentJoins >= raidConfig.criticalJoinThreshold) {
        level = "critical";
    } else if (recentJoins >= raidConfig.joinThreshold) {
        level = "suspected";
    } else if (accountIsNew) {
        level = "warning";
    }

    return {
        level,
        recentJoins,
        accountIsNew,
        windowMs: raidConfig.windowMs
    };
}

// ------------------------------------------------------
// BOT ADD ANALYSIS
// ------------------------------------------------------

function analyzeBotAdd(guildId) {
    const config = getConfig(guildId);
    const botConfig = config.botAdd;

    const list = pushJoin(botJoinTimestamps, guildId);
    const recentBots = countRecent(list, botConfig.windowMs);

    return {
        recentBots,
        isSuspicious: recentBots > botConfig.maxBotsPerWindow,
        windowMs: botConfig.windowMs
    };
}

// ------------------------------------------------------
// RAID MODE
// ------------------------------------------------------

function activateRaidMode(guildId) {
    return setRaidMode(guildId, true);
}

function deactivateRaidMode(guildId) {
    return setRaidMode(guildId, false);
}

function resetGuildJoinTracking(guildId) {
    joinTimestamps.delete(guildId);
    botJoinTimestamps.delete(guildId);
}

module.exports = {
    analyzeMemberJoin,
    analyzeBotAdd,
    activateRaidMode,
    deactivateRaidMode,
    resetGuildJoinTracking,
    cleanupStaleJoins,
    isNewAccount
};
