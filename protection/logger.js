const { EmbedBuilder } = require("discord.js");
const { getConfig } = require("./config");

// ======================================================
// PROTECTION LOGGER
// ======================================================
// كل حدث حماية مهم يُرسل هنا. مسؤولية واحدة: بناء وإرسال Embed
// احترافي لروم اللوق المحدد لكل Guild. لا يتخذ أي قرار حماية بنفسه.
// ======================================================

const COLORS = {
    NORMAL: 0x5865F2,
    LOW: 0x00C853,
    MEDIUM: 0xF5A623,
    HIGH: 0xE67E22,
    CRITICAL: 0xE53E3E
};

function colorForRiskLevel(levelName) {
    switch (levelName) {
        case "LOW RISK": return COLORS.LOW;
        case "MEDIUM RISK": return COLORS.MEDIUM;
        case "HIGH RISK": return COLORS.HIGH;
        case "CRITICAL": return COLORS.CRITICAL;
        default: return COLORS.NORMAL;
    }
}

async function getLogChannel(guild) {
    const config = getConfig(guild.id);

    if (!config.logChannelId) return null;

    try {
        const channel =
            guild.channels.cache.get(config.logChannelId) ||
            (await guild.channels.fetch(config.logChannelId).catch(() => null));

        return channel && channel.isTextBased() ? channel : null;
    } catch (error) {
        console.error("[Protection Logger] فشل جلب روم اللوق:", error);
        return null;
    }
}

// ------------------------------------------------------
// GENERIC SECURITY ALERT (Risk-based)
// ------------------------------------------------------

async function logSecurityAlert(guild, {
    user,
    riskScore,
    riskLevelName,
    threat,
    action,
    evidence
}) {
    try {
        const channel = await getLogChannel(guild);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle("🛡️ تنبيه أمني")
            .setColor(colorForRiskLevel(riskLevelName))
            .addFields(
                { name: "👤 العضو", value: user ? `<@${user.id}>` : "غير معروف", inline: true },
                { name: "📊 درجة الخطورة", value: `**${riskScore}/100**`, inline: true },
                { name: "🎯 المستوى", value: `**${riskLevelName}**`, inline: true },
                { name: "⚠️ نوع التهديد", value: threat || "غير محدد", inline: false },
                { name: "🔨 الإجراء المتخذ", value: action || "لا شيء", inline: false }
            )
            .setFooter({ text: "W BOT • Protection System" })
            .setTimestamp();

        if (evidence) {
            embed.addFields({ name: "🔍 الأدلة", value: evidence, inline: false });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("[Protection Logger] فشل إرسال تنبيه أمني:", error);
    }
}

// ------------------------------------------------------
// SIMPLE EVENT LOG (raid, bot added, invite, lockdown...)
// ------------------------------------------------------

async function logEvent(guild, title, description, color = COLORS.NORMAL) {
    try {
        const channel = await getLogChannel(guild);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setFooter({ text: "W BOT • Protection System" })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error("[Protection Logger] فشل إرسال سجل:", error);
    }
}

module.exports = {
    COLORS,
    colorForRiskLevel,
    logSecurityAlert,
    logEvent
};
