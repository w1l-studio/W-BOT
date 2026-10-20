const Parser = require("rss-parser");

const sources = require("./sources");

const { classifyNews, detectPlatforms } = require("./classifier");

const { formatNews } = require("./formatter");

const {
  loadSeen,
  saveSeen,
  getArticleId,
  getArticleKeys,
  hasSeenArticle,
  markArticleSeen,
  enqueueFailedArticle,
  dequeueArticles,
  removeFromQueue,
} = require("./storage");

// ============================================
// إعدادات نظام الأخبار
// ============================================

const NEWS_CHANNEL_ID = "1555683844953477160";

const CHECK_INTERVAL = 10 * 60 * 1000;

const MAX_RETRIES = 2;
const RETRY_DELAY = 3000;
const SOURCE_TIMEOUT = 15000;
const MESSAGE_DELAY = 1500;

// ============================================
// إعداد قارئ RSS
// ============================================

const parser = new Parser({
  timeout: SOURCE_TIMEOUT,

  headers: {
    "User-Agent": "Trivia-BOT-News/1.0",
  },
});

// ============================================
// حالة النظام
// ============================================

let seen = loadSeen();

let initialized = false;
let checking = false;

const sourceStatus = new Map();

// ============================================
// أدوات مساعدة
// ============================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorType(error) {
  const code = error?.code;

  const networkErrors = [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENETUNREACH",
  ];

  if (networkErrors.includes(code)) {
    return "NETWORK";
  }

  const message = String(error?.message || "").toLowerCase();

  if (message.includes("timeout")) {
    return "TIMEOUT";
  }

  return "RSS";
}

// ============================================
// جلب الأخبار مع إعادة المحاولة
// ============================================

async function fetchSource(source) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      const feed = await parser.parseURL(source.url);

      const articles = (feed.items || []).map((article) => ({
        ...article,
        sourceName: source.name,
        sourceLanguage: source.language,
      }));

      const previousStatus = sourceStatus.get(source.name);

      if (previousStatus === "FAILED") {
        console.log(`[NEWS] ${source.name} is back online.`);
      }

      sourceStatus.set(source.name, "ONLINE");

      console.log(`[NEWS] ${source.name}: ${articles.length} articles`);

      return {
        ok: true,
        articles,
      };
    } catch (error) {
      lastError = error;

      if (attempt <= MAX_RETRIES) {
        console.warn(
          `[NEWS] ${source.name}: retry ` + `${attempt}/${MAX_RETRIES} failed.`
        );

        await sleep(RETRY_DELAY);
      }
    }
  }

  const previousStatus = sourceStatus.get(source.name);
  const errorType = getErrorType(lastError);

  sourceStatus.set(source.name, "FAILED");

  if (previousStatus !== "FAILED") {
    console.error(
      `[NEWS] ${source.name} unavailable ` +
        `(${errorType}): ${lastError?.message || "Unknown error"}`
    );
  }

  return {
    ok: false,
    articles: [],
    error: lastError,
  };
}

// ============================================
// تسجيل بصمات الخبر في الذاكرة
// ============================================

function rememberArticle(article) {
  const id = getArticleId(article);

  if (id) {
    seen.add(id);
  }

  markArticleSeen(seen, article);
}

// ============================================
// تجهيز قاعدة الأخبار عند تشغيل البوت
// ============================================

async function initializeNews() {
  console.log("========================================");
  console.log("Trivia BOT | INITIALIZING NEWS SYSTEM");
  console.log("========================================");

  let added = 0;
  let successfulSources = 0;
  let failedSources = 0;

  for (const source of sources) {
    const result = await fetchSource(source);

    if (!result.ok) {
      failedSources++;
      continue;
    }

    successfulSources++;

    for (const article of result.articles) {
      const id = getArticleId(article);

      if (!id) {
        continue;
      }

      if (!seen.has(id)) {
        added++;
      }

      // حفظ الأخبار الحالية كخط أساس،
      // حتى لا يرسل البوت أرشيف RSS كاملًا عند التشغيل.
      rememberArticle(article);
    }
  }

  saveSeen(seen);

  initialized = true;

  console.log(`[NEWS] Baseline updated. New identifiers recorded: ${added}`);

  console.log(`[NEWS] Sources online: ${successfulSources}/${sources.length}`);

  if (failedSources > 0) {
    console.log(
      `[NEWS] ${failedSources} source(s) unavailable during initialization.`
    );
  }

  console.log("[NEWS] Ready. New articles will be checked periodically.");
}

// ============================================
// مقارنة الأخبار التي وصلت في الفحص نفسه
// ============================================

function hasPendingDuplicate(article, pendingKeys) {
  const keys = getArticleKeys(article);

  return keys.some((key) => pendingKeys.has(key));
}

function rememberPendingKeys(article, pendingKeys) {
  const keys = getArticleKeys(article);

  for (const key of keys) {
    pendingKeys.add(key);
  }
}

// ============================================
// معالجة أخبار من الطابور (إعادة محاولات)
// ============================================

async function processQueuedArticles(client) {
  if (!initialized) {
    return;
  }

  const channel = await client.channels
    .fetch(NEWS_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.log("[QUEUE] News channel not available for queue processing.");
    return;
  }

  const queued = dequeueArticles(24 * 60 * 60 * 1000, 5);

  if (queued.length === 0) {
    console.log("[QUEUE] No articles ready for retry.");
    return;
  }

  console.log(`[QUEUE] Processing ${queued.length} article(s) from queue...`);

  let successCount = 0;
  let stillFailedCount = 0;

  for (const item of queued) {
    const article = item.article;
    const id = getArticleId(article);

    try {
      const classification = classifyNews(article);

      if (!classification) {
        console.log(`[QUEUE] Skipping non-gaming article: ${article.title}`);
        removeFromQueue(id);
        rememberArticle(article);
        saveSeen(seen);
        continue;
      }

      const platforms = detectPlatforms(article);

      console.log(
        `[QUEUE] Retrying article (attempt ${item.attempts}): ${article.title}`
      );

      const embed = await formatNews(article, {
        color: classification.color,
        footerText: `${classification.labelAr} • ${article.sourceName || "News"}`,
        includeTimestamp: true,
        enSummaryMax: 450,
        arSummaryMax: 650,
      });

      if (!embed) {
        // الترجمة فشلت مرة أخرى
        console.log(
          `[QUEUE] Translation still failing. Will retry later.`
        );
        stillFailedCount++;
        continue; // اترك الخبر في الطابور للمحاولة التالية
      }

      // نجح الإرسال
      await channel.send({ embeds: [embed] });

      rememberArticle(article);
      saveSeen(seen);
      removeFromQueue(id);

      successCount++;

      console.log(`[QUEUE] Successfully sent: ${article.title}`);

      await sleep(MESSAGE_DELAY);
    } catch (error) {
      console.error(
        `[QUEUE] Error processing queued article: ${error.message}`
      );
      stillFailedCount++;
      // اترك الخبر في الطابور للمحاولة التالية
    }
  }

  console.log(
    `[QUEUE] Queue processing complete | Sent: ${successCount} | Still failing: ${stillFailedCount}`
  );
}

// ============================================
// فحص الأخبار الجديدة
// ============================================

async function checkNews(client) {
  if (!initialized) {
    return;
  }

  if (checking) {
    console.log("[NEWS] Previous check is still running. Skipping.");

    return;
  }

  checking = true;

  try {
    const channel = await client.channels
      .fetch(NEWS_CHANNEL_ID)
      .catch(() => null);

    if (!channel || !channel.isTextBased()) {
      console.error("[NEWS] News channel not found or not text-based.");

      return;
    }

    console.log("[NEWS] Checking for new articles...");

    const newArticles = [];

    let successfulSources = 0;
    let failedSources = 0;

    // مفاتيح لمنع تكرار الخبر بين المصادر في الفحص نفسه
    const pendingKeys = new Set();

    // ----------------------------------------
    // جلب الأخبار من جميع المصادر
    // ----------------------------------------

    for (const source of sources) {
      const result = await fetchSource(source);

      if (!result.ok) {
        failedSources++;
        continue;
      }

      successfulSources++;

      for (const article of result.articles) {
        const id = getArticleId(article);

        if (!id) {
          continue;
        }

        // فحص المعرّف القديم والمفاتيح الجديدة
        if (seen.has(id) || hasSeenArticle(seen, article)) {
          continue;
        }

        // منع إدراج الخبر نفسه مرتين من مصدرين
        if (hasPendingDuplicate(article, pendingKeys)) {
          console.log(`[NEWS] Duplicate in current batch: ${article.title}`);

          continue;
        }

        rememberPendingKeys(article, pendingKeys);

        newArticles.push({
          article,
          id,
        });
      }
    }

    // ----------------------------------------
    // التحقق من حالة المصادر
    // ----------------------------------------

    if (successfulSources === 0) {
      console.log("[NEWS] Unable to reach any news source.");

      return;
    }

    if (failedSources > 0) {
      console.log(
        `[NEWS] ${failedSources} source(s) unavailable. ` +
          `Continuing with ${successfulSources} source(s).`
      );
    }

    if (newArticles.length === 0) {
      console.log("[NEWS] No new articles.");

      return;
    }

    // ----------------------------------------
    // ترتيب الأخبار من الأحدث إلى الأقدم
    // ----------------------------------------

    newArticles.sort((a, b) => {
      const aDate =
        new Date(a.article.isoDate || a.article.pubDate || 0).getTime() || 0;

      const bDate =
        new Date(b.article.isoDate || b.article.pubDate || 0).getTime() || 0;

      return bDate - aDate;
    });

    console.log(`[NEWS] Found ${newArticles.length} candidate article(s).`);

    let sentCount = 0;
    let ignoredCount = 0;
    let queuedCount = 0;
    let failedCount = 0;

    // ----------------------------------------
    // تصنيف الأخبار وإرسالها
    // ----------------------------------------

    for (const item of newArticles) {
      const article = item.article;
      const id = item.id;

      try {
        // احتياط إضافي قبل معالجة الخبر
        if (seen.has(id) || hasSeenArticle(seen, article)) {
          continue;
        }

        const classification = classifyNews(article);

        // تجاهل الأخبار التي لا تخص الألعاب
        if (!classification) {
          console.log(`[NEWS] Ignored non-gaming article: ${article.title}`);

          rememberArticle(article);
          ignoredCount++;

          continue;
        }

        const platforms = detectPlatforms(article);

        console.log(`[NEWS] Attempting to format article: ${article.title}`);

        const embed = await formatNews(article, {
          color: classification.color,
          footerText: `${classification.labelAr} • ${article.sourceName || "News"}`,
          includeTimestamp: true,
          enSummaryMax: 450,
          arSummaryMax: 650,
        });

        // إذا فشلت الترجمة، ضع الخبر في الطابور
        if (!embed) {
          console.log(
            `[NEWS] Translation failed. Enqueueing for retry: ${article.title}`
          );
          enqueueFailedArticle(article, "translation-failed");
          queuedCount++;
          continue;
        }

        // تسجيل الخبر بعد نجاح الإرسال فقط
        await channel.send({
          embeds: [embed],
        });

        rememberArticle(article);

        saveSeen(seen);

        sentCount++;

        console.log(`[NEWS] Sent: ${article.title}`);

        await sleep(MESSAGE_DELAY);
      } catch (error) {
        failedCount++;

        console.error(
          `[NEWS] Failed to process "${article.title}": ` + `${error.message}`
        );

        // لا نسجل الخبر على أنه أُرسل،
        // حتى يمكن إعادة محاولة معالجته لاحقًا.
      }
    }

    // حفظ التغييرات النهائية
    saveSeen(seen);

    console.log(
      "[NEWS] Check complete | " +
        `Sent: ${sentCount} | ` +
        `Queued: ${queuedCount} | ` +
        `Ignored: ${ignoredCount} | ` +
        `Failed: ${failedCount}`
    );
  } catch (error) {
    console.error(`[NEWS] Check failed: ${error.message}`);
  } finally {
    checking = false;
  }
}

async function sendOneRecentArticle(client) {
  const fs = require("node:fs");
  const path = require("node:path");

  const markerFile = path.join(__dirname, "startup-article-sent.json");

  // لا نكرر خبر البداية في كل إعادة تشغيل
  if (fs.existsSync(markerFile)) {
    console.log("[NEWS] Startup article was already sent.");
    return;
  }

  const channel = await client.channels
    .fetch(NEWS_CHANNEL_ID)
    .catch(() => null);

  if (!channel || !channel.isTextBased()) {
    console.error("[NEWS] News channel unavailable.");
    return;
  }

  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  const twentyFourHours = 24 * 60 * 60 * 1000;
  const candidates = [];

  for (const source of sources) {
    const result = await fetchSource(source);
    if (!result.ok) continue;

    for (const article of result.articles) {
      const date = new Date(article.isoDate || article.pubDate || "").getTime();

      if (!Number.isFinite(date) || date > now) continue;

      const age = now - date;

      if (age <= twentyFourHours) {
        const classification = classifyNews(article);

        if (classification) {
          candidates.push({
            article,
            classification,
            date,
          });
        }
      }
    }
  }

  // فضّل الأخبار المنشورة خلال آخر 6 ساعات
  let recent = candidates.filter((item) => now - item.date <= sixHours);

  // إذا لم نجد، نوسّع البحث إلى 24 ساعة
  if (recent.length === 0) {
    recent = candidates;
  }

  recent.sort((a, b) => b.date - a.date);

  if (recent.length === 0) {
    console.log("[NEWS] No suitable article found in the last 24 hours.");
    return;
  }

  const { article, classification } = recent[0];
  const platforms = detectPlatforms(article);

  const embed = await formatNews(article, {
    color: classification.color,
    footerText: `${classification.labelAr} • ${article.sourceName || "News"}`,
    includeTimestamp: true,
    enSummaryMax: 450,
    arSummaryMax: 650,
  });

  if (!embed) {
    console.log("[NEWS] Startup article failed translation. Skipping.");
    return;
  }

  await channel.send({ embeds: [embed] });

  rememberArticle(article);
  saveSeen(seen);

  fs.writeFileSync(
    markerFile,
    JSON.stringify(
      {
        sent: true,
        articleId: getArticleId(article),
        sentAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log(`[NEWS] Startup article sent: ${article.title}`);
}

// ============================================
// تسجيل نظام الأخبار مع Discord
// ============================================

function registerNews(client) {
  if (client.__wbotNewsRegistered) {
    console.log("[NEWS] Already registered.");

    return;
  }

  client.__wbotNewsRegistered = true;

  console.log("[NEWS] News system registered successfully.");

  initializeNews()
    .then(async () => {
      console.log("[NEWS] News system initialized successfully.");

      await sendOneRecentArticle(client).catch((error) => {
        console.error(`[NEWS] Startup article failed: ${error.message}`);
      });

      // أول فحص بعد مرور فترة الفحص المحددة
      setTimeout(() => {
        checkNews(client).catch((error) => {
          console.error(`[NEWS] Check error: ${error.message}`);
        });

        // معالجة الطابور كل 5 دقائق
        setInterval(() => {
          processQueuedArticles(client).catch((error) => {
            console.error(`[QUEUE] Processing error: ${error.message}`);
          });
        }, 5 * 60 * 1000); // كل 5 دقائق
      }, CHECK_INTERVAL);

      // فحص دوري
      setInterval(() => {
        checkNews(client).catch((error) => {
          console.error(`[NEWS] Check error: ${error.message}`);
        });
      }, CHECK_INTERVAL);
    })
    .catch((error) => {
      console.error(`[NEWS] Initialization failed: ${error.message}`);
    });
}

// ============================================
// تصدير الدوال
// ============================================

module.exports = {
  registerNews,
  checkNews,
  processQueuedArticles,
};
