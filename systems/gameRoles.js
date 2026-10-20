const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require("discord.js");

// ======================================================
// GAME ROLE IDS
// ======================================================

const GAME_ROLES = {
    gamer: "1553227654105276467",
    rocket_league: "1552480030158753872",
    ea_fc: "1552479839938678794",
    fortnite: "1552479701656666132",
    call_of_duty: "1552479662574411896",
    counter_strike: "1552479488439488542",
    over_watch: "1552479369623244880",
    pubg_battlegrounds: "1552478888658214993",
    free_fire: "1552478838707978290",
    apex_legends: "1552478569115156600",
    genshin_impact: "1552478467126337678",
    brawl_stars: "1552478427380973630",
    hay_day: "1552478379943534622",
    clash_of_clans: "1552478339552387223",
    clash_royale: "1552478297449828473",
    valorant: "1552478218618142740",
    roblox: "1552478171947991193",
    minecraft: "1552478085234819184",
    others: "1553220654327799839",
};

// ======================================================
// GAME OPTIONS
// ======================================================

const GAME_OPTIONS = [
    { label: "Gamer", value: "gamer", emoji: "🎮" },
    { label: "Rocket League", value: "rocket_league", emoji: "🚗" },
    { label: "EA FC", value: "ea_fc", emoji: "⚽" },
    { label: "Fortnite", value: "fortnite", emoji: "🔫" },
    { label: "Call Of Duty", value: "call_of_duty", emoji: "💀" },
    { label: "Counter Strike", value: "counter_strike", emoji: "🔫" },
    { label: "Over Watch", value: "over_watch", emoji: "🦸" },
    { label: "PUBG Battlegrounds", value: "pubg_battlegrounds", emoji: "🔫" },
    { label: "Free Fire", value: "free_fire", emoji: "🔥" },
    { label: "Apex Legends", value: "apex_legends", emoji: "🎯" },
    { label: "Genshin Impact", value: "genshin_impact", emoji: "✨" },
    { label: "Brawl Stars", value: "brawl_stars", emoji: "⭐" },
    { label: "Hay Day", value: "hay_day", emoji: "🌾" },
    { label: "Clash Of Clans", value: "clash_of_clans", emoji: "🏰" },
    { label: "Clash Royale", value: "clash_royale", emoji: "👑" },
    { label: "Valorant", value: "valorant", emoji: "🎯" },
    { label: "Roblox", value: "roblox", emoji: "🧱" },
    { label: "Minecraft", value: "minecraft", emoji: "⛏️" },
    { label: "Others", value: "others", emoji: "⚪" },
];

// ======================================================
// EMBED
// ======================================================

const EMBED_DESCRIPTION = [
    "**اختار الرولات الخاصة بالألعاب البتلعبها، والرول ح يجيك تلقائي.**",
    "",
    "> ممكن تختار أكتر من لعبة.",
    "> وممكن تعدّل اختياراتك في أي وقت.",
    "",
    "**🎯 الألعاب المتوفرة:**",
    "",
    "🎮 `Gamer`",
    "🚗 `Rocket League`",
    "⚽ `EA FC`",
    "🔫 `Fortnite`",
    "💀 `Call Of Duty`",
    "🔫 `Counter Strike`",
    "🦸 `Over Watch`",
    "🔫 `PUBG Battlegrounds`",
    "🔥 `Free Fire`",
    "🎯 `Apex Legends`",
    "✨ `Genshin Impact`",
    "⭐ `Brawl Stars`",
    "🌾 `Hay Day`",
    "🏰 `Clash Of Clans`",
    "👑 `Clash Royale`",
    "🎯 `Valorant`",
    "🧱 `Roblox`",
    "⛏️ `Minecraft`",
    "⚪ `Others`",
    "",
    "> 💡 **ما لقيت لعبتك في القائمة؟**",
    "> ما مشكلة، اختار **`Others`** عشان تحدد إنك بتلعب ألعاب تانية غير الموجودة فوق. 🎮",
    "",
    "**اختار الألعاب العاجباك من تحت 👇**",
].join("\n");

// ======================================================
// BUILD PANEL
// ======================================================

function buildGameRolesPanel() {
    const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("🎮・اختار الألعاب البتحبها")
        .setDescription(EMBED_DESCRIPTION)
        .setFooter({
            text: "Trivia BOT • Game Roles",
        });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("game_roles_select")
        .setPlaceholder("🎮 اختار الألعاب البتلعبها")
        .setMinValues(1)
        .setMaxValues(GAME_OPTIONS.length)
        .addOptions(GAME_OPTIONS);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return {
        embeds: [embed],
        components: [row],
    };
}

// ======================================================
// HANDLE SELECTION
// ======================================================

async function handleGameRoles(interaction) {
    if (
        !interaction.isStringSelectMenu() ||
        interaction.customId !== "game_roles_select"
    ) {
        return false;
    }

    try {
        // نرد فورًا حتى ما يظهر "This interaction failed"
        await interaction.deferReply({
            ephemeral: true,
        });

        const guild = interaction.guild;

        if (!guild) {
            await interaction.editReply({
                content: "❌ هذا النظام يعمل داخل السيرفر فقط.",
            });
            return true;
        }

        const member = await guild.members
            .fetch(interaction.user.id)
            .catch(() => null);

        if (!member) {
            await interaction.editReply({
                content: "❌ ما قدرت أحدد عضويتك.",
            });
            return true;
        }

        const botMember =
            guild.members.me ||
            (await guild.members
                .fetch(interaction.client.user.id)
                .catch(() => null));

        if (!botMember) {
            await interaction.editReply({
                content: "❌ ما قدرت أحدد رتبة البوت.",
            });
            return true;
        }

        const selectedValues = [...new Set(interaction.values)];

        if (selectedValues.length === 0) {
            await interaction.editReply({
                content: "❌ اختار لعبة واحدة على الأقل.",
            });
            return true;
        }

        const added = [];
        const alreadyHave = [];
        const failed = [];

        for (const value of selectedValues) {
            const roleId = GAME_ROLES[value];
            const option = GAME_OPTIONS.find(
                (item) => item.value === value
            );

            if (!roleId || !option) {
                continue;
            }

            const role = guild.roles.cache.get(roleId);

            if (!role) {
                failed.push(`${option.label} — الرول غير موجود`);
                continue;
            }

            if (role.managed) {
                failed.push(`${option.label} — الرول مُدار من Discord`);
                continue;
            }

            if (
                role.id === guild.id ||
                botMember.roles.highest.comparePositionTo(role) <= 0
            ) {
                failed.push(
                    `${option.label} — رتبة البوت لازم تكون أعلى`
                );
                continue;
            }

            if (member.roles.cache.has(roleId)) {
                alreadyHave.push(option.label);
                continue;
            }

            try {
                await member.roles.add(
                    role,
                    `Trivia BOT • Game Role • ${interaction.user.tag}`
                );

                added.push(option.label);
            } catch (error) {
                console.error(
                    `[GAME ROLE ERROR] ${option.label} (${roleId})`,
                    error
                );

                failed.push(option.label);
            }
        }

        const result = [
            "🎮 **تم تحديث رولات الألعاب**",
            "",
        ];

        if (added.length) {
            result.push(
                `✅ تمت الإضافة: **${added.join("، ")}**`
            );
        }

        if (alreadyHave.length) {
            result.push(
                `ℹ️ موجودة عندك بالفعل: **${alreadyHave.join("، ")}**`
            );
        }

        if (failed.length) {
            result.push(
                `⚠️ تعذر إضافة: **${failed.join("، ")}**`
            );
        }

        await interaction.editReply({
            content: result.join("\n"),
        });

        return true;
    } catch (error) {
        console.error(
            "[GAME ROLES] Interaction Error:",
            error
        );

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "❌ تعذر تحديث الرولات حاليًا.",
                });
            } else {
                await interaction.reply({
                    content: "❌ تعذر تحديث الرولات حاليًا.",
                    ephemeral: true,
                });
            }
        } catch {}

        return true;
    }
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
    GAME_ROLES,
    GAME_OPTIONS,
    buildGameRolesPanel,
    handleGameRoles,
};
