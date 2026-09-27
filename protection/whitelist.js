const { getConfig } = require("./config");

// ======================================================
// WHITELIST
// ======================================================
// فحوصات استثناء بسيطة. لا تعني الاستثناء تجاهل كل شيء بشكل مطلق —
// كل دالة هنا تفحص نوع استثناء واحد محدد، ويقرر المستدعي (detector/index)
// أي الاستثناءات تنطبق على أي فحص.
// ======================================================

function isUserWhitelisted(guildId, userId) {
    const config = getConfig(guildId);
    return config.whitelist.users.includes(userId);
}

function isBotWhitelisted(guildId, botId) {
    const config = getConfig(guildId);
    return config.whitelist.bots.includes(botId);
}

function isChannelWhitelisted(guildId, channelId) {
    const config = getConfig(guildId);
    return config.whitelist.channels.includes(channelId);
}

function isDomainWhitelisted(guildId, domain) {
    const config = getConfig(guildId);
    return config.whitelist.domains.some(
        d => domain === d || domain.endsWith(`.${d}`)
    );
}

function hasWhitelistedRole(guildId, member) {
    if (!member || !member.roles) return false;

    const config = getConfig(guildId);

    if (config.whitelist.roles.length === 0) return false;

    return member.roles.cache.some(role =>
        config.whitelist.roles.includes(role.id)
    );
}

// فحص شامل: هل هذا العضو مستثنى من فحوصات الرسائل/السلوك؟
// (Owner والبوت نفسه يُتحقق منهم من المستدعي لأنهم يحتاجون client/guild مباشرة)
function isMemberExempt(guildId, member) {
    if (!member) return false;

    if (isUserWhitelisted(guildId, member.id)) return true;
    if (hasWhitelistedRole(guildId, member)) return true;

    return false;
}

// ------------------------------------------------------
// MUTATIONS
// ------------------------------------------------------

function addToWhitelist(guildId, type, id) {
    const config = getConfig(guildId);

    if (!config.whitelist[type]) return false;
    if (config.whitelist[type].includes(id)) return false;

    config.whitelist[type].push(id);

    const { saveConfig } = require("./config");
    saveConfig(guildId);

    return true;
}

function removeFromWhitelist(guildId, type, id) {
    const config = getConfig(guildId);

    if (!config.whitelist[type]) return false;

    const index = config.whitelist[type].indexOf(id);
    if (index === -1) return false;

    config.whitelist[type].splice(index, 1);

    const { saveConfig } = require("./config");
    saveConfig(guildId);

    return true;
}

function listWhitelist(guildId) {
    return getConfig(guildId).whitelist;
}

module.exports = {
    isUserWhitelisted,
    isBotWhitelisted,
    isChannelWhitelisted,
    isDomainWhitelisted,
    hasWhitelistedRole,
    isMemberExempt,
    addToWhitelist,
    removeFromWhitelist,
    listWhitelist
};
