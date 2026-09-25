require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    AuditLogEvent,
    ChannelType,
    MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const welcome = require("./welcome");
const games = require("./games");
const tickets = require("./tickets");
const general = require("./commands");

const OWNER_ID = "1487388575329681570";

const PUBLIC_COMMANDS = [
    "play",
    "help",
    "userinfo",
    "user",
    "serverinfo",
    "server",
    "avatar"
];

const ADMIN_COMMANDS = new Set(general.ADMIN_COMMANDS);

let MAINTENANCE = false;


// ======================================================
// CLIENT
// ======================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});


// ===============================
// GENERAL SYSTEM
// ===============================
general.registerClient(client);

// ===============================
// WELCOME SYSTEM
// ===============================

// نظام الترحيب GIF المستقل
welcome.registerWelcome(client);

// ======================================================
// إعدادات السيرفر
// ======================================================

// 👇👇👇 حط ID السيرفر هنا
const GUILD_ID = "1551431706731479199";



// ======================================================
// إعدادات الحماية
// ======================================================

const SECURITY = {

    // الحماية مفعلة
    enabled: true,

    // حماية البوتات
    antiBot: true,

    // حماية الحظر الجماعي
    antiMassBan: true,

    // حماية الطرد الجماعي
    antiMassKick: true,

    // حماية حذف الرومات
    antiChannelDelete: true,

    // حماية إنشاء الرومات بكثرة
    antiChannelCreate: true,

    // حماية حذف الرتب
    antiRoleDelete: true,

    // حماية إنشاء الرتب بكثرة
    antiRoleCreate: true,

    // حماية الويب هوك
    antiWebhook: true,

    // حماية السبام
    antiSpam: true,

    // حماية المنشن الجماعي
    antiMassMention: true,

    // منع روابط الدعوات
    antiInvites: true,

    // الحد الأقصى للعمليات خلال النافذة الزمنية
    actionLimit: 3,

    // المدة بالثواني
    actionWindow: 10,

    // عدد الرسائل المسموح بها
    spamMessageLimit: 6,

    // مدة التايم أوت للسبامر
    spamTimeout: 10 * 60 * 1000
};


// ======================================================
// الألوان
// ======================================================

const COLORS = {

    RED: 0xFF0000,

    BLUE: 0x0000FF,

    BLACK: 0x000000,

    WHITE: 0xFFFFFF
};


// ======================================================
// ملف إعدادات الحماية
// ======================================================

const DATA_FILE = path.join(__dirname, "protection.json");

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify({}, null, 4)
    );
}

let protectionData = {};

try {
    protectionData = JSON.parse(
        fs.readFileSync(DATA_FILE, "utf8")
    );
} catch {
    protectionData = {};
}


function saveProtectionData() {

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(protectionData, null, 4)
    );
}


// ======================================================
// نظام التحذيرات والعقوبات التلقائية
// ======================================================

const WARNINGS_FILE = path.join(__dirname, "warnings.json");
const TEMP_BANS_FILE = path.join(__dirname, "temporary_bans.json");

if (!fs.existsSync(WARNINGS_FILE)) {
    fs.writeFileSync(
        WARNINGS_FILE,
        JSON.stringify({}, null, 4)
    );
}

if (!fs.existsSync(TEMP_BANS_FILE)) {
    fs.writeFileSync(
        TEMP_BANS_FILE,
        JSON.stringify({}, null, 4)
    );
}

let warningsData = {};
let temporaryBansData = {};

try {
    warningsData = JSON.parse(
        fs.readFileSync(WARNINGS_FILE, "utf8")
    );
} catch {
    warningsData = {};
}

try {
    temporaryBansData = JSON.parse(
        fs.readFileSync(TEMP_BANS_FILE, "utf8")
    );
} catch {
    temporaryBansData = {};
}

function saveWarningsData() {
    fs.writeFileSync(
        WARNINGS_FILE,
        JSON.stringify(warningsData, null, 4)
    );
}

function saveTemporaryBansData() {
    fs.writeFileSync(
        TEMP_BANS_FILE,
        JSON.stringify(temporaryBansData, null, 4)
    );
}

function getWarningCount(guildId, userId) {
    if (!warningsData[guildId]) {
        warningsData[guildId] = {};
    }

    return Number(
        warningsData[guildId][userId] || 0
    );
}

function addWarning(guildId, userId) {
    if (!warningsData[guildId]) {
        warningsData[guildId] = {};
    }

    const count =
        getWarningCount(guildId, userId) + 1;

    warningsData[guildId][userId] = count;

    saveWarningsData();

    return count;
}

function removeWarning(guildId, userId) {
    const current =
        getWarningCount(guildId, userId);

    if (current <= 0) {
        return 0;
    }

    const next = current - 1;

    if (next === 0) {
        if (warningsData[guildId]) {
            delete warningsData[guildId][userId];
        }
    } else {
        warningsData[guildId][userId] = next;
    }

    saveWarningsData();

    return next;
}

function getWarningAction(count) {
    if (count === 2) {
        return {
            type: "timeout",
            durationMs: 6 * 60 * 60 * 1000,
            durationText: "6 ساعات"
        };
    }

    if (count === 4) {
        return {
            type: "temporaryBan",
            durationMs: 12 * 60 * 60 * 1000,
            durationText: "12 ساعة"
        };
    }

    if (count >= 5) {
        return {
            type: "permanentBan",
            durationMs: null,
            durationText: "دائم"
        };
    }

    return null;
}

const temporaryBanTimers = new Map();

function clearTemporaryBanTimer(guildId, userId) {
    const key = `${guildId}:${userId}`;

    if (temporaryBanTimers.has(key)) {
        clearTimeout(
            temporaryBanTimers.get(key)
        );

        temporaryBanTimers.delete(key);
    }
}

async function scheduleTemporaryWarningBan(
    guild,
    userId,
    durationMs,
    reason
) {
    const key = `${guild.id}:${userId}`;
    const expiresAt = Date.now() + durationMs;

    temporaryBansData[key] = {
        guildId: guild.id,
        userId,
        expiresAt,
        reason
    };

    saveTemporaryBansData();

    clearTemporaryBanTimer(
        guild.id,
        userId
    );

    const remaining = Math.max(
        1000,
        expiresAt - Date.now()
    );

    const timer = setTimeout(
        async () => {
            try {
                await guild.bans.remove(
                    userId,
                    "W BOT • انتهاء باند التحذيرات لمدة 12 ساعة"
                );

                await sendSecurityLog(
                    guild,
                    "🔓 انتهى باند التحذيرات",
                    `👤 العضو: <@${userId}>\n` +
                    `⏱️ انتهت مدة الباند تلقائيًا بعد **12 ساعة**.`,
                    COLORS.BLUE
                );
            } catch (error) {
                console.error(
                    "Auto Warning Unban Error:",
                    error
                );
            } finally {
                delete temporaryBansData[key];
                saveTemporaryBansData();
                temporaryBanTimers.delete(key);
            }
        },
        remaining
    );

    temporaryBanTimers.set(key, timer);
}

async function restoreTemporaryWarningBans() {
    for (const [key, data] of Object.entries(temporaryBansData)) {
        const guild = client.guilds.cache.get(data.guildId);

        if (!guild) {
            delete temporaryBansData[key];
            continue;
        }

        const remaining = data.expiresAt - Date.now();

        if (remaining <= 0) {
            try {
                await guild.bans.remove(
                    data.userId,
                    "W BOT • انتهاء باند التحذيرات لمدة 12 ساعة"
                );

                await sendSecurityLog(
                    guild,
                    "🔓 انتهى باند التحذيرات",
                    `👤 العضو: <@${data.userId}>\n` +
                    `⏱️ انتهت مدة الباند أثناء توقف البوت.`,
                    COLORS.BLUE
                );
            } catch (error) {
                console.error(
                    "Restore Warning Ban Error:",
                    error
                );
            }

            delete temporaryBansData[key];
            continue;
        }

        clearTemporaryBanTimer(
            data.guildId,
            data.userId
        );

        const timer = setTimeout(
            async () => {
                try {
                    await guild.bans.remove(
                        data.userId,
                        "W BOT • انتهاء باند التحذيرات لمدة 12 ساعة"
                    );

                    await sendSecurityLog(
                        guild,
                        "🔓 انتهى باند التحذيرات",
                        `👤 العضو: <@${data.userId}>\n` +
                        `⏱️ انتهت مدة الباند تلقائيًا بعد **12 ساعة**.`,
                        COLORS.BLUE
                    );
                } catch (error) {
                    console.error(
                        "Auto Warning Unban Error:",
                        error
                    );
                } finally {
                    delete temporaryBansData[key];
                    saveTemporaryBansData();
                    temporaryBanTimers.delete(key);
                }
            },
            remaining
        );

        temporaryBanTimers.set(key, timer);
    }

    saveTemporaryBansData();
}


function getGuildData(guildId) {

    if (!protectionData[guildId]) {

        protectionData[guildId] = {
            enabled: true,
            logChannelId: null,
            whitelist: []
        };

        saveProtectionData();
    }

    return protectionData[guildId];
}


// ======================================================
// WHITELIST
// ======================================================

function isWhitelisted(guild, userId) {

    const data = getGuildData(guild.id);

    // مالك السيرفر محمي
    if (guild.ownerId === userId) {
        return true;
    }

    // البوت نفسه محمي
    if (client.user && client.user.id === userId) {
        return true;
    }

    // Whitelist
    if (data.whitelist.includes(userId)) {
        return true;
    }

    return false;
}


// ======================================================
// EMBED
// ======================================================

function createEmbed(title, description, color) {

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({
            text: "W BOT • نظام الحماية"
        })
        .setTimestamp();
}


// ======================================================
// LOG
// ======================================================

async function sendSecurityLog(
    guild,
    title,
    description,
    color = COLORS.RED
) {

    try {

        const data = getGuildData(guild.id);

        const configuredLogChannelId =
            data.logChannelId ||
            general.getGuildConfig(guild.id).logChannelId;

        if (!configuredLogChannelId) {
            return;
        }

        const channel =
            guild.channels.cache.get(
                configuredLogChannelId
            );

        if (!channel) {
            return;
        }

        const embed =
            createEmbed(
                title,
                description,
                color
            );

        await channel.send({
            embeds: [embed]
        });

    } catch (error) {

        console.error(
            "Security Log Error:",
            error
        );
    }
}


// ======================================================
// RATE LIMIT
// ======================================================

const actionTracker = new Map();


function registerAction(
    guildId,
    userId,
    action
) {

    const key =
        `${guildId}:${userId}:${action}`;

    const now = Date.now();

    if (!actionTracker.has(key)) {
        actionTracker.set(key, []);
    }

    const actions =
        actionTracker.get(key);

    const validActions =
        actions.filter(
            timestamp =>
                now - timestamp <
                SECURITY.actionWindow * 1000
        );

    validActions.push(now);

    actionTracker.set(
        key,
        validActions
    );

    return validActions.length;
}


// ======================================================
// GET EXECUTOR
// ======================================================

async function getExecutor(
    guild,
    auditType,
    targetId
) {

    try {

        const logs =
            await guild.fetchAuditLogs({
                type: auditType,
                limit: 5
            });

        const entry =
            logs.entries.find(
                item => {

                    if (
                        targetId &&
                        item.targetId !== targetId
                    ) {
                        return false;
                    }

                    return (
                        Date.now() -
                        item.createdTimestamp <
                        10000
                    );
                }
            );

        if (!entry) {
            return null;
        }

        return entry.executor;

    } catch (error) {

        console.error(
            "Audit Log Error:",
            error
        );

        return null;
    }
}


// ======================================================
// عقوبة المستخدم
// ======================================================

async function punishUser(
    guild,
    userId,
    reason
) {

    if (
        !userId ||
        isWhitelisted(guild, userId)
    ) {
        return false;
    }

    try {

        const member =
            await guild.members
                .fetch(userId)
                .catch(() => null);

        if (!member) {
            return false;
        }

        if (
            !member.bannable
        ) {
            await sendSecurityLog(
                guild,
                "⚠️ تم اكتشاف تهديد",
                `👤 المستخدم: <@${userId}>\n` +
                `📝 السبب: ${reason}\n\n` +
                `❌ البوت لا يستطيع حظره بسبب ترتيب الرتب.`,
                COLORS.RED
            );

            return false;
        }

        await member.ban({
            reason:
                `W BOT Security: ${reason}`
        });

        await sendSecurityLog(
            guild,
            "🛡️ تم إيقاف مستخدم",
            `👤 المستخدم: <@${userId}>\n` +
            `🔨 الإجراء: حظر\n` +
            `📝 السبب: ${reason}`,
            COLORS.RED
        );

        return true;

    } catch (error) {

        console.error(
            "Punishment Error:",
            error
        );

        return false;
    }
}


// ======================================================
// أوامر البوت
// ======================================================

const commands = [

    // --------------------------------------------------
    // PING
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription(
            "معرفة سرعة استجابة البوت"
        ),


    // --------------------------------------------------
    // HELP
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("help")
        .setDescription(
            "عرض جميع أوامر البوت"
        ),


    // --------------------------------------------------
    // BAN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription(
            "حظر عضو من السيرفر"
        )

        .addUserOption(option =>
            option
                .setName("user")
                .setDescription(
                    "العضو الذي تريد حظره"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("duration")
                .setDescription(
                    "10m / 1h / 1d / 7d / permanent"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "سبب الحظر"
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),


    // --------------------------------------------------
    // UNBAN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("unban")
        .setDescription(
            "فك حظر عضو"
        )

        .addStringOption(option =>
            option
                .setName("user")
                .setDescription(
                    "Discord ID الخاص بالعضو"
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.BanMembers
        ),


    // --------------------------------------------------
    // KICK
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("kick")
        .setDescription(
            "طرد عضو من السيرفر"
        )

        .addUserOption(option =>
            option
                .setName("user")
                .setDescription(
                    "العضو الذي تريد طرده"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "سبب الطرد"
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.KickMembers
        ),


    // --------------------------------------------------
    // TIMEOUT
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("timeout")
        .setDescription(
            "إعطاء عضو تايم أوت"
        )

        .addUserOption(option =>
            option
                .setName("user")
                .setDescription(
                    "العضو"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("duration")
                .setDescription(
                    "10m / 1h / 1d / 7d / 28d"
                )
                .setRequired(true)
        )

        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription(
                    "سبب التايم أوت"
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),


    // --------------------------------------------------
    // UNTIMEOUT
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("untimeout")
        .setDescription(
            "إلغاء تايم أوت عن عضو"
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("العضو")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("سبب إلغاء التايم أوت")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    // --------------------------------------------------
    // WARN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("warn")
        .setDescription(
            "تحذير عضو"
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("العضو")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("سبب التحذير")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    // --------------------------------------------------
    // UNWARN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("unwarn")
        .setDescription(
            "إزالة تحذير من عضو"
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("العضو")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ModerateMembers
        ),

    // --------------------------------------------------
    // CLEAR
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("clear")
        .setDescription(
            "حذف رسائل من الروم"
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("عدد الرسائل من 1 إلى 100")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    // --------------------------------------------------
    // PROTECTION
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("protection")
        .setDescription(
            "عرض حالة نظام الحماية"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),


    // --------------------------------------------------
    // LOCKDOWN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("lockdown")
        .setDescription(
            "تفعيل الإغلاق الأمني للسيرفر"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),


    // --------------------------------------------------
    // UNLOCKDOWN
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("unlockdown")
        .setDescription(
            "إلغاء الإغلاق الأمني"
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),



new SlashCommandBuilder()
    .setName("maintenance")
    .setDescription("تشغيل أو إيقاف الصيانة")
    .addBooleanOption(option =>
        option
            .setName("status")
            .setDescription("تشغيل = true | إيقاف = false")
            .setRequired(true)
    )
    .setDefaultMemberPermissions(
        PermissionFlagsBits.Administrator
    ),





   // --------------------------------------------------
    // SET SECURITY LOG
    // --------------------------------------------------

    new SlashCommandBuilder()
        .setName("setsecuritylog")
        .setDescription(
            "تحديد روم سجلات الحماية"
        )

        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription(
                    "روم السجلات"
                )
                .addChannelTypes(
                    ChannelType.GuildText
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    // ==================================================
    // GENERAL COMMANDS
    // ==================================================

    ...general.commands,

    // GAMES
    // ==================================================

    ...games.commands,
    ...tickets.commands

].map(command =>
    typeof command?.toJSON === "function"
        ? command.toJSON()
        : command
);

// ======================================================
// REST
// ======================================================

const rest = new REST({
    version: "10"
}).setToken(
    process.env.TOKEN
);


// ======================================================
// PARSE DURATION
// ======================================================

function parseDuration(duration) {

    if (!duration) {
        return false;
    }

    const match =
        duration
            .toLowerCase()
            .match(
                /^(\d+)(m|h|d)$/
            );

    if (!match) {
        return false;
    }

    const amount =
        Number(match[1]);

    const unit =
        match[2];

    if (amount <= 0) {
        return false;
    }

    if (unit === "m") {
        return amount * 60 * 1000;
    }

    if (unit === "h") {
        return amount * 60 * 60 * 1000;
    }

    if (unit === "d") {
        return amount * 24 * 60 * 60 * 1000;
    }

    return false;
}


// ======================================================
// MODERATION HIERARCHY
// ======================================================

function cannotModerate(
    interaction,
    member
) {

    if (!member) {
        return false;
    }

    if (
        member.id ===
        interaction.guild.ownerId
    ) {
        return true;
    }

    if (
        member.roles.highest.position >=
        interaction.member.roles.highest.position
    ) {
        return true;
    }

    const botMember =
        interaction.guild.members.me;

    if (
        botMember &&
        member.roles.highest.position >=
        botMember.roles.highest.position
    ) {
        return true;
    }

    return false;
}


// ======================================================
// BOT JOIN / REGISTER COMMANDS
// ======================================================

client.on("guildCreate", async guild => {
    if (guild.id !== GUILD_ID) {
        console.log(`🚫 سيرفر غير مسموح: ${guild.name}`);

        try {
            await guild.leave();
            console.log(`✅ خرج البوت من: ${guild.name}`);
        } catch (error) {
            console.error("❌ فشل خروج البوت:", error);
        }

        return;
    }

    console.log(`✅ السيرفر المسموح: ${guild.name}`);
});

client.once(
    "clientReady",
    async () => {

        console.log(
            `✅ البوت اشتغل: ${client.user.tag}`
        );

        try {

            await rest.put(
                Routes.applicationGuildCommands(
                    client.user.id,
                    GUILD_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                "✅ تم تسجيل جميع الأوامر"
            );

            await restoreTemporaryWarningBans();

        } catch (error) {

            console.error(
                "❌ خطأ في تسجيل الأوامر:",
                error
            );
        }
    }
);


// ======================================================
// BOT JOIN
// ======================================================

client.on(
    "guildMemberAdd",
    async member => {

        if (!SECURITY.enabled) {
            return;
        }

        if (!SECURITY.antiBot) {
            return;
        }

        if (!member.user.bot) {
            return;
        }

        if (
            isWhitelisted(
                member.guild,
                member.id
            )
        ) {
            return;
        }

        try {

            await member.ban({
                reason:
                    "W BOT Security • Bot Protection"
            });

            await sendSecurityLog(
                member.guild,
                "🤖 تم منع بوت",
                `🤖 البوت: <@${member.id}>\n` +
                `🔨 الإجراء: حظر تلقائي\n` +
                `📝 السبب: إضافة بوت غير مصرح به`,
                COLORS.RED
            );

        } catch (error) {

            console.error(
                "Anti Bot Error:",
                error
            );
        }
    }
);


// ======================================================
// CHANNEL DELETE
// ======================================================

client.on(
    "channelDelete",
    async channel => {

        if (!channel.guild) {
            return;
        }

        if (
            !SECURITY.enabled ||
            !SECURITY.antiChannelDelete
        ) {
            return;
        }

        const executor =
            await getExecutor(
                channel.guild,
                AuditLogEvent.ChannelDelete,
                channel.id
            );

        if (!executor) {
            return;
        }

        if (
            isWhitelisted(
                channel.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                channel.guild.id,
                executor.id,
                "channelDelete"
            );

        await sendSecurityLog(
            channel.guild,
            "🚨 حذف روم",
            `👤 المنفذ: <@${executor.id}>\n` +
            `📁 الروم: **${channel.name}**\n` +
            `🔢 عدد العمليات: **${count}**`,
            COLORS.RED
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            await punishUser(
                channel.guild,
                executor.id,
                "حذف عدة رومات خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// CHANNEL CREATE
// ======================================================

client.on(
    "channelCreate",
    async channel => {

        if (!channel.guild) {
            return;
        }

        if (
            !SECURITY.enabled ||
            !SECURITY.antiChannelCreate
        ) {
            return;
        }

        const executor =
            await getExecutor(
                channel.guild,
                AuditLogEvent.ChannelCreate,
                channel.id
            );

        if (!executor) {
            return;
        }

        if (
            isWhitelisted(
                channel.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                channel.guild.id,
                executor.id,
                "channelCreate"
            );

        await sendSecurityLog(
            channel.guild,
            "⚠️ إنشاء روم",
            `👤 المنفذ: <@${executor.id}>\n` +
            `📁 الروم: **${channel.name}**\n` +
            `🔢 العمليات: **${count}**`,
            COLORS.BLUE
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            try {

                await channel.delete(
                    "W BOT Security • Mass Channel Create"
                );

            } catch {}

            await punishUser(
                channel.guild,
                executor.id,
                "إنشاء عدة رومات خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// ROLE DELETE
// ======================================================

client.on(
    "roleDelete",
    async role => {

        if (
            !SECURITY.enabled ||
            !SECURITY.antiRoleDelete
        ) {
            return;
        }

        const executor =
            await getExecutor(
                role.guild,
                AuditLogEvent.RoleDelete,
                role.id
            );

        if (!executor) {
            return;
        }

        if (
            isWhitelisted(
                role.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                role.guild.id,
                executor.id,
                "roleDelete"
            );

        await sendSecurityLog(
            role.guild,
            "🚨 حذف رتبة",
            `👤 المنفذ: <@${executor.id}>\n` +
            `🎭 الرتبة: **${role.name}**\n` +
            `🔢 العمليات: **${count}**`,
            COLORS.RED
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            await punishUser(
                role.guild,
                executor.id,
                "حذف عدة رتب خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// ROLE CREATE
// ======================================================

client.on(
    "roleCreate",
    async role => {

        if (
            !SECURITY.enabled ||
            !SECURITY.antiRoleCreate
        ) {
            return;
        }

        const executor =
            await getExecutor(
                role.guild,
                AuditLogEvent.RoleCreate,
                role.id
            );

        if (!executor) {
            return;
        }

        if (
            isWhitelisted(
                role.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                role.guild.id,
                executor.id,
                "roleCreate"
            );

        await sendSecurityLog(
            role.guild,
            "⚠️ إنشاء رتبة",
            `👤 المنفذ: <@${executor.id}>\n` +
            `🎭 الرتبة: **${role.name}**\n` +
            `🔢 العمليات: **${count}**`,
            COLORS.BLUE
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            try {

                await role.delete(
                    "W BOT Security • Mass Role Create"
                );

            } catch {}

            await punishUser(
                role.guild,
                executor.id,
                "إنشاء عدة رتب خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// WEBHOOK UPDATE
// ======================================================

client.on(
    "webhooksUpdate",
    async channel => {

        if (
            !SECURITY.enabled ||
            !SECURITY.antiWebhook
        ) {
            return;
        }

        const executor =
            await getExecutor(
                channel.guild,
                AuditLogEvent.WebhookCreate
            );

        if (!executor) {
            return;
        }

        if (
            isWhitelisted(
                channel.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                channel.guild.id,
                executor.id,
                "webhook"
            );

        await sendSecurityLog(
            channel.guild,
            "⚠️ تعديل Webhook",
            `👤 المنفذ: <@${executor.id}>\n` +
            `📁 الروم: <#${channel.id}>\n` +
            `🔢 العمليات: **${count}**`,
            COLORS.RED
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            await punishUser(
                channel.guild,
                executor.id,
                "إنشاء أو تعديل Webhook بشكل متكرر"
            );
        }
    }
);


// ======================================================
// MEMBER BAN
// ======================================================

client.on(
    "guildBanAdd",
    async ban => {

        if (
            !SECURITY.enabled ||
            !SECURITY.antiMassBan
        ) {
            return;
        }

        const executor =
            await getExecutor(
                ban.guild,
                AuditLogEvent.MemberBanAdd,
                ban.user.id
            );

        if (!executor) {
            return;
        }

        if (
            executor.id === client.user.id
        ) {
            return;
        }

        if (
            isWhitelisted(
                ban.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                ban.guild.id,
                executor.id,
                "ban"
            );

        await sendSecurityLog(
            ban.guild,
            "🚨 حظر عضو",
            `👤 المنفذ: <@${executor.id}>\n` +
            `🎯 العضو: <@${ban.user.id}>\n` +
            `🔢 عدد عمليات الحظر: **${count}**`,
            COLORS.RED
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            await punishUser(
                ban.guild,
                executor.id,
                "حظر عدة أعضاء خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// MEMBER REMOVE / KICK
// ======================================================

client.on(
    "guildMemberRemove",
    async member => {

        if (
            !SECURITY.enabled ||
            !SECURITY.antiMassKick
        ) {
            return;
        }

        const executor =
            await getExecutor(
                member.guild,
                AuditLogEvent.MemberKick,
                member.id
            );

        if (!executor) {
            return;
        }

        if (
            executor.id === client.user.id
        ) {
            return;
        }

        if (
            isWhitelisted(
                member.guild,
                executor.id
            )
        ) {
            return;
        }

        const count =
            registerAction(
                member.guild.id,
                executor.id,
                "kick"
            );

        await sendSecurityLog(
            member.guild,
            "⚠️ طرد عضو",
            `👤 المنفذ: <@${executor.id}>\n` +
            `🎯 العضو: <@${member.id}>\n` +
            `🔢 عدد عمليات الطرد: **${count}**`,
            COLORS.RED
        );

        if (
            count >=
            SECURITY.actionLimit
        ) {

            await punishUser(
                member.guild,
                executor.id,
                "طرد عدة أعضاء خلال فترة قصيرة"
            );
        }
    }
);


// ======================================================
// MESSAGE SECURITY
// ======================================================

const spamTracker = new Map();


client.on(
    "messageCreate",
    async message => {

        if (
            !message.guild ||
            message.author.bot
        ) {
            return;
        }

        const guildData =
            getGuildData(
                message.guild.id
            );

        if (
            !SECURITY.enabled ||
            !guildData.enabled
        ) {
            return;
        }


        // ------------------------------------------------
        // MASS MENTION
        // ------------------------------------------------

        if (
            SECURITY.antiMassMention &&
            (
                message.mentions.users.size >= 5 ||
                message.mentions.roles.size >= 3 ||
                message.mentions.everyone
            )
        ) {

            try {
                await message.delete();
            } catch {}

            try {

                await message.member.timeout(
                    SECURITY.spamTimeout,
                    "W BOT Security • Mass Mention"
                );

            } catch {}

            await sendSecurityLog(
                message.guild,
                "🚨 منشن جماعي",
                `👤 العضو: <@${message.author.id}>\n` +
                `📁 الروم: <#${message.channel.id}>\n` +
                `🔨 الإجراء: حذف الرسالة + تايم أوت`,
                COLORS.RED
            );

            return;
        }


        // ------------------------------------------------
        // INVITE LINKS
        // ------------------------------------------------

        if (
            SECURITY.antiInvites &&
            /discord\.gg\/|discord\.com\/invite\//i
                .test(message.content)
        ) {

            // السماح للإدارة
            if (
                !message.member.permissions.has(
                    PermissionFlagsBits.ManageGuild
                )
            ) {

                try {
                    await message.delete();
                } catch {}

                await sendSecurityLog(
                    message.guild,
                    "🔗 تم حذف رابط دعوة",
                    `👤 العضو: <@${message.author.id}>\n` +
                    `📁 الروم: <#${message.channel.id}>\n` +
                    `🔨 الإجراء: حذف الرسالة`,
                    COLORS.RED
                );

                return;
            }
        }


        // ------------------------------------------------
        // SPAM
        // ------------------------------------------------

        if (SECURITY.antiSpam) {

            const key =
                `${message.guild.id}:${message.author.id}`;

            const now = Date.now();

            if (!spamTracker.has(key)) {
                spamTracker.set(key, []);
            }

            const messages =
                spamTracker.get(key);

            const recent =
                messages.filter(
                    time =>
                        now - time <
                        5000
                );

            recent.push(now);

            spamTracker.set(
                key,
                recent
            );

            if (
                recent.length >=
                SECURITY.spamMessageLimit
            ) {

                spamTracker.delete(key);

                try {
                    await message.member.timeout(
                        SECURITY.spamTimeout,
                        "W BOT Security • Spam"
                    );
                } catch {}

                await sendSecurityLog(
                    message.guild,
                    "🚨 تم اكتشاف Spam",
                    `👤 العضو: <@${message.author.id}>\n` +
                    `📁 الروم: <#${message.channel.id}>\n` +
                    `🔨 الإجراء: تايم أوت لمدة 10 دقائق`,
                    COLORS.RED
                );
            }
        }
    }
);


// ======================================================
// INTERACTIONS
// ======================================================

client.on(
    "interactionCreate",
    async interaction => {
                if (
            interaction.isChatInputCommand() &&
            interaction.user.id !== OWNER_ID &&
            !PUBLIC_COMMANDS.includes(interaction.commandName)
        ) {
            const isNewAdminCommand =
                ADMIN_COMMANDS.has(interaction.commandName);

            if (isNewAdminCommand) {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                    await interaction.reply({
                        content: "❌ هذا الأمر مخصص للإداريين فقط.",
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
            } else {
                await interaction.reply({
                    content: "❌ هذا الأمر خاص بمالك البوت.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }
        }

        // ==================================================
        // MAINTENANCE
        // ==================================================

        if (
            interaction.isChatInputCommand() &&
            interaction.commandName === "maintenance"
        ) {

            if (
                interaction.user.id !== OWNER_ID
            ) {
                await interaction.reply({
                    content:
                        "❌ هذا الأمر لمالك البوت فقط.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            MAINTENANCE =
                interaction.options.getBoolean("status");

            await interaction.reply({
                content:
                    MAINTENANCE
                        ? "🛠️ تم تفعيل الصيانة."
                        : "✅ تم إيقاف الصيانة.",
                flags: MessageFlags.Ephemeral
            });

            return;
        }


        if (MAINTENANCE) {

            await interaction.reply({
                content:
                    "عذرًا، توجد صيانة حاليًا. الرجاء المحاولة لاحقًا.",
                flags: MessageFlags.Ephemeral
            });

            return;
        }


        // ==================================================
        // GAMES
        // ==================================================

        // التذاكر أولًا لمنع أي تعارض مع أزرار أو مودالات الألعاب
        const ticketConfig = interaction.guild
            ? general.getGuildConfig(interaction.guild.id)
            : null;

        if (ticketConfig?.ticketsEnabled === false &&
            interaction.isChatInputCommand() &&
            interaction.commandName === "ticket") {
            await interaction.reply({
                content: "❌ نظام التذاكر متوقف حاليًا من إعدادات البوت.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (ticketConfig?.ticketsEnabled !== false) {
            const handledByTicket =
                await tickets.handleInteraction(
                    interaction
                );

            if (handledByTicket) {
                return;
            }
        }

        const handledByGame =
            await games.handleInteraction(
                interaction
            );

        if (handledByGame) {
            return;
        }

        const handledByGeneral =
            await general.handleInteraction(interaction);

        if (handledByGeneral) {
            return;
        }

        // ==================================================
        // PING
        // ==================================================

        if (
            interaction.commandName === "ping"
        ) {

            const embed =
                createEmbed(
                    "🏓 W BOT | Pong",
                    `سرعة استجابة البوت:\n\n` +
                    `\`${client.ws.ping}ms\``,
                    COLORS.BLUE
                );

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }


        // ==================================================
        // HELP
        // ==================================================

        if (
            interaction.commandName === "help"
        ) {

            const embed =
                new EmbedBuilder()

                    .setTitle(
                        "🤖 W BOT | Help"
                    )

                    .setDescription(
                        "نظام إدارة وحماية السيرفر"
                    )

                    .setColor(
                        COLORS.BLUE
                    )

                    .addFields(

                        {
                            name: "⚙️ عامة",
                            value:
                                "🏓 `/ping` — سرعة البوت\n" +
                                "📚 `/help` — قائمة الأوامر\n" +
                                "👤 `/userinfo` أو `/user` — معلومات العضو\n" +
                                "🏰 `/serverinfo` أو `/server` — معلومات السيرفر\n" +
                                "🖼️ `/avatar` — الصورة الشخصية بجودة عالية"
                        },

                        {
                            name: "🛠️ الإدارة الجديدة",
                            value:
                                "📊 `/poll` — استطلاع رأي\n" +
                                "🖌️ `/embed` — رسالة Embed\n" +
                                "🎭 `/role add|remove` — إدارة الرتب\n" +
                                "📢 `/say` — إرسال رسالة باسم البوت\n" +
                                "⚙️ `/setup` أو `/config` — إعداد الأنظمة\n" +
                                "🔰 `/prefix` — تغيير Prefix"
                        },

                        {
                            name: "🛡️ الإدارة",
                            value:
                                "🔨 `/ban` — حظر عضو\n" +
                                "🔓 `/unban` — فك الحظر\n" +
                                "👢 `/kick` — طرد عضو\n" +
                                "🔇 `/timeout` — كتم عضو\n" +
                                "🔊 `/untimeout` — إلغاء الكتم\n" +
                                "⚠️ `/warn` — تحذير عضو\n" +
                                "🧹 `/unwarn` — إزالة تحذير\n" +
                                "🗑️ `/clear` — حذف رسائل\n\n" +
                                "⚠️ نظام التحذيرات: 2 = كتم 6 ساعات | 4 = باند 12 ساعة | 5 = باند فوري"
                        },

                        {
                            name: "🔐 الحماية",
                            value:
                                "🛡️ `/protection` — حالة الحماية\n" +
                                "🔒 `/lockdown` — إغلاق أمني\n" +
                                "🔓 `/unlockdown` — إلغاء الإغلاق\n" +
                                "📋 `/setsecuritylog` — تحديد روم السجلات"
                        }

                    )

                    .setFooter({
                        text:
                            `${interaction.guild.name} • W BOT`
                    })

                    .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }


        // ==================================================
        // BAN
        // ==================================================

        if (
            interaction.commandName === "ban"
        ) {

            const user =
                interaction.options.getUser(
                    "user"
                );

            const duration =
                interaction.options.getString(
                    "duration"
                );

            const reason =
                interaction.options.getString(
                    "reason"
                );

            const durationMs =
                duration.toLowerCase() ===
                "permanent"
                    ? null
                    : parseDuration(duration);

            if (
                durationMs === false
            ) {

                await interaction.reply({
                    content:
                        "❌ **المدة غير صحيحة**\n\n" +
                        "`10m` — 10 دقائق\n" +
                        "`1h` — ساعة\n" +
                        "`1d` — يوم\n" +
                        "`7d` — أسبوع\n" +
                        "`permanent` — دائم",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (
                user.id === client.user.id
            ) {

                await interaction.reply({
                    content:
                        "❌ ما أقدر أحظر نفسي 😂",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (
                interaction.guild.ownerId ===
                user.id
            ) {

                await interaction.reply({
                    content:
                        "❌ ما تقدر تحظر مالك السيرفر.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            let member;

            try {

                member =
                    await interaction.guild
                        .members
                        .fetch(user.id);

            } catch {

                member = null;
            }

            if (
                cannotModerate(
                    interaction,
                    member
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ ما تقدر تتعامل مع هذا العضو بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            try {

                await interaction.guild.members.ban(
                    user.id,
                    {
                        reason
                    }
                );

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "🔨 تم حظر عضو"
                        )

                        .setDescription(
                            "تم تنفيذ الحظر بنجاح."
                        )

                        .setColor(
                            COLORS.RED
                        )

                        .addFields(

                            {
                                name: "👤 العضو",
                                value:
                                    `<@${user.id}>`,
                                inline: false
                            },

                            {
                                name: "⏱️ مدة الحظر",
                                value:
                                    `**${
                                        durationMs === null
                                            ? "دائم"
                                            : duration
                                    }**`,
                                inline: true
                            },

                            {
                                name: "📝 السبب",
                                value:
                                    `**${reason}**`,
                                inline: true
                            },

                            {
                                name: "👮 بواسطة",
                                value:
                                    `<@${interaction.user.id}>`,
                                inline: false
                            }

                        )

                        .setFooter({
                            text:
                                "W BOT • نظام الإدارة"
                        })

                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                if (
                    durationMs !== null
                ) {

                    setTimeout(
                        async () => {

                            try {

                                await interaction.guild
                                    .bans
                                    .remove(
                                        user.id
                                    );

                                await sendSecurityLog(
                                    interaction.guild,
                                    "🔓 انتهى الحظر",
                                    `👤 العضو: <@${user.id}>\n` +
                                    `⏱️ انتهت مدة الحظر تلقائيًا.`,
                                    COLORS.BLUE
                                );

                            } catch {}
                        },
                        durationMs
                    );
                }

            } catch (error) {

                console.error(
                    "Ban Error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ ما قدرت أحظر هذا العضو.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }


        // ==================================================
        // UNBAN
        // ==================================================

        if (
            interaction.commandName === "unban"
        ) {

            const userId =
                interaction.options.getString(
                    "user"
                );

            if (
                !/^\d{17,20}$/.test(
                    userId
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ Discord ID غير صحيح.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            try {

                await interaction.guild.bans
                    .fetch(userId);

                await interaction.guild.bans
                    .remove(userId);

                clearTemporaryBanTimer(
                    interaction.guild.id,
                    userId
                );

                const tempBanKey =
                    `${interaction.guild.id}:${userId}`;

                if (temporaryBansData[tempBanKey]) {
                    delete temporaryBansData[tempBanKey];
                    saveTemporaryBansData();
                }

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "🔓 تم فك الحظر"
                        )

                        .setColor(
                            COLORS.BLUE
                        )

                        .addFields(

                            {
                                name: "👤 العضو",
                                value:
                                    `<@${userId}>\n\`${userId}\``,
                                inline: false
                            },

                            {
                                name: "👮 بواسطة",
                                value:
                                    `<@${interaction.user.id}>`,
                                inline: false
                            }

                        )

                        .setFooter({
                            text:
                                "W BOT • نظام الإدارة"
                        })

                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

            } catch {

                await interaction.reply({
                    content:
                        "❌ هذا العضو غير مبند أو أن الـ ID غير صحيح.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }


        // ==================================================
        // KICK
        // ==================================================

        if (
            interaction.commandName === "kick"
        ) {

            const user =
                interaction.options.getUser(
                    "user"
                );

            const reason =
                interaction.options.getString(
                    "reason"
                );

            if (
                user.id === client.user.id
            ) {

                await interaction.reply({
                    content:
                        "❌ ما أقدر أطرد نفسي 😂",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            let member;

            try {

                member =
                    await interaction.guild
                        .members
                        .fetch(user.id);

            } catch {

                member = null;
            }

            if (!member) {

                await interaction.reply({
                    content:
                        "❌ العضو غير موجود في السيرفر.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (
                cannotModerate(
                    interaction,
                    member
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ ما تقدر تطرد هذا العضو بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            try {

                await member.kick(
                    reason
                );

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "👢 تم طرد عضو"
                        )

                        .setColor(
                            COLORS.WHITE
                        )

                        .addFields(

                            {
                                name: "👤 العضو",
                                value:
                                    `<@${user.id}>`,
                                inline: false
                            },

                            {
                                name: "📝 السبب",
                                value:
                                    `**${reason}**`,
                                inline: true
                            },

                            {
                                name: "👮 بواسطة",
                                value:
                                    `<@${interaction.user.id}>`,
                                inline: true
                            }

                        )

                        .setFooter({
                            text:
                                "W BOT • نظام الإدارة"
                        })

                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error(
                    "Kick Error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ ما قدرت أطرد هذا العضو.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }


        // ==================================================
        // TIMEOUT
        // ==================================================

        if (
            interaction.commandName === "timeout"
        ) {

            const user =
                interaction.options.getUser(
                    "user"
                );

            const duration =
                interaction.options.getString(
                    "duration"
                );

            const reason =
                interaction.options.getString(
                    "reason"
                );

            const durationMs =
                parseDuration(
                    duration
                );

            if (
                durationMs === false
            ) {

                await interaction.reply({
                    content:
                        "❌ المدة غير صحيحة.\n\n" +
                        "استخدم:\n" +
                        "`10m`\n" +
                        "`1h`\n" +
                        "`1d`\n" +
                        "`7d`\n" +
                        "`28d`",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            // Discord timeout maximum
            // 28 days

            const maxTimeout =
                28 * 24 * 60 * 60 * 1000;

            if (
                durationMs >
                maxTimeout
            ) {

                await interaction.reply({
                    content:
                        "❌ أقصى مدة للتايم أوت هي **28d**.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            let member;

            try {

                member =
                    await interaction.guild
                        .members
                        .fetch(user.id);

            } catch {

                member = null;
            }

            if (!member) {

                await interaction.reply({
                    content:
                        "❌ العضو غير موجود في السيرفر.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            if (
                cannotModerate(
                    interaction,
                    member
                )
            ) {

                await interaction.reply({
                    content:
                        "❌ ما تقدر تعطي هذا العضو تايم أوت بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });

                return;
            }

            try {

                await member.timeout(
                    durationMs,
                    reason
                );

                const embed =
                    new EmbedBuilder()

                        .setTitle(
                            "🔇 تم إعطاء Timeout"
                        )

                        .setColor(
                            COLORS.BLUE
                        )

                        .addFields(

                            {
                                name: "👤 العضو",
                                value:
                                    `<@${user.id}>`,
                                inline: false
                            },

                            {
                                name: "⏱️ المدة",
                                value:
                                    `**${duration}**`,
                                inline: true
                            },

                            {
                                name: "📝 السبب",
                                value:
                                    `**${reason}**`,
                                inline: true
                            },

                            {
                                name: "👮 بواسطة",
                                value:
                                    `<@${interaction.user.id}>`,
                                inline: false
                            }

                        )

                        .setFooter({
                            text:
                                "W BOT • نظام الإدارة"
                        })

                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

            } catch (error) {

                console.error(
                    "Timeout Error:",
                    error
                );

                await interaction.reply({
                    content:
                        "❌ ما قدرت أعطي العضو تايم أوت.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }


        // ==================================================
        // UNTIMEOUT
        // ==================================================

        if (
            interaction.commandName === "untimeout"
        ) {

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason") ||
                "إلغاء التايم أوت";

            let member;

            try {
                member = await interaction.guild.members.fetch(user.id);
            } catch {
                member = null;
            }

            if (!member) {
                await interaction.reply({
                    content: "❌ العضو غير موجود في السيرفر.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (cannotModerate(interaction, member)) {
                await interaction.reply({
                    content: "❌ ما تقدر تتعامل مع هذا العضو بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            try {
                await member.timeout(
                    null,
                    reason
                );

                const embed =
                    new EmbedBuilder()
                        .setTitle("🔊 تم إلغاء الكتم")
                        .setColor(COLORS.BLUE)
                        .addFields(
                            {
                                name: "👤 العضو",
                                value: `<@${user.id}>`,
                                inline: false
                            },
                            {
                                name: "📝 السبب",
                                value: `**${reason}**`,
                                inline: true
                            },
                            {
                                name: "👮 بواسطة",
                                value: `<@${interaction.user.id}>`,
                                inline: false
                            }
                        )
                        .setFooter({
                            text: "W BOT • نظام الإدارة"
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await sendSecurityLog(
                    interaction.guild,
                    "🔊 إلغاء Timeout",
                    `👤 العضو: <@${user.id}>\n` +
                    `📝 السبب: ${reason}\n` +
                    `👮 بواسطة: <@${interaction.user.id}>`,
                    COLORS.BLUE
                );
            } catch (error) {
                console.error("Untimeout Error:", error);

                await interaction.reply({
                    content: "❌ ما قدرت ألغي الكتم عن هذا العضو.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }

        // ==================================================
        // WARN
        // ==================================================

        if (
            interaction.commandName === "warn"
        ) {

            const user =
                interaction.options.getUser("user");

            const reason =
                interaction.options.getString("reason");

            if (user.id === client.user.id) {
                await interaction.reply({
                    content: "❌ ما تقدر تحذر البوت نفسه 😂",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (interaction.guild.ownerId === user.id) {
                await interaction.reply({
                    content: "❌ ما تقدر تحذر مالك السيرفر.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            let member;

            try {
                member = await interaction.guild.members.fetch(user.id);
            } catch {
                member = null;
            }

            if (!member) {
                await interaction.reply({
                    content: "❌ العضو غير موجود في السيرفر.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            if (cannotModerate(interaction, member)) {
                await interaction.reply({
                    content: "❌ ما تقدر تحذر هذا العضو بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            try {
                const warningCount = addWarning(
                    interaction.guild.id,
                    user.id
                );

                const action = getWarningAction(warningCount);
                let actionText = "⚠️ تم تسجيل التحذير فقط.";

                if (action?.type === "timeout") {
                    try {
                        await member.timeout(
                            action.durationMs,
                            "W BOT • وصل إلى تحذيرين"
                        );

                        actionText =
                            "🔇 وصل العضو إلى **تحذيرين** وتم كتمه لمدة **6 ساعات**.";
                    } catch (error) {
                        console.error("Warning Timeout Error:", error);
                        actionText =
                            "⚠️ وصل العضو إلى تحذيرين لكن تعذر تنفيذ كتم الـ 6 ساعات.";
                    }
                }

                if (action?.type === "temporaryBan") {
                    try {
                        await interaction.guild.members.ban(
                            user.id,
                            {
                                reason:
                                    "W BOT • وصل إلى 4 تحذيرات"
                            }
                        );

                        await scheduleTemporaryWarningBan(
                            interaction.guild,
                            user.id,
                            action.durationMs,
                            "W BOT • وصل إلى 4 تحذيرات"
                        );

                        actionText =
                            "🔨 وصل العضو إلى **4 تحذيرات** وتم حظره لمدة **12 ساعة**.";
                    } catch (error) {
                        console.error("Warning 12h Ban Error:", error);
                        actionText =
                            "⚠️ وصل العضو إلى **4 تحذيرات** لكن تعذر تنفيذ الباند.";
                    }
                }

                if (action?.type === "permanentBan") {
                    try {
                        await interaction.guild.members.ban(
                            user.id,
                            {
                                reason:
                                    "W BOT • وصل إلى 5 تحذيرات"
                            }
                        );

                        actionText =
                            "⛔ وصل العضو إلى **5 تحذيرات** وتم حظره **فورًا**.";
                    } catch (error) {
                        console.error("Warning Permanent Ban Error:", error);
                        actionText =
                            "⚠️ وصل العضو إلى **5 تحذيرات** لكن تعذر تنفيذ الباند.";
                    }
                }

                const embed =
                    new EmbedBuilder()
                        .setTitle("⚠️ تم تحذير عضو")
                        .setDescription("تم تسجيل التحذير بنجاح.")
                        .setColor(COLORS.RED)
                        .addFields(
                            {
                                name: "👤 العضو",
                                value: `<@${user.id}>`,
                                inline: false
                            },
                            {
                                name: "⚠️ عدد التحذيرات",
                                value: `**${warningCount}**`,
                                inline: true
                            },
                            {
                                name: "📝 السبب",
                                value: `**${reason}**`,
                                inline: true
                            },
                            {
                                name: "🔨 الإجراء",
                                value: actionText,
                                inline: false
                            },
                            {
                                name: "👮 بواسطة",
                                value: `<@${interaction.user.id}>`,
                                inline: false
                            }
                        )
                        .setFooter({
                            text: "W BOT • نظام الإدارة"
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                await sendSecurityLog(
                    interaction.guild,
                    "⚠️ تحذير عضو",
                    `👤 العضو: <@${user.id}>\n` +
                    `⚠️ عدد التحذيرات: **${warningCount}**\n` +
                    `📝 السبب: ${reason}\n` +
                    `🔨 الإجراء: ${actionText}\n` +
                    `👮 بواسطة: <@${interaction.user.id}>`,
                    COLORS.RED
                );
            } catch (error) {
                console.error("Warn Error:", error);

                if (!interaction.replied) {
                    await interaction.reply({
                        content: "❌ حدث خطأ أثناء تسجيل التحذير.",
                        flags: MessageFlags.Ephemeral
                    });
                }
            }

            return;
        }

        // ==================================================
        // UNWARN
        // ==================================================

        if (
            interaction.commandName === "unwarn"
        ) {

            const user =
                interaction.options.getUser("user");

            let member;

            try {
                member = await interaction.guild.members.fetch(user.id);
            } catch {
                member = null;
            }

            if (member && cannotModerate(interaction, member)) {
                await interaction.reply({
                    content: "❌ ما تقدر تتعامل مع هذا العضو بسبب ترتيب الرتب.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const currentCount = getWarningCount(
                interaction.guild.id,
                user.id
            );

            if (currentCount <= 0) {
                await interaction.reply({
                    content: "❌ هذا العضو ما عليه أي تحذيرات.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const newCount = removeWarning(
                interaction.guild.id,
                user.id
            );

            const embed =
                new EmbedBuilder()
                    .setTitle("🧹 تم إزالة تحذير")
                    .setColor(COLORS.BLUE)
                    .addFields(
                        {
                            name: "👤 العضو",
                            value: `<@${user.id}>`,
                            inline: false
                        },
                        {
                            name: "⚠️ التحذيرات السابقة",
                            value: `**${currentCount}**`,
                            inline: true
                        },
                        {
                            name: "⚠️ التحذيرات الحالية",
                            value: `**${newCount}**`,
                            inline: true
                        },
                        {
                            name: "👮 بواسطة",
                            value: `<@${interaction.user.id}>`,
                            inline: false
                        }
                    )
                    .setFooter({
                        text: "W BOT • نظام الإدارة"
                    })
                    .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });

            await sendSecurityLog(
                interaction.guild,
                "🧹 إزالة تحذير",
                `👤 العضو: <@${user.id}>\n` +
                `⚠️ التحذيرات الحالية: **${newCount}**\n` +
                `👮 بواسطة: <@${interaction.user.id}>`,
                COLORS.BLUE
            );

            return;
        }

        // ==================================================
        // CLEAR
        // ==================================================

        if (
            interaction.commandName === "clear"
        ) {

            const amount =
                interaction.options.getInteger("amount");

            if (!interaction.channel || !interaction.channel.isTextBased()) {
                await interaction.reply({
                    content: "❌ هذا الأمر يعمل داخل الرومات النصية فقط.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            try {
                const deleted =
                    await interaction.channel.bulkDelete(
                        amount,
                        true
                    );

                const embed =
                    new EmbedBuilder()
                        .setTitle("🗑️ تم حذف الرسائل")
                        .setColor(COLORS.WHITE)
                        .addFields(
                            {
                                name: "🧹 عدد الرسائل",
                                value: `**${deleted.size}**`,
                                inline: true
                            },
                            {
                                name: "👮 بواسطة",
                                value: `<@${interaction.user.id}>`,
                                inline: true
                            }
                        )
                        .setFooter({
                            text: "W BOT • نظام الإدارة"
                        })
                        .setTimestamp();

                await interaction.reply({
                    embeds: [embed]
                });

                setTimeout(
                    async () => {
                        try {
                            await interaction.deleteReply();
                        } catch {}
                    },
                    5000
                );

                await sendSecurityLog(
                    interaction.guild,
                    "🗑️ حذف رسائل",
                    `📁 الروم: <#${interaction.channel.id}>\n` +
                    `🧹 عدد الرسائل: **${deleted.size}**\n` +
                    `👮 بواسطة: <@${interaction.user.id}>`,
                    COLORS.WHITE
                );
            } catch (error) {
                console.error("Clear Error:", error);

                await interaction.reply({
                    content: "❌ ما قدرت أحذف الرسائل.",
                    flags: MessageFlags.Ephemeral
                });
            }

            return;
        }

        // ==================================================
        // PROTECTION
        // ==================================================

        if (
            interaction.commandName ===
            "protection"
        ) {

            const data =
                getGuildData(
                    interaction.guild.id
                );

            const status =
                data.enabled
                    ? "🟢 مفعلة"
                    : "🔴 متوقفة";

            const embed =
                new EmbedBuilder()

                    .setTitle(
                        "🛡️ W BOT | Protection"
                    )

                    .setDescription(
                        "حالة نظام حماية السيرفر"
                    )

                    .setColor(
                        COLORS.BLUE
                    )

                    .addFields(

                        {
                            name: "🛡️ الحماية العامة",
                            value: status,
                            inline: true
                        },

                        {
                            name: "🤖 Anti Bot",
                            value:
                                SECURITY.antiBot
                                    ? "🟢"
                                    : "🔴",
                            inline: true
                        },

                        {
                            name: "🚨 Anti Nuke",
                            value:
                                SECURITY.antiChannelDelete &&
                                SECURITY.antiRoleDelete &&
                                SECURITY.antiMassBan &&
                                SECURITY.antiMassKick
                                    ? "🟢"
                                    : "🔴",
                            inline: true
                        },

                        {
                            name: "🚫 Anti Spam",
                            value:
                                SECURITY.antiSpam
                                    ? "🟢"
                                    : "🔴",
                            inline: true
                        },

                        {
                            name: "🔗 Anti Invite",
                            value:
                                SECURITY.antiInvites
                                    ? "🟢"
                                    : "🔴",
                            inline: true
                        },

                        {
                            name: "📢 Anti Mention",
                            value:
                                SECURITY.antiMassMention
                                    ? "🟢"
                                    : "🔴",
                            inline: true
                        }

                    )

                    .setFooter({
                        text:
                            "W BOT • Security System"
                    })

                    .setTimestamp();

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }


        // ==================================================
        // SET SECURITY LOG
        // ==================================================

        if (
            interaction.commandName ===
            "setsecuritylog"
        ) {

            const channel =
                interaction.options.getChannel(
                    "channel"
                );

            const data =
                getGuildData(
                    interaction.guild.id
                );

            data.logChannelId =
                channel.id;

            saveProtectionData();

            const embed =
                createEmbed(
                    "📋 تم تحديد روم الحماية",
                    `سيتم إرسال سجلات الحماية هنا:\n\n` +
                    `📁 <#${channel.id}>`,
                    COLORS.BLUE
                );

            await interaction.reply({
                embeds: [embed]
            });

            return;
        }


        // ==================================================
        // LOCKDOWN
        // ==================================================

        if (
            interaction.commandName ===
            "lockdown"
        ) {

            const channels =
                interaction.guild.channels.cache
                    .filter(
                        channel =>
                            channel.isTextBased() &&
                            channel.type ===
                            ChannelType.GuildText
                    );

            let locked = 0;

            for (
                const channel of channels.values()
            ) {

                try {

                    await channel.permissionOverwrites.edit(
                        interaction.guild.roles.everyone,
                        {
                            SendMessages: false
                        },
                        {
                            reason:
                                "W BOT Security • Lockdown"
                        }
                    );

                    locked++;

                } catch {}
            }

            const embed =
                createEmbed(
                    "🔒 تم تفعيل Lockdown",
                    `تم إغلاق **${locked}** روم نصي.\n\n` +
                    `👮 بواسطة: <@${interaction.user.id}>`,
                    COLORS.RED
                );

            await interaction.reply({
                embeds: [embed]
            });

            await sendSecurityLog(
                interaction.guild,
                "🔒 Lockdown",
                `👮 بواسطة: <@${interaction.user.id}>\n` +
                `📁 الرومات المقفلة: **${locked}**`,
                COLORS.RED
            );

            return;
        }


        // ==================================================
        // UNLOCKDOWN
        // ==================================================

        if (
            interaction.commandName ===
            "unlockdown"
        ) {

            const channels =
                interaction.guild.channels.cache
                    .filter(
                        channel =>
                            channel.isTextBased() &&
                            channel.type ===
                            ChannelType.GuildText
                    );

            let unlocked = 0;

            for (
                const channel of channels.values()
            ) {

                try {

                    await channel.permissionOverwrites.edit(
                        interaction.guild.roles.everyone,
                        {
                            SendMessages: null
                        },
                        {
                            reason:
                                "W BOT Security • Unlockdown"
                        }
                    );

                    unlocked++;

                } catch {}
            }

            const embed =
                createEmbed(
                    "🔓 تم إلغاء Lockdown",
                    `تم فتح **${unlocked}** روم نصي.\n\n` +
                    `👮 بواسطة: <@${interaction.user.id}>`,
                    COLORS.BLUE
                );

            await interaction.reply({
                embeds: [embed]
            });

            await sendSecurityLog(
                interaction.guild,
                "🔓 Unlockdown",
                `👮 بواسطة: <@${interaction.user.id}>\n` +
                `📁 الرومات المفتوحة: **${unlocked}**`,
                COLORS.BLUE
            );

            return;
        }

    }
);


// ======================================================
// ERRORS
// ======================================================

client.on(
    "error",
    error => {

        console.error(
            "Discord Client Error:",
            error
        );
    }
);

client.on(
    "warn",
    warning => {

        console.warn(
            "Discord Warning:",
            warning
        );
    }
);


// ======================================================
// LOGIN
// ======================================================

client.login(
    process.env.TOKEN
);


