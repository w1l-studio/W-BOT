const fs = require("fs");
const path = require("path");

const CHARACTERS_FILE =
    path.join(__dirname, "characters.json");

const API_URL =
    "https://graphql.anilist.co";

const BACKUP_FILE =
    path.join(
        __dirname,
        `characters.backup-${Date.now()}.json`
    );

// AniList API مجاني ومتاح بدون API key.
// الطلبات GraphQL تستخدم POST حسب توثيق AniList.
const REQUEST_DELAY_MS = 700;
const RETRIES = 4;

// ==========================================
// أدوات عامة
// ==========================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(text) {
    return String(text ?? "")
        .toLowerCase()
        .trim()
        .replace(/[\s_\-'.،,؟?!:؛]/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي");
}

function getSearchNames(character) {
    const names = [];

    const add = value => {
        if (!value) {
            return;
        }

        const text = String(value).trim();

        if (text && !names.includes(text)) {
            names.push(text);
        }
    };

    // الأفضلية للاسم الإنجليزي الرسمي.
    add(character.answer);
    add(character.name);

    for (const variant of character.answer_variants || []) {
        add(variant);
    }

    return names;
}

function getResultNames(result) {
    const names = [];
    const name = result?.name || {};

    const add = value => {
        if (value) {
            names.push(String(value));
        }
    };

    add(name.full);
    add(name.userPreferred);
    add(name.native);

    for (const alternative of name.alternative || []) {
        add(alternative);
    }

    return names;
}

function exactMatch(result, character) {
    if (!result) {
        return false;
    }

    const targetNames = new Set(
        getSearchNames(character)
            .map(normalize)
            .filter(Boolean)
    );

    const resultNames =
        getResultNames(result)
            .map(normalize)
            .filter(Boolean);

    return resultNames.some(name =>
        targetNames.has(name)
    );
}

function imageFromResult(result) {
    return (
        result?.image?.large ||
        result?.image?.medium ||
        null
    );
}

// ==========================================
// استدعاء AniList GraphQL
// ==========================================

const CHARACTER_QUERY = `
query ($search: String!) {
    Page(page: 1, perPage: 10) {
        characters(search: $search) {
            id
            name {
                first
                middle
                last
                full
                native
                alternative
                userPreferred
            }
            image {
                large
                medium
            }
            siteUrl
        }
    }
}
`;

async function requestAniList(search) {
    let lastError = null;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                body: JSON.stringify({
                    query: CHARACTER_QUERY,
                    variables: {
                        search
                    }
                })
            });

            const text = await response.text();

            let data;

            try {
                data = JSON.parse(text);
            } catch {
                throw new Error(
                    `استجابة غير صالحة من AniList (HTTP ${response.status})`
                );
            }

            if (!response.ok) {
                const message =
                    data?.errors?.[0]?.message ||
                    `HTTP ${response.status}`;

                throw new Error(message);
            }

            if (Array.isArray(data?.errors) && data.errors.length) {
                throw new Error(
                    data.errors[0]?.message ||
                    "AniList GraphQL Error"
                );
            }

            return data?.data?.Page?.characters || [];
        } catch (error) {
            lastError = error;

            if (attempt === RETRIES) {
                break;
            }

            const wait = 1500 * attempt;

            console.log(
                `⚠️ AniList فشل، إعادة المحاولة بعد ${Math.ceil(wait / 1000)} ثانية...`
            );

            await sleep(wait);
        }
    }

    throw lastError || new Error("AniList request failed");
}

// ==========================================
// البحث عن الصورة الصحيحة
// ==========================================

async function findCharacterImage(character) {
    const searchNames = getSearchNames(character);

    for (const searchName of searchNames) {
        const results = await requestAniList(searchName);

        // لا نأخذ أول نتيجة أبدًا.
        // يجب أن يكون الاسم مطابقًا لأحد الأسماء المعروفة للشخصية.
        const matched = results.find(result =>
            exactMatch(result, character)
        );

        if (matched) {
            const image = imageFromResult(matched);

            if (image) {
                return {
                    image,
                    matchedName:
                        matched?.name?.full ||
                        matched?.name?.userPreferred ||
                        searchName,
                    id: matched.id,
                    url: matched.siteUrl || null
                };
            }
        }

        await sleep(REQUEST_DELAY_MS);
    }

    return null;
}

// ==========================================
// تحديد الشخصيات المطلوب فحصها
// ==========================================

function getArguments() {
    const args = process.argv.slice(2);

    const testIndex = args.indexOf("--test");

    if (testIndex !== -1) {
        const name = args[testIndex + 1];

        if (!name) {
            throw new Error(
                `استخدم: node update-images.js --test "Naruto Uzumaki"`
            );
        }

        return {
            mode: "test",
            name
        };
    }

    const limitIndex = args.indexOf("--limit");

    if (limitIndex !== -1) {
        const value = Number(args[limitIndex + 1]);

        if (!Number.isInteger(value) || value <= 0) {
            throw new Error(
                `قيمة --limit غير صحيحة.`
            );
        }

        return {
            mode: "limit",
            limit: value
        };
    }

    return {
        mode: "all"
    };
}

function selectCharacters(characters, options) {
    if (options.mode === "test") {
        const target = normalize(options.name);

        return characters
            .map((character, index) => ({ character, index }))
            .filter(({ character }) =>
                getSearchNames(character)
                    .some(name => normalize(name) === target)
            );
    }

    if (options.mode === "limit") {
        return characters
            .slice(0, options.limit)
            .map((character, index) => ({ character, index }));
    }

    return characters.map((character, index) => ({
        character,
        index
    }));
}

// ==========================================
// التشغيل
// ==========================================

async function main() {
    if (!fs.existsSync(CHARACTERS_FILE)) {
        console.error(
            `❌ لم أجد الملف: ${CHARACTERS_FILE}`
        );
        process.exit(1);
    }

    let characters;

    try {
        characters = JSON.parse(
            fs.readFileSync(
                CHARACTERS_FILE,
                "utf8"
            )
        );
    } catch (error) {
        console.error(
            "❌ characters.json غير صالح:",
            error.message
        );
        process.exit(1);
    }

    if (!Array.isArray(characters)) {
        console.error(
            "❌ characters.json يجب أن يكون Array."
        );
        process.exit(1);
    }

    const options = getArguments();
    const selected = selectCharacters(characters, options);

    if (!selected.length) {
        console.error(
            "❌ لم أجد الشخصية المطلوبة.",
        );
        process.exit(1);
    }

    // النسخة الاحتياطية قبل أول تعديل.
    fs.copyFileSync(
        CHARACTERS_FILE,
        BACKUP_FILE
    );

    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log(
        "🖼️ Trivia BOT | IMAGE UPDATER"
    );
    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log(
        `📚 عدد الشخصيات في الملف: ${characters.length}`
    );
    console.log(
        `🔎 المطلوب فحصه الآن: ${selected.length}`
    );
    console.log(
        "🌐 المصدر: AniList Character API"
    );
    console.log(
        "🚫 لا نستخدم TMDB /search/person ولا صور ممثلين."
    );
    console.log(
        `💾 النسخة الاحتياطية: ${path.basename(BACKUP_FILE)}`
    );
    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    let found = 0;
    let missing = 0;
    let failed = 0;

    for (let i = 0; i < selected.length; i++) {
        const { character, index } = selected[i];
        const displayName =
            character.name ||
            character.answer ||
            `#${index + 1}`;

        process.stdout.write(
            `[${i + 1}/${selected.length}] ${displayName} ... `
        );

        try {
            const result = await findCharacterImage(character);

            if (result) {
                // نحفظ صورة الشخصية نفسها.
                character.image = result.image;
                character.image_source = "AniList";
                character.image_anilist_id = result.id;
                character.image_matched_name = result.matchedName;
                character.image_source_url = result.url;
                character.image_status = "found";

                found++;

                console.log(
                    `✅ ${result.matchedName}`
                );
            } else {
                // لا نترك صورة قديمة يمكن أن تكون خاطئة.
                character.image = null;
                character.image_source = null;
                character.image_anilist_id = null;
                character.image_matched_name = null;
                character.image_source_url = null;
                character.image_status = "not_found";

                missing++;

                console.log(
                    "❌ لا توجد مطابقة موثوقة"
                );
            }
        } catch (error) {
            failed++;

            console.log(
                `⚠️ خطأ: ${error.message}`
            );
        }

        // حفظ فوري في وضع الاختبار، وكل 10 شخصيات في الفحص الكامل.
        if (
            options.mode === "test" ||
            (i + 1) % 10 === 0 ||
            i === selected.length - 1
        ) {
            fs.writeFileSync(
                CHARACTERS_FILE,
                JSON.stringify(
                    characters,
                    null,
                    2
                ),
                "utf8"
            );

            console.log(
                `💾 تم حفظ characters.json عند ${i + 1}/${selected.length}`
            );
        }

        if (i < selected.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    fs.writeFileSync(
        CHARACTERS_FILE,
        JSON.stringify(
            characters,
            null,
            2
        ),
        "utf8"
    );

    console.log("");
    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log(
        "✅ انتهى تحديث الصور"
    );
    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
    console.log(`🟢 صور موجودة: ${found}`);
    console.log(`🔴 صور غير موجودة: ${missing}`);
    console.log(`🟡 أخطاء أثناء الفحص: ${failed}`);
    console.log(
        `📦 الملف المحدث: ${path.basename(CHARACTERS_FILE)}`
    );
    console.log(
        `💾 النسخة الاحتياطية: ${path.basename(BACKUP_FILE)}`
    );
    console.log(
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );
}

main().catch(error => {
    console.error(
        "❌ خطأ غير متوقع:",
        error.message
    );
    process.exit(1);
});
