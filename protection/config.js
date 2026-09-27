const fs = require("fs");
const path = require("path");

// ======================================================
// PROTECTION CONFIG
// ======================================================
// مسؤول فقط عن قراءة/حفظ إعدادات نظام الحماية الجديد لكل Guild.
// هذا ملف منفصل تمامًا عن protection.json القديم المستخدم في index.js
// الرئيسي (الخاص بـ Anti-Nuke / whitelist / logChannelId القديم) —
// حتى لا يتصادم مع أي بيانات موجودة هناك.
// ======================================================

const DATA_FILE = path.join(__dirname, "data", "protection.json");

function ensureDataFile() {
    const dir = path.dirname(DATA_FILE);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 4));
    }
}

ensureDataFile();

let store = {};

try {
    store = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch {
    store = {};
}

function save() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 4));
    } catch (error) {
        console.error("[Protection] فشل حفظ الإعدادات:", error);
    }
}

// ------------------------------------------------------
// DEFAULTS
// ------------------------------------------------------
// كل هذه القيم قابلة للتعديل لكل Guild عبر /protection config.
function defaultConfig() {
    return {
        enabled: true,

        modules: {
            antiRaid: true,
            antiSpam: true,
            antiMention: true,
            antiLink: true,
            antiInvite: true,
            autoTimeout: true
        },

        logChannelId: null,

        // ---------------- RAID ----------------
        raid: {
            // عدد الأعضاء خلال windowMs لاعتباره raid مشتبه به
            joinThreshold: 10,
            // عدد الأعضاء خلال windowMs لاعتباره raid مؤكد
            criticalJoinThreshold: 20,
            windowMs: 60 * 1000,
            // حساب عمر الحساب: أقل من هذا يعتبر حساب جديد مشبوه
            newAccountAgeMs: 3 * 24 * 60 * 60 * 1000, // 3 أيام
            autoLockdownOnCritical: false
        },

        // ---------------- BOT ADD ----------------
        botAdd: {
            maxBotsPerWindow: 2,
            windowMs: 60 * 1000
        },

        // ---------------- SPAM ----------------
        spam: {
            messageWindowMs: 7000,
            messageLimit: 5,
            duplicateLimit: 3,
            similarityThreshold: 0.85
        },

        // ---------------- MENTIONS ----------------
        mentions: {
            userMentionLimit: 5,
            roleMentionLimit: 3
        },

        // ---------------- LINKS ----------------
        links: {
            // لو true: يفحص الروابط ضد blockedDomains فقط.
            // لو false: أي رابط غير موجود بـ allowedDomains يُعتبر مشبوه بدرجة أقل.
            allowByDefault: true,
            allowedDomains: [
                "youtube.com", "youtu.be",
                "tiktok.com",
                "instagram.com",
                "twitter.com", "x.com",
                "github.com",
                "discord.com"
            ],
            blockedDomains: []
        },

        // ---------------- INVITES ----------------
        invites: {
            // ALLOW | DELETE | WARN | TIMEOUT
            action: "DELETE",
            allowOwnServerInvites: true
        },

        // ---------------- RISK SCORE WEIGHTS ----------------
        riskWeights: {
            spam: 20,
            duplicateMessage: 15,
            mentionSpam: 30,
            everyoneMention: 50,
            suspiciousInvite: 40,
            blockedLink: 35,
            capsFlood: 10,
            raidBehavior: 60,
            newAccountPenalty: 20
        },

        // ---------------- RISK LEVELS ----------------
        riskLevels: {
            low: 30,
            medium: 50,
            high: 70,
            critical: 90
        },

        // ---------------- RISK DECAY ----------------
        // كم ينزل الـ Risk Score تلقائيًا كل decayIntervalMs
        riskDecay: {
            amount: 10,
            intervalMs: 60 * 1000
        },

        // ---------------- WHITELIST ----------------
        whitelist: {
            users: [],
            roles: [],
            bots: [],
            channels: [],
            domains: []
        },

        // ---------------- RAID MODE STATE ----------------
        raidMode: {
            active: false,
            activatedAt: null
        }
    };
}

// دمج عميق بسيط: يحافظ على القيم المخصصة الموجودة، ويضيف أي حقل جديد
// أضيف لاحقًا للـ defaults بدون ما يمسح إعدادات المستخدم الحالية.
function mergeDefaults(target, defaults) {
    for (const key of Object.keys(defaults)) {
        if (target[key] === undefined) {
            target[key] = defaults[key];
        } else if (
            typeof defaults[key] === "object" &&
            defaults[key] !== null &&
            !Array.isArray(defaults[key]) &&
            typeof target[key] === "object" &&
            target[key] !== null &&
            !Array.isArray(target[key])
        ) {
            mergeDefaults(target[key], defaults[key]);
        }
    }

    return target;
}

function getConfig(guildId) {
    if (!store[guildId]) {
        store[guildId] = defaultConfig();
        save();
        return store[guildId];
    }

    // يضمن أن أي حقل جديد أضيف للـ defaults مستقبلًا يظهر تلقائيًا
    // في الإعدادات القديمة بدون فقدان أي تخصيص محفوظ.
    store[guildId] = mergeDefaults(store[guildId], defaultConfig());

    return store[guildId];
}

function saveConfig(guildId) {
    if (store[guildId]) {
        save();
    }
}

function setModuleEnabled(guildId, moduleName, enabled) {
    const config = getConfig(guildId);

    if (!(moduleName in config.modules)) {
        return false;
    }

    config.modules[moduleName] = !!enabled;
    saveConfig(guildId);
    return true;
}

function setLogChannel(guildId, channelId) {
    const config = getConfig(guildId);
    config.logChannelId = channelId;
    saveConfig(guildId);
}

function setProtectionEnabled(guildId, enabled) {
    const config = getConfig(guildId);
    config.enabled = !!enabled;
    saveConfig(guildId);
}

function setRaidMode(guildId, active) {
    const config = getConfig(guildId);
    config.raidMode.active = !!active;
    config.raidMode.activatedAt = active ? Date.now() : null;
    saveConfig(guildId);
    return config.raidMode;
}

function isRaidModeActive(guildId) {
    return getConfig(guildId).raidMode.active === true;
}

module.exports = {
    getConfig,
    saveConfig,
    setModuleEnabled,
    setLogChannel,
    setProtectionEnabled,
    setRaidMode,
    isRaidModeActive,
    defaultConfig
};
