const { getConfig } = require("./config");
const { isUserWhitelisted, hasWhitelistedRole } = require("./whitelist");

// ======================================================
// ACTIONS
// ======================================================
// مسؤول عن:
// 1) تخزين Risk Score لكل عضو (بذاكرة قصيرة المدى + decay تلقائي).
// 2) تحويل Risk Score لمستوى (NORMAL/LOW/MEDIUM/HIGH/CRITICAL).
// 3) تنفيذ العقوبة التصاعدية المناسبة لكل مستوى، بأمان (صلاحيات،
//    استثناءات، عدم تنفيذ على الـ Owner/البوت نفسه).
// ======================================================

// key: guildId:userId -> { score, lastUpdate }
const riskScores = new Map();

function getRiskKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function getRiskScore(guildId, userId) {
    const key = getRiskKey(guildId, userId);
    const entry = riskScores.get(key);

    if (!entry) return 0;

    applyDecay(guildId, userId, entry);

    return entry.score;
}

function applyDecay(guildId, userId, entry) {
    const config = getConfig(guildId);
    const { amount, intervalMs } = config.riskDecay;

    const now = Date.now();
    const elapsed = now - entry.lastUpdate;

    if (elapsed < intervalMs) return;

    const ticks = Math.floor(elapsed / intervalMs);
    entry.score = Math.max(0, entry.score - ticks * amount);
    entry.lastUpdate = now;

    if (entry.score === 0) {
        riskScores.delete(getRiskKey(guildId, userId));
    }
}

// يضيف نقاط للـ Risk Score الحالي ويرجع القيمة الجديدة (0-100، مسقّف).
function addRisk(guildId, userId, points) {
    const key = getRiskKey(guildId, userId);
    let entry = riskScores.get(key);

    if (!entry) {
        entry = { score: 0, lastUpdate: Date.now() };
        riskScores.set(key, entry);
    } else {
        applyDecay(guildId, userId, entry);
    }

    entry.score = Math.min(100, entry.score + points);
    entry.lastUpdate = Date.now();

    return entry.score;
}

function resetRisk(guildId, userId) {
    riskScores.delete(getRiskKey(guildId, userId));
}

// تنظيف دوري لأي مدخلات وصلت صفر أصلاً أو قديمة جدًا (احتياطي إضافي
// فوق الـ decay نفسه، لضمان عدم تراكم Map لسيرفرات كبيرة).
function cleanupStaleRisk(maxAgeMs = 30 * 60 * 1000) {
    const now = Date.now();

    for (const [key, entry] of riskScores.entries()) {
        if (now - entry.lastUpdate > maxAgeMs) {
            riskScores.delete(key);
        }
    }
}

// ------------------------------------------------------
// RISK LEVEL
// ------------------------------------------------------

function getRiskLevel(guildId, score) {
    const { riskLevels } = getConfig(guildId);

    if (score >= riskLevels.critical) return "CRITICAL";
    if (score >= riskLevels.high) return "HIGH RISK";
    if (score >= riskLevels.medium) return "MEDIUM RISK";
    if (score >= riskLevels.low) return "LOW RISK";
    return "NORMAL";
}

// ------------------------------------------------------
// SAFETY CHECKS
// ------------------------------------------------------

function isProtectedFromPunishment(guild, client, member) {
    if (!member) return true;
    if (member.id === client.user.id) return true; // البوت نفسه
    if (member.id === guild.ownerId) return true;   // مالك السيرفر
    if (member.user?.bot && isBotSystemAccount(member)) return true;

    if (isUserWhitelisted(guild.id, member.id)) return true;
    if (hasWhitelistedRole(guild.id, member)) return true;

    return false;
}

function isBotSystemAccount(member) {
    // Webhooks/system messages لا يصلون هنا أصلًا كـ GuildMember حقيقي،
    // لكن هذا الفحص موجود كحاجز أمان إضافي واضح النية.
    return member.user?.system === true;
}

async function botCanModerate(guild, member, permissionFlag) {
    const botMember = guild.members.me;

    if (!botMember) return false;
    if (!botMember.permissions.has(permissionFlag)) return false;

    // ترتيب الرتب: البوت يحتاج يكون أعلى من العضو المستهدف.
    if (member.roles.highest.position >= botMember.roles.highest.position) {
        return false;
    }

    return true;
}

// ------------------------------------------------------
// PROGRESSIVE PUNISHMENT
// ------------------------------------------------------
// يقرر ويُنفذ الإجراء المناسب حسب مستوى الخطورة. يُرجع دائمًا نتيجة
// واضحة (executed/skipped + سبب) بدل ما يفشل بصمت أو يكسر البوت.
//
// المستويات:
//   NORMAL       -> لا إجراء
//   LOW RISK     -> حذف الرسالة فقط (بدون إزعاج العضو)
//   MEDIUM RISK  -> تحذير (يُسجَّل عبر onWarn المُمرَّرة من index.js
//                   الرئيسي — لا يُنشئ نظام تحذيرات جديد)
//   HIGH RISK    -> Timeout
//   CRITICAL     -> Kick أو Ban حسب إعدادات الإدارة (افتراضيًا Kick،
//                   قابل للتشديد لاحقًا)
async function applyProgressivePunishment({
    guild,
    client,
    member,
    message,
    riskLevelName,
    reason,
    onWarn,
    PermissionFlagsBits
}) {
    const result = { executed: false, action: "none", detail: "" };

    if (isProtectedFromPunishment(guild, client, member)) {
        result.detail = "العضو محمي (Owner/Whitelist/البوت نفسه) — لم يُتخذ أي إجراء.";
        return result;
    }

    try {
        if (riskLevelName === "LOW RISK") {
            if (message?.deletable) {
                await message.delete().catch(() => {});
            }

            result.executed = true;
            result.action = "delete";
            result.detail = "تم حذف الرسالة فقط، بدون إزعاج العضو.";
            return result;
        }

        if (riskLevelName === "MEDIUM RISK") {
            if (message?.deletable) {
                await message.delete().catch(() => {});
            }

            if (typeof onWarn === "function") {
                await onWarn(guild.id, member.id, reason);
            }

            result.executed = true;
            result.action = "warn";
            result.detail = "تم تسجيل تحذير عبر نظام التحذيرات الحالي.";
            return result;
        }

        if (riskLevelName === "HIGH RISK") {
            if (message?.deletable) {
                await message.delete().catch(() => {});
            }

            const canTimeout = await botCanModerate(
                guild,
                member,
                PermissionFlagsBits.ModerateMembers
            );

            if (!canTimeout) {
                result.detail = "البوت لا يملك صلاحية Timeout أو ترتيب الرتب غير كافٍ.";
                console.error(`[Protection] لا يمكن تنفيذ Timeout على ${member.id} — صلاحيات غير كافية.`);
                return result;
            }

            await member.timeout(10 * 60 * 1000, `W BOT Protection: ${reason}`);

            try {
                await member.send(
                    `⚠️ تم كتمك مؤقتًا في **${guild.name}** بسبب: ${reason}`
                ).catch(() => {});
            } catch {}

            result.executed = true;
            result.action = "timeout";
            result.detail = "تم تنفيذ Timeout لمدة 10 دقائق.";
            return result;
        }

        if (riskLevelName === "CRITICAL") {
            const canKick = await botCanModerate(
                guild,
                member,
                PermissionFlagsBits.KickMembers
            );

            if (!canKick) {
                result.detail = "البوت لا يملك صلاحية Kick أو ترتيب الرتب غير كافٍ.";
                console.error(`[Protection] لا يمكن تنفيذ Kick على ${member.id} — صلاحيات غير كافية.`);
                return result;
            }

            try {
                await member.send(
                    `🚨 تم طردك من **${guild.name}** بسبب سلوك عالي الخطورة: ${reason}`
                ).catch(() => {});
            } catch {}

            await member.kick(`W BOT Protection: ${reason}`);

            result.executed = true;
            result.action = "kick";
            result.detail = "تم تنفيذ Kick بسبب سلوك حرج.";
            return result;
        }

        result.detail = "المستوى NORMAL — لا إجراء مطلوب.";
        return result;
    } catch (error) {
        console.error("[Protection] خطأ أثناء تنفيذ العقوبة:", error);
        result.detail = `خطأ أثناء التنفيذ: ${error.message}`;
        return result;
    }
}

module.exports = {
    getRiskScore,
    addRisk,
    resetRisk,
    cleanupStaleRisk,
    getRiskLevel,
    isProtectedFromPunishment,
    botCanModerate,
    applyProgressivePunishment
};
