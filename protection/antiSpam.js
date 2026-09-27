// ======================================================
// ANTI-SPAM ANALYSIS
// ======================================================
// دوال تحليل بحتة — لا تنفذ أي عقوبة ولا ترسل رسائل. كل دالة تأخذ
// بيانات وترجع نتيجة تحليل، ويستخدمها detector.js لبناء Risk Score.
// ======================================================

// Tracking قصير المدى فقط لكل عضو، بحد أقصى من الرسائل المحفوظة،
// لتفادي أي تراكم ذاكرة على المدى الطويل.
const MAX_TRACKED_MESSAGES = 10;
const messageHistory = new Map(); // key: guildId:userId -> [{content, time}]

function getHistoryKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function pushMessage(guildId, userId, content) {
    const key = getHistoryKey(guildId, userId);

    if (!messageHistory.has(key)) {
        messageHistory.set(key, []);
    }

    const history = messageHistory.get(key);
    history.push({ content, time: Date.now() });

    // احتفظ فقط بآخر N رسائل — لا تخزين دائم لكل رسائل السيرفر.
    while (history.length > MAX_TRACKED_MESSAGES) {
        history.shift();
    }

    return history;
}

function clearHistory(guildId, userId) {
    messageHistory.delete(getHistoryKey(guildId, userId));
}

// تنظيف دوري للمفاتيح القديمة كليًا (عضو ما راسل من مدة) — يمنع تسرب
// الذاكرة على المدى الطويل في سيرفرات كبيرة.
function cleanupStaleHistory(maxAgeMs = 10 * 60 * 1000) {
    const now = Date.now();

    for (const [key, history] of messageHistory.entries()) {
        const last = history[history.length - 1];

        if (!last || now - last.time > maxAgeMs) {
            messageHistory.delete(key);
        }
    }
}

// ------------------------------------------------------
// FREQUENCY (rate of messages)
// ------------------------------------------------------

function checkFrequency(guildId, userId, windowMs, limit) {
    const key = getHistoryKey(guildId, userId);
    const history = messageHistory.get(key) || [];
    const now = Date.now();

    const recent = history.filter(m => now - m.time <= windowMs);

    return {
        count: recent.length,
        isSpam: recent.length >= limit
    };
}

// ------------------------------------------------------
// STRING SIMILARITY (no external libraries)
// ------------------------------------------------------
// Levenshtein-based similarity ratio, بدون أي مكتبة خارجية.
// النتيجة بين 0 (مختلفة تمامًا) و 1 (متطابقة).
function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 0; i < a.length; i++) {
        const currentRow = [i + 1];

        for (let j = 0; j < b.length; j++) {
            const cost = a[i] === b[j] ? 0 : 1;

            currentRow.push(
                Math.min(
                    currentRow[j] + 1,        // insertion
                    previousRow[j + 1] + 1,   // deletion
                    previousRow[j] + cost     // substitution
                )
            );
        }

        previousRow = currentRow;
    }

    return previousRow[b.length];
}

function similarityRatio(a, b) {
    const normalizedA = (a || "").trim().toLowerCase();
    const normalizedB = (b || "").trim().toLowerCase();

    const maxLen = Math.max(normalizedA.length, normalizedB.length);
    if (maxLen === 0) return 1;

    const distance = levenshteinDistance(normalizedA, normalizedB);
    return 1 - distance / maxLen;
}

// يفحص هل الرسالة الحالية مشابهة جدًا لأي رسالة حديثة من نفس العضو.
function checkDuplicateOrSimilar(guildId, userId, content, threshold = 0.85) {
    const key = getHistoryKey(guildId, userId);
    const history = messageHistory.get(key) || [];

    let similarCount = 0;
    let exactCount = 0;

    for (const entry of history) {
        const ratio = similarityRatio(entry.content, content);

        if (ratio === 1) exactCount++;
        else if (ratio >= threshold) similarCount++;
    }

    return {
        exactCount,
        similarCount,
        totalSimilar: exactCount + similarCount
    };
}

// ------------------------------------------------------
// CAPS FLOOD
// ------------------------------------------------------
// يتجاهل الرسائل القصيرة جدًا (LOL, OK, GG) — تلك لا تُعتبر caps spam
// تلقائيًا، وتُستخدم فقط كعامل إضافي بسيط في حالة الرسائل الطويلة فعلًا.
function checkCapsFlood(content, minLength = 10, capsRatioThreshold = 0.7) {
    const letters = content.replace(/[^a-zA-Z]/g, "");

    if (letters.length < minLength) {
        return { isCapsFlood: false, ratio: 0 };
    }

    const upperCount = (letters.match(/[A-Z]/g) || []).length;
    const ratio = upperCount / letters.length;

    return {
        isCapsFlood: ratio >= capsRatioThreshold,
        ratio
    };
}

// ------------------------------------------------------
// MENTIONS
// ------------------------------------------------------

function checkMentions(message, config) {
    const userMentions = message.mentions.users.size;
    const roleMentions = message.mentions.roles.size;
    const hasEveryone = message.mentions.everyone; // covers @everyone و @here

    return {
        userMentions,
        roleMentions,
        hasEveryone,
        isUserMentionSpam: userMentions >= config.mentions.userMentionLimit,
        isRoleMentionSpam: roleMentions >= config.mentions.roleMentionLimit
    };
}

// ------------------------------------------------------
// LINKS
// ------------------------------------------------------

const URL_REGEX = /https?:\/\/([^\s/$.?#]+\.[^\s]*)/gi;
const INVITE_REGEX = /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)([a-zA-Z0-9-]+)/i;

function extractDomains(content) {
    const domains = [];
    let match;

    URL_REGEX.lastIndex = 0;
    while ((match = URL_REGEX.exec(content)) !== null) {
        try {
            const url = new URL(match[0]);
            domains.push(url.hostname.replace(/^www\./, "").toLowerCase());
        } catch {
            // رابط غير صالح للتحليل — تجاهله بدل ما يسبب كراش.
        }
    }

    return domains;
}

function extractInvite(content) {
    const match = content.match(INVITE_REGEX);
    return match ? match[1] : null;
}

module.exports = {
    pushMessage,
    clearHistory,
    cleanupStaleHistory,
    checkFrequency,
    similarityRatio,
    checkDuplicateOrSimilar,
    checkCapsFlood,
    checkMentions,
    extractDomains,
    extractInvite
};
