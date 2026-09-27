const { getConfig } = require("./config");
const {
    pushMessage,
    checkFrequency,
    checkDuplicateOrSimilar,
    checkCapsFlood,
    checkMentions,
    extractDomains,
    extractInvite
} = require("./antiSpam");
const { isDomainWhitelisted } = require("./whitelist");
const { isNewAccount } = require("./raid");

// ======================================================
// DETECTOR
// ======================================================
// المسؤولية الوحيدة: تحليل رسالة واحدة وإرجاع تقرير خطورة (نقاط +
// أسباب + أدلة). لا يحذف رسائل ولا يعاقب أحدًا — هذا عمل actions.js.
// ======================================================

function analyzeMessage(message) {
    const guildId = message.guild.id;
    const userId = message.author.id;
    const content = message.content || "";
    const config = getConfig(guildId);
    const weights = config.riskWeights;

    const reasons = [];
    const evidenceLines = [];
    let points = 0;

    // سجل الرسالة أولًا حتى تدخل بحساب التكرار/التشابه القادم.
    pushMessage(guildId, userId, content);

    // ---------------- SPAM FREQUENCY ----------------
    if (config.modules.antiSpam) {
        const frequency = checkFrequency(
            guildId,
            userId,
            config.spam.messageWindowMs,
            config.spam.messageLimit
        );

        if (frequency.isSpam) {
            points += weights.spam;
            reasons.push("Spam (رسائل متكررة بسرعة)");
            evidenceLines.push(
                `${frequency.count} رسالة خلال ${config.spam.messageWindowMs / 1000} ثانية`
            );
        }

        // ---------------- DUPLICATE / SIMILAR MESSAGES ----------------
        const duplicate = checkDuplicateOrSimilar(
            guildId,
            userId,
            content,
            config.spam.similarityThreshold
        );

        if (duplicate.totalSimilar >= config.spam.duplicateLimit) {
            points += weights.duplicateMessage;
            reasons.push("رسائل مكررة أو متشابهة جدًا");
            evidenceLines.push(
                `${duplicate.totalSimilar} رسالة مشابهة/مكررة مؤخرًا`
            );
        }

        // ---------------- CAPS FLOOD (secondary factor only) ----------------
        const caps = checkCapsFlood(content);

        if (caps.isCapsFlood) {
            points += weights.capsFlood;
            reasons.push("إفراط في الأحرف الكبيرة");
            evidenceLines.push(`نسبة الأحرف الكبيرة: ${Math.round(caps.ratio * 100)}%`);
        }
    }

    // ---------------- MENTIONS ----------------
    if (config.modules.antiMention) {
        const mentions = checkMentions(message, config);

        if (mentions.hasEveryone) {
            points += weights.everyoneMention;
            reasons.push("استخدام @everyone / @here");
            evidenceLines.push("تم استخدام منشن جماعي (@everyone/@here)");
        } else if (mentions.isUserMentionSpam || mentions.isRoleMentionSpam) {
            points += weights.mentionSpam;
            reasons.push("منشن جماعي (Mention Spam)");
            evidenceLines.push(
                `${mentions.userMentions} منشن عضو / ${mentions.roleMentions} منشن رتبة`
            );
        }
    }

    // ---------------- INVITES ----------------
    let inviteDetected = null;

    if (config.modules.antiInvite) {
        const invite = extractInvite(content);

        if (invite) {
            inviteDetected = invite;

            const isOwnServerInvite =
                config.invites.allowOwnServerInvites &&
                message.guild.vanityURLCode === invite;

            if (!isOwnServerInvite) {
                points += weights.suspiciousInvite;
                reasons.push("رابط دعوة ديسكورد");
                evidenceLines.push(`رابط دعوة مكتشف: discord.gg/${invite}`);
            }
        }
    }

    // ---------------- LINKS ----------------
    let blockedDomainFound = null;

    if (config.modules.antiLink) {
        const domains = extractDomains(content);

        for (const domain of domains) {
            const isExplicitlyBlocked = config.links.blockedDomains.some(
                blocked => domain === blocked || domain.endsWith(`.${blocked}`)
            );

            const isExplicitlyAllowed =
                isDomainWhitelisted(guildId, domain) ||
                config.links.allowedDomains.some(
                    allowed => domain === allowed || domain.endsWith(`.${allowed}`)
                );

            if (isExplicitlyBlocked) {
                blockedDomainFound = domain;
                points += weights.blockedLink;
                reasons.push("رابط محظور");
                evidenceLines.push(`رابط محظور: ${domain}`);
                break;
            }

            if (!config.links.allowByDefault && !isExplicitlyAllowed) {
                blockedDomainFound = domain;
                points += Math.round(weights.blockedLink / 2);
                reasons.push("رابط غير موثوق");
                evidenceLines.push(`رابط غير مدرج ضمن المسموح: ${domain}`);
                break;
            }
        }
    }

    // ---------------- NEW ACCOUNT FACTOR ----------------
    if (
        points > 0 &&
        message.member &&
        isNewAccount(message.author, config.raid.newAccountAgeMs)
    ) {
        points += weights.newAccountPenalty;
        reasons.push("حساب جديد + سلوك مشبوه");
        evidenceLines.push("عمر الحساب أقل من الحد الآمن المحدد");
    }

    return {
        points: Math.min(100, points),
        reasons,
        evidence: evidenceLines.join(" / "),
        inviteDetected,
        blockedDomainFound
    };
}

module.exports = {
    analyzeMessage
};
