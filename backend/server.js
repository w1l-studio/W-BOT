require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const {
    Client,
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");

const app = express();
app.use(cors());
app.use(express.json());

// ======================================================
// PATHS & FILES
// ======================================================

const BOT_DIR = path.join(__dirname, "..");
const BOT_CONFIG_FILE = path.join(BOT_DIR, "bot_config.json");
const PROTECTION_FILE = path.join(BOT_DIR, "protection.json");
const WARNINGS_FILE = path.join(BOT_DIR, "warnings.json");
const TICKET_DATA_FILE = path.join(BOT_DIR, "tickets", "ticket_data.json");
const TICKET_SYSTEM_FILE = path.join(BOT_DIR, "tickets", "ticket_system_data.json");

// ======================================================
// DISCORD BOT CLIENT INTEGRATION
// ======================================================

const botClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let botStartTime = Date.now();

botClient.once("ready", () => {
    console.log(`[W BOT Backend] Discord Bot logged in as ${botClient.user.tag}`);
    botStartTime = Date.now();
});

if (process.env.TOKEN) {
    botClient.login(process.env.TOKEN).catch(err => {
        console.error("[W BOT Backend] Failed to login Discord Bot:", err.message);
    });
} else {
    console.warn("[W BOT Backend] WARNING: TOKEN environment variable is missing!");
}

// ======================================================
// HELPER FUNCTIONS FOR JSON DATA
// ======================================================

function readJsonFile(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(fallback, null, 4));
            return fallback;
        }
        const content = fs.readFileSync(filePath, "utf8");
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return fallback;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
    }
}

// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

const JWT_SECRET = process.env.JWT_SECRET || "wbot_secret_key_2026_change_in_env";

function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Authentication token required" });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });
}

// Check user guild permissions
async function checkGuildPermission(req, res, next) {
    const guildId = req.params.guildId;
    const userId = req.user.id;

    if (!guildId) {
        return res.status(400).json({ success: false, error: "Guild ID parameter missing" });
    }

    const guild = botClient.guilds.cache.get(guildId);
    if (!guild) {
        return res.status(444).json({ success: false, error: "Bot is not in this server" });
    }

    // Owner ID check
    if (guild.ownerId === userId) {
        req.guild = guild;
        return next();
    }

    // Fetch user member in guild
    try {
        const member = await guild.members.fetch(userId);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) ||
                        member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (!isAdmin) {
            return res.status(403).json({ success: false, error: "You do not have Administrator permissions in this server" });
        }

        req.guild = guild;
        next();
    } catch (e) {
        // If user is not in the guild or member fetch fails, check Discord API user guilds if access token is available
        if (req.user.accessToken) {
            try {
                const userGuildsRes = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
                    headers: { Authorization: `Bearer ${req.user.accessToken}` }
                });
                const userGuild = userGuildsRes.data.find(g => g.id === guildId);
                if (userGuild && (userGuild.owner || (BigInt(userGuild.permissions) & BigInt(0x8)) !== 0n || (BigInt(userGuild.permissions) & BigInt(0x20)) !== 0n)) {
                    req.guild = guild;
                    return next();
                }
            } catch (err) {
                console.error("User guilds check failed:", err.message);
            }
        }
        return res.status(403).json({ success: false, error: "Access denied. Server permission check failed." });
    }
}

// ======================================================
// DISCORD OAUTH2 ROUTES
// ======================================================

app.get("/auth/discord", (req, res) => {
    const clientId = process.env.CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI || "http://localhost:3000/auth/callback");
    const scope = encodeURIComponent("identify guilds");
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    res.json({ success: true, url });
});

app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send("Authorization code missing");
    }

    try {
        const tokenRes = await axios.post(
            "https://discord.com/api/v10/oauth2/token",
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.REDIRECT_URI || "http://localhost:3000/auth/callback"
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userRes.data;
        const payload = {
            id: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.global_name || discordUser.username,
            avatar: discordUser.avatar,
            discriminator: discordUser.discriminator,
            accessToken
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

        // If requested from web / browser, show landing html or redirect
        res.send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>W BOT • تسجيل الدخول ناجح</title>
                <style>
                    body { background: #0F1015; color: #FFF; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                    .card { background: #1A1C24; padding: 2rem; border-radius: 16px; border: 1px solid #5865F2; max-width: 400px; width: 90%; }
                    h2 { color: #5865F2; margin-top: 0; }
                    code { background: #232631; padding: 0.5rem; border-radius: 8px; display: block; word-break: break-all; margin: 1rem 0; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>✅ تم تسجيل الدخول بنجاح!</h2>
                    <p>مرحبًا ${discordUser.global_name || discordUser.username}</p>
                    <p>عد إلى تطبيق W BOT Dashboard للجوال لإكمال الاستخدام.</p>
                    <code>${token}</code>
                </div>
            </body>
            </html>
        `);
    } catch (e) {
        console.error("OAuth Callback Error:", e.response?.data || e.message);
        res.status(500).send("OAuth authentication failed: " + (e.response?.data?.error_description || e.message));
    }
});

// Mobile OAuth Code Token Exchange Endpoint
app.post("/auth/token", async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ success: false, error: "Authorization code missing" });
    }

    try {
        const tokenRes = await axios.post(
            "https://discord.com/api/v10/oauth2/token",
            new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.REDIRECT_URI || "http://localhost:3000/auth/callback"
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenRes.data.access_token;

        const userRes = await axios.get("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const discordUser = userRes.data;
        const payload = {
            id: discordUser.id,
            username: discordUser.username,
            globalName: discordUser.global_name || discordUser.username,
            avatar: discordUser.avatar,
            discriminator: discordUser.discriminator,
            accessToken
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

        res.json({
            success: true,
            token,
            user: {
                id: discordUser.id,
                username: discordUser.username,
                globalName: discordUser.global_name || discordUser.username,
                avatar: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=256` : "https://cdn.discordapp.com/embed/avatars/0.png"
            }
        });
    } catch (e) {
        console.error("Token Exchange Error:", e.response?.data || e.message);
        res.status(500).json({ success: false, error: e.response?.data?.error_description || e.message });
    }
});

// ======================================================
// API ENDPOINTS
// ======================================================

// GET /api/me
app.get("/api/me", authenticateJWT, async (req, res) => {
    try {
        const avatarUrl = req.user.avatar
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=256`
            : "https://cdn.discordapp.com/embed/avatars/0.png";

        res.json({
            success: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                globalName: req.user.globalName || req.user.username,
                avatar: avatarUrl
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/bot/stats - Bot Global Dashboard Stats
app.get("/api/bot/stats", authenticateJWT, (req, res) => {
    const isOnline = botClient.ws.status === 0;
    const ping = isOnline ? botClient.ws.ping : 0;
    const uptimeSeconds = isOnline ? Math.floor((Date.now() - botStartTime) / 1000) : 0;

    let totalGuilds = botClient.guilds.cache.size;
    let totalMembers = 0;

    botClient.guilds.cache.forEach(g => {
        totalMembers += g.memberCount || 0;
    });

    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const ticketsObj = ticketData.tickets || {};
    const totalTickets = Object.keys(ticketsObj).length;
    let openTickets = 0;
    let closedTickets = 0;

    Object.values(ticketsObj).forEach(t => {
        if (t.closedAt) closedTickets++;
        else openTickets++;
    });

    res.json({
        success: true,
        stats: {
            status: isOnline ? "Online" : "Offline",
            isOnline,
            pingMs: ping,
            uptimeSeconds,
            totalGuilds,
            totalMembers,
            totalTickets,
            openTickets,
            closedTickets
        }
    });
});

// GET /api/guilds - User's manageable guilds
app.get("/api/guilds", authenticateJWT, async (req, res) => {
    try {
        let userGuilds = [];
        if (req.user.accessToken) {
            const response = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
                headers: { Authorization: `Bearer ${req.user.accessToken}` }
            });
            userGuilds = response.data;
        } else {
            // Fallback: search bot guilds where user is present with permissions or owner
            botClient.guilds.cache.forEach(g => {
                if (g.ownerId === req.user.id) {
                    userGuilds.push({
                        id: g.id,
                        name: g.name,
                        icon: g.icon,
                        owner: true,
                        permissions: "8"
                    });
                }
            });
        }

        const manageableGuilds = userGuilds.filter(g => {
            if (g.owner) return true;
            const perms = BigInt(g.permissions || "0");
            const admin = (perms & BigInt(0x8)) !== 0n;
            const manageGuild = (perms & BigInt(0x20)) !== 0n;
            return admin || manageGuild;
        }).map(g => {
            const botInGuild = botClient.guilds.cache.has(g.id);
            const botGuild = botClient.guilds.cache.get(g.id);
            const iconUrl = g.icon
                ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=256`
                : null;

            return {
                id: g.id,
                name: g.name,
                icon: iconUrl,
                botPresent: botInGuild,
                memberCount: botGuild ? botGuild.memberCount : 0
            };
        });

        res.json({ success: true, guilds: manageableGuilds });
    } catch (e) {
        console.error("Get Guilds Error:", e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/guilds/:guildId - Guild details
app.get("/api/guilds/:guildId", authenticateJWT, checkGuildPermission, (req, res) => {
    const guild = req.guild;
    const iconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
        : null;

    res.json({
        success: true,
        guild: {
            id: guild.id,
            name: guild.name,
            icon: iconUrl,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
            textChannelsCount: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size,
            voiceChannelsCount: guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size,
            botPresent: true
        }
    });
});

// GET /api/guilds/:guildId/config - Get Guild Config
app.get("/api/guilds/:guildId/config", authenticateJWT, checkGuildPermission, (req, res) => {
    const allConfig = readJsonFile(BOT_CONFIG_FILE, {});
    const guildConfig = allConfig[req.params.guildId] || {
        prefix: "!",
        logChannelId: null,
        welcomeEnabled: false,
        welcomeChannelId: null,
        ticketsEnabled: true
    };

    res.json({ success: true, config: guildConfig });
});

// PUT /api/guilds/:guildId/config - Update Guild Config
app.put("/api/guilds/:guildId/config", authenticateJWT, checkGuildPermission, (req, res) => {
    const allConfig = readJsonFile(BOT_CONFIG_FILE, {});
    const current = allConfig[req.params.guildId] || {
        prefix: "!",
        logChannelId: null,
        welcomeEnabled: false,
        welcomeChannelId: null,
        ticketsEnabled: true
    };

    const { prefix, logChannelId, welcomeEnabled, welcomeChannelId, ticketsEnabled } = req.body;

    const updated = {
        ...current,
        ...(prefix !== undefined ? { prefix: String(prefix).trim() } : {}),
        ...(logChannelId !== undefined ? { logChannelId } : {}),
        ...(welcomeEnabled !== undefined ? { welcomeEnabled: Boolean(welcomeEnabled) } : {}),
        ...(welcomeChannelId !== undefined ? { welcomeChannelId } : {}),
        ...(ticketsEnabled !== undefined ? { ticketsEnabled: Boolean(ticketsEnabled) } : {})
    };

    allConfig[req.params.guildId] = updated;
    writeJsonFile(BOT_CONFIG_FILE, allConfig);

    res.json({ success: true, config: updated, message: "Server configuration updated successfully" });
});

// GET /api/guilds/:guildId/protection - Get Protection Settings
app.get("/api/guilds/:guildId/protection", authenticateJWT, checkGuildPermission, (req, res) => {
    const allProtection = readJsonFile(PROTECTION_FILE, {});
    const guildProtection = allProtection[req.params.guildId] || {
        enabled: true,
        logChannelId: null,
        whitelist: []
    };

    // Include global security toggles and values
    const responseData = {
        ...guildProtection,
        antiBot: true,
        antiMassBan: true,
        antiMassKick: true,
        antiChannelDelete: true,
        antiChannelCreate: true,
        antiRoleDelete: true,
        antiRoleCreate: true,
        antiWebhook: true,
        antiSpam: true,
        antiMassMention: true,
        antiInvites: true,
        actionLimit: 3,
        actionWindow: 10,
        spamMessageLimit: 6
    };

    res.json({ success: true, protection: responseData });
});

// PUT /api/guilds/:guildId/protection - Update Protection Settings
app.put("/api/guilds/:guildId/protection", authenticateJWT, checkGuildPermission, (req, res) => {
    const allProtection = readJsonFile(PROTECTION_FILE, {});
    const current = allProtection[req.params.guildId] || {
        enabled: true,
        logChannelId: null,
        whitelist: []
    };

    const { enabled, logChannelId, whitelist } = req.body;

    const updated = {
        ...current,
        ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
        ...(logChannelId !== undefined ? { logChannelId } : {}),
        ...(whitelist !== undefined && Array.isArray(whitelist) ? { whitelist } : {})
    };

    allProtection[req.params.guildId] = updated;
    writeJsonFile(PROTECTION_FILE, allProtection);

    res.json({ success: true, protection: updated, message: "Protection settings updated successfully" });
});

// GET /api/guilds/:guildId/channels - Get Guild Channels & Categories
app.get("/api/guilds/:guildId/channels", authenticateJWT, checkGuildPermission, (req, res) => {
    const guild = req.guild;
    const channels = guild.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        typeName: c.type === ChannelType.GuildText ? "Text" : c.type === ChannelType.GuildCategory ? "Category" : c.type === ChannelType.GuildVoice ? "Voice" : "Other"
    }));

    res.json({ success: true, channels });
});

// GET /api/guilds/:guildId/tickets - Get Tickets List
app.get("/api/guilds/:guildId/tickets", authenticateJWT, checkGuildPermission, (req, res) => {
    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const allTickets = ticketData.tickets || {};

    const guildTickets = Object.values(allTickets).filter(t => t.guildId === req.params.guildId || !t.guildId);

    const open = [];
    const closed = [];

    guildTickets.forEach(t => {
        const ticketNumberStr = String(t.ticketNumber || 0).padStart(4, "0");
        const formatted = {
            channelId: t.channelId,
            ticketNumber: ticketNumberStr,
            type: t.type || "support",
            ownerId: t.ownerId,
            createdAt: t.createdAt,
            claimedBy: t.claimedBy,
            claimedAt: t.claimedAt,
            closerId: t.closerId,
            closedAt: t.closedAt,
            closeReason: t.closeReason,
            durationMs: t.durationMs,
            rating: t.rating,
            ratedAt: t.ratedAt,
            deletedBy: t.deletedBy,
            deletedAt: t.deletedAt
        };

        if (t.closedAt) closed.push(formatted);
        else open.push(formatted);
    });

    res.json({
        success: true,
        tickets: {
            open,
            closed,
            totalCount: guildTickets.length,
            openCount: open.length,
            closedCount: closed.length
        }
    });
});

// GET /api/guilds/:guildId/tickets/:channelId - Ticket details & messages
app.get("/api/guilds/:guildId/tickets/:channelId", authenticateJWT, checkGuildPermission, async (req, res) => {
    const { channelId } = req.params;
    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const record = ticketData.tickets[channelId];

    if (!record) {
        return res.status(404).json({ success: false, error: "Ticket record not found" });
    }

    const guild = req.guild;
    const channel = guild.channels.cache.get(channelId);

    let messages = [];
    if (channel && channel.isTextBased()) {
        try {
            const fetched = await channel.messages.fetch({ limit: 50 });
            messages = fetched.map(m => ({
                id: m.id,
                authorId: m.author.id,
                authorName: m.author.username,
                authorAvatar: m.author.displayAvatarURL({ size: 128 }),
                content: m.content,
                timestamp: m.createdTimestamp,
                attachments: m.attachments.map(a => a.url)
            })).reverse();
        } catch (err) {
            console.error("Fetch ticket messages error:", err.message);
        }
    }

    res.json({
        success: true,
        ticket: {
            ...record,
            ticketNumber: String(record.ticketNumber || 0).padStart(4, "0"),
            channelName: channel ? channel.name : `ticket-${record.ticketNumber}`,
            channelExists: Boolean(channel),
            messages
        }
    });
});

// POST /api/guilds/:guildId/tickets/:channelId/close - Close ticket from mobile app
app.post("/api/guilds/:guildId/tickets/:channelId/close", authenticateJWT, checkGuildPermission, async (req, res) => {
    const { channelId } = req.params;
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({ success: false, error: "Close reason is required" });
    }

    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const record = ticketData.tickets[channelId];

    if (!record) {
        return res.status(404).json({ success: false, error: "Ticket record not found" });
    }

    const guild = req.guild;
    const channel = guild.channels.cache.get(channelId);

    const now = Date.now();
    record.closerId = req.user.id;
    record.closedAt = now;
    record.closeReason = reason;
    record.durationMs = record.claimedAt ? Math.max(0, now - record.claimedAt) : null;

    writeJsonFile(TICKET_DATA_FILE, ticketData);

    if (channel) {
        try {
            await channel.permissionOverwrites.edit(record.ownerId, {
                ViewChannel: true,
                SendMessages: false,
                ReadMessageHistory: true
            });

            if (!channel.name.startsWith("closed-")) {
                await channel.setName(`closed-${channel.name}`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔒 تم إغلاق التذكرة #${String(record.ticketNumber).padStart(4, "0")}`)
                .setDescription(`تم إغلاق التذكرة بواسطة <@${req.user.id}> من تطبيق Dashboard الجوال.\n\n📝 **سبب الإغلاق:**\n${reason}`)
                .setColor(0xED4245)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error("Error applying close on Discord channel:", err.message);
        }
    }

    res.json({ success: true, message: "Ticket closed successfully", ticket: record });
});

// POST /api/guilds/:guildId/tickets/:channelId/reopen - Reopen ticket
app.post("/api/guilds/:guildId/tickets/:channelId/reopen", authenticateJWT, checkGuildPermission, async (req, res) => {
    const { channelId } = req.params;
    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const record = ticketData.tickets[channelId];

    if (!record) {
        return res.status(404).json({ success: false, error: "Ticket record not found" });
    }

    const guild = req.guild;
    const channel = guild.channels.cache.get(channelId);

    record.closedAt = null;
    record.closerId = null;
    record.closeReason = null;
    record.durationMs = null;
    record.claimedAt = null;
    record.claimedBy = null;

    writeJsonFile(TICKET_DATA_FILE, ticketData);

    if (channel) {
        try {
            await channel.permissionOverwrites.edit(record.ownerId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            if (channel.name.startsWith("closed-")) {
                await channel.setName(channel.name.replace("closed-", ""));
            }

            const embed = new EmbedBuilder()
                .setTitle(`🔓 تم إعادة فتح التذكرة #${String(record.ticketNumber).padStart(4, "0")}`)
                .setDescription(`تمت إعادة فتح التذكرة بواسطة <@${req.user.id}> من تطبيق Dashboard الجوال.`)
                .setColor(0x57F287)
                .setTimestamp();

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error("Error applying reopen on Discord channel:", err.message);
        }
    }

    res.json({ success: true, message: "Ticket reopened successfully", ticket: record });
});

// POST /api/guilds/:guildId/tickets/:channelId/delete - Delete ticket
app.post("/api/guilds/:guildId/tickets/:channelId/delete", authenticateJWT, checkGuildPermission, async (req, res) => {
    const { channelId } = req.params;
    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const record = ticketData.tickets[channelId];

    if (!record) {
        return res.status(404).json({ success: false, error: "Ticket record not found" });
    }

    record.deletedBy = req.user.id;
    record.deletedAt = Date.now();

    writeJsonFile(TICKET_DATA_FILE, ticketData);

    const guild = req.guild;
    const channel = guild.channels.cache.get(channelId);

    if (channel) {
        try {
            await channel.delete("W BOT Dashboard • Ticket Deleted");
        } catch (err) {
            console.error("Error deleting channel on Discord:", err.message);
        }
    }

    res.json({ success: true, message: "Ticket deleted successfully" });
});

// GET /api/guilds/:guildId/commands - Get Bot Commands
app.get("/api/guilds/:guildId/commands", authenticateJWT, checkGuildPermission, (req, res) => {
    const commandList = [
        { name: "ping", description: "معرفة سرعة استجابة البوت", category: "عامة", permission: "جميع الأعضاء" },
        { name: "help", description: "عرض جميع أوامر البوت", category: "عامة", permission: "جميع الأعضاء" },
        { name: "userinfo", description: "عرض معلومات عضو في السيرفر", category: "عامة", permission: "جميع الأعضاء" },
        { name: "serverinfo", description: "عرض معلومات السيرفر", category: "عامة", permission: "جميع الأعضاء" },
        { name: "avatar", description: "عرض الصورة الشخصية بجودة عالية", category: "عامة", permission: "جميع الأعضاء" },
        { name: "play", description: "اختيار لعبة للعب (المافيا)", category: "ألعاب", permission: "جميع الأعضاء" },
        { name: "ban", description: "حظر عضو من السيرفر", category: "إدارة", permission: "Ban Members / الإدارة" },
        { name: "unban", description: "فك حظر عضو من السيرفر", category: "إدارة", permission: "Ban Members / الإدارة" },
        { name: "kick", description: "طرد عضو من السيرفر", category: "إدارة", permission: "Kick Members / الإدارة" },
        { name: "timeout", description: "إعطاء عضو تايم أوت (كتم)", category: "إدارة", permission: "Moderate Members / الإدارة" },
        { name: "untimeout", description: "إلغاء تايم أوت عن عضو", category: "إدارة", permission: "Moderate Members / الإدارة" },
        { name: "warn", description: "تحذير عضو وإضافة عقوبات تلقائية", category: "إدارة", permission: "Moderate Members / الإدارة" },
        { name: "unwarn", description: "إزالة تحذير من عضو", category: "إدارة", permission: "Moderate Members / الإدارة" },
        { name: "clear", description: "حذف رسائل من الروم (1-100)", category: "إدارة", permission: "Manage Messages" },
        { name: "protection", description: "عرض حالة أنظمة الحماية", category: "حماية", permission: "Administrator" },
        { name: "lockdown", description: "تفعيل الإغلاق الأمني للسيرفر", category: "حماية", permission: "Administrator" },
        { name: "unlockdown", description: "إلغاء الإغلاق الأمني للسيرفر", category: "حماية", permission: "Administrator" },
        { name: "setsecuritylog", description: "تحديد روم سجلات الحماية", category: "حماية", permission: "Administrator" },
        { name: "poll", description: "إنشاء استطلاع رأي", category: "عامة / إدارة", permission: "Administrator" },
        { name: "embed", description: "نشر رسالة Embed احترافية باسم البوت", category: "عامة / إدارة", permission: "Administrator" },
        { name: "role", description: "إضافة أو سحب رتبة من عضو", category: "إدارة", permission: "Administrator" },
        { name: "say", description: "إرسال رسالة باسم البوت", category: "إدارة", permission: "Administrator" },
        { name: "prefix", description: "تغيير بادئة الأوامر النصية", category: "إعدادات", permission: "Administrator" },
        { name: "setup", description: "إعداد أنظمة البوت واللوج والترحيب", category: "إعدادات", permission: "Administrator" },
        { name: "ticket", description: "إرسال لوحة التذاكر التفاعلية", category: "تذاكر", permission: "Administrator" }
    ];

    res.json({ success: true, commands: commandList });
});

// GET /api/guilds/:guildId/stats - Guild Statistics
app.get("/api/guilds/:guildId/stats", authenticateJWT, checkGuildPermission, (req, res) => {
    const guild = req.guild;

    const warnings = readJsonFile(WARNINGS_FILE, {})[guild.id] || {};
    const totalWarnings = Object.values(warnings).reduce((a, b) => a + Number(b || 0), 0);

    const ticketData = readJsonFile(TICKET_DATA_FILE, { tickets: {} });
    const guildTickets = Object.values(ticketData.tickets || {}).filter(t => t.guildId === guild.id || !t.guildId);

    const openTicketsCount = guildTickets.filter(t => !t.closedAt).length;
    const closedTicketsCount = guildTickets.filter(t => t.closedAt).length;

    res.json({
        success: true,
        stats: {
            memberCount: guild.memberCount,
            textChannels: guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size,
            voiceChannels: guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size,
            categoriesCount: guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size,
            totalTickets: guildTickets.length,
            openTickets: openTicketsCount,
            closedTickets: closedTicketsCount,
            totalWarnings
        }
    });
});

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 W BOT Secure Backend API running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`==================================================`);
});
