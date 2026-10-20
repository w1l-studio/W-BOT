
function normalize(text = "") {
    return String(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function has(text, words) {
    return words.some(word => text.includes(normalize(word)));
}

const gamingEntities = [
    "game", "games", "gaming", "video game", "video games",
    "playstation", "ps5", "ps4", "xbox", "nintendo", "switch 2",
    "steam", "pc gamer", "epic games", "fortnite", "minecraft",
    "pubg", "gta", "grand theft auto", "call of duty", "warzone",
    "ea sports", "ea fc", "fifa", "battlefield", "apex legends",
    "rockstar games", "ubisoft", "capcom", "square enix",
    "riot games", "valorant", "overwatch", "roblox", "genshin impact",
    "fromsoftware", "bandai namco", "konami", "bethesda",
    "activision", "blizzard", "take-two", "take two interactive",
    "nvidia", "amd", "valve", "gaming studio", "game studio",
    "video game developer", "gaming industry"
];

const blockedTopics = [
    "movie", "movies", "film", "films", "box office",
    "actor", "actress", "tv series", "episode", "netflix",
    "album", "singer", "concert", "celebrity", "anime", "manga",
    "iphone", "smartphone", "cryptocurrency", "stock market",
    "politics", "election"
];

const categories = [
    {
        type: "free",
        emoji: "🎁",
        labelAr: "ألعاب مجانية",
        labelEn: "FREE GAMES",
        color: 0x2ECC71,
        keywords: [
            "free game", "free games", "free to claim",
            "free download", "giveaway", "free this week",
            "free on epic games", "free on steam",
            "play for free", "free weekend",
            "ألعاب مجانية", "لعبة مجانية"
        ]
    },
    {
        type: "update",
        emoji: "🔧",
        labelAr: "تحديثات الألعاب",
        labelEn: "GAME UPDATES",
        color: 0x3498DB,
        keywords: [
            "update", "patch notes", "hotfix", "patch",
            "season update", "new season", "balance update",
            "maintenance", "version update", "content update",
            "تحديث", "تحديثات"
        ]
    },
    {
        type: "release",
        emoji: "🚀",
        labelAr: "إصدارات وإعلانات",
        labelEn: "RELEASES & ANNOUNCEMENTS",
        color: 0x9B59B6,
        keywords: [
            "release date", "launch date", "launches",
            "launching", "now available", "available now",
            "announced", "announcement", "revealed",
            "official reveal", "new trailer", "gameplay trailer",
            "pre-order", "preorder", "early access",
            "إطلاق", "موعد الإصدار", "إعلان رسمي"
        ]
    },
    {
        type: "company",
        emoji: "🏢",
        labelAr: "أخبار الشركات",
        labelEn: "GAMING INDUSTRY",
        color: 0xE67E22,
        keywords: [
            "acquisition", "acquires", "merger", "layoffs",
            "studio closure", "shuts down", "restructuring",
            "revenue", "earnings", "investors", "ceo",
            "publishing deal", "developer studio",
            "استحواذ", "تسريح موظفين", "شركة ألعاب"
        ]
    }
];

function classifyNews(article) {
    const title = normalize(article.title || "");
    const description = normalize(
        article.contentSnippet ||
        article.description ||
        article.content ||
        ""
    );
    const text = `${title} ${description}`;

    // لا نرسل الأخبار التي لا يظهر فيها سياق ألعاب واضح
    const isGaming = has(text, gamingEntities);

    if (!isGaming) return null;

    if (has(title, blockedTopics)) return null;

    if (has(text, ["leak", "leaked", "datamined", "تسريب", "تسريبات"])) {
        return {
            type: "leak",
            emoji: "🔍",
            labelAr: "تسريبات",
            labelEn: "LEAKS",
            color: 0x5865F2
        };
    }

    if (has(text, ["rumor", "rumour", "reportedly", "allegedly", "إشاعة", "إشاعات"])) {
        return {
            type: "rumor",
            emoji: "🟡",
            labelAr: "إشاعات وتقارير",
            labelEn: "RUMORS & REPORTS",
            color: 0xF1C40F
        };
    }

    for (const category of categories) {
        if (has(title, category.keywords)) {
            return category;
        }
    }

    // نستخدم الوصف فقط عند غياب التصنيف من العنوان
    for (const category of categories) {
        if (has(description, category.keywords)) {
            return category;
        }
    }

    return {
        type: "gaming",
        emoji: "🎮",
        labelAr: "أخبار الألعاب",
        labelEn: "GAMING NEWS",
        color: 0x2B2D42
    };
}

function detectPlatforms(article) {
    const text = normalize(
        `${article.title || ""} ${article.contentSnippet || ""} ${article.description || ""}`
    );

    const platforms = [];

    const checks = [
        ["playstation", ["playstation", "ps5", "ps4", "ps5 pro"]],
        ["xbox", ["xbox", "game pass"]],
        ["pc", ["pc gaming", "pc gamer", "steam", "windows pc"]],
        ["nintendo", ["nintendo", "switch 2", "nintendo switch"]],
        ["mobile", ["mobile game", "ios game", "android game", "pubg mobile"]]
    ];

    for (const [name, keywords] of checks) {
        if (has(text, keywords)) platforms.push(name);
    }

    const labels = {
        playstation: "🎮 PlayStation",
        xbox: "🟩 Xbox",
        pc: "🖥️ PC",
        nintendo: "🔴 Nintendo",
        mobile: "📱 Mobile"
    };

    return platforms.map(name => labels[name]);
}

module.exports = {
    classifyNews,
    detectPlatforms
};
