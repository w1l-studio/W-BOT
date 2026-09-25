const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    MessageFlags
} = require("discord.js");

// ======================================================
// إعدادات التذاكر
// ======================================================

const TICKET_CATEGORY_ID = "1551759030769422417";
const TICKET_PANEL_CHANNEL_ID = "1551759063149322332";
const OWNER_ID = "1487388575329681570";
const ADMIN_ROLE_ID = "1552476033842679969";

const TICKET_TOPIC_PREFIX = "W-BOT-TICKET:";
const CLOSED_TOPIC_PREFIX = "W-BOT-CLOSED:";

const fs = require("fs");
const path = require("path");

const TICKET_DATA_FILE = path.join(
    __dirname,
    "ticket_data.json"
);

const TICKET_DATA_VERSION = 2;
const FIRST_TICKET_NUMBER = -1;

function defaultTicketData() {
    return {
        version: TICKET_DATA_VERSION,
        lastTicketNumber: FIRST_TICKET_NUMBER,
        tickets: {}
    };
}

if (!fs.existsSync(TICKET_DATA_FILE)) {
    fs.writeFileSync(
        TICKET_DATA_FILE,
        JSON.stringify(defaultTicketData(), null, 4)
    );
}

let ticketData;

try {
    ticketData = JSON.parse(
        fs.readFileSync(TICKET_DATA_FILE, "utf8")
    );
} catch {
    ticketData = defaultTicketData();
}

if (!ticketData || typeof ticketData !== "object") {
    ticketData = defaultTicketData();
}

if (!ticketData.tickets || typeof ticketData.tickets !== "object") {
    ticketData.tickets = {};
}

// الإصدار القديم كان يبدأ بأرقام كبيرة مثل 12345.
// نعتمد هنا تسلسلًا جديدًا يبدأ من #0000 مع الحفاظ على سجلات التذاكر القديمة.
if (
    ticketData.version !== TICKET_DATA_VERSION ||
    !Number.isInteger(ticketData.lastTicketNumber) ||
    ticketData.lastTicketNumber > 9999
) {
    ticketData.version = TICKET_DATA_VERSION;
    ticketData.lastTicketNumber = FIRST_TICKET_NUMBER;
}

function saveTicketData() {
    fs.writeFileSync(
        TICKET_DATA_FILE,
        JSON.stringify(ticketData, null, 4)
    );
}

saveTicketData();

// ======================================================
// الألوان
// ======================================================

const COLORS = {
    BLUE: 0x5865F2,
    RED: 0xED4245,
    GREEN: 0x57F287,
    GOLD: 0xFEE75C,
    DARK: 0x111214,
    WHITE: 0xFFFFFF
};

// ======================================================
// /ticket
// ======================================================

const command = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("إرسال لوحة التذاكر")
    .setDefaultMemberPermissions(
        PermissionFlagsBits.Administrator
    );

// ======================================================
// أنواع التذاكر
// ======================================================

const TICKET_TYPES = {
    support: {
        label: "الدعم الفني",
        shortLabel: "SUPPORT",
        emoji: "🛠️",
        description: "للمساعدة في المشاكل التقنية والاستفسارات."
    },
    report: {
        label: "الإبلاغ",
        shortLabel: "REPORT",
        emoji: "🚨",
        description: "للإبلاغ عن مخالفة أو مشكلة مع عضو."
    },
    verification: {
        label: "التوثيق",
        shortLabel: "VERIFICATION",
        emoji: "🎀",
        description: "لتوثيقك ك فتاة للحصول على رول Female."
    },
    suggestions: {
        label: "الاقتراحات",
        shortLabel: "SUGGESTIONS",
        emoji: "💡",
        description: "لتقديم الاقتراحات والأفكار لتطوير السيرفر."
    }
};

// ======================================================
// Helpers
// ======================================================

function formatTicketNumber(number) {
    const value = Number(number);

    if (!Number.isFinite(value)) {
        return "0000";
    }

    return String(Math.max(0, Math.trunc(value))).padStart(4, "0");
}

function ticketTitle(record) {
    return `#${formatTicketNumber(record.ticketNumber)}`;
}

function createEmbed(title, description, color = COLORS.BLUE) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({
            text: "W BOT • Ticket System"
        })
        .setTimestamp();
}

function parseTicketTopic(topic = "") {
    let prefix = null;
    let raw = null;

    if (topic.startsWith(TICKET_TOPIC_PREFIX)) {
        prefix = TICKET_TOPIC_PREFIX;
        raw = topic.slice(TICKET_TOPIC_PREFIX.length);
    } else if (topic.startsWith(CLOSED_TOPIC_PREFIX)) {
        prefix = CLOSED_TOPIC_PREFIX;
        raw = topic.slice(CLOSED_TOPIC_PREFIX.length);
    } else {
        return null;
    }

    const parts = raw.split(":");

    return {
        prefix,
        closed: prefix === CLOSED_TOPIC_PREFIX,
        type: parts[0] || "support",
        ownerId: parts[1] || null,
        claimedBy:
            parts[2] && parts[2] !== "0"
                ? parts[2]
                : null
    };
}

function makeTicketTopic(
    prefix,
    type,
    ownerId,
    claimedBy = null
) {
    return `${prefix}${type}:${ownerId}:${claimedBy || "0"}`;
}

function isTicketStaff(interaction) {
    return Boolean(
        interaction.user.id === OWNER_ID ||
        interaction.member?.roles?.cache?.has(ADMIN_ROLE_ID)
    );
}

function canManageTicket(interaction) {
    return isTicketStaff(interaction);
}

function getTicketRecord(channelId) {
    return ticketData.tickets[channelId] || null;
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) {
        return "غير متاح";
    }

    let seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];

    if (days) parts.push(`${days} يوم`);
    if (hours) parts.push(`${hours} ساعة`);
    if (minutes) parts.push(`${minutes} دقيقة`);
    if (seconds || parts.length === 0) parts.push(`${seconds} ثانية`);

    return parts.join(" و ");
}

function ratingRow(channelId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(number =>
            new ButtonBuilder()
                .setCustomId(`ticket_rate:${channelId}:${number}`)
                .setLabel(`${number}/5`)
                .setEmoji("⭐")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        )
    );
}

function openTicketButtons(claimed = false) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_claim")
                .setLabel(claimed ? "تم قبول التذكرة" : "قبول التذكرة")
                .setEmoji(claimed ? "✅" : "🙋")
                .setStyle(ButtonStyle.Success)
                .setDisabled(claimed),

            new ButtonBuilder()
                .setCustomId("ticket_add_member")
                .setLabel("إضافة عضو")
                .setEmoji("➕")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("إغلاق التذكرة")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("ticket_copy")
                .setLabel("نسخ التذكرة")
                .setEmoji("📋")
                .setStyle(ButtonStyle.Secondary)
        )
    ];
}

function closedTicketButtons() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("ticket_reopen")
                .setLabel("إعادة فتح")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("ticket_copy")
                .setLabel("نسخ التذكرة")
                .setEmoji("📋")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("ticket_delete")
                .setLabel("حذف التذكرة")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function ticketPanel() {
    const embed = new EmbedBuilder()
        .setTitle("╭・🎫 W BOT | نظام التذاكر")
        .setDescription(
            "**مرحبًا بك في نظام التذاكر** ✦\n\n" +
            "للحصول على المساعدة، اختر القسم المناسب من الأزرار بالأسفل.\n" +
            "بعد إنشاء التذكرة، ستبقى مخفية عنك حتى تقوم الإدارة بقبولها.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🛠️ **الدعم الفني - SUPPORT**\n" +
            "للمساعدة في المشاكل التقنية والاستفسارات.\n\n" +
            "🚨 **الإبلاغ - REPORT**\n" +
            "للإبلاغ عن مخالفة أو مشكلة مع عضو.\n\n" +
            "🎀 **التوثيق - VERIFICATION**\n" +
            "لتوثيقك ك فتاة للحصول على رول **Female**.\n\n" +
            "💡 **الاقتراحات - SUGGESTIONS**\n" +
            "لتقديم الاقتراحات والأفكار لتطوير السيرفر.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━\n\n" +
            "🔐 **تنبيه:** لا تفتح أكثر من تذكرة لنفس الطلب، واكتب تفاصيل طلبك بوضوح."
        )
        .setColor(COLORS.BLUE)
        .setFooter({
            text: "W BOT • اختر القسم المناسب"
        })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ticket_open:support")
            .setLabel("الدعم الفني")
            .setEmoji("🛠️")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("ticket_open:report")
            .setLabel("الإبلاغ")
            .setEmoji("🚨")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("ticket_open:verification")
            .setLabel("التوثيق")
            .setEmoji("🎀")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("ticket_open:suggestions")
            .setLabel("الاقتراحات")
            .setEmoji("💡")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row]
    };
}

function findOpenTicket(guild, userId) {
    return guild.channels.cache.find(channel => {
        if (channel.type !== ChannelType.GuildText) {
            return false;
        }

        const info = parseTicketTopic(channel.topic || "");

        return Boolean(
            info &&
            !info.closed &&
            info.ownerId === userId
        );
    });
}

async function getTicketCategory(guild) {
    const category = await guild.channels.fetch(
        TICKET_CATEGORY_ID
    ).catch(() => null);

    if (
        !category ||
        category.type !== ChannelType.GuildCategory
    ) {
        throw new Error("Ticket category not found");
    }

    return category;
}

function buildTicketLog(record) {
    const closeInfo = record.closerId
        ? `<@${record.closerId}> — ID: \`${record.closerId}\``
        : "لم يتم الإغلاق بعد";

    const deleteInfo = record.deletedBy
        ? `<@${record.deletedBy}> — ID: \`${record.deletedBy}\``
        : "لم يتم الحذف بعد";

    const ratingInfo = Number.isInteger(record.rating)
        ? `${record.rating}/5 ⭐`
        : "لم يتم التقييم بعد";

    const reason = record.closeReason || "لم يتم تحديد السبب بعد";

    const duration = Number.isFinite(record.durationMs)
        ? formatDuration(record.durationMs)
        : "لم يتم قبول التذكرة بعد";

    return (
        `**سجل الرسائل الخاص بالتذكرة. #${formatTicketNumber(record.ticketNumber)}**\n\n` +
        `**الشكوى #${formatTicketNumber(record.ticketNumber)}**\n\n` +
        `- **من:** <@${record.ownerId}>\n` +
        `- **تم الإغلاق:** ${closeInfo}\n` +
        `- **تم الحذف:** ${deleteInfo}\n` +
        `- **التقييم:** ${ratingInfo}\n` +
        `- **الحكم/السبب:** ${reason}\n` +
        `- **المدة:** ${duration}`
    );
}

async function sendTicketLogToOwner(client, record) {
    const owner = await client.users.fetch(OWNER_ID).catch(() => null);

    if (!owner) {
        return;
    }

    try {
        await owner.send({
            embeds: [
                createEmbed(
                    `📋 سجل التذكرة ${ticketTitle(record)}`,
                    buildTicketLog(record),
                    COLORS.BLUE
                )
            ]
        });
    } catch (error) {
        console.error("Ticket Owner DM Error:", error);
    }
}

async function sendRatingRequestToUser(client, record) {
    const user = await client.users.fetch(record.ownerId).catch(() => null);

    if (!user) {
        return;
    }

    try {
        await user.send({
            embeds: [
                createEmbed(
                    `🔒 تم إغلاق تذكرتك ${ticketTitle(record)}`,
                    `تم إغلاق تذكرتك بواسطة <@${record.closerId}>.\n\n` +
                    `📝 **سبب الإغلاق:**\n${record.closeReason}\n\n` +
                    `⏱️ **المدة بعد القبول:** ${formatDuration(record.durationMs)}\n\n` +
                    "⭐ قيّم الخدمة من 1 إلى 5 بالأسفل.",
                    COLORS.RED
                )
            ],
            components: [ratingRow(record.channelId)]
        });
    } catch (error) {
        console.error("Ticket Rating DM Error:", error);
    }
}

async function editFirstBotMessage(channel, components) {
    try {
        const messages = await channel.messages.fetch({ limit: 50 });
        const message = messages.find(
            item => item.author?.bot && item.components?.length
        );

        if (message) {
            await message.edit({components});
        }
    } catch (error) {
        console.error("Ticket Button Update Error:", error);
    }
}

// ======================================================
// إنشاء التذكرة
// ======================================================

async function createTicket(interaction, type) {
    const guild = interaction.guild;
    const user = interaction.user;
    const ticketType = TICKET_TYPES[type];

    if (!ticketType) {
        await interaction.reply({
            content: "❌ نوع التذكرة غير صحيح.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const existing = findOpenTicket(guild, user.id);

    if (existing) {
        await interaction.reply({
            content: `❌ عندك تذكرة مفتوحة بالفعل: ${existing}`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    try {
        const category = await getTicketCategory(guild);
        const botMember = guild.members.me;

        if (!botMember) {
            await interaction.editReply({
                content: "❌ تعذر العثور على البوت داخل السيرفر."
            });
            return;
        }

        ticketData.lastTicketNumber += 1;

        const ticketNumber = ticketData.lastTicketNumber;
        const displayNumber = formatTicketNumber(ticketNumber);

        const channel = await guild.channels.create({
            name: `ticket-${displayNumber}`,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: makeTicketTopic(
                TICKET_TOPIC_PREFIX,
                type,
                user.id
            ),
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [
                        PermissionFlagsBits.ViewChannel
                    ]
                },
                // صاحب التذكرة مخفي عنها إلى أن تُقبل.
                {
                    id: user.id,
                    deny: [
                        PermissionFlagsBits.ViewChannel
                    ]
                },
                {
                    id: ADMIN_ROLE_ID,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ManageMessages
                    ]
                },
                {
                    id: OWNER_ID,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.ManageChannels
                    ]
                },
                {
                    id: botMember.id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages,
                        PermissionFlagsBits.ReadMessageHistory,
                        PermissionFlagsBits.AttachFiles,
                        PermissionFlagsBits.EmbedLinks,
                        PermissionFlagsBits.ManageMessages,
                        PermissionFlagsBits.ManageChannels
                    ]
                }
            ]
        });

        ticketData.tickets[channel.id] = {
            ticketNumber,
            guildId: guild.id,
            channelId: channel.id,
            type,
            ownerId: user.id,
            createdAt: Date.now(),
            claimedBy: null,
            claimedAt: null,
            closerId: null,
            closedAt: null,
            closeReason: null,
            durationMs: null,
            rating: null,
            ratedAt: null,
            deletedBy: null,
            deletedAt: null
        };

        saveTicketData();

        const embed = new EmbedBuilder()
            .setTitle(`╭・${ticketType.emoji} ${ticketType.label}`)
            .setDescription(
                `**طلب تذكرة جديد — ${ticketType.shortLabel}**\n\n` +
                `🎫 **رقم التذكرة:** #${displayNumber}\n` +
                `📌 **القسم:** ${ticketType.label}\n` +
                `👤 **صاحب الطلب:** مخفي حتى قبول التذكرة\n\n` +
                "━━━━━━━━━━━━━━━━━━━━\n\n" +
                "⏳ **الحالة:** بانتظار قبول الإدارة\n\n" +
                "🔐 صاحب التذكرة لن يستطيع رؤية هذه القناة حاليًا.\n" +
                "بعد الضغط على **قبول التذكرة** ستظهر القناة له تلقائيًا ويتمكن من بدء المحادثة.\n\n" +
                "📋 **ملاحظة للإدارة:** يرجى مراجعة الطلب ثم قبول التذكرة أو إغلاقها بسبب واضح."
            )
            .setColor(COLORS.BLUE)
            .setFooter({
                text: `W BOT • Ticket #${displayNumber}`
            })
            .setTimestamp();

        // لا يوجد منشن لصاحب التذكرة هنا، حتى لا يصله أي ظهور/إشعار من داخل القناة.
        await channel.send({
            embeds: [embed],
            components: openTicketButtons(false)
        });

        await interaction.editReply({
            content:
                `✅ تم استلام طلبك للتذكرة **#${displayNumber}**.\n` +
                "⏳ التذكرة مخفية عنك الآن، وستظهر لك مباشرة بعد قبولها من الإدارة."
        });
    } catch (error) {
        console.error("Ticket Create Error:", error);

        await interaction.editReply({
            content: "❌ حدث خطأ أثناء إنشاء التذكرة. تأكد من صلاحيات البوت ورتبة الإدارة والتصنيف."
        });
    }
}

// ======================================================
// قبول التذكرة
// ======================================================

async function claimTicket(interaction) {
    const channel = interaction.channel;
    const info = parseTicketTopic(channel?.topic || "");

    if (!info || info.closed) {
        await interaction.reply({
            content: "❌ هذه ليست تذكرة مفتوحة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ قبول التذكرة متاح للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const record = getTicketRecord(channel.id);

    if (!record) {
        await interaction.reply({
            content: "❌ بيانات التذكرة غير موجودة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (info.claimedBy || record.claimedBy) {
        await interaction.reply({
            content: `❌ التذكرة مقبولة بالفعل من <@${info.claimedBy || record.claimedBy}>.`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // نؤكد التفاعل فورًا حتى لا يبقى Discord على "W BOT is thinking..."
    // أثناء تنفيذ تعديلات القناة وإرسال التقييم.
    await interaction.reply({
        content: "🔒 جاري إغلاق التذكرة...",
        flags: MessageFlags.Ephemeral
    });

    try {
        const now = Date.now();

        record.claimedBy = interaction.user.id;
        record.claimedAt = now;

        await channel.permissionOverwrites.edit(info.ownerId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        await channel.setTopic(
            makeTicketTopic(
                TICKET_TOPIC_PREFIX,
                info.type,
                info.ownerId,
                interaction.user.id
            )
        );

        saveTicketData();

        await interaction.editReply({
            embeds: [
                createEmbed(
                    "✅ تم قبول التذكرة",
                    `تم استلام ${ticketTitle(record)} بواسطة <@${interaction.user.id}>.\n\n` +
                    "👤 **تم إظهار التذكرة لصاحبها الآن.**\n" +
                    "يمكنه الدخول والبدء بالمحادثة مباشرة.\n\n" +
                    "⏱️ يبدأ حساب مدة التذكرة من لحظة القبول.",
                    COLORS.GREEN
                )
            ]
        });

        await editFirstBotMessage(channel, openTicketButtons(true));

        await channel.send({
            content: `<@${info.ownerId}>`,
            embeds: [
                createEmbed(
                    "🎉 تم قبول طلبك",
                    `تم قبول ${ticketTitle(record)} من قبل <@${interaction.user.id}>.\n\n` +
                    "✅ يمكنك الآن الكتابة هنا وشرح طلبك بالتفصيل.",
                    COLORS.GREEN
                )
            ],
            allowedMentions: {
                users: [info.ownerId]
            }
        });
    } catch (error) {
        console.error("Ticket Claim Error:", error);

        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({
                content: "❌ تعذر قبول التذكرة. تأكد من صلاحيات البوت لإدارة القناة."
            });
        }
    }
}

// ======================================================
// إضافة عضو
// ======================================================

async function addMemberToTicket(interaction) {
    const info = parseTicketTopic(interaction.channel?.topic || "");

    if (!info || info.closed) {
        await interaction.reply({
            content: "❌ هذه التذكرة مغلقة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ إضافة الأعضاء متاحة للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId("ticket_add_member_modal")
        .setTitle("➕ إضافة عضو للتذكرة");

    const input = new TextInputBuilder()
        .setCustomId("member_id")
        .setLabel("ID العضو")
        .setPlaceholder("123456789012345678")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20);

    modal.addComponents(
        new ActionRowBuilder().addComponents(input)
    );

    await interaction.showModal(modal);
}

async function processAddMember(interaction) {
    const info = parseTicketTopic(interaction.channel?.topic || "");

    if (!info || info.closed) {
        await interaction.reply({
            content: "❌ هذه التذكرة مغلقة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ إضافة الأعضاء متاحة للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const userId = interaction.fields
        .getTextInputValue("member_id")
        .trim();

    if (!/^\d{17,20}$/.test(userId)) {
        await interaction.reply({
            content: "❌ الـ ID غير صحيح.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const member = await interaction.guild.members
        .fetch(userId)
        .catch(() => null);

    if (!member) {
        await interaction.reply({
            content: "❌ العضو غير موجود في السيرفر.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true
    });

    await interaction.reply({
        embeds: [
            createEmbed(
                "➕ تم إضافة عضو",
                `تمت إضافة <@${member.id}> إلى التذكرة بواسطة <@${interaction.user.id}>.`,
                COLORS.BLUE
            )
        ]
    });
}

// ======================================================
// Transcript / نسخ التذكرة
// ======================================================

async function buildTranscript(channel) {
    const messages = [];
    let before;

    for (let page = 0; page < 20; page++) {
        const batch = await channel.messages.fetch({
            limit: 100,
            ...(before ? {before} : {})
        });

        if (!batch.size) {
            break;
        }

        messages.push(...batch.values());

        if (batch.size < 100) {
            break;
        }

        before = batch.last().id;
    }

    messages.sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    const record = getTicketRecord(channel.id);
    const lines = [
        "W BOT - Ticket Transcript",
        `Ticket: #${formatTicketNumber(record?.ticketNumber)}`,
        `Channel: #${channel.name}`,
        `Created: ${new Date(channel.createdTimestamp).toISOString()}`,
        "=".repeat(70),
        ""
    ];

    for (const message of messages) {
        const date = new Date(message.createdTimestamp).toISOString();
        const text = message.content || "[بدون نص]";

        const attachments = message.attachments.size
            ? ` | Attachments: ${[...message.attachments.values()]
                .map(attachment => attachment.url)
                .join(" ")}`
            : "";

        lines.push(
            `[${date}] ${message.author.tag}: ${text}${attachments}`
        );
    }

    let output = lines.join("\n");

    if (Buffer.byteLength(output, "utf8") > 7_000_000) {
        output = output.slice(0, 6_500_000) +
            "\n\n[تم اختصار النسخة بسبب الحجم]";
    }

    return output;
}

async function copyTicket(interaction) {
    const info = parseTicketTopic(interaction.channel?.topic || "");

    if (!info) {
        await interaction.reply({
            content: "❌ هذه ليست تذكرة W BOT.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ نسخ التذكرة متاح للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    try {
        const transcript = await buildTranscript(interaction.channel);
        const record = getTicketRecord(interaction.channel.id);
        const ticketNumber = formatTicketNumber(record?.ticketNumber);

        const attachment = new AttachmentBuilder(
            Buffer.from(transcript, "utf8"),
            {name: `ticket-${ticketNumber}.txt`}
        );

        await interaction.editReply({
            content: `📋 تم تجهيز نسخة التذكرة #${ticketNumber}.`,
            files: [attachment]
        });
    } catch (error) {
        console.error("Ticket Copy Error:", error);

        await interaction.editReply({
            content: "❌ ما قدرت أنشئ نسخة التذكرة."
        });
    }
}

// ======================================================
// إغلاق التذكرة
// ======================================================

async function showCloseModal(interaction) {
    try {
        const channel = interaction.channel;
        const info = parseTicketTopic(channel?.topic || "");

        if (!info) {
            await interaction.reply({
                content: "❌ هذا الزر لا يعمل خارج تذكرة W BOT.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (info.closed) {
            await interaction.reply({
                content: "❌ هذه التذكرة مغلقة بالفعل.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (!canManageTicket(interaction)) {
            await interaction.reply({
                content: "❌ إغلاق التذكرة متاح للإدارة فقط.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId("ticket_close_modal")
            .setTitle("🔒 إغلاق التذكرة");

        const reasonInput = new TextInputBuilder()
            .setCustomId("close_reason")
            .setLabel("سبب إغلاق التذكرة")
            .setPlaceholder("اكتب سبب الإغلاق بوضوح...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMinLength(2)
            .setMaxLength(1000);

        modal.addComponents(
            new ActionRowBuilder().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
    } catch (error) {
        console.error("Show Close Modal Error:", error);

        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: "❌ تعذر فتح نافذة إغلاق التذكرة. تأكد من أن الزر حديث ومن صلاحيات البوت.",
                    flags: MessageFlags.Ephemeral
                });
            } catch (replyError) {
                console.error("Close Modal Error Reply Failed:", replyError);
            }
        }
    }
}

async function processCloseTicket(interaction) {
    const info = parseTicketTopic(interaction.channel?.topic || "");

    if (!info || info.closed) {
        await interaction.reply({
            content: "❌ هذه التذكرة مغلقة بالفعل.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!canManageTicket(interaction)) {
        await interaction.reply({
            content: "❌ إغلاق التذكرة متاح للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const reason = interaction.fields
        .getTextInputValue("close_reason")
        .trim();

    if (!reason) {
        await interaction.reply({
            content: "❌ لازم تكتب سبب الإغلاق.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const channel = interaction.channel;
    const record = getTicketRecord(channel.id);

    if (!record) {
        await interaction.reply({
            content: "❌ بيانات التذكرة غير موجودة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply();

    try {
        const now = Date.now();

        record.closerId = interaction.user.id;
        record.closedAt = now;
        record.closeReason = reason;
        record.durationMs = Number.isFinite(record.claimedAt)
            ? Math.max(0, now - record.claimedAt)
            : null;

        await channel.permissionOverwrites.edit(info.ownerId, {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true,
            AttachFiles: false,
            EmbedLinks: false
        });

        await channel.setTopic(
            makeTicketTopic(
                CLOSED_TOPIC_PREFIX,
                info.type,
                info.ownerId,
                info.claimedBy
            )
        );

        if (!channel.name.startsWith("closed-")) {
            await channel.setName(`closed-${channel.name}`);
        }

        saveTicketData();

        await interaction.editReply({
            embeds: [
                createEmbed(
                    `🔒 تم إغلاق التذكرة ${ticketTitle(record)}`,
                    `تم إغلاق التذكرة بواسطة <@${record.closerId}>.\n\n` +
                    `📝 **سبب الإغلاق:**\n${reason}\n\n` +
                    `⏱️ **المدة من لحظة القبول إلى الإغلاق:**\n${formatDuration(record.durationMs)}\n\n` +
                    "يمكن للإدارة إعادة فتح التذكرة أو نسخ سجلها.",
                    COLORS.RED
                )
            ],
            components: closedTicketButtons()
        });

        // نرسل طلب التقييم في الخلفية حتى لا يؤثر على استجابة تفاعل الإغلاق.
        void sendRatingRequestToUser(
            interaction.client,
            record
        ).catch(error => {
            console.error("Ticket Rating DM Background Error:", error);
        });
    } catch (error) {
        console.error("Ticket Close Error:", error);

        try {
            await interaction.editReply({
                content: "❌ تم بدء إغلاق التذكرة، لكن حدث خطأ أثناء إكمال بعض الخطوات. راجع الكونسول للتفاصيل."
            });
        } catch (replyError) {
            console.error("Ticket Close Reply Error:", replyError);
        }
    }
}

// ======================================================
// إعادة الفتح
// ======================================================

async function reopenTicket(interaction) {
    const info = parseTicketTopic(interaction.channel?.topic || "");

    if (!info || !info.closed) {
        await interaction.reply({
            content: "❌ هذه التذكرة ليست مغلقة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ إعادة فتح التذكرة متاحة للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const record = getTicketRecord(interaction.channel.id);

    if (!record) {
        await interaction.reply({
            content: "❌ بيانات التذكرة غير موجودة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply();

    try {
        await interaction.channel.permissionOverwrites.edit(info.ownerId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        await interaction.channel.setTopic(
            makeTicketTopic(
                TICKET_TOPIC_PREFIX,
                info.type,
                info.ownerId,
                info.claimedBy
            )
        );

        if (interaction.channel.name.startsWith("closed-")) {
            await interaction.channel.setName(
                interaction.channel.name.slice("closed-".length)
            );
        }

        // يبدأ قبول جديد إذا لم يعد هناك مسؤول ممسك بالتذكرة.
        record.closedAt = null;
        record.closerId = null;
        record.closeReason = null;
        record.durationMs = null;
        record.claimedAt = null;
        record.claimedBy = null;
        record.ratedAt = null;
        record.rating = null;

        saveTicketData();

        await interaction.editReply({
            embeds: [
                createEmbed(
                    `🔓 تم إعادة فتح التذكرة ${ticketTitle(record)}`,
                    `تمت إعادة فتح التذكرة بواسطة <@${interaction.user.id}>.\n\n` +
                    "⏳ أصبحت بانتظار قبول الإدارة من جديد.",
                    COLORS.GREEN
                )
            ],
            components: openTicketButtons(false)
        });
    } catch (error) {
        console.error("Ticket Reopen Error:", error);

        if (interaction.deferred) {
            await interaction.editReply({
                content: "❌ تعذر إعادة فتح التذكرة."
            });
        }
    }
}

// ======================================================
// حذف التذكرة
// ======================================================

async function deleteTicket(interaction) {
    const channel = interaction.channel;
    const info = parseTicketTopic(channel?.topic || "");

    if (!info || !info.closed) {
        await interaction.reply({
            content: "❌ يجب إغلاق التذكرة قبل حذفها.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!isTicketStaff(interaction)) {
        await interaction.reply({
            content: "❌ حذف التذكرة متاح للإدارة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const record = getTicketRecord(channel.id);

    if (!record) {
        await interaction.reply({
            content: "❌ بيانات التذكرة غير موجودة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    record.deletedBy = interaction.user.id;
    record.deletedAt = Date.now();

    saveTicketData();

    // إرسال السجل النهائي إلى مالك البوت قبل حذف القناة.
    await sendTicketLogToOwner(
        interaction.client,
        record
    );

    await interaction.reply({
        content: `🗑️ سيتم حذف التذكرة ${ticketTitle(record)} خلال ثانيتين...`
    });

    setTimeout(async () => {
        try {
            await channel.delete("W BOT • حذف تذكرة");
        } catch (error) {
            console.error("Ticket Delete Error:", error);
        }
    }, 2000);
}

// ======================================================
// التقييم
// ======================================================

async function processRating(interaction) {
    const parts = interaction.customId.split(":");
    const channelId = parts[1];
    const rating = Number(parts[2]);

    if (!channelId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        await interaction.reply({
            content: "❌ التقييم غير صحيح.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const record = getTicketRecord(channelId);

    if (!record) {
        await interaction.reply({
            content: "❌ لا يمكن العثور على بيانات هذه التذكرة.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (interaction.user.id !== record.ownerId) {
        await interaction.reply({
            content: "❌ هذا التقييم مخصص لصاحب التذكرة فقط.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (!record.closedAt) {
        await interaction.reply({
            content: "❌ لا يمكن تقييم التذكرة قبل إغلاقها.",
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    if (Number.isInteger(record.rating)) {
        await interaction.reply({
            content: `✅ تم تسجيل تقييمك مسبقًا: **${record.rating}/5 ⭐**`,
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    record.rating = rating;
    record.ratedAt = Date.now();

    saveTicketData();

    await interaction.reply({
        embeds: [
            createEmbed(
                "⭐ تم تسجيل التقييم",
                `شكرًا لك! تم تسجيل تقييمك للتذكرة ${ticketTitle(record)}: **${rating}/5 ⭐**`,
                COLORS.GOLD
            )
        ],
        flags: MessageFlags.Ephemeral
    });

    // عند التقييم، يصل السجل الكامل إلى مالك البوت.
    await sendTicketLogToOwner(
        interaction.client,
        record
    );

    try {
        await interaction.message.edit({
            components: [ratingRow(channelId, true)]
        });
    } catch {}
}

// ======================================================
// Handler
// ======================================================

async function handleInteraction(interaction) {
    // --------------------------------------------------
    // /ticket
    // --------------------------------------------------

    if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "ticket"
    ) {
        const panelChannel = await interaction.guild.channels.fetch(
            TICKET_PANEL_CHANNEL_ID
        ).catch(() => null);

        if (!panelChannel || !panelChannel.isTextBased()) {
            await interaction.reply({
                content: "❌ قناة لوحة التذاكر غير موجودة.",
                flags: MessageFlags.Ephemeral
            });
            return true;
        }

        await panelChannel.send(ticketPanel());

        await interaction.reply({
            content:
                `✅ تم إرسال لوحة التذاكر في <#${TICKET_PANEL_CHANNEL_ID}>.`,
            flags: MessageFlags.Ephemeral
        });

        return true;
    }

    // --------------------------------------------------
    // إنشاء التذكرة بالأزرار
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId.startsWith("ticket_open:")
    ) {
        const type = interaction.customId.split(":")[1];

        try {
            await createTicket(interaction, type);
        } catch (error) {
            console.error("Ticket Create Handler Error:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ حدث خطأ أثناء إنشاء التذكرة.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        return true;
    }

    // --------------------------------------------------
    // قبول
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_claim"
    ) {
        try {
            await claimTicket(interaction);
        } catch (error) {
            console.error("Ticket Claim Handler Error:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ حدث خطأ أثناء قبول التذكرة.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        return true;
    }

    // --------------------------------------------------
    // إضافة عضو
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_add_member"
    ) {
        await addMemberToTicket(interaction);
        return true;
    }

    // --------------------------------------------------
    // إغلاق
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_close"
    ) {
        await showCloseModal(interaction);
        return true;
    }

    // --------------------------------------------------
    // نسخ
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_copy"
    ) {
        await copyTicket(interaction);
        return true;
    }

    // --------------------------------------------------
    // إعادة فتح
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_reopen"
    ) {
        await reopenTicket(interaction);
        return true;
    }

    // --------------------------------------------------
    // حذف
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId === "ticket_delete"
    ) {
        await deleteTicket(interaction);
        return true;
    }

    // --------------------------------------------------
    // إضافة عضو - Modal
    // --------------------------------------------------

    if (
        interaction.isModalSubmit() &&
        interaction.customId === "ticket_add_member_modal"
    ) {
        await processAddMember(interaction);
        return true;
    }

    // --------------------------------------------------
    // إغلاق - Modal
    // --------------------------------------------------

    if (
        interaction.isModalSubmit() &&
        interaction.customId === "ticket_close_modal"
    ) {
        try {
            await processCloseTicket(interaction);
        } catch (error) {
            console.error("Ticket Close Handler Error:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ حدث خطأ أثناء إغلاق التذكرة.",
                    flags: MessageFlags.Ephemeral
                });
            }
        }
        return true;
    }

    // --------------------------------------------------
    // التقييم
    // --------------------------------------------------

    if (
        interaction.isButton() &&
        interaction.customId.startsWith("ticket_rate:")
    ) {
        await processRating(interaction);
        return true;
    }

    return false;
}

module.exports = {
    commands: [command],
    handleInteraction
};
