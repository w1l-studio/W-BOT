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

const TICKET_DATA_FILE = path.join(__dirname, "ticket_data.json");
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
    DARK: 0x2B2D31,
    PURPLE: 0x9B59B6
};

// ======================================================
// الأمر
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
        color: COLORS.BLUE,
        description: "للمساعدة في المشاكل التقنية والاستفسارات."
    },

    report: {
        label: "الإبلاغ",
        shortLabel: "REPORT",
        emoji: "🚨",
        color: COLORS.RED,
        description: "للإبلاغ عن مخالفة أو مشكلة مع عضو."
    },

    verification: {
        label: "التوثيق",
        shortLabel: "VERIFICATION",
        emoji: "🎀",
        color: COLORS.PURPLE,
        description: "لتوثيقك كفتاة للحصول على رول Female."
    },

    suggestions: {
        label: "الاقتراحات",
        shortLabel: "SUGGESTIONS",
        emoji: "💡",
        color: COLORS.GOLD,
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

    return String(
        Math.max(0, Math.trunc(value))
    ).padStart(4, "0");
}

function ticketTitle(record) {
    return `#${formatTicketNumber(record.ticketNumber)}`;
}

function createEmbed(
    title,
    description,
    color = COLORS.BLUE
) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: "W BOT" })
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

    if (days) {
        parts.push(`${days} يوم`);
    }

    if (hours) {
        parts.push(`${hours} ساعة`);
    }

    if (minutes) {
        parts.push(`${minutes} دقيقة`);
    }

    if (seconds || parts.length === 0) {
        parts.push(`${seconds} ثانية`);
    }

    return parts.join(" و ");
}

function ratingRow(channelId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(number =>
            new ButtonBuilder()
                .setCustomId(
                    `ticket_rate:${channelId}:${number}`
                )
                .setLabel(`${number}`)
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
                .setLabel(
                    claimed
                        ? "تم القبول"
                        : "قبول التذكرة"
                )
                .setEmoji(
                    claimed
                        ? "✅"
                        : "🙋"
                )
                .setStyle(ButtonStyle.Success)
                .setDisabled(claimed),

            new ButtonBuilder()
                .setCustomId("ticket_add_member")
                .setLabel("إضافة عضو")
                .setEmoji("➕")
                .setStyle(ButtonStyle.Primary),

            new ButtonBuilder()
                .setCustomId("ticket_close")
                .setLabel("إغلاق")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("ticket_copy")
                .setLabel("نسخ")
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
                .setLabel("نسخ السجل")
                .setEmoji("📋")
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setCustomId("ticket_delete")
                .setLabel("حذف نهائي")
                .setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

function ticketPanel() {
    const embed = new EmbedBuilder()
        .setTitle("🎫 • نظام التذاكر | W BOT")
        .setDescription(
            "مرحباً بك في نظام الدعم.\n" +
            "اختر القسم المناسب من الأزرار بالأسفل لفتح تذكرة.\n\n" +
            "━━━━━━━━━━━━━━━━━━━━"
        )
        .addFields(
            {
                name: "🛠️ الدعم الفني",
                value:
                    "للمساعدة في المشاكل التقنية والاستفسارات.",
                inline: false
            },
            {
                name: "🚨 الإبلاغ",
                value:
                    "للإبلاغ عن مخالفة أو مشكلة مع عضو.",
                inline: false
            },
            {
                name: "🎀 التوثيق",
                value:
                    "لتوثيقك كفتاة والحصول على رول **Female**.",
                inline: false
            },
            {
                name: "💡 الاقتراحات",
                value:
                    "لتقديم أفكارك واقتراحاتك لتطوير السيرفر.",
                inline: false
            }
        )
        .setColor(COLORS.BLUE)
        .setFooter({ text: "W BOT" })
        .setTimestamp();

    const row =
        new ActionRowBuilder().addComponents(

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
        if (
            channel.type !== ChannelType.GuildText ||
            channel.parentId !== TICKET_CATEGORY_ID
        ) {
            return false;
        }

        const info = parseTicketTopic(
            channel.topic || ""
        );

        return (
            info &&
            !info.closed &&
            info.ownerId === userId
        );
    });
}

// ======================================================
// إنشاء التذكرة
// ======================================================

async function createTicket(interaction, type) {
    if (!TICKET_TYPES[type]) {
        return interaction.reply({
            content: "❌ نوع التذكرة غير صحيح.",
            flags: MessageFlags.Ephemeral
        });
    }

    const guild = interaction.guild;

    if (!guild) {
        return interaction.reply({
            content: "❌ لا يمكن إنشاء التذكرة هنا.",
            flags: MessageFlags.Ephemeral
        });
    }

    const existing = findOpenTicket(
        guild,
        interaction.user.id
    );

    if (existing) {
        return interaction.reply({
            content:
                `❌ لديك تذكرة مفتوحة بالفعل: ${existing}`,
            flags: MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    try {
        const ticketNumber =
            ticketData.lastTicketNumber + 1;

        ticketData.lastTicketNumber =
            ticketNumber > 9999
                ? 0
                : ticketNumber;

        const record = {
            channelId: null,
            ticketNumber:
                ticketNumber > 9999
                    ? 0
                    : ticketNumber,

            type,
            ownerId: interaction.user.id,
            ownerTag: interaction.user.tag,

            createdAt: Date.now(),
            claimedAt: null,
            claimedBy: null,

            closedAt: null,
            closerId: null,
            closeReason: null,
            durationMs: null,

            deletedAt: null,
            deletedBy: null,

            rating: null,
            ratedAt: null
        };

        const channel =
            await guild.channels.create({
                name:
                    `ticket-${formatTicketNumber(
                        record.ticketNumber
                    )}`,

                type: ChannelType.GuildText,

                parent: TICKET_CATEGORY_ID,

                topic:
                    makeTicketTopic(
                        TICKET_TOPIC_PREFIX,
                        type,
                        interaction.user.id
                    ),

                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
                    },

                    {
                        id: interaction.user.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
                    },

                    {
                        id: OWNER_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    },

                    {
                        id: ADMIN_ROLE_ID,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.EmbedLinks
                        ]
                    }
                ]
            });

        record.channelId = channel.id;

        ticketData.tickets[channel.id] =
            record;

        saveTicketData();

        const ticketType =
            TICKET_TYPES[type];

        const embed =
            createEmbed(
                `${ticketType.emoji} ${ticketType.label} ${ticketTitle(record)}`,

                `مرحباً بك في تذكرتك.\n\n` +
                `**نوع التذكرة:** ${ticketType.label}\n` +
                `**صاحب التذكرة:** <@${interaction.user.id}>\n\n` +
                `⏳ **الرجاء الانتظار قليلاً وسيتم الرد عليك من قبل الاداريين.**\n\n` +
                `يمكن للإدارة قبول التذكرة والبدء في مساعدتك.`,

                ticketType.color
            );

        await channel.send({
            content:
                `<@${interaction.user.id}> <@&${ADMIN_ROLE_ID}>`,

            embeds: [embed],

            components:
                openTicketButtons(false)
        });

        await interaction.editReply({
            content:
                "🎫 **تم إنشاء تذكرتك بنجاح**\n\n" +
                "⏳ **الرجاء الانتظار قليلاً وسيتم الرد عليك من قبل الاداريين.**"
        });

    } catch (error) {
        console.error(
            "Ticket Create Error:",
            error
        );

        await interaction.editReply({
            content:
                "❌ حدث خطأ أثناء إنشاء التذكرة."
        });
    }
}

// ======================================================
// قبول التذكرة
// ======================================================

async function claimTicket(interaction) {
    const channel =
        interaction.channel;

    const info =
        parseTicketTopic(
            channel?.topic || ""
        );

    if (!info || info.closed) {
        return interaction.reply({
            content:
                "❌ هذه ليست تذكرة مفتوحة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!canManageTicket(interaction)) {
        return interaction.reply({
            content:
                "❌ قبول التذاكر متاح للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(channel.id);

    if (!record) {
        return interaction.reply({
            content:
                "❌ بيانات التذكرة غير موجودة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (record.claimedBy) {
        return interaction.reply({
            content:
                `❌ تم قبول التذكرة مسبقاً بواسطة <@${record.claimedBy}>.`,
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    try {
        record.claimedAt =
            Date.now();

        record.claimedBy =
            interaction.user.id;

        await channel.permissionOverwrites.edit(
            record.ownerId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            }
        );

        await channel.setTopic(
            makeTicketTopic(
                TICKET_TOPIC_PREFIX,
                info.type,
                record.ownerId,
                record.claimedBy
            )
        );

        saveTicketData();

        await interaction.message.edit({
            components:
                openTicketButtons(true)
        });

        await interaction.editReply({
            content:
                `✅ تم قبول التذكرة بواسطة <@${interaction.user.id}>.`
        });

        await channel.send({
            embeds: [
                createEmbed(
                    "✅ تم قبول التذكرة",
                    `تم قبول التذكرة بواسطة <@${interaction.user.id}>.\n\nيمكن لصاحب التذكرة الآن الدخول والتحدث مع الإدارة.`,
                    COLORS.GREEN
                )
            ]
        });

    } catch (error) {
        console.error(
            "Ticket Claim Error:",
            error
        );

        await interaction.editReply({
            content:
                "❌ تعذر قبول التذكرة."
        });
    }
}

// ======================================================
// إضافة عضو
// ======================================================

async function addMemberToTicket(interaction) {
    const info =
        parseTicketTopic(
            interaction.channel?.topic || ""
        );

    if (!info || info.closed) {
        return interaction.reply({
            content:
                "❌ هذه التذكرة مغلقة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ إضافة أعضاء متاحة للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                "ticket_add_member_modal"
            )
            .setTitle(
                "إضافة عضو للتذكرة"
            );

    const input =
        new TextInputBuilder()
            .setCustomId(
                "member_id"
            )
            .setLabel(
                "Discord User ID"
            )
            .setPlaceholder(
                "مثال: 123456789012345678"
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            input
        )
    );

    await interaction.showModal(modal);
}

// ======================================================
// معالجة إضافة العضو
// ======================================================

async function processAddMember(interaction) {
    const info =
        parseTicketTopic(
            interaction.channel?.topic || ""
        );

    if (!info || info.closed) {
        return interaction.reply({
            content:
                "❌ هذه التذكرة مغلقة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ إضافة أعضاء متاحة للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const userId =
        interaction.fields.getTextInputValue(
            "member_id"
        ).trim();

    if (!/^\d{17,20}$/.test(userId)) {
        return interaction.reply({
            content:
                "❌ الـ ID غير صحيح.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    const member =
        await interaction.guild.members
            .fetch(userId)
            .catch(() => null);

    if (!member) {
        return interaction.editReply({
            content:
                "❌ لم يتم العثور على هذا العضو في السيرفر."
        });
    }

    try {
        await interaction.channel.permissionOverwrites.edit(
            userId,
            {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true
            }
        );

        await interaction.editReply({
            content:
                `✅ تم إضافة <@${userId}> إلى التذكرة.`
        });

        await interaction.channel.send({
            embeds: [
                createEmbed(
                    "➕ تم إضافة عضو",
                    `تمت إضافة <@${userId}> إلى التذكرة بواسطة <@${interaction.user.id}>.`,
                    COLORS.BLUE
                )
            ]
        });

    } catch (error) {
        console.error(
            "Ticket Add Member Error:",
            error
        );

        await interaction.editReply({
            content:
                "❌ تعذر إضافة العضو."
        });
    }
}

// ======================================================
// نافذة الإغلاق
// ======================================================

async function showCloseModal(interaction) {
    const info =
        parseTicketTopic(
            interaction.channel?.topic || ""
        );

    if (!info || info.closed) {
        return interaction.reply({
            content:
                "❌ هذه التذكرة مغلقة بالفعل.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ إغلاق التذاكر متاح للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const modal =
        new ModalBuilder()
            .setCustomId(
                "ticket_close_modal"
            )
            .setTitle(
                "إغلاق التذكرة"
            );

    const reason =
        new TextInputBuilder()
            .setCustomId(
                "close_reason"
            )
            .setLabel(
                "سبب الإغلاق"
            )
            .setPlaceholder(
                "اكتب سبب إغلاق التذكرة..."
            )
            .setStyle(
                TextInputStyle.Paragraph
            )
            .setRequired(true)
            .setMaxLength(1000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            reason
        )
    );

    await interaction.showModal(modal);
}

// ======================================================
// سجل التذكرة
// ======================================================

async function buildTicketTranscript(client, record) {
    const channel =
        await client.channels
            .fetch(record.channelId)
            .catch(() => null);

    if (!channel || !channel.isTextBased()) {
        return null;
    }

    const messages = [];

    let lastId;

    while (true) {
        const batch =
            await channel.messages.fetch({
                limit: 100,
                ...(lastId
                    ? { before: lastId }
                    : {})
            });

        if (!batch.size) break;

        messages.push(
            ...batch.values()
        );

        lastId =
            batch.last()?.id;

        if (
            batch.size < 100 ||
            messages.length >= 1000
        ) {
            break;
        }
    }

    messages.reverse();

    const lines = [];

    lines.push(
        `سجل الرسائل الخاص بالتذكرة ${ticketTitle(record)}`
    );

    lines.push(
        `النوع: ${TICKET_TYPES[record.type]?.label || record.type}`
    );

    lines.push(
        `صاحب التذكرة: <@${record.ownerId}>`
    );

    lines.push(
        `تم القبول: ${
            record.claimedBy
                ? `<@${record.claimedBy}>`
                : "لم يتم القبول"
        }`
    );

    lines.push(
        `تم الإغلاق: ${
            record.closerId
                ? `ID: ${record.closerId}`
                : "غير متاح"
        }`
    );

    lines.push(
        `تم الحذف: ${
            record.deletedBy
                ? `ID: ${record.deletedBy}`
                : "لم يتم الحذف"
        }`
    );

    lines.push(
        `التقييم: ${
            Number.isInteger(record.rating)
                ? `${record.rating}/5`
                : "لم يتم التقييم"
        }`
    );

    lines.push(
        `الحكم/السبب: ${
            record.closeReason ||
            "غير محدد"
        }`
    );

    lines.push(
        `المدة: ${
            formatDuration(
                record.durationMs
            )
        }`
    );

    lines.push(
        "",
        "==============================",
        ""
    );

    for (const message of messages) {
        const date =
            new Date(
                message.createdTimestamp
            ).toLocaleString("ar-SA");

        const content =
            message.content ||
            "[بدون نص]";

        lines.push(
            `[${date}] ${message.author.tag}: ${content}`
        );

        if (message.attachments.size) {
            for (
                const attachment
                of message.attachments.values()
            ) {
                lines.push(
                    `مرفق: ${attachment.url}`
                );
            }
        }
    }

    return Buffer.from(
        lines.join("\n"),
        "utf8"
    );
}

async function sendTicketLogToOwner(client, record) {
    const owner =
        await client.users
            .fetch(OWNER_ID)
            .catch(() => null);

    if (!owner) return;

    const transcript =
        await buildTicketTranscript(
            client,
            record
        );

    const embed =
        createEmbed(
            `📋 سجل التذكرة ${ticketTitle(record)}`,

            `**الشكوى:** ${ticketTitle(record)}\n` +
            `**من:** <@${record.ownerId}>\n` +
            `**تم الإغلاق:** ${
                record.closerId
                    ? `ID: ${record.closerId}`
                    : "غير متاح"
            }\n` +
            `**تم الحذف:** ${
                record.deletedBy
                    ? `ID: ${record.deletedBy}`
                    : "لم يتم الحذف"
            }\n` +
            `**التقييم:** ${
                Number.isInteger(record.rating)
                    ? `${record.rating}/5 ⭐`
                    : "لم يتم التقييم"
            }\n` +
            `**الحكم/السبب:** ${
                record.closeReason ||
                "غير محدد"
            }\n` +
            `**المدة:** ${
                formatDuration(
                    record.durationMs
                )
            }`,

            COLORS.BLUE
        );

    try {
        if (transcript) {
            const attachment =
                new AttachmentBuilder(
                    transcript,
                    {
                        name:
                            `ticket-${formatTicketNumber(
                                record.ticketNumber
                            )}.txt`
                    }
                );

            await owner.send({
                embeds: [embed],
                files: [attachment]
            });
        } else {
            await owner.send({
                embeds: [embed]
            });
        }
    } catch (error) {
        console.error(
            "Ticket Owner Log Error:",
            error
        );
    }
}

// ======================================================
// إغلاق التذكرة
// ======================================================

async function processCloseTicket(interaction) {
    const channel =
        interaction.channel;

    const info =
        parseTicketTopic(
            channel?.topic || ""
        );

    if (!info || info.closed) {
        return interaction.reply({
            content:
                "❌ هذه التذكرة مغلقة بالفعل.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ إغلاق التذاكر متاح للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(channel.id);

    if (!record) {
        return interaction.reply({
            content:
                "❌ بيانات التذكرة غير موجودة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const reason =
        interaction.fields
            .getTextInputValue(
                "close_reason"
            )
            .trim();

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    try {
        record.closedAt =
            Date.now();

        record.closerId =
            interaction.user.id;

        record.closeReason =
            reason || "غير محدد";

        record.durationMs =
            record.claimedAt
                ? record.closedAt -
                  record.claimedAt
                : record.closedAt -
                  record.createdAt;

        await channel.setTopic(
            makeTicketTopic(
                CLOSED_TOPIC_PREFIX,
                info.type,
                record.ownerId,
                record.claimedBy
            )
        );

        await channel.permissionOverwrites.edit(
            record.ownerId,
            {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            }
        );

        await channel.send({
            embeds: [
                createEmbed(
                    `🔒 تم إغلاق التذكرة ${ticketTitle(record)}`,

                    `**تم الإغلاق بواسطة:** <@${record.closerId}>\n` +
                    `**سبب الإغلاق:** ${record.closeReason}\n` +
                    `**مدة التذكرة:** ${formatDuration(record.durationMs)}\n\n` +
                    `يمكن لصاحب التذكرة تقييم الخدمة من خلال الأزرار الموجودة في الأسفل.`,

                    COLORS.RED
                )
            ],

            components:
                closedTicketButtons()
        });

        saveTicketData();

        await interaction.editReply({
            content:
                `🔒 تم إغلاق التذكرة ${ticketTitle(record)} بنجاح.`
        });

        try {
            const owner =
                await interaction.client.users.fetch(
                    record.ownerId
                );

            await owner.send({
                embeds: [
                    createEmbed(
                        `🔒 تم إغلاق التذكرة ${ticketTitle(record)}`,

                        `تم إغلاق تذكرتك بواسطة <@${record.closerId}>.\n\n` +
                        `**السبب:** ${record.closeReason}\n` +
                        `**المدة:** ${formatDuration(record.durationMs)}\n\n` +
                        `يمكنك تقييم الخدمة من خلال أزرار التقييم الموجودة في رسالة التذكرة.`,

                        COLORS.RED
                    )
                ]
            });
        } catch {}

        void sendRatingRequestToUser(
            interaction.client,
            record
        ).catch(error =>
            console.error(
                "Ticket Rating DM Background Error:",
                error
            )
        );

    } catch (error) {
        console.error(
            "Ticket Close Error:",
            error
        );

        try {
            await interaction.editReply({
                content:
                    "❌ حدث خطأ أثناء إغلاق التذكرة. راجع الكونسول."
            });
        } catch {}
    }
}

// ======================================================
// التقييم في الخاص
// ======================================================

async function sendRatingRequestToUser(
    client,
    record
) {
    try {
        const user =
            await client.users.fetch(
                record.ownerId
            );

        await user.send({
            embeds: [
                createEmbed(
                    `⭐ تقييم التذكرة ${ticketTitle(record)}`,

                    "نشكرك على استخدام نظام التذاكر.\n" +
                    "يرجى اختيار تقييمك للخدمة من 1 إلى 5.",

                    COLORS.GOLD
                )
            ],

            components: [
                ratingRow(record.channelId)
            ]
        });
    } catch (error) {
        console.error(
            "Ticket Rating Request Error:",
            error
        );
    }
}

// ======================================================
// إعادة الفتح
// ======================================================

async function reopenTicket(interaction) {
    const info =
        parseTicketTopic(
            interaction.channel?.topic || ""
        );

    if (!info || !info.closed) {
        return interaction.reply({
            content:
                "❌ هذه التذكرة ليست مغلقة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ إعادة فتح التذكرة متاحة للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(
            interaction.channel.id
        );

    if (!record) {
        return interaction.reply({
            content:
                "❌ بيانات التذكرة غير موجودة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply();

    try {
        await Promise.all([
            interaction.channel.permissionOverwrites.edit(
                info.ownerId,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true
                }
            ),

            interaction.channel.setTopic(
                makeTicketTopic(
                    TICKET_TOPIC_PREFIX,
                    info.type,
                    info.ownerId,
                    info.claimedBy
                )
            )
        ]);

        if (
            interaction.channel.name.startsWith(
                "closed-"
            )
        ) {
            await interaction.channel
                .setName(
                    interaction.channel.name.slice(
                        "closed-".length
                    )
                )
                .catch(() => {});
        }

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

                    `أعاد فتحها <@${interaction.user.id}>.\n` +
                    `أصبحت بانتظار قبول الإدارة من جديد.`,

                    COLORS.GREEN
                )
            ],

            components:
                openTicketButtons(false)
        });

    } catch (error) {
        console.error(
            "Ticket Reopen Error:",
            error
        );

        await interaction.editReply({
            content:
                "❌ تعذر إعادة فتح التذكرة."
        });
    }
}

// ======================================================
// نسخ التذكرة
// ======================================================

async function copyTicket(interaction) {
    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ نسخ سجل التذكرة متاح للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(
            interaction.channel.id
        );

    if (!record) {
        return interaction.reply({
            content:
                "❌ بيانات التذكرة غير موجودة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    try {
        const transcript =
            await buildTicketTranscript(
                interaction.client,
                record
            );

        if (!transcript) {
            return interaction.editReply({
                content:
                    "❌ تعذر إنشاء سجل التذكرة."
            });
        }

        const attachment =
            new AttachmentBuilder(
                transcript,
                {
                    name:
                        `ticket-${formatTicketNumber(
                            record.ticketNumber
                        )}.txt`
                }
            );

        await interaction.editReply({
            content:
                `📋 سجل التذكرة ${ticketTitle(record)}:`,

            files: [
                attachment
            ]
        });

    } catch (error) {
        console.error(
            "Ticket Copy Error:",
            error
        );

        await interaction.editReply({
            content:
                "❌ تعذر نسخ سجل التذكرة."
        });
    }
}

// ======================================================
// حذف التذكرة
// ======================================================

async function deleteTicket(interaction) {
    const channel =
        interaction.channel;

    const info =
        parseTicketTopic(
            channel?.topic || ""
        );

    if (!info || !info.closed) {
        return interaction.reply({
            content:
                "❌ يجب إغلاق التذكرة قبل حذفها.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!isTicketStaff(interaction)) {
        return interaction.reply({
            content:
                "❌ حذف التذكرة متاح للإدارة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(channel.id);

    if (!record) {
        return interaction.reply({
            content:
                "❌ بيانات التذكرة غير موجودة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });

    record.deletedBy =
        interaction.user.id;

    record.deletedAt =
        Date.now();

    saveTicketData();

    await sendTicketLogToOwner(
        interaction.client,
        record
    );

    await interaction.editReply({
        content:
            `🗑️ سيتم حذف التذكرة ${ticketTitle(record)} خلال ثانيتين...`
    });

    setTimeout(async () => {
        try {
            await channel.delete(
                "W BOT • حذف تذكرة"
            );
        } catch (error) {
            console.error(
                "Ticket Delete Error:",
                error
            );
        }
    }, 2000);
}

// ======================================================
// التقييم
// ======================================================

async function processRating(interaction) {
    const parts =
        interaction.customId.split(":");

    const channelId =
        parts[1];

    const rating =
        Number(parts[2]);

    if (
        !channelId ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
    ) {
        return interaction.reply({
            content:
                "❌ التقييم غير صحيح.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    const record =
        getTicketRecord(channelId);

    if (!record) {
        return interaction.reply({
            content:
                "❌ لا يمكن العثور على بيانات هذه التذكرة.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (
        interaction.user.id !==
        record.ownerId
    ) {
        return interaction.reply({
            content:
                "❌ هذا التقييم مخصص لصاحب التذكرة فقط.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (!record.closedAt) {
        return interaction.reply({
            content:
                "❌ لا يمكن تقييم التذكرة قبل إغلاقها.",
            flags:
                MessageFlags.Ephemeral
        });
    }

    if (
        Number.isInteger(
            record.rating
        )
    ) {
        return interaction.reply({
            content:
                `✅ تم تسجيل تقييمك مسبقاً: **${record.rating}/5 ⭐**`,
            flags:
                MessageFlags.Ephemeral
        });
    }

    record.rating =
        rating;

    record.ratedAt =
        Date.now();

    saveTicketData();

    await interaction.reply({
        embeds: [
            createEmbed(
                "⭐ تم تسجيل التقييم",

                `شكراً لك! تم تسجيل تقييمك للتذكرة ${ticketTitle(record)}:\n` +
                `**${"⭐".repeat(rating)} (${rating}/5)**`,

                COLORS.GOLD
            )
        ],

        flags:
            MessageFlags.Ephemeral
    });

    await sendTicketLogToOwner(
        interaction.client,
        record
    );

    try {
        await interaction.message.edit({
            components: [
                ratingRow(
                    channelId,
                    true
                )
            ]
        });
    } catch {}
}

// ======================================================
// Handler
// ======================================================

async function handleInteraction(interaction) {

    if (
        interaction.isChatInputCommand() &&
        interaction.commandName === "ticket"
    ) {
        await interaction.deferReply({
            flags:
                MessageFlags.Ephemeral
        });

        const panelChannel =
            await interaction.guild.channels
                .fetch(
                    TICKET_PANEL_CHANNEL_ID
                )
                .catch(() => null);

        if (
            !panelChannel ||
            !panelChannel.isTextBased()
        ) {
            return interaction.editReply({
                content:
                    "❌ قناة لوحة التذاكر غير موجودة."
            });
        }

        await panelChannel.send(
            ticketPanel()
        );

        await interaction.editReply({
            content:
                `✅ تم إرسال لوحة التذاكر في <#${TICKET_PANEL_CHANNEL_ID}>.`
        });

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "ticket_open:"
        )
    ) {
        const type =
            interaction.customId.split(":")[1];

        try {
            await createTicket(
                interaction,
                type
            );
        } catch (error) {
            console.error(
                "Ticket Create Handler Error:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ حدث خطأ أثناء إنشاء التذكرة.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_claim"
    ) {
        try {
            await claimTicket(
                interaction
            );
        } catch (error) {
            console.error(
                "Ticket Claim Handler Error:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ حدث خطأ أثناء قبول التذكرة.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_add_member"
    ) {
        await addMemberToTicket(
            interaction
        );

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_close"
    ) {
        await showCloseModal(
            interaction
        );

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_copy"
    ) {
        await copyTicket(
            interaction
        );

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_reopen"
    ) {
        await reopenTicket(
            interaction
        );

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId ===
            "ticket_delete"
    ) {
        await deleteTicket(
            interaction
        );

        return true;
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId ===
            "ticket_add_member_modal"
    ) {
        await processAddMember(
            interaction
        );

        return true;
    }

    if (
        interaction.isModalSubmit() &&
        interaction.customId ===
            "ticket_close_modal"
    ) {
        try {
            await processCloseTicket(
                interaction
            );
        } catch (error) {
            console.error(
                "Ticket Close Handler Error:",
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                await interaction.reply({
                    content:
                        "❌ حدث خطأ أثناء إغلاق التذكرة.",
                    flags:
                        MessageFlags.Ephemeral
                });
            }
        }

        return true;
    }

    if (
        interaction.isButton() &&
        interaction.customId.startsWith(
            "ticket_rate:"
        )
    ) {
        await processRating(
            interaction
        );

        return true;
    }

    return false;
}

module.exports = {
    commands: [command],
    handleInteraction
};