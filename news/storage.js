const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================
// Trivia BOT | News Storage & Queue
// ============================================

const DATA_FILE = path.join(__dirname, "seen.json");
const QUEUE_FILE = path.join(__dirname, "translation-queue.json");

// ============================================
// تحميل الأخبار السابقة
// ============================================

function loadSeen() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return new Set();
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    if (!Array.isArray(data)) {
      return new Set();
    }

    return new Set(data.filter((item) => typeof item === "string"));
  } catch (error) {
    console.error("[NEWS] Failed to load seen.json:", error.message);

    return new Set();
  }
}

// ============================================
// حفظ الأخبار التي تمت معالجتها
// ============================================

function saveSeen(seen) {
  try {
    const temporaryFile = `${DATA_FILE}.tmp`;

    fs.writeFileSync(temporaryFile, JSON.stringify([...seen], null, 2), "utf8");

    fs.renameSync(temporaryFile, DATA_FILE);
  } catch (error) {
    console.error("[NEWS] Failed to save seen.json:", error.message);
  }
}

// ============================================
// نظام Queue — تحميل الأخبار الفاشلة
// ============================================

function loadQueue() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) {
      return [];
    }

    const data = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));

    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.article === "object" &&
        Number.isFinite(item.attempts) &&
        Number.isFinite(item.lastRetryTime)
    );
  } catch (error) {
    console.error(
      "[NEWS] Failed to load translation-queue.json:",
      error.message
    );

    return [];
  }
}

// ============================================
// نظام Queue — حفظ الأخبار الفاشلة
// ============================================

function saveQueue(queue) {
  try {
    const temporaryFile = `${QUEUE_FILE}.tmp`;

    fs.writeFileSync(temporaryFile, JSON.stringify(queue, null, 2), "utf8");

    fs.renameSync(temporaryFile, QUEUE_FILE);
  } catch (error) {
    console.error("[NEWS] Failed to save translation-queue.json:", error.message);
  }
}

// ============================================
// نظام Queue — إضافة خبر فاشل للطابور
// ============================================

function enqueueFailedArticle(article, reason = "translation-failed") {
  try {
    const queue = loadQueue();

    // تحقق من أن الخبر ليس في الطابور بالفعل
    const existing = queue.find(
      (item) => getArticleId(item.article) === getArticleId(article)
    );

    if (existing) {
      console.log(
        `[QUEUE] Article already in queue. Incrementing attempts: ${existing.attempts + 1}`
      );
      existing.attempts += 1;
      existing.lastRetryTime = Date.now();
      saveQueue(queue);
      return;
    }

    const queueItem = {
      article,
      attempts: 1,
      firstFailedAt: Date.now(),
      lastRetryTime: Date.now(),
      reason,
    };

    queue.push(queueItem);
    saveQueue(queue);

    console.log(
      `[QUEUE] Article enqueued. Queue size: ${queue.length}`
    );
  } catch (error) {
    console.error("[QUEUE] Failed to enqueue article:", error.message);
  }
}

// ============================================
// نظام Queue — استخراج أخبار للمحاولة
// ============================================

function dequeueArticles(maxAge = 24 * 60 * 60 * 1000, maxRetries = 5) {
  try {
    const queue = loadQueue();
    const now = Date.now();
    const candidates = [];

    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      const age = now - item.firstFailedAt;
      const timeSinceLastRetry = now - item.lastRetryTime;

      // انتظر وقتًا متزايدًا بين المحاولات (exponential backoff)
      const requiredWait = Math.min(
        30 * 60 * 1000, // 30 دقيقة كحد أقصى
        Math.pow(2, item.attempts - 1) * 2 * 60 * 1000 // 2 دقيقة، 4، 8، 16، إلخ
      );

      if (timeSinceLastRetry < requiredWait) {
        console.log(
          `[QUEUE] Article needs ${Math.ceil( (requiredWait - timeSinceLastRetry) / 60000 )} more minutes before retry`
        );
        continue; // لم يأتِ وقت المحاولة بعد
      }

      // لا تحاول بعد أكثر من maxRetries
      if (item.attempts >= maxRetries) {
        console.log(
          `[QUEUE] Removing article from queue (max retries reached): attempts=${item.attempts}`
        );
        queue.splice(i, 1);
        saveQueue(queue);
        continue;
      }

      // لا تحاول بعد maxAge
      if (age > maxAge) {
        console.log(
          `[QUEUE] Removing article from queue (too old): age=${Math.ceil( age / 60000 )} minutes`
        );
        queue.splice(i, 1);
        saveQueue(queue);
        continue;
      }

      candidates.push({ ...item, queueIndex: i });
    }

    return candidates;
  } catch (error) {
    console.error("[QUEUE] Failed to dequeue articles:", error.message);
    return [];
  }
}

// ============================================
// نظام Queue — إزالة خبر من الطابور
// ============================================

function removeFromQueue(articleId) {
  try {
    const queue = loadQueue();
    const initialLength = queue.length;

    const filtered = queue.filter(
      (item) => getArticleId(item.article) !== articleId
    );

    if (filtered.length < initialLength) {
      saveQueue(filtered);
      console.log(
        `[QUEUE] Article removed from queue. New size: ${filtered.length}`
      );
    }
  } catch (error) {
    console.error("[QUEUE] Failed to remove article from queue:", error.message);
  }
}

// ============================================
// توحيد النص قبل إنشاء البصمة
// ============================================

function normalizeText(text = "") {
  return String(text)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================
// إنشاء بصمة ثابتة للنص
// ============================================

function createHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ============================================
// استخراج الرابط وتوحيده
// ============================================

function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "";
  }

  try {
    const url = new URL(rawUrl.trim());

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    // تجاهل معاملات التتبع
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";

    return url.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

// ============================================
// استخراج المعرّف الأصلي للخبر
// ============================================

function getArticleId(article) {
  if (!article) {
    return null;
  }

  const guid = article.guid;

  if (typeof guid === "string" && guid.trim()) {
    return guid.trim();
  }

  if (guid && typeof guid === "object") {
    if (typeof guid._ === "string" && guid._.trim()) {
      return guid._.trim();
    }

    if (typeof guid.value === "string" && guid.value.trim()) {
      return guid.value.trim();
    }
  }

  if (article.id && String(article.id).trim()) {
    return String(article.id).trim();
  }

  const link = normalizeUrl(article.link);

  if (link) {
    return link;
  }

  const title = normalizeText(article.title);

  if (title) {
    const date = article.isoDate || article.pubDate || "";

    return date ? `${title}::${String(date).trim()}` : title;
  }

  return null;
}

// ============================================
// إنشاء مفاتيح تساعد على اكتشاف التكرار
// ============================================

function getArticleKeys(article) {
  if (!article) {
    return [];
  }

  const keys = [];
  const articleId = getArticleId(article);

  // المعرّف الأصلي
  if (articleId) {
    keys.push(`id:${articleId}`);
  }

  // الرابط بعد إزالة معاملات التتبع
  const url = normalizeUrl(article.link);

  if (url) {
    keys.push(`url:${url}`);
  }

  // بصمة العنوان الموحّد
  const title = normalizeText(article.title);

  if (title.length >= 20) {
    keys.push(`title:${createHash(title)}`);
  }

  // بصمة المحتوى عند توفر وصف كافٍ
  const content = normalizeText(
    article.contentSnippet ||
      article.summary ||
      article.description ||
      article.content ||
      ""
  );

  if (content.length >= 100) {
    keys.push(`content:${createHash(content)}`);
  }

  return [...new Set(keys)];
}

// ============================================
// التحقق من وجود الخبر سابقًا
// ============================================

function hasSeenArticle(seen, article) {
  const keys = getArticleKeys(article);

  return keys.some((key) => seen.has(key));
}

// ============================================
// تسجيل الخبر ضمن الأخبار المعالجة
// ============================================

function markArticleSeen(seen, article) {
  const keys = getArticleKeys(article);

  for (const key of keys) {
    seen.add(key);
  }

  return keys;
}

// ============================================
// تصدير الدوال
// ============================================

module.exports = {
  loadSeen,
  saveSeen,
  getArticleId,
  getArticleKeys,
  hasSeenArticle,
  markArticleSeen,
  normalizeText,
  normalizeUrl,
  // Queue functions
  loadQueue,
  saveQueue,
  enqueueFailedArticle,
  dequeueArticles,
  removeFromQueue,
};
