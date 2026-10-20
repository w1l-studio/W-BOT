// =====================================================
// Trivia BOT • Ticket System v3 (single-file)
// =====================================================

const {
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ChannelType, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle,
    AttachmentBuilder, MessageFlags
} = require("discord.js");

const fs = require("fs");
const path = require("path");



const CONFIG = {
    OWNER_ID: "1487388575329681570",
    ADMIN_ROLE_ID: "1552476033842679969",
    BOT_ROLE_ID: "1558957016548909168",
    GUILD_ID: "1551431706731479199",
    TICKET_CATEGORY_ID: "1551759030769422417",
    TICKET_PANEL_CHANNEL_ID: "1551759063149322332",

    TRANSCRIPTS_LOG_CHANNEL_ID: "",
    RATINGS_LOG_CHANNEL_ID: "1558951712834719874",
    SUGGESTIONS_VOTE_CHANNEL_ID: "",
    FEMALE_ROLE_ID: "",
    VERIFIER_ROLE_ID: "",

    IDLE_WARN_MS: 10 * 60 * 1000,
    IDLE_CLOSE_MS: 5 * 60 * 1000,
    TRANSCRIPT_MAX_MSGS: 2000,

    TOPIC_PREFIX: "TRIVIA-TICKET:",
    CLOSED_PREFIX: "TRIVIA-CLOSED:",


    COLORS: {
        BLUE: 0x5865F2,
        RED: 0xED4245,
        GREEN: 0x57F287,
        GOLD: 0xFEE75C,
        DARK: 0x2B2D31,
        PURPLE: 0x9B59B6
    },

    TYPES: {

        support: {
            label: "الدعم الفني", emoji: "🛠️", color: 0x5865F2,
            desc: "للمساعدة في المشاكل التقنية والاستفسارات.",
            modalTitle: "تفاصيل طلب الدعم", modalLabel: "اشرح مشكلتك",
            modalPlaceholder: "مثال: أواجه مشكلة في..."
        },
        report: {
            label: "الإبلاغ", emoji: "🚨", color: 0xED4245,
            desc: "للإبلاغ عن مخالفة أو مشكلة مع عضو.",
            modalTitle: "تفاصيل البلاغ", modalLabel: "من تريد الإبلاغ عنه؟",
            modalPlaceholder: "مثال: أبلغ عن..."
        },
        verification: {
            label: "التوثيق", emoji: "🎀", color: 0x9B59B6,
            desc: "لتوثيقك كفتاة للحصول على رول Female.",
            modalTitle: "طلب التوثيق", modalLabel: "سبب طلب التوثيق",
            modalPlaceholder: "مثال: أطلب التوثيق لأنني..."
        },
        suggestions: {
            label: "الاقتراحات", emoji: "💡", color: 0xFEE75C,
            desc: "لتقديم الاقتراحات والأفكار لتطوير السيرفر.",
            modalTitle: "اقتراحك", modalLabel: "اكتب اقتراحك",
            modalPlaceholder: "مثال: أقترح..."
        }
    }
};

const DATA_FILE = path.join(__dirname, "ticket_data.json");
const DATA_VERSION = 3;

function defaultData() {
    return {
        version: DATA_VERSION,
        nextTicketNumber: 0,
        tickets: {},
        stats: { created: 0, claimed: 0, closed: 0, deleted: 0, ratings: 0, totalRating: 0 }
    };
}

let _data = null;

function loadData() {
    if (_data) return _data;
    if (!fs.existsSync(DATA_FILE)) { _data = defaultData(); saveData(); return _data; }
    try { _data = migrate(JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))); }
    catch (e) { console.error("[Tickets] Load error:", e); _data = defaultData(); }
    return _data;
}

function migrate(raw) {
    if (!raw || typeof raw !== "object") return defaultData();
    let next = raw.nextTicketNumber;
    if (!Number.isInteger(next) || next < 0) {
        const nums = Object.values(raw.tickets || {})
            .map(t => Number(t.ticketNumber))
            .filter(n => Number.isInteger(n) && n >= 0);
        next = nums.length ? Math.max(...nums) + 1 : 0;
    }
    const data = {
        version: DATA_VERSION,
        nextTicketNumber: next,
        tickets: raw.tickets || {},
        stats: raw.stats || { created: 0, claimed: 0, closed: 0, deleted: 0, ratings: 0, totalRating: 0 }
    };
    for (const [id, rec] of Object.entries(data.tickets)) {
        if (!rec.channelId) rec.channelId = id;
        if (typeof rec.ticketNumber !== "number") rec.ticketNumber = -1;
        if (!rec.status) rec.status = rec.deletedAt ? "deleted" : rec.closedAt ? "closed" : rec.claimedAt ? "claimed" : "open";
        if (rec.hideIdentity === undefined) rec.hideIdentity = false;
        if (rec.publishedToVote === undefined) rec.publishedToVote = false;
        if (rec.femaleGranted === undefined) rec.femaleGranted = false;
    }
    return data;
}

function saveData() {
    if (!_data) return;
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(_data, null, 4)); }
    catch (e) { console.error("[Tickets] Save error:", e); }
}

function nextNumber() {
    const d = loadData();
    const n = d.nextTicketNumber;
    d.nextTicketNumber = n + 1;
    saveData();
    return n;
}

const getRecord = (id) => loadData().tickets[id] || null;
const setRecord = (id, rec) => { loadData().tickets[id] = rec; saveData(); };
function updateRecord(id, patch) {
    const d = loadData();
    if (!d.tickets[id]) return null;
    Object.assign(d.tickets[id], patch);
    saveData();
    return d.tickets[id];
}
function bumpStat(k, n = 1) {
    const d = loadData();
    d.stats[k] = (d.stats[k] || 0) + n;
    saveData();
}

const formatNum = (n) => String(Math.max(0, Math.trunc(n))).padStart(4, "0");
const ticketTag = (rec) => `#${formatNum(rec.ticketNumber)}`;

function makeTopic(closed, type, ownerId, claimedBy) {
    const p = closed ? CONFIG.CLOSED_PREFIX : CONFIG.TOPIC_PREFIX;
    return `${p}${type}:${ownerId}:${claimedBy || "0"}`;
}

function parseTopic(topic = "") {
    let prefix = null, raw = null;
    if (topic.startsWith(CONFIG.TOPIC_PREFIX)) { prefix = CONFIG.TOPIC_PREFIX; raw = topic.slice(prefix.length); }
    else if (topic.startsWith(CONFIG.CLOSED_PREFIX)) { prefix = CONFIG.CLOSED_PREFIX; raw = topic.slice(prefix.length); }
    else return null;
    const parts = raw.split(":");
    return {
        closed: prefix === CONFIG.CLOSED_PREFIX,
        type: parts[0] || "support",
        ownerId: parts[1] || null,
        claimedBy: parts[2] && parts[2] !== "0" ? parts[2] : null
    };
}

function isStaff(i) {
    return Boolean(i.user?.id === CONFIG.OWNER_ID ||
        (CONFIG.ADMIN_ROLE_ID && i.member?.roles?.cache?.has(CONFIG.ADMIN_ROLE_ID)));
}
function isVerifier(i) {
    return Boolean(isStaff(i) ||
        (CONFIG.VERIFIER_ROLE_ID && i.member?.roles?.cache?.has(CONFIG.VERIFIER_ROLE_ID)));
}

function buildEmbed(title, desc, color = CONFIG.COLORS.BLUE) {
    return new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color)
        .setFooter({ text: "Trivia BOT" }).setTimestamp();
}

function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "غير متاح";
    let s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    const p = [];
    if (d) p.push(`${d} يوم`);
    if (h) p.push(`${h} ساعة`);
    if (m) p.push(`${m} دقيقة`);
    if (s || !p.length) p.push(`${s} ثانية`);
    return p.join(" و ");
}

const command = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("إرسال لوحة التذاكر")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

function buildPanel() {
    const embed = new EmbedBuilder()
        .setTitle("🎫 • نظام التذاكر | Trivia BOT")
        .setDescription("مرحباً بك في نظام الدعم.\nاختر القسم المناسب من الأزرار بالأسفل لفتح تذكرة.\n\n━━━━━━━━━━━━━━━━━━━━")
        .setColor(CONFIG.COLORS.BLUE).setFooter({ text: "Trivia BOT" }).setTimestamp();
    for (const info of Object.values(CONFIG.TYPES)) {
        embed.addFields({ name: `${info.emoji} ${info.label}`, value: info.desc, inline: false });
    }
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_open:support").setLabel("الدعم الفني").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_open:report").setLabel("الإبلاغ").setEmoji("🚨").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("ticket_open:verification").setLabel("التوثيق").setEmoji("🎀").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_open:suggestions").setLabel("الاقتراحات").setEmoji("💡").setStyle(ButtonStyle.Secondary)
    );
    return { embeds: [embed], components: [row] };
}

function buildOpenModal(type) {
    const info = CONFIG.TYPES[type];
    if (!info) return null;
    const modal = new ModalBuilder().setCustomId(`ticket_open_modal:${type}`).setTitle(info.modalTitle);
    const input = new TextInputBuilder().setCustomId("details")
        .setLabel(info.modalLabel).setPlaceholder(info.modalPlaceholder)
        .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function buildOpenButtons(rec) {
    const claimed = Boolean(rec.claimedBy);
    const locked = rec.status === "locked";
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_claim")
            .setLabel(claimed ? "مقبولة" : "استلام").setEmoji("🙋")
            .setStyle(ButtonStyle.Success).setDisabled(claimed),
        new ButtonBuilder().setCustomId("ticket_lock")
            .setLabel(locked ? "إلغاء القفل" : "قفل مؤقت").setEmoji(locked ? "🔓" : "🔒")
            .setStyle(locked ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_add_member").setLabel("إضافة عضو").setEmoji("➕").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ticket_close").setLabel("إغلاق نهائي").setEmoji("⛔").setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_copy").setLabel("نسخ السجل").setEmoji("📋").setStyle(ButtonStyle.Secondary)
    );
    if (rec.type === "report") {
        row2.addComponents(new ButtonBuilder().setCustomId("ticket_hide_identity")
            .setLabel(rec.hideIdentity ? "هوية مخفية" : "إخفاء هوية المبلّغ").setEmoji("🕵️")
            .setStyle(ButtonStyle.Secondary).setDisabled(rec.hideIdentity));
    }
    if (rec.type === "suggestions") {
        row2.addComponents(new ButtonBuilder().setCustomId("ticket_publish")
            .setLabel(rec.publishedToVote ? "تم النشر" : "نشر للتصويت").setEmoji("📢")
            .setStyle(ButtonStyle.Primary).setDisabled(rec.publishedToVote));
    }
    if (rec.type === "verification") {
        row2.addComponents(new ButtonBuilder().setCustomId("ticket_grant_female")
            .setLabel(rec.femaleGranted ? "تم منح الرول" : "منح رتبة Female").setEmoji("🎀")
            .setStyle(ButtonStyle.Success).setDisabled(rec.femaleGranted));
    }
    return [row1, row2];
}

function buildClosedButtons() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ticket_reopen").setLabel("إعادة فتح").setEmoji("🔓").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ticket_copy").setLabel("نسخ السجل").setEmoji("📋").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("ticket_delete").setLabel("حذف نهائي").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
    )];
}

function buildRatingRow(channelId, disabled = false) {
    return new ActionRowBuilder().addComponents(
        ...[1, 2, 3, 4, 5].map(n => new ButtonBuilder()
            .setCustomId(`ticket_rate:${channelId}:${n}`).setLabel(`${n}`).setEmoji("⭐")
            .setStyle(ButtonStyle.Secondary).setDisabled(disabled))
    );
}

function buildCloseModal() {
    const modal = new ModalBuilder().setCustomId("ticket_close_modal").setTitle("إغلاق التذكرة");
    const reason = new TextInputBuilder().setCustomId("close_reason").setLabel("سبب الإغلاق")
        .setPlaceholder("اكتب سبب إغلاق التذكرة...").setStyle(TextInputStyle.Paragraph)
        .setRequired(true).setMaxLength(1000);
    modal.addComponents(new ActionRowBuilder().addComponents(reason));
    return modal;
}

function buildAddMemberModal() {
    const modal = new ModalBuilder().setCustomId("ticket_add_member_modal").setTitle("إضافة عضو للتذكرة");
    const input = new TextInputBuilder().setCustomId("member_id").setLabel("Discord User ID")
        .setPlaceholder("مثال: 123456789012345678").setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const fmtDate = (ts) => new Date(ts).toISOString().replace("T", " ").slice(0, 19);

async function buildTranscript(client, rec) {
    const ch = await client.channels.fetch(rec.channelId).catch(() => null);
    if (!ch) return null;
    const all = [];
    let lastId = null;
    while (all.length < CONFIG.TRANSCRIPT_MAX_MSGS) {
        const batch = await ch.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) }).catch(() => null);
        if (!batch || batch.size === 0) break;
        all.push(...batch.values());
        lastId = batch.last()?.id;
        if (batch.size < 100) break;
    }
    all.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const typeInfo = CONFIG.TYPES[rec.type] || { label: rec.type };
    const rows = all.map(m => {
        const author = escapeHtml(m.author?.tag || "Unknown");
        const authorId = m.author?.id || "";
        const avatar = m.author?.displayAvatarURL?.({ size: 32, extension: "png" }) || "";
        const time = fmtDate(m.createdTimestamp);
        const content = escapeHtml(m.content || "");
        const atts = [...(m.attachments?.values() || [])].map(a =>
            `<div class="attachment"><a href="${escapeHtml(a.url)}" target="_blank">📎 ${escapeHtml(a.name)}</a></div>`).join("");
        const embeds = (m.embeds || []).map(e =>
            `<div class="embed"><strong>${escapeHtml(e.title || "Embed")}</strong><br>${escapeHtml(e.description || "")}</div>`).join("");
        return `<div class="message">${avatar ? `<img class="avatar" src="${escapeHtml(avatar)}">` : ""}
            <div class="body">
                <div class="meta"><span class="author">${author}</span> <span class="uid">(${escapeHtml(authorId)})</span> <span class="time">${time}</span></div>
                <div class="content">${content || "<em>(بدون نص)</em>"}</div>${atts}${embeds}
            </div></div>`;
    }).join("\n");
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>Ticket #${rec.ticketNumber}</title><style>
body{background:#313338;color:#dbdee1;font-family:'Segoe UI',Tahoma,sans-serif;padding:20px;margin:0}
.header{background:#2b2d31;padding:16px;border-radius:8px;margin-bottom:20px}
.header h1{margin:0 0 12px;color:#fff;font-size:22px}
.info{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:14px}
.info div{padding:4px 0}.info strong{color:#fff}
.message{display:flex;gap:12px;padding:12px;border-bottom:1px solid #3a3c42}
.message:hover{background:#2e3035}.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0}
.body{flex:1;min-width:0}.meta{margin-bottom:4px;font-size:13px}
.author{color:#fff;font-weight:600}.uid{color:#949ba4;font-size:11px}
.time{color:#949ba4;font-size:11px;margin-inline-start:8px}
.content{white-space:pre-wrap;word-break:break-word}
.attachment,.embed{margin-top:6px;padding:6px 10px;background:#2b2d31;border-radius:4px;font-size:13px}
.attachment a{color:#00a8fc;text-decoration:none}
</style></head><body>
<div class="header"><h1>🎫 تذكرة #${rec.ticketNumber} - ${escapeHtml(typeInfo.label)}</h1>
<div class="info">
<div><strong>صاحب التذكرة:</strong> ${escapeHtml(rec.ownerTag || rec.ownerId)}</div>
<div><strong>النوع:</strong> ${escapeHtml(typeInfo.label)}</div>
<div><strong>الحالة:</strong> ${escapeHtml(rec.status || "unknown")}</div>
<div><strong>تم الاستلام:</strong> ${rec.claimedBy ? escapeHtml(rec.claimedBy) : "لم يُقبل"}</div>
<div><strong>تم الإغلاق:</strong> ${rec.closedBy ? escapeHtml(rec.closedBy) : "—"}</div>
<div><strong>سبب الإغلاق:</strong> ${escapeHtml(rec.closeReason || "—")}</div>
<div><strong>المدة:</strong> ${rec.durationMs != null ? formatDuration(rec.durationMs) : "—"}</div>
<div><strong>التقييم:</strong> ${rec.rating ? "⭐".repeat(rec.rating) : "—"}</div>
<div><strong>التفاصيل:</strong> ${escapeHtml(rec.details || "—")}</div>
</div></div>
<div class="messages">${rows || "<p>لا توجد رسائل.</p>"}</div>
</body></html>`;
    return Buffer.from(html, "utf8");
}

const idleTimers = new Map();

function clearIdle(channelId) {
    const t = idleTimers.get(channelId);
    if (!t) return;
    if (t.warn) clearTimeout(t.warn);
    if (t.close) clearTimeout(t.close);
    idleTimers.delete(channelId);
}

function startIdle(client, channelId) {
    clearIdle(channelId);
    const rec = getRecord(channelId);
    if (!rec || rec.closedAt || rec.deletedAt || rec.status === "locked") return;

    const sinceLast = Date.now() - (rec.lastUserMessageAt || rec.createdAt);
    const warnDelay = Math.max(1000, CONFIG.IDLE_WARN_MS - sinceLast);

    const warn = setTimeout(async () => {
        try {
            const r = getRecord(channelId);
            if (!r || r.closedAt || r.deletedAt) return;
            const idle = Date.now() - (r.lastUserMessageAt || r.createdAt);
            if (idle < CONFIG.IDLE_WARN_MS - 5000) { startIdle(client, channelId); return; }
            const ch = await client.channels.fetch(channelId).catch(() => null);
            if (!ch) return;
            await ch.send({
                content: `<@${r.ownerId}>`,
                embeds: [buildEmbed("⚠️ تنبيه عدم النشاط",
                    `لم تُرسل أي رسالة من صاحب التذكرة منذ فترة.\nسيتم **إغلاق التذكرة تلقائياً** بعد **5 دقائق** إن لم يرد.`,
                    CONFIG.COLORS.GOLD)]
            }).catch(() => {});
            updateRecord(channelId, { idleWarnedAt: Date.now() });

            const close = setTimeout(async () => {
                try {
                    const r2 = getRecord(channelId);
                    if (!r2 || r2.closedAt || r2.deletedAt) return;
                    const idle2 = Date.now() - (r2.lastUserMessageAt || r2.createdAt);
                    if (idle2 < CONFIG.IDLE_WARN_MS + CONFIG.IDLE_CLOSE_MS - 5000) { startIdle(client, channelId); return; }
                    await autoClose(client, channelId, "⛔ إغلاق تلقائي - عدم النشاط");
                } catch (e) { console.error("[Tickets] Idle close error:", e); }
            }, CONFIG.IDLE_CLOSE_MS);

            idleTimers.set(channelId, { warn: null, close });
        } catch (e) { console.error("[Tickets] Idle warn error:", e); }
    }, warnDelay);

    idleTimers.set(channelId, { warn, close: null });
}

function resetIdle(client, channelId) {
    const rec = getRecord(channelId);
    if (!rec || rec.closedAt || rec.deletedAt) return;
    updateRecord(channelId, { lastUserMessageAt: Date.now(), idleWarnedAt: null });
    startIdle(client, channelId);
}

function resumeIdleOnStartup(client) {
    for (const [id, rec] of Object.entries(loadData().tickets)) {
        if (rec.closedAt || rec.deletedAt) continue;
        startIdle(client, id);
    }
}

async function handleOpenModalSubmit(interaction) {
    const type = interaction.customId.split(":")[1];
    const details = interaction.fields.getTextInputValue("details").trim();
    const info = CONFIG.TYPES[type];
    if (!info) return interaction.reply({ content: "❌ نوع غير صحيح.", flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) return interaction.editReply({ content: "❌ لا يمكن الإنشاء هنا." });

    for (const rec of Object.values(loadData().tickets)) {
        if (rec.ownerId === interaction.user.id && !rec.closedAt && !rec.deletedAt && guild.channels.cache.has(rec.channelId)) {
            return interaction.editReply({ content: `❌ لديك تذكرة مفتوحة: <#${rec.channelId}>` });
        }
    }

    const num = nextNumber();
    const rec = {
        channelId: null, ticketNumber: num, guildId: guild.id, type,
        ownerId: interaction.user.id, ownerTag: interaction.user.tag,
        details, createdAt: Date.now(), status: "open",
        claimedBy: null, claimedAt: null, lockedBy: null, lockedAt: null,
        closedBy: null, closedAt: null, closeReason: null, durationMs: null,
        deletedBy: null, deletedAt: null, rating: null, ratedAt: null,
        hideIdentity: false, publishedToVote: false, publishedBy: null, publishedAt: null,
        femaleGranted: false, grantedBy: null, grantedAt: null,
        lastUserMessageAt: Date.now(), idleWarnedAt: null
    };

    const staffPerms = [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages
    ];
    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
        ]},
        { id: CONFIG.OWNER_ID, allow: staffPerms }
    ];
    if (CONFIG.ADMIN_ROLE_ID && CONFIG.ADMIN_ROLE_ID !== CONFIG.OWNER_ID) {
        overwrites.push({ id: CONFIG.ADMIN_ROLE_ID, allow: staffPerms });
    }

    let channel;
    try {
        channel = await guild.channels.create({
            name: `ticket-${formatNum(num)}`,
            type: ChannelType.GuildText,
            parent: CONFIG.TICKET_CATEGORY_ID,
            topic: makeTopic(false, type, interaction.user.id, null),
            permissionOverwrites: overwrites
        });
    } catch (e) {
        console.error("[Tickets] Create channel error:", e);
        return interaction.editReply({ content: "❌ فشل إنشاء القناة. تأكد من الصلاحيات." });
    }

    rec.channelId = channel.id;
    setRecord(channel.id, rec);
    bumpStat("created");

    const embed = new EmbedBuilder()
        .setTitle(`${info.emoji} ${info.label} ${ticketTag(rec)}`)
        .setDescription(
            `مرحباً <@${interaction.user.id}>!\n\n**النوع:** ${info.label}\n` +
            `**التفاصيل:**\n>>> ${details}\n\n⏳ سيتم الرد عليك من قبل الإدارة قريباً.`
        )
        .setColor(info.color).setFooter({ text: "Trivia BOT" }).setTimestamp();

    const ping = `<@${interaction.user.id}>` + (CONFIG.ADMIN_ROLE_ID ? ` <@&${CONFIG.ADMIN_ROLE_ID}>` : "");
    try { await channel.send({ content: ping, embeds: [embed], components: buildOpenButtons(rec) }); }
    catch (e) { console.error("[Tickets] Send intro error:", e); }

    await interaction.editReply({
        content: `🎫 **تم إنشاء تذكرتك!**\n📌 <#${channel.id}>\n🔢 **${ticketTag(rec)}**\n\n⏳ سيتم الرد عليك قريباً.`
    });
    startIdle(interaction.client, channel.id);
}

async function claimTicket(interaction) {
    const ch = interaction.channel;
    const info = parseTopic(ch?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ ليست تذكرة مفتوحة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ الاستلام للإدارة فقط.", flags: MessageFlags.Ephemeral });

    const rec = getRecord(ch.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    if (rec.claimedBy) return interaction.reply({ content: `❌ مستلمة بواسطة <@${rec.claimedBy}>.`, flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    updateRecord(ch.id, {
        claimedBy: interaction.user.id, claimedAt: Date.now(),
        status: rec.status === "locked" ? "locked" : "claimed"
    });
    bumpStat("claimed");
    await ch.setTopic(makeTopic(false, info.type, rec.ownerId, interaction.user.id)).catch(() => {});
    try { if (interaction.message?.editable) await interaction.message.edit({ components: buildOpenButtons(getRecord(ch.id)) }); } catch {}
    await ch.send({ embeds: [buildEmbed("✅ تم استلام التذكرة", `استلمها <@${interaction.user.id}>.`, CONFIG.COLORS.GREEN)] });
    await interaction.editReply({ content: "✅ تم الاستلام." });
}

async function toggleLock(interaction) {
    const ch = interaction.channel;
    const info = parseTopic(ch?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ التذكرة مغلقة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ القفل للإدارة فقط.", flags: MessageFlags.Ephemeral });

    const rec = getRecord(ch.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isLocked = rec.status === "locked";

    if (isLocked) {
        await ch.permissionOverwrites.edit(rec.ownerId, { SendMessages: true }).catch(() => {});
        updateRecord(ch.id, { status: rec.claimedBy ? "claimed" : "open", lockedBy: null, lockedAt: null });
        startIdle(interaction.client, ch.id);
    } else {
        await ch.permissionOverwrites.edit(rec.ownerId, { SendMessages: false }).catch(() => {});
        updateRecord(ch.id, { status: "locked", lockedBy: interaction.user.id, lockedAt: Date.now() });
        clearIdle(ch.id);
    }
    try { if (interaction.message?.editable) await interaction.message.edit({ components: buildOpenButtons(getRecord(ch.id)) }); } catch {}
    await ch.send({ embeds: [buildEmbed(
        isLocked ? "🔓 تم إلغاء القفل" : "🔒 تم القفل المؤقت",
        `بواسطة <@${interaction.user.id}>.`,
        isLocked ? CONFIG.COLORS.GREEN : CONFIG.COLORS.GOLD
    )] });
    await interaction.editReply({ content: isLocked ? "🔓 تم إلغاء القفل." : "🔒 تم القفل." });
}

async function processClose(interaction) {
    const ch = interaction.channel;
    const info = parseTopic(ch?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ مغلقة بالفعل.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ الإغلاق للإدارة فقط.", flags: MessageFlags.Ephemeral });

    const rec = getRecord(ch.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });

    const reason = interaction.fields.getTextInputValue("close_reason").trim() || "غير محدد";
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const now = Date.now();
    const durationMs = rec.claimedAt ? now - rec.claimedAt : now - rec.createdAt;
    updateRecord(ch.id, { status: "closed", closedBy: interaction.user.id, closedAt: now, closeReason: reason, durationMs });
    bumpStat("closed");
    clearIdle(ch.id);
    await ch.permissionOverwrites.edit(rec.ownerId, { SendMessages: false }).catch(() => {});
    await ch.setTopic(makeTopic(true, info.type, rec.ownerId, rec.claimedBy)).catch(() => {});

    const fresh = getRecord(ch.id);
    let buf = null;
    try { buf = await buildTranscript(interaction.client, fresh); } catch (e) { console.error("[Tickets] Transcript error:", e); }

    await ch.send({
        embeds: [buildEmbed(
            `🔒 تم إغلاق التذكرة ${ticketTag(fresh)}`,
            `**بواسطة:** <@${fresh.closedBy}>\n**السبب:** ${fresh.closeReason}\n**المدة:** ${formatDuration(fresh.durationMs)}\n\nيمكن لصاحب التذكرة التقييم من الرسالة الخاصة.`,
            CONFIG.COLORS.RED
        )],
        components: buildClosedButtons()
    }).catch(() => {});

    if (CONFIG.TRANSCRIPTS_LOG_CHANNEL_ID && buf) {
        try {
            const logCh = await interaction.client.channels.fetch(CONFIG.TRANSCRIPTS_LOG_CHANNEL_ID).catch(() => null);
            if (logCh?.isTextBased()) {
                const att = new AttachmentBuilder(buf, { name: `ticket-${formatNum(fresh.ticketNumber)}.html` });
                await logCh.send({
                    embeds: [buildEmbed(
                        `📋 سجل تذكرة ${ticketTag(fresh)}`,
                        `**النوع:** ${CONFIG.TYPES[fresh.type]?.label || fresh.type}\n` +
                        `**صاحب التذكرة:** <@${fresh.ownerId}>\n` +
                        `**الإداري المستلم:** ${fresh.claimedBy ? `<@${fresh.claimedBy}>` : "—"}\n` +
                        `**سبب الإغلاق:** ${fresh.closeReason}\n` +
                        `**المدة:** ${formatDuration(fresh.durationMs)}`,
                        CONFIG.COLORS.BLUE
                    )],
                    files: [att]
                });
            }
        } catch (e) { console.error("[Tickets] Log channel error:", e); }
    }

    try {
        const owner = await interaction.client.users.fetch(fresh.ownerId);
        await owner.send({
            embeds: [buildEmbed(
                `🔒 تم إغلاق تذكرتك ${ticketTag(fresh)}`,
                `**السبب:** ${fresh.closeReason}\n**المدة:** ${formatDuration(fresh.durationMs)}\n\nقيّم الخدمة من الأزرار أدناه:`,
                CONFIG.COLORS.RED
            )],
            components: [buildRatingRow(fresh.channelId)]
        }).catch(() => {});
    } catch {}

    await interaction.editReply({ content: `🔒 تم إغلاق التذكرة ${ticketTag(fresh)}.` });
}

async function autoClose(client, channelId, reasonText) {
    const rec = getRecord(channelId);
    if (!rec || rec.closedAt) return;
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch) return;
    const now = Date.now();
    const durationMs = rec.claimedAt ? now - rec.claimedAt : now - rec.createdAt;
    updateRecord(channelId, { status: "closed", closedBy: client.user.id, closedAt: now, closeReason: reasonText, durationMs });
    bumpStat("closed");
    clearIdle(channelId);
    await ch.permissionOverwrites.edit(rec.ownerId, { SendMessages: false }).catch(() => {});
    const info = parseTopic(ch.topic || "");
    if (info) await ch.setTopic(makeTopic(true, info.type, rec.ownerId, rec.claimedBy)).catch(() => {});
    const fresh = getRecord(channelId);
    let buf = null;
    try { buf = await buildTranscript(client, fresh); } catch {}
    await ch.send({
        embeds: [buildEmbed(
            `🔒 تم إغلاق التذكرة تلقائياً ${ticketTag(fresh)}`,
            `**السبب:** ${reasonText}\n**المدة:** ${formatDuration(fresh.durationMs)}`,
            CONFIG.COLORS.RED
        )],
        components: buildClosedButtons()
    }).catch(() => {});
    if (CONFIG.TRANSCRIPTS_LOG_CHANNEL_ID && buf) {
        try {
            const logCh = await client.channels.fetch(CONFIG.TRANSCRIPTS_LOG_CHANNEL_ID).catch(() => null);
            if (logCh?.isTextBased()) {
                const att = new AttachmentBuilder(buf, { name: `ticket-${formatNum(fresh.ticketNumber)}.html` });
                await logCh.send({
                    embeds: [buildEmbed(
                        `📋 سجل تذكرة (تلقائي) ${ticketTag(fresh)}`,
                        `**صاحب التذكرة:** <@${fresh.ownerId}>\n**السبب:** ${reasonText}\n**المدة:** ${formatDuration(fresh.durationMs)}`,
                        CONFIG.COLORS.BLUE
                    )],
                    files: [att]
                });
            }
        } catch {}
    }
}

async function reopenTicket(interaction) {
    const info = parseTopic(interaction.channel?.topic || "");
    if (!info || !info.closed) return interaction.reply({ content: "❌ ليست مغلقة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(interaction.channel.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply();
    await interaction.channel.permissionOverwrites.edit(rec.ownerId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
        AttachFiles: true, EmbedLinks: true
    }).catch(() => {});
    await interaction.channel.setTopic(makeTopic(false, info.type, rec.ownerId, null)).catch(() => {});
    updateRecord(interaction.channel.id, {
        status: "open", closedBy: null, closedAt: null, closeReason: null, durationMs: null,
        claimedBy: null, claimedAt: null, rating: null, ratedAt: null
    });
    await interaction.editReply({
        embeds: [buildEmbed(`🔓 تم إعادة فتح التذكرة ${ticketTag(rec)}`, `بواسطة <@${interaction.user.id}>.`, CONFIG.COLORS.GREEN)],
        components: buildOpenButtons(getRecord(interaction.channel.id))
    });
    startIdle(interaction.client, interaction.channel.id);
}

async function copyTicket(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(interaction.channel.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const buf = await buildTranscript(interaction.client, rec).catch(() => null);
    if (!buf) return interaction.editReply({ content: "❌ تعذر إنشاء السجل." });
    const att = new AttachmentBuilder(buf, { name: `ticket-${formatNum(rec.ticketNumber)}.html` });
    await interaction.editReply({ content: `📋 سجل ${ticketTag(rec)}:`, files: [att] });
}

async function showAddMemberModal(interaction) {
    const info = parseTopic(interaction.channel?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ مغلقة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    await interaction.showModal(buildAddMemberModal());
}
async function processAddMember(interaction) {
    const info = parseTopic(interaction.channel?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ مغلقة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const userId = interaction.fields.getTextInputValue("member_id").trim();
    if (!/^\d{17,20}$/.test(userId)) return interaction.reply({ content: "❌ ID غير صحيح.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) return interaction.editReply({ content: "❌ العضو غير موجود." });
    await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
        AttachFiles: true, EmbedLinks: true
    }).catch(() => {});
    await interaction.editReply({ content: `✅ تم إضافة <@${userId}>.` });
    await interaction.channel.send({ embeds: [buildEmbed("➕ تم إضافة عضو",
        `<@${userId}> بواسطة <@${interaction.user.id}>.`, CONFIG.COLORS.BLUE)] });
}

async function showCloseModal(interaction) {
    const info = parseTopic(interaction.channel?.topic || "");
    if (!info || info.closed) return interaction.reply({ content: "❌ مغلقة.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    await interaction.showModal(buildCloseModal());
}

async function hideIdentity(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(interaction.channel.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    if (rec.type !== "report") return interaction.reply({ content: "❌ هذه الميزة للبلاغات فقط.", flags: MessageFlags.Ephemeral });
    if (rec.hideIdentity) return interaction.reply({ content: "✅ مخفي مسبقاً.", flags: MessageFlags.Ephemeral });
    updateRecord(interaction.channel.id, { hideIdentity: true });
    await interaction.channel.permissionOverwrites.edit(rec.ownerId, { ViewChannel: false }).catch(() => {});
    await interaction.reply({ embeds: [buildEmbed("🕵️ تم إخفاء هوية المبلّغ",
        `**ملاحظة:** الإدارة المصرح لها قد تستطيع رؤية صاحب البلاغ من صلاحيات القناة.\nبواسطة <@${interaction.user.id}>.`,
        CONFIG.COLORS.DARK)], flags: MessageFlags.Ephemeral });
}

async function publishSuggestion(interaction) {
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(interaction.channel.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    if (rec.type !== "suggestions") return interaction.reply({ content: "❌ هذه الميزة للاقتراحات فقط.", flags: MessageFlags.Ephemeral });
    if (rec.publishedToVote) return interaction.reply({ content: "✅ تم النشر مسبقاً.", flags: MessageFlags.Ephemeral });
    if (!CONFIG.SUGGESTIONS_VOTE_CHANNEL_ID) return interaction.reply({ content: "❌ قناة التصويت غير مُعدّة.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const voteCh = await interaction.client.channels.fetch(CONFIG.SUGGESTIONS_VOTE_CHANNEL_ID).catch(() => null);
    if (!voteCh?.isTextBased()) return interaction.editReply({ content: "❌ قناة التصويت غير متاحة." });
    const embed = new EmbedBuilder()
        .setTitle(`💡 اقتراح ${ticketTag(rec)}`)
        .setDescription(rec.details || "لا توجد تفاصيل.")
        .setColor(CONFIG.COLORS.GOLD).setFooter({ text: "Trivia BOT" }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`suggestion_vote:${rec.channelId}:up`).setLabel("0").setEmoji("👍").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`suggestion_vote:${rec.channelId}:down`).setLabel("0").setEmoji("👎").setStyle(ButtonStyle.Danger)
    );
    const msg = await voteCh.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (!msg) return interaction.editReply({ content: "❌ تعذر النشر." });
    updateRecord(interaction.channel.id, {
        publishedToVote: true, publishedBy: interaction.user.id,
        publishedAt: Date.now(), voteMessageId: msg.id
    });
    await interaction.editReply({ content: `✅ تم نشر الاقتراح في <#${CONFIG.SUGGESTIONS_VOTE_CHANNEL_ID}>.` });
}

async function grantFemale(interaction) {
    if (!isVerifier(interaction)) return interaction.reply({ content: "❌ غير مصرح.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(interaction.channel.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    if (rec.type !== "verification") return interaction.reply({ content: "❌ للتوثيق فقط.", flags: MessageFlags.Ephemeral });
    if (rec.femaleGranted) return interaction.reply({ content: "✅ مُنحت مسبقاً.", flags: MessageFlags.Ephemeral });
    if (!CONFIG.FEMALE_ROLE_ID) return interaction.reply({ content: "❌ رتبة Female غير مُعدّة.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await interaction.guild.members.fetch(rec.ownerId).catch(() => null);
    if (!member) return interaction.editReply({ content: "❌ العضو غير موجود." });
    if (member.roles.cache.has(CONFIG.FEMALE_ROLE_ID)) {
        updateRecord(interaction.channel.id, { femaleGranted: true, grantedBy: interaction.user.id, grantedAt: Date.now() });
        return interaction.editReply({ content: "✅ العضو يملك الرتبة مسبقاً (تم تحديث السجل)." });
    }
    try { await member.roles.add(CONFIG.FEMALE_ROLE_ID, `توثيق بواسطة ${interaction.user.tag}`); }
    catch (e) { console.error("[Tickets] Grant role error:", e); return interaction.editReply({ content: "❌ تعذر منح الرتبة." }); }
    updateRecord(interaction.channel.id, { femaleGranted: true, grantedBy: interaction.user.id, grantedAt: Date.now() });
    await interaction.editReply({ content: `✅ تم منح <@&${CONFIG.FEMALE_ROLE_ID}> لـ <@${rec.ownerId}>.` });
    await interaction.channel.send({ embeds: [buildEmbed("🎀 تم التوثيق",
        `تم منح الرتبة لـ <@${rec.ownerId}> بواسطة <@${interaction.user.id}>.`,
        CONFIG.COLORS.PURPLE)] });
}

async function processRating(interaction) {
    const parts = interaction.customId.split(":");
    const channelId = parts[1];
    const rating = Number(parts[2]);
    if (!channelId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return interaction.reply({ content: "❌ تقييم غير صحيح.", flags: MessageFlags.Ephemeral });
    }
    const rec = getRecord(channelId);
    if (!rec) return interaction.reply({ content: "❌ لا يمكن العثور على التذكرة.", flags: MessageFlags.Ephemeral });
    if (interaction.user.id !== rec.ownerId) return interaction.reply({ content: "❌ التقييم لصاحب التذكرة فقط.", flags: MessageFlags.Ephemeral });
    if (!rec.closedAt) return interaction.reply({ content: "❌ لم تُغلق بعد.", flags: MessageFlags.Ephemeral });
    if (Number.isInteger(rec.rating)) return interaction.reply({ content: `✅ قيّمت مسبقاً: **${rec.rating}/5**.`, flags: MessageFlags.Ephemeral });

    updateRecord(channelId, { rating, ratedAt: Date.now() });
    bumpStat("ratings");
    bumpStat("totalRating", rating);

    await interaction.reply({
        embeds: [buildEmbed("⭐ شكراً لتقييمك!",
            `تم تسجيل **${"⭐".repeat(rating)} (${rating}/5)** للتذكرة ${ticketTag(rec)}.`,
            CONFIG.COLORS.GOLD)],
        flags: MessageFlags.Ephemeral
    });

    if (CONFIG.RATINGS_LOG_CHANNEL_ID) {
        try {
            const logCh = await interaction.client.channels.fetch(CONFIG.RATINGS_LOG_CHANNEL_ID).catch(() => null);
            if (logCh?.isTextBased()) {
                await logCh.send({ embeds: [buildEmbed(
                    `⭐ تقييم جديد ${ticketTag(rec)}`,
                    `**النوع:** ${CONFIG.TYPES[rec.type]?.label || rec.type}\n` +
                    `**صاحب التذكرة:** <@${rec.ownerId}>\n` +
                    `**الإداري المستلم:** ${rec.claimedBy ? `<@${rec.claimedBy}>` : "—"}\n` +
                    `**التقييم:** ${"⭐".repeat(rating)} (${rating}/5)\n` +
                    `**المدة:** ${formatDuration(rec.durationMs)}`,
                    CONFIG.COLORS.GOLD
                )] });
            }
        } catch {}
    }
    try { if (interaction.message?.editable) await interaction.message.edit({ components: [buildRatingRow(channelId, true)] }); } catch {}
}

async function deleteTicket(interaction) {
    const ch = interaction.channel;
    const info = parseTopic(ch?.topic || "");
    if (!info || !info.closed) return interaction.reply({ content: "❌ يجب إغلاقها أولاً.", flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction)) return interaction.reply({ content: "❌ للإدارة فقط.", flags: MessageFlags.Ephemeral });
    const rec = getRecord(ch.id);
    if (!rec) return interaction.reply({ content: "❌ بيانات غير موجودة.", flags: MessageFlags.Ephemeral });
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    updateRecord(ch.id, { deletedBy: interaction.user.id, deletedAt: Date.now(), status: "deleted" });
    bumpStat("deleted");
    clearIdle(ch.id);
    await interaction.editReply({ content: `🗑️ سيتم الحذف خلال ثانيتين...` });
    setTimeout(async () => {
        try { await ch.delete("Trivia BOT • حذف تذكرة"); }
        catch (e) { console.error("[Tickets] Delete error:", e); }
    }, 2000);
}

async function sendPanel(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panelCh = await interaction.guild.channels.fetch(CONFIG.TICKET_PANEL_CHANNEL_ID).catch(() => null);
    if (!panelCh?.isTextBased()) return interaction.editReply({ content: "❌ قناة اللوحة غير موجودة." });
    await panelCh.send(buildPanel());
    await interaction.editReply({ content: `✅ تم إرسال اللوحة في <#${CONFIG.TICKET_PANEL_CHANNEL_ID}>.` });
}

async function handleInteraction(interaction) {
    if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
        await sendPanel(interaction); return true;
    }
    if (interaction.isButton() && interaction.customId.startsWith("ticket_open:")) {
        const type = interaction.customId.split(":")[1];
        const modal = buildOpenModal(type);
        if (!modal) return interaction.reply({ content: "❌ نوع غير صحيح.", flags: MessageFlags.Ephemeral });
        await interaction.showModal(modal); return true;
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_open_modal:")) {
        try { await handleOpenModalSubmit(interaction); }
        catch (e) { console.error("[Tickets] Open error:", e); safeReply(interaction, "❌ حدث خطأ."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_claim") {
        try { await claimTicket(interaction); }
        catch (e) { console.error("[Tickets] Claim error:", e); safeReply(interaction, "❌ خطأ في الاستلام."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_lock") {
        try { await toggleLock(interaction); }
        catch (e) { console.error("[Tickets] Lock error:", e); safeReply(interaction, "❌ خطأ في القفل."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_add_member") {
        try { await showAddMemberModal(interaction); }
        catch (e) { console.error("[Tickets] Add modal error:", e); }
        return true;
    }
    if (interaction.isModalSubmit() && interaction.customId === "ticket_add_member_modal") {
        try { await processAddMember(interaction); }
        catch (e) { console.error("[Tickets] Add error:", e); safeReply(interaction, "❌ خطأ في الإضافة."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_close") {
        try { await showCloseModal(interaction); }
        catch (e) { console.error("[Tickets] Close modal error:", e); }
        return true;
    }
    if (interaction.isModalSubmit() && interaction.customId === "ticket_close_modal") {
        try { await processClose(interaction); }
        catch (e) { console.error("[Tickets] Close error:", e); safeReply(interaction, "❌ خطأ في الإغلاق."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_copy") {
        try { await copyTicket(interaction); }
        catch (e) { console.error("[Tickets] Copy error:", e); safeReply(interaction, "❌ خطأ في النسخ."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_reopen") {
        try { await reopenTicket(interaction); }
        catch (e) { console.error("[Tickets] Reopen error:", e); safeReply(interaction, "❌ خطأ في إعادة الفتح."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_delete") {
        try { await deleteTicket(interaction); }
        catch (e) { console.error("[Tickets] Delete error:", e); safeReply(interaction, "❌ خطأ في الحذف."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId.startsWith("ticket_rate:")) {
        try { await processRating(interaction); }
        catch (e) { console.error("[Tickets] Rating error:", e); safeReply(interaction, "❌ خطأ في التقييم."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_hide_identity") {
        try { await hideIdentity(interaction); }
        catch (e) { console.error("[Tickets] Hide error:", e); safeReply(interaction, "❌ خطأ."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_publish") {
        try { await publishSuggestion(interaction); }
        catch (e) { console.error("[Tickets] Publish error:", e); safeReply(interaction, "❌ خطأ في النشر."); }
        return true;
    }
    if (interaction.isButton() && interaction.customId === "ticket_grant_female") {
        try { await grantFemale(interaction); }
        catch (e) { console.error("[Tickets] Grant female error:", e); safeReply(interaction, "❌ خطأ."); }
        return true;
    }
    return false;
}

async function safeReply(interaction, msg) {
    try {
        const payload = { content: msg, flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
        else await interaction.reply(payload).catch(() => {});
    } catch {}
}

async function handleMessage(message) {
    if (!message.guild || message.author.bot) return false;
    const rec = getRecord(message.channel.id);
    if (!rec || rec.closedAt || rec.deletedAt) return false;
    if (message.author.id === rec.ownerId) resetIdle(message.client, message.channel.id);
    return false;
}

function getPublicTicketInfo(guildId) {
    if (guildId !== CONFIG.GUILD_ID) {
        return null;
    }

    return {
        guildId: CONFIG.GUILD_ID,
        panelChannelId: CONFIG.TICKET_PANEL_CHANNEL_ID,
        categoryId: CONFIG.TICKET_CATEGORY_ID,
        ticketTypes: [
            {
                id: "support",
                label: "الدعم الفني"
            },
            {
                id: "report",
                label: "البلاغات والشكاوى"
            },
            {
                id: "verification",
                label: "التوثيق"
            },
            {
                id: "suggestions",
                label: "الاقتراحات"
            }
        ],
        openingSteps: [
            "اذهب إلى قناة لوحة التذاكر.",
            "اختر نوع التذكرة المناسب من الأزرار.",
            "أكمل النموذج وأرسل طلبك."
        ]
    };
}

module.exports = {
    commands: [command],
    handleInteraction,
    handleMessage,
    resumeIdleOnStartup,
    getPublicTicketInfo
};