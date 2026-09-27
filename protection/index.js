const fs = require('fs');
const path = require('path');
const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require('discord.js');

const OWNER_ID = '1487388575329681570';
const DATA_FILE = path.join(__dirname, 'protection_data.json');

const DEFAULT_MODULES = {
    antiRaid: true,
    antiSpam: true,
    antiMention: true,
    antiLink: true,
    antiInvite: true,
    antiBot: true,
    autoTimeout: true
};

const DEFAULT_GUILD = {
    enabled: true,
    logChannelId: null,
    whitelist: [],
    modules: { ...DEFAULT_MODULES },
    raid: {
        active: false,
        startedAt: null,
        until: 0,
        joins: []
    }
};

let data = {};

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 4));
        }
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
    } catch (error) {
        console.error('[PROTECTION] Failed to load data:', error);
        data = {};
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
    } catch (error) {
        console.error('[PROTECTION] Failed to save data:', error);
    }
}

loadData();

function getConfig(guildId) {
    if (!data[guildId]) {
        data[guildId] = JSON.parse(JSON.stringify(DEFAULT_GUILD));
        saveData();
    }

    const config = data[guildId];
    config.modules = { ...DEFAULT_MODULES, ...(config.modules || {}) };
    config.whitelist = Array.isArray(config.whitelist) ? config.whitelist : [];
    config.raid = {
        ...DEFAULT_GUILD.raid,
        ...(config.raid || {})
    };

    return config;
}

function isProtected(member) {
    if (!member) return true;
    if (member.id === OWNER_ID) return true;
    if (member.guild?.ownerId === member.id) return true;
    if (member.user?.bot) return true;
    return false;
}

function isWhitelisted(guild, userId) {
    if (!guild || !userId) return true;
    if (guild.ownerId === userId) return true;
    if (userId === OWNER_ID) return true;
    return getConfig(guild.id).whitelist.includes(userId);
}

function isRaidModeActive(guildId) {
    const config = getConfig(guildId);
    if (!config.raid.active) return false;

    if (config.raid.until && Date.now() >= config.raid.until) {
        config.raid.active = false;
        config.raid.until = 0;
        config.raid.joins = [];
        saveData();
        return false;
    }

    return true;
}

function makeEmbed(title, description, color = 0xFF0000) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: 'W BOT • نظام الحماية' })
        .setTimestamp();
}

async function logEvent(guild, title, description, color = 0xFF0000) {
    try {
        const channelId = getConfig(guild.id).logChannelId;
        if (!channelId) return;

        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) return;

        await channel.send({
            embeds: [makeEmbed(title, description, color)]
        });
    } catch (error) {
        console.error('[PROTECTION] Log error:', error);
    }
}

function isAdmin(interaction) {
    return interaction.user.id === OWNER_ID ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function moduleEnabled(guild, moduleName) {
    const config = getConfig(guild.id);
    return config.enabled && config.modules[moduleName] !== false;
}

// ------------------------------------------------------
// ANTI SPAM
// ------------------------------------------------------
const messageTracker = new Map();
const spamTimeoutMs = 10 * 60 * 1000;
const spamLimit = 6;
const spamWindowMs = 7000;

async function handleSpam(message) {
    if (!message.guild || !message.author || message.author.bot) return false;
    if (!moduleEnabled(message.guild, 'antiSpam')) return false;
    if (isWhitelisted(message.guild, message.author.id)) return false;

    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const history = (messageTracker.get(key) || [])
        .filter(t => now - t < spamWindowMs);

    history.push(now);
    messageTracker.set(key, history);

    if (history.length < spamLimit) return false;

    messageTracker.delete(key);

    try {
        if (message.member?.moderatable && moduleEnabled(message.guild, 'autoTimeout')) {
            await message.member.timeout(
                spamTimeoutMs,
                'W BOT Security • Spam Protection'
            );
        }

        await logEvent(
            message.guild,
            '🚨 تم اكتشاف Spam',
            `👤 العضو: <@${message.author.id}>\n` +
            `🔢 الرسائل: **${spamLimit}** خلال فترة قصيرة\n` +
            `🔇 الإجراء: **Timeout لمدة 10 دقائق**`,
            0xFF0000
        );
    } catch (error) {
        console.error('[PROTECTION] Anti-spam error:', error);
    }

    return true;
}

// ------------------------------------------------------
// ANTI MENTION
// ------------------------------------------------------
async function handleMassMention(message) {
    if (!message.guild || !message.author || message.author.bot) return false;
    if (!moduleEnabled(message.guild, 'antiMention')) return false;
    if (isWhitelisted(message.guild, message.author.id)) return false;

    const everyone = message.mentions.everyone;
    const users = message.mentions.users?.size || 0;
    const roles = message.mentions.roles?.size || 0;

    if (!everyone && users < 6 && roles < 4) return false;

    try {
        if (message.deletable) {
            await message.delete().catch(() => {});
        }

        if (message.member?.moderatable && moduleEnabled(message.guild, 'autoTimeout')) {
            await message.member.timeout(
                spamTimeoutMs,
                'W BOT Security • Mass Mention Protection'
            );
        }

        await logEvent(
            message.guild,
            '🚨 منشن جماعي',
            `👤 العضو: <@${message.author.id}>\n` +
            `📢 Everyone: **${everyone ? 'نعم' : 'لا'}**\n` +
            `👥 الأعضاء: **${users}**\n` +
            `🎭 الرتب: **${roles}**\n` +
            `🔇 الإجراء: **حذف الرسالة + Timeout 10 دقائق**`,
            0xFF0000
        );
    } catch (error) {
        console.error('[PROTECTION] Anti-mention error:', error);
    }

    return true;
}

// ------------------------------------------------------
// ANTI INVITE / LINKS
// ------------------------------------------------------
const inviteRegex = /(discord(?:\.gg|\.com\/invite)\/[^\s]+)/i;
const linkRegex = /https?:\/\/[^\s]+/i;

async function handleLinks(message) {
    if (!message.guild || !message.author || message.author.bot) return false;
    if (isWhitelisted(message.guild, message.author.id)) return false;

    const content = message.content || '';
    const hasInvite = inviteRegex.test(content);
    const hasLink = linkRegex.test(content);

    if (hasInvite && moduleEnabled(message.guild, 'antiInvite')) {
        try {
            if (message.deletable) await message.delete().catch(() => {});
            await logEvent(
                message.guild,
                '🔗 تم منع رابط دعوة',
                `👤 العضو: <@${message.author.id}>\n` +
                `📝 السبب: إرسال رابط دعوة Discord`,
                0xFF0000
            );
        } catch (error) {
            console.error('[PROTECTION] Anti-invite error:', error);
        }
        return true;
    }

    if (hasLink && moduleEnabled(message.guild, 'antiLink')) {
        // روابط HTTP العادية ليست ممنوعة افتراضيًا هنا؛ منع الدعوات هو الإجراء الأساسي.
        return false;
    }

    return false;
}

// ------------------------------------------------------
// RAID
// ------------------------------------------------------
async function handleMemberAdd(member, deps = {}) {
    if (!member?.guild) return false;
    const guild = member.guild;
    const config = getConfig(guild.id);

    if (!config.enabled) return false;

    if (member.user?.bot && config.modules.antiBot !== false) {
        if (!isWhitelisted(guild, member.id)) {
            if (typeof deps.onBotAdd === 'function') {
                await deps.onBotAdd(member);
            } else {
                try {
                    if (member.bannable) {
                        await member.ban({ reason: 'W BOT Security • Bot Protection' });
                    }
                } catch (error) {
                    console.error('[PROTECTION] Anti-bot error:', error);
                }
            }
            return true;
        }
    }

    if (config.modules.antiRaid === false || isWhitelisted(guild, member.id)) {
        return false;
    }

    const now = Date.now();
    const joins = Array.isArray(config.raid.joins) ? config.raid.joins : [];
    config.raid.joins = joins.filter(t => now - t < 15000);
    config.raid.joins.push(now);

    if (config.raid.joins.length >= 5) {
        config.raid.active = true;
        config.raid.startedAt = now;
        config.raid.until = now + 5 * 60 * 1000;
        saveData();

        await logEvent(
            guild,
            '🚨 تم تفعيل Anti-Raid',
            `تم اكتشاف دخول عدد كبير من الأعضاء خلال وقت قصير.\n\n` +
            `🛡️ الوضع: **Raid Mode**\n` +
            `⏱️ المدة: **5 دقائق**`,
            0xFF0000
        );
    } else {
        saveData();
    }

    if (isRaidModeActive(guild.id) && member.joinedTimestamp) {
        try {
            if (member.moderatable && !isWhitelisted(guild, member.id)) {
                await member.timeout(
                    10 * 60 * 1000,
                    'W BOT Security • Anti-Raid'
                );
            }
        } catch (error) {
            console.error('[PROTECTION] Raid action error:', error);
        }
    }

    return isRaidModeActive(guild.id);
}

// ------------------------------------------------------
// MESSAGE HANDLER
// ------------------------------------------------------
async function handleMessage(message, deps = {}) {
    if (!message?.guild || message.author?.bot) return false;

    const spammed = await handleSpam(message);
    if (spammed) {
        if (typeof deps.onWarn === 'function' && !isWhitelisted(message.guild, message.author.id)) {
            // تسجيل تحذير واحد فقط لكل اكتشاف Spam.
            await deps.onWarn(
                message.guild.id,
                message.author.id,
                'W BOT Security • Spam'
            ).catch?.(() => {});
        }
        return true;
    }

    const mentioned = await handleMassMention(message);
    if (mentioned) {
        if (typeof deps.onWarn === 'function' && !isWhitelisted(message.guild, message.author.id)) {
            await deps.onWarn(
                message.guild.id,
                message.author.id,
                'W BOT Security • Mass Mention'
            ).catch?.(() => {});
        }
        return true;
    }

    const linkBlocked = await handleLinks(message);
    if (linkBlocked) return true;

    return false;
}

// ------------------------------------------------------
// COMMANDS
// ------------------------------------------------------
const commands = [
    new SlashCommandBuilder()
        .setName('protection')
        .setDescription('إدارة نظام الحماية')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('عرض حالة الحماية')
        )
        .addSubcommand(sub =>
            sub
                .setName('config')
                .setDescription('تفعيل أو إيقاف النظام بالكامل')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('حالة نظام الحماية')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('lockdown')
                .setDescription('تفعيل وضع الطوارئ Anti-Raid')
        )
        .addSubcommand(sub =>
            sub
                .setName('unlock')
                .setDescription('إيقاف وضع الطوارئ Anti-Raid')
        )
        .addSubcommand(sub =>
            sub
                .setName('whitelist')
                .setDescription('إدارة قائمة الحماية')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('add أو remove أو list')
                        .setRequired(true)
                        .addChoices(
                            { name: 'إضافة', value: 'add' },
                            { name: 'إزالة', value: 'remove' },
                            { name: 'عرض', value: 'list' }
                        )
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('العضو')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('logs')
                .setDescription('تحديد روم سجلات الحماية')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('روم السجلات')
                        .setRequired(true)
                )
        )
];

function statusEmbed(guild) {
    const config = getConfig(guild.id);
    const enabled = config.enabled;
    const modules = config.modules;

    const icon = value => value ? '🟢' : '🔴';

    return makeEmbed(
        '🛡️ W BOT • حالة الحماية',
        `الحالة العامة: **${enabled ? 'مفعلة' : 'متوقفة'}**\n\n` +
        `${icon(modules.antiRaid)} Anti-Raid\n` +
        `${icon(modules.antiSpam)} Anti-Spam\n` +
        `${icon(modules.antiMention)} Anti-Mention\n` +
        `${icon(modules.antiInvite)} Anti-Invite\n` +
        `${icon(modules.antiLink)} Anti-Link\n` +
        `${icon(modules.antiBot)} Anti-Bot\n` +
        `${icon(modules.autoTimeout)} Auto Timeout\n\n` +
        `📋 روم السجلات: ${config.logChannelId ? `<#${config.logChannelId}>` : '**غير محدد**'}`,
        enabled ? 0x00AA00 : 0xFF0000
    );
}

async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    if (interaction.commandName !== 'protection') return false;

    if (!interaction.guild) {
        await interaction.reply({
            content: '❌ هذا الأمر يعمل داخل السيرفر فقط.',
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    if (!isAdmin(interaction)) {
        await interaction.reply({
            content: '❌ هذا الأمر مخصص للإداريين فقط.',
            flags: MessageFlags.Ephemeral
        });
        return true;
    }

    const subcommand = interaction.options.getSubcommand();
    const config = getConfig(interaction.guild.id);

    if (subcommand === 'status') {
        await interaction.reply({ embeds: [statusEmbed(interaction.guild)] });
        return true;
    }

    if (subcommand === 'config') {
        config.enabled = interaction.options.getBoolean('enabled');
        saveData();

        await interaction.reply({
            embeds: [makeEmbed(
                config.enabled ? '🛡️ تم تفعيل الحماية' : '⚠️ تم إيقاف الحماية',
                `الحالة الجديدة: **${config.enabled ? 'مفعلة' : 'متوقفة'}**`,
                config.enabled ? 0x0000FF : 0xFF0000
            )]
        });
        return true;
    }

    if (subcommand === 'lockdown') {
        config.raid.active = true;
        config.raid.startedAt = Date.now();
        config.raid.until = Date.now() + 5 * 60 * 1000;
        saveData();

        await logEvent(
            interaction.guild,
            '🔒 تم تفعيل Raid Lockdown',
            `👮 بواسطة: <@${interaction.user.id}>`,
            0xFF0000
        );

        await interaction.reply({
            embeds: [makeEmbed(
                '🔒 تم تفعيل الحماية الطارئة',
                'تم تفعيل **Raid Mode** لمدة **5 دقائق**.',
                0xFF0000
            )]
        });
        return true;
    }

    if (subcommand === 'unlock') {
        config.raid.active = false;
        config.raid.until = 0;
        config.raid.joins = [];
        saveData();

        await interaction.reply({
            embeds: [makeEmbed(
                '🔓 تم إلغاء الحماية الطارئة',
                `👮 بواسطة: <@${interaction.user.id}>`,
                0x0000FF
            )]
        });
        return true;
    }

    if (subcommand === 'whitelist') {
        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');

        if (action === 'list') {
            const list = config.whitelist.length
                ? config.whitelist.map(id => `<@${id}> — \`${id}\``).join('\n')
                : 'القائمة فارغة.';

            await interaction.reply({
                embeds: [makeEmbed('🛡️ Whitelist', list, 0x0000FF)]
            });
            return true;
        }

        if (!user) {
            await interaction.reply({
                content: '❌ لازم تحدد العضو.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        if (user.id === OWNER_ID || user.id === interaction.guild.ownerId) {
            await interaction.reply({
                content: '❌ هذا المستخدم محمي تلقائيًا ولا يحتاج إلى Whitelist.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        if (action === 'add') {
            if (!config.whitelist.includes(user.id)) {
                config.whitelist.push(user.id);
                saveData();
            }

            await interaction.reply({
                embeds: [makeEmbed(
                    '🟢 تمت إضافة العضو',
                    `👤 <@${user.id}>\n\nتمت إضافته إلى **Whitelist**.`,
                    0x0000FF
                )]
            });
            return true;
        }

        if (action === 'remove') {
            config.whitelist = config.whitelist.filter(id => id !== user.id);
            saveData();

            await interaction.reply({
                embeds: [makeEmbed(
                    '🔴 تمت إزالة العضو',
                    `👤 <@${user.id}>\n\nتمت إزالته من **Whitelist**.`,
                    0xFF0000
                )]
            });
            return true;
        }
    }

    if (subcommand === 'logs') {
        const channel = interaction.options.getChannel('channel');

        if (!channel?.isTextBased()) {
            await interaction.reply({
                content: '❌ اختر رومًا نصيًا.',
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        config.logChannelId = channel.id;
        saveData();

        await interaction.reply({
            embeds: [makeEmbed(
                '📋 تم تحديد روم السجلات',
                `سيتم إرسال سجلات نظام الحماية إلى:\n\n<#${channel.id}>`,
                0x0000FF
            )]
        });
        return true;
    }

    return true;
}

// ------------------------------------------------------
// REGISTER
// ------------------------------------------------------
function register(client, deps = {}) {
    if (!client || typeof client.on !== 'function') {
        throw new TypeError('[PROTECTION] register(client) requires a Discord client.');
    }

    // هذا الملف يملك messageCreate فقط.
    // أحداث channel/role/ban/kick موجودة أصلًا في index.js الرئيسي.
    if (!client.__wbotProtectionMessageListener) {
        client.__wbotProtectionMessageListener = true;

        client.on('messageCreate', async message => {
            try {
                await handleMessage(message, deps);
            } catch (error) {
                console.error('[PROTECTION] messageCreate error:', error);
            }
        });
    }

    console.log('[PROTECTION] Protection system registered successfully.');
}

module.exports = {
    register,
    handleInteraction,
    handleMemberAdd,
    handleMessage,
    commands,
    getConfig,
    isRaidModeActive,
    isWhitelisted,
    isProtected,
    logEvent
    
};