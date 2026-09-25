const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js");

// ======================================================
// W BOT • GENERAL COMMANDS / CONFIG
// ======================================================

const CONFIG_FILE = path.join(__dirname, "bot_config.json");
const ADMIN_COMMANDS = [
    "poll",
    "embed",
    "role",
    "say",
    "setup",
    "config",
    "prefix",
    "ticket",
    "permban"
];

const DEFAULT_CONFIG = {
    prefix: "!",
    logChannelId: null,
    welcomeEnabled: false,
    welcomeChannelId: null,
    ticketsEnabled: true
};

function ensureConfigFile() {
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 4));
    }
}

function readAllConfig() {
    ensureConfigFile();
    try {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        return data && typeof data === "object" ? data : {};
    } catch {
        return {};
    }
}

function writeAllConfig(data) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 4));
}

function getGuildConfig(guildId) {
    const all = readAllConfig();
    if (!all[guildId] || typeof all[guildId] !== "object") {
        all[guildId] = { ...DEFAULT_CONFIG };
        writeAllConfig(all);
    } else {
        all[guildId] = { ...DEFAULT_CONFIG, ...all[guildId] };
    }
    return all[guildId];
}

function updateGuildConfig(guildId, patch) {
    const all = readAllConfig();
    all[guildId] = {
        ...DEFAULT_CONFIG,
        ...(all[guildId] || {}),
        ...patch
    };
    writeAllConfig(all);
    return all[guildId];
}

function hasAdmin(interaction) {
    return Boolean(
        interaction.user?.id &&
        (
            interaction.user.id === interaction.guild?.ownerId ||
            interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
        )
    );
}

function adminReply(message) {
    return {
        content: message,
        flags: MessageFlags.Ephemeral
    };
}

function safeText(value, fallback = "—") {
    const text = String(value ?? "").trim();
    return text || fallback;
}

function parseHexColor(input, fallback = 0x5865F2) {
    if (input === undefined || input === null || input === "") {
        return fallback;
    }
    const raw = String(input).trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
        return null;
    }
    return Number.parseInt(raw, 16);
}

function formatDate(timestamp) {
    if (!timestamp) return "—";
    return `<t:${Math.floor(timestamp / 1000)}:F>\n(<t:${Math.floor(timestamp / 1000)}:R>)`;
}

function truncate(text, max = 1024) {
    const value = String(text ?? "");
    if (value.length <= max) return value;
    return value.slice(0, max - 3) + "...";
}

function userMention(user) {
    return user ? `<@${user.id}>` : "—";
}

function roleList(member) {
    if (!member) return "—";
    const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(role => `<@&${role.id}>`);
    if (!roles.length) return "لا توجد رتب إضافية";
    return truncate(roles.slice(0, 25).join(" "), 1024) + (roles.length > 25 ? "\n… والمزيد" : "");
}

// ======================================================
// /userinfo + /user
// ======================================================

function userInfoCommand(name) {
    return new SlashCommandBuilder()
        .setName(name)
        .setDescription("عرض معلومات عضو في السيرفر")
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("العضو، اتركه فارغًا لعرض معلوماتك")
                .setRequired(false)
        );
}

async function handleUserInfo(interaction) {
    const user = interaction.options.getUser("member") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const created = user.createdTimestamp;
    const joined = member?.joinedTimestamp;
    const embed = new EmbedBuilder()
        .setTitle(`👤 معلومات العضو • ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ extension: "png", size: 1024 }))
        .setColor(0x5865F2)
        .addFields(
            { name: "🆔 الآيدي", value: `\`${user.id}\``, inline: true },
            { name: "📅 إنشاء الحساب", value: formatDate(created), inline: true },
            { name: "📥 الانضمام للسيرفر", value: formatDate(joined), inline: true },
            { name: "🏷️ الرتب", value: roleList(member), inline: false },
            { name: "🤖 بوت؟", value: user.bot ? "نعم" : "لا", inline: true }
        )
        .setFooter({ text: `${interaction.guild.name} • W BOT` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// ======================================================
// /serverinfo + /server
// ======================================================

function serverInfoCommand(name) {
    return new SlashCommandBuilder()
        .setName(name)
        .setDescription("عرض معلومات السيرفر");
}

async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const owner = await guild.fetchOwner().catch(() => null);
    const created = guild.createdTimestamp;

    const embed = new EmbedBuilder()
        .setTitle(`🏰 معلومات السيرفر • ${guild.name}`)
        .setThumbnail(guild.iconURL({ extension: "png", size: 1024 }) || null)
        .setColor(0x5865F2)
        .addFields(
            { name: "👥 الأعضاء", value: `**${guild.memberCount}**`, inline: true },
            { name: "💬 الرومات النصية", value: `**${textChannels}**`, inline: true },
            { name: "🔊 الرومات الصوتية", value: `**${voiceChannels}**`, inline: true },
            { name: "👑 مالك السيرفر", value: owner ? `${owner} \`${owner.id}\`` : `\`${guild.ownerId}\``, inline: false },
            { name: "📅 تاريخ الإنشاء", value: formatDate(created), inline: false },
            { name: "🆔 Server ID", value: `\`${guild.id}\``, inline: false }
        )
        .setFooter({ text: "W BOT • Server Information" })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

// ======================================================
// /avatar
// ======================================================

const avatarCommand = new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("عرض الصورة الشخصية بجودة عالية")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("العضو المطلوب، اتركه فارغًا لعرض صورتك")
            .setRequired(false)
    );

async function handleAvatar(interaction) {
    const user = interaction.options.getUser("user") || interaction.user;
    const avatar = user.displayAvatarURL({ extension: "png", size: 4096, forceStatic: false });
    const embed = new EmbedBuilder()
        .setTitle(`🖼️ صورة ${user.tag}`)
        .setDescription(`**الرابط المباشر بجودة عالية:**\n${avatar}`)
        .setImage(avatar)
        .setColor(0x5865F2)
        .setFooter({ text: "W BOT • Avatar" })
        .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("فتح الصورة بجودة عالية")
            .setStyle(ButtonStyle.Link)
            .setURL(avatar)
    );
    await interaction.reply({ embeds: [embed], components: [row] });
}

// ======================================================
// /poll
// ======================================================

const pollCommand = new SlashCommandBuilder()
    .setName("poll")
    .setDescription("إنشاء استطلاع رأي 👍 / 👎")
    .addStringOption(option =>
        option
            .setName("question")
            .setDescription("سؤال الاستطلاع")
            .setRequired(true)
            .setMaxLength(1000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePoll(interaction) {
    const question = interaction.options.getString("question", true);
    const embed = new EmbedBuilder()
        .setTitle("📊 استطلاع رأي")
        .setDescription(`**${question}**\n\n👍 **نعم**\n👎 **لا**`)
        .setColor(0x5865F2)
        .setFooter({ text: `W BOT • بواسطة ${interaction.user.tag}` })
        .setTimestamp();

    const message = await interaction.channel.send({ embeds: [embed] });
    await message.react("👍");
    await message.react("👎");
    await interaction.reply(adminReply("✅ تم نشر الاستطلاع بنجاح."));
}

// ======================================================
// /embed
// ======================================================

const embedCommand = new SlashCommandBuilder()
    .setName("embed")
    .setDescription("نشر رسالة Embed احترافية باسم البوت")
    .addStringOption(option =>
        option.setName("title").setDescription("عنوان الـ Embed").setRequired(true).setMaxLength(256)
    )
    .addStringOption(option =>
        option.setName("description").setDescription("محتوى الـ Embed").setRequired(true).setMaxLength(4000)
    )
    .addStringOption(option =>
        option.setName("color").setDescription("لون Hex مثل #5865F2").setRequired(false).setMaxLength(7)
    )
    .addStringOption(option =>
        option.setName("image").setDescription("رابط الصورة الرئيسية").setRequired(false).setMaxLength(500)
    )
    .addStringOption(option =>
        option.setName("thumbnail").setDescription("رابط الصورة المصغرة").setRequired(false).setMaxLength(500)
    )
    .addChannelOption(option =>
        option
            .setName("channel")
            .setDescription("الروم المستهدف، الافتراضي الروم الحالي")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleEmbed(interaction) {
    const title = interaction.options.getString("title", true);
    const description = interaction.options.getString("description", true);
    const color = parseHexColor(interaction.options.getString("color"));
    const image = interaction.options.getString("image");
    const thumbnail = interaction.options.getString("thumbnail");
    const channel = interaction.options.getChannel("channel") || interaction.channel;

    if (color === null) {
        await interaction.reply(adminReply("❌ اللون غير صحيح. استخدم مثالًا مثل `#5865F2`."));
        return;
    }
    if (!channel?.isTextBased() || !channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply(adminReply("❌ البوت لا يستطيع الإرسال في الروم المحدد."));
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: `W BOT • ${interaction.user.tag}` })
        .setTimestamp();

    if (image) {
        if (!/^https?:\/\//i.test(image)) {
            await interaction.reply(adminReply("❌ رابط الصورة الرئيسية غير صحيح."));
            return;
        }
        embed.setImage(image);
    }
    if (thumbnail) {
        if (!/^https?:\/\//i.test(thumbnail)) {
            await interaction.reply(adminReply("❌ رابط الـ Thumbnail غير صحيح."));
            return;
        }
        embed.setThumbnail(thumbnail);
    }

    await channel.send({ embeds: [embed] });
    await interaction.reply(adminReply(`✅ تم نشر الـ Embed في ${channel}.`));
}

// ======================================================
// /role add/remove
// ======================================================

const roleCommand = new SlashCommandBuilder()
    .setName("role")
    .setDescription("إدارة رتب الأعضاء")
    .addSubcommand(sub =>
        sub
            .setName("add")
            .setDescription("إعطاء عضو رتبة")
            .addUserOption(option => option.setName("user").setDescription("العضو").setRequired(true))
            .addRoleOption(option => option.setName("role").setDescription("الرتبة").setRequired(true))
    )
    .addSubcommand(sub =>
        sub
            .setName("remove")
            .setDescription("سحب رتبة من عضو")
            .addUserOption(option => option.setName("user").setDescription("العضو").setRequired(true))
            .addRoleOption(option => option.setName("role").setDescription("الرتبة").setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleRole(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const me = interaction.guild.members.me;

    if (!member) {
        await interaction.reply(adminReply("❌ العضو غير موجود في السيرفر."));
        return;
    }
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply(adminReply("❌ البوت لا يملك صلاحية Manage Roles."));
        return;
    }
    if (role.id === interaction.guild.id || role.managed) {
        await interaction.reply(adminReply("❌ لا يمكن إدارة هذه الرتبة."));
        return;
    }
    if (me.roles.highest.comparePositionTo(role) <= 0) {
        await interaction.reply(adminReply("❌ رتبة البوت يجب أن تكون أعلى من الرتبة المطلوبة."));
        return;
    }
    if (interaction.member.roles.highest.comparePositionTo(role) <= 0 && interaction.user.id !== interaction.guild.ownerId) {
        await interaction.reply(adminReply("❌ رتبتك يجب أن تكون أعلى من الرتبة التي تحاول إدارتها."));
        return;
    }

    try {
        if (sub === "add") {
            if (member.roles.cache.has(role.id)) {
                await interaction.reply(adminReply("ℹ️ العضو يملك هذه الرتبة بالفعل."));
                return;
            }
            await member.roles.add(role, `W BOT • /role add • ${interaction.user.tag}`);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("✅ تم إعطاء الرتبة")
                        .setDescription(`تم إعطاء ${role} إلى ${member}.`)
                        .setColor(0x57F287)
                        .setFooter({ text: `بواسطة ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });
        } else {
            if (!member.roles.cache.has(role.id)) {
                await interaction.reply(adminReply("ℹ️ العضو لا يملك هذه الرتبة."));
                return;
            }
            await member.roles.remove(role, `W BOT • /role remove • ${interaction.user.tag}`);
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("🗑️ تم سحب الرتبة")
                        .setDescription(`تم سحب ${role} من ${member}.`)
                        .setColor(0xED4245)
                        .setFooter({ text: `بواسطة ${interaction.user.tag}` })
                        .setTimestamp()
                ]
            });
        }
    } catch (error) {
        console.error("Role Command Error:", error);
        await interaction.reply(adminReply("❌ فشل تعديل الرتبة. تأكد من صلاحيات البوت وترتيب الرتب."));
    }
}

// ======================================================
// /say
// ======================================================

const sayCommand = new SlashCommandBuilder()
    .setName("say")
    .setDescription("إرسال رسالة باسم البوت")
    .addChannelOption(option =>
        option
            .setName("channel")
            .setDescription("الروم الذي سترسل فيه الرسالة")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("message")
            .setDescription("نص الرسالة")
            .setRequired(true)
            .setMaxLength(2000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSay(interaction) {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message", true);
    const perms = channel.permissionsFor(interaction.guild.members.me);
    if (!channel.isTextBased() || !perms?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply(adminReply("❌ البوت لا يستطيع الإرسال في هذا الروم."));
        return;
    }
    await channel.send({ content: message, allowedMentions: { parse: [] } });
    await interaction.reply(adminReply(`✅ تم إرسال الرسالة في ${channel}.`));
}





// ======================================================
// /permban
// ======================================================

const permbanCommand = new SlashCommandBuilder()

    .setName("permban")

    .setDescription("حظر عضو بشكل دائم من السيرفر")

    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("العضو الذي تريد حظره")
            .setRequired(true)
    )

    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("سبب الحظر")
            .setRequired(true)
            .setMaxLength(500)
    )

    .setDefaultMemberPermissions(
        PermissionFlagsBits.BanMembers
    );


// ======================================================
// HANDLE PERMBAN
// ======================================================

async function handlePermBan(interaction) {

    const user =
        interaction.options.getUser(
            "user",
            true
        );

    const reason =
        interaction.options.getString(
            "reason",
            true
        );

    // ------------------------------------------
    // Check permission
    // ------------------------------------------

    if (
        !interaction.memberPermissions?.has(
            PermissionFlagsBits.BanMembers
        )
    ) {

        await interaction.reply(
            adminReply(
                "❌ ما عندك صلاحية حظر الأعضاء."
            )
        );

        return;
    }


    // ------------------------------------------
    // Cannot ban server owner
    // ------------------------------------------

    if (
        user.id === interaction.guild.ownerId
    ) {

        await interaction.reply(
            adminReply(
                "❌ ما تقدر تحظر مالك السيرفر."
            )
        );

        return;
    }


    // ------------------------------------------
    // Cannot ban bot itself
    // ------------------------------------------

    if (
        user.id === interaction.client.user.id
    ) {

        await interaction.reply(
            adminReply(
                "❌ ما تقدر تحظر البوت نفسه 😂"
            )
        );

        return;
    }


    // ------------------------------------------
    // Fetch member
    // ------------------------------------------

    const member =
        await interaction.guild.members
            .fetch(user.id)
            .catch(() => null);


    // ------------------------------------------
    // Check hierarchy
    // ------------------------------------------

    if (member) {

        if (
            !member.bannable
        ) {

            await interaction.reply(
                adminReply(
                    "❌ ما أقدر أحظر هذا العضو. تأكد أن رتبة البوت أعلى من رتبته."
                )
            );

            return;
        }

        if (
            interaction.user.id !== interaction.guild.ownerId &&
            interaction.member.roles.highest.comparePositionTo(
                member.roles.highest
            ) <= 0
        ) {

            await interaction.reply(
                adminReply(
                    "❌ ما تقدر تحظر عضو رتبته مساوية أو أعلى من رتبتك."
                )
            );

            return;
        }
    }


    // ------------------------------------------
    // Permanent Ban
    // ------------------------------------------

    try {

        await interaction.guild.members.ban(
            user.id,
            {
                reason:
                    `W BOT • حظر دائم • بواسطة ${interaction.user.tag} • السبب: ${reason}`,

                deleteMessageSeconds: 0
            }
        );


        // --------------------------------------
        // Success Embed
        // --------------------------------------

        const embed =
            new EmbedBuilder()

                .setTitle(
                    "🔨 تم الحظر الدائم"
                )

                .setDescription(
                    `تم حظر ${user} من السيرفر بشكل دائم.`
                )

                .addFields(

                    {
                        name: "👤 العضو",
                        value:
                            `${user}\n\`${user.id}\``,
                        inline: true
                    },

                    {
                        name: "👮 بواسطة",
                        value:
                            `${interaction.user}\n\`${interaction.user.id}\``,
                        inline: true
                    },

                    {
                        name: "📝 السبب",
                        value:
                            `**${reason}**`,
                        inline: false
                    },

                    {
                        name: "⛔ المدة",
                        value:
                            "**دائم**",
                        inline: true
                    }
                )

                .setColor(
                    0xED4245
                )

                .setFooter({
                    text:
                        "W BOT • Permanent Ban"
                })

                .setTimestamp();


        await interaction.reply({
            embeds: [
                embed
            ]
        });

    } catch (error) {

        console.error(
            "Permanent Ban Error:",
            error
        );

        await interaction.reply(
            adminReply(
                "❌ فشل حظر العضو. تأكد من صلاحيات البوت وترتيب الرتب."
            )
        );
    }
}



// ======================================================
// /prefix
// ======================================================

const prefixCommand = new SlashCommandBuilder()
    .setName("prefix")
    .setDescription("تغيير بادئة أوامر البوت النصية")
    .addStringOption(option =>
        option
            .setName("symbol")
            .setDescription("البادئة الجديدة مثل ! أو .")
            .setMinLength(1)
            .setMaxLength(5)
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handlePrefix(interaction) {
    const symbol = interaction.options.getString("symbol", true).trim();
    if (/\s/.test(symbol)) {
        await interaction.reply(adminReply("❌ البادئة يجب ألا تحتوي على مسافات."));
        return;
    }
    const config = updateGuildConfig(interaction.guild.id, { prefix: symbol });
    await interaction.reply({
        embeds: [
            new EmbedBuilder()
                .setTitle("⚙️ تم تغيير Prefix")
                .setDescription(`البادئة الجديدة للسيرفر هي **${config.prefix}**`)
                .setColor(0x5865F2)
                .setFooter({ text: "W BOT • Bot Setup" })
                .setTimestamp()
        ],
        flags: MessageFlags.Ephemeral
    });
}

// ======================================================
// /setup + /config
// ======================================================

function setupCommand(name) {
    return new SlashCommandBuilder()
        .setName(name)
        .setDescription("إعداد أنظمة البوت والسيرفر")
        .addSubcommand(sub =>
            sub.setName("view").setDescription("عرض الإعدادات الحالية")
        )
        .addSubcommand(sub =>
            sub
                .setName("log")
                .setDescription("تحديد روم اللوج")
                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("روم اللوج")
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("welcome")
                .setDescription("تحديد روم الترحيب وتفعيل الترحيب")
                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("روم الترحيب")
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("welcome-toggle")
                .setDescription("تشغيل أو إيقاف الترحيب")
                .addBooleanOption(option =>
                    option
                        .setName("enabled")
                        .setDescription("true للتشغيل / false للإيقاف")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("tickets-toggle")
                .setDescription("تشغيل أو إيقاف نظام التذاكر")
                .addBooleanOption(option =>
                    option
                        .setName("enabled")
                        .setDescription("true للتشغيل / false للإيقاف")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName("reset").setDescription("إعادة إعدادات البوت للوضع الافتراضي")
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

function configEmbed(guild, config) {
    return new EmbedBuilder()
        .setTitle("⚙️ W BOT • إعدادات النظام")
        .setDescription("الإعدادات الحالية لهذا السيرفر")
        .setColor(0x5865F2)
        .addFields(
            { name: "🔰 Prefix", value: `\`${safeText(config.prefix)}\``, inline: true },
            { name: "📋 Log", value: config.logChannelId ? `<#${config.logChannelId}>` : "غير محدد", inline: true },
            { name: "👋 الترحيب", value: config.welcomeEnabled ? `🟢 مفعل • ${config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : "بدون روم"}` : "🔴 متوقف", inline: true },
            { name: "🎫 التذاكر", value: config.ticketsEnabled ? "🟢 مفعلة" : "🔴 متوقفة", inline: true }
        )
        .setFooter({ text: `${guild.name} • W BOT` })
        .setTimestamp();
}

async function handleSetup(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    let config = getGuildConfig(guildId);

    if (sub === "view") {
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
        return;
    }
    if (sub === "log") {
        const channel = interaction.options.getChannel("channel", true);
        config = updateGuildConfig(guildId, { logChannelId: channel.id });
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
        return;
    }
    if (sub === "welcome") {
        const channel = interaction.options.getChannel("channel", true);
        config = updateGuildConfig(guildId, { welcomeChannelId: channel.id, welcomeEnabled: true });
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
        return;
    }
    if (sub === "welcome-toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        config = updateGuildConfig(guildId, { welcomeEnabled: enabled });
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
        return;
    }
    if (sub === "tickets-toggle") {
        const enabled = interaction.options.getBoolean("enabled", true);
        config = updateGuildConfig(guildId, { ticketsEnabled: enabled });
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
        return;
    }
    if (sub === "reset") {
        config = updateGuildConfig(guildId, { ...DEFAULT_CONFIG });
        await interaction.reply({ embeds: [configEmbed(interaction.guild, config)], flags: MessageFlags.Ephemeral });
    }
}

// ======================================================
// Welcome system
// ======================================================

function registerClient(client) {
    if (!client || client.__wbotGeneralRegistered) return;
    client.__wbotGeneralRegistered = true;

    // -------------------------------
    // Welcome messages
    // -------------------------------
    client.on("guildMemberAdd", async member => {
        if (member.user.bot) return;
        const config = getGuildConfig(member.guild.id);
        if (!config.welcomeEnabled || !config.welcomeChannelId) return;
        const channel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (!channel?.isTextBased()) return;
        const perms = channel.permissionsFor(member.guild.members.me);
        if (!perms?.has(PermissionFlagsBits.SendMessages)) return;

        const embed = new EmbedBuilder()
            .setTitle("👋 عضو جديد انضم!")
            .setDescription(`أهلًا وسهلًا ${member} 💙\nنورت **${member.guild.name}**!`)
            .setThumbnail(member.user.displayAvatarURL({ extension: "png", size: 512 }))
            .setColor(0x5865F2)
            .addFields(
                { name: "👤 العضو", value: `${member}`, inline: true },
                { name: "👥 عدد الأعضاء", value: `**${member.guild.memberCount}**`, inline: true }
            )
            .setFooter({ text: "W BOT • Welcome System" })
            .setTimestamp();
        await channel.send({
            embeds: [embed],
            allowedMentions: { users: [member.id] }
        }).catch(() => {});
    });

    // -------------------------------
    // Optional prefix commands
    // -------------------------------
    client.on("messageCreate", async message => {
        if (!message.guild || message.author.bot) return;

        const config = getGuildConfig(message.guild.id);
        const prefix = config.prefix || "!";
        if (!message.content.startsWith(prefix)) return;

        const body = message.content.slice(prefix.length).trim();
        if (!body) return;

        const parts = body.split(/\s+/);
        const command = (parts.shift() || "").toLowerCase();
        const argText = parts.join(" ").trim();
        const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.Administrator);

        if (["ping"].includes(command)) {
            await message.reply(`🏓 **${message.client.ws.ping}ms**`).catch(() => {});
            return;
        }

        if (["user", "userinfo"].includes(command)) {
            const mentioned = message.mentions.users.first();
            const user = mentioned || message.author;
            const member = await message.guild.members.fetch(user.id).catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle(`👤 معلومات العضو • ${user.tag}`)
                .setThumbnail(user.displayAvatarURL({ extension: "png", size: 1024 }))
                .setColor(0x5865F2)
                .addFields(
                    { name: "🆔 الآيدي", value: `\`${user.id}\``, inline: true },
                    { name: "📅 إنشاء الحساب", value: formatDate(user.createdTimestamp), inline: true },
                    { name: "📥 الانضمام", value: formatDate(member?.joinedTimestamp), inline: true },
                    { name: "🏷️ الرتب", value: roleList(member), inline: false }
                )
                .setFooter({ text: `${message.guild.name} • W BOT` })
                .setTimestamp();
            await message.reply({ embeds: [embed] }).catch(() => {});
            return;
        }

        if (["server", "serverinfo"].includes(command)) {
            const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
            const voiceChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
            const owner = await message.guild.fetchOwner().catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle(`🏰 معلومات السيرفر • ${message.guild.name}`)
                .setColor(0x5865F2)
                .addFields(
                    { name: "👥 الأعضاء", value: `**${message.guild.memberCount}**`, inline: true },
                    { name: "💬 النصية", value: `**${textChannels}**`, inline: true },
                    { name: "🔊 الصوتية", value: `**${voiceChannels}**`, inline: true },
                    { name: "👑 المالك", value: owner ? `${owner}` : `\`${message.guild.ownerId}\``, inline: false },
                    { name: "📅 الإنشاء", value: formatDate(message.guild.createdTimestamp), inline: false }
                )
                .setFooter({ text: "W BOT • Server Information" })
                .setTimestamp();
            await message.reply({ embeds: [embed] }).catch(() => {});
            return;
        }

        if (command === "avatar") {
            const user = message.mentions.users.first() || message.author;
            const url = user.displayAvatarURL({ extension: "png", size: 4096, forceStatic: false });
            const embed = new EmbedBuilder()
                .setTitle(`🖼️ صورة ${user.tag}`)
                .setImage(url)
                .setDescription(`[فتح الصورة بجودة عالية](${url})`)
                .setColor(0x5865F2)
                .setTimestamp();
            await message.reply({ embeds: [embed] }).catch(() => {});
            return;
        }

        if (command === "help") {
            const embed = new EmbedBuilder()
                .setTitle("🤖 W BOT • Prefix Help")
                .setDescription(`البادئة الحالية: **${prefix}**`)
                .setColor(0x5865F2)
                .addFields(
                    { name: "🌐 عامة", value: `${prefix}ping\n${prefix}user [@member]\n${prefix}server\n${prefix}avatar [@member]`, inline: false },
                    { name: "🛡️ إدارة", value: `${prefix}poll <question>\n${prefix}say #channel <message>\n${prefix}role add/remove @user @role`, inline: false }
                )
                .setFooter({ text: "W BOT" })
                .setTimestamp();
            await message.reply({ embeds: [embed] }).catch(() => {});
            return;
        }

        if (command === "poll") {
            if (!isAdmin) return;
            if (!argText) {
                await message.reply("❌ اكتب سؤال الاستطلاع.").catch(() => {});
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle("📊 استطلاع رأي")
                .setDescription(`**${argText}**\n\n👍 **نعم**\n👎 **لا**`)
                .setColor(0x5865F2)
                .setFooter({ text: `W BOT • بواسطة ${message.author.tag}` })
                .setTimestamp();
            const pollMessage = await message.channel.send({ embeds: [embed] }).catch(() => null);
            if (pollMessage) {
                await pollMessage.react("👍").catch(() => {});
                await pollMessage.react("👎").catch(() => {});
            }
            return;
        }

        if (command === "say") {
            if (!isAdmin) return;
            const target = message.mentions.channels.first();
            if (!target) {
                await message.reply(`❌ الاستخدام: **${prefix}say #channel الرسالة**`).catch(() => {});
                return;
            }
            const content = message.content.slice(prefix.length).trim().replace(/^say\s+<#[0-9]+>\s*/i, "");
            if (!content || !target.isTextBased()) return;
            await target.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
            return;
        }

        if (command === "role") {
            if (!isAdmin) return;
            const sub = (parts.shift() || "").toLowerCase();
            const member = message.mentions.members.first();
            const role = message.mentions.roles.first();
            const me = message.guild.members.me;
            if (!['add', 'remove'].includes(sub) || !member || !role) {
                await message.reply(`❌ الاستخدام: **${prefix}role add @user @role** أو **${prefix}role remove @user @role**`).catch(() => {});
                return;
            }
            if (role.managed || role.id === message.guild.id || !me || me.roles.highest.comparePositionTo(role) <= 0) {
                await message.reply("❌ لا يمكن للبوت إدارة هذه الرتبة.").catch(() => {});
                return;
            }
            if (sub === "add") await member.roles.add(role).catch(() => {});
            else await member.roles.remove(role).catch(() => {});
            return;
        }
    });
}

// ======================================================
// Dispatcher
// ======================================================

const commands = [
    userInfoCommand("userinfo"),
    userInfoCommand("user"),
    serverInfoCommand("serverinfo"),
    serverInfoCommand("server"),
    avatarCommand,
    pollCommand,
    embedCommand,
    roleCommand,
    sayCommand,
    permbanCommand,
    setupCommand("setup"),
    setupCommand("config"),
    prefixCommand
];

async function handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return false;
    const name = interaction.commandName;

    if (["userinfo", "user"].includes(name)) {
        await handleUserInfo(interaction);
        return true;
    }
    if (["serverinfo", "server"].includes(name)) {
        await handleServerInfo(interaction);
        return true;
    }
    if (name === "avatar") {
        await handleAvatar(interaction);
        return true;
    }
    if (name === "poll") {
        await handlePoll(interaction);
        return true;
    }
    if (name === "embed") {
        await handleEmbed(interaction);
        return true;
    }
    if (name === "role") {
        await handleRole(interaction);
        return true;
    }
    if (name === "say") {
        await handleSay(interaction);
        return true;
    }


if (name === "permban") {
    await handlePermBan(interaction);
    return true;
}


    if (name === "prefix") {
        await handlePrefix(interaction);
        return true;
    }
    if (name === "setup" || name === "config") {
        await handleSetup(interaction);
        return true;
    }

    return false;
}

module.exports = {
    commands,
    ADMIN_COMMANDS,
    getGuildConfig,
    updateGuildConfig,
    registerClient,
    handleInteraction
};
