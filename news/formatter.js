"use strict";

/** * news/formatter.js — Trivia BOT * * مسؤول عن: تنظيف نصوص الأخبار، تلخيصها، ترجمتها للعربية (مع Fallback)، * استخراج الرابط والمصدر والصورة والتاريخ، وبناء Discord Embed ثنائي اللغة. * * مع نظام Queue للأخبار الفاشلة وإعادة محاولة تلقائية. * * الدوال المصدّرة: * formatNews(item, options) -> Promise<object|null> (Embed كـ plain object أو null إذا فشلت الترجمة) * formatNewsBatch(items, options) -> Promise<object[]> * translateToArabic(text, options) -> Promise<string> * setTranslator(fn|null) -> تبديل خدمة الترجمة */

const https = require("https");
const http = require("http");

// ───────────────────────────── الإعدادات ─────────────────────────────

const BOT_NAME = "Trivia BOT";
const EMBED_COLOR = 0x5b8def;

const LIMITS = Object.freeze({
  description: 4096,
  authorName: 256,
  footerText: 2048,
  total: 6000,
});

const DEFAULTS = Object.freeze({
  titleMax: 200,
  enSummaryMax: 450,
  arSummaryMax: 650,
  translateTimeoutMs: 8000,
  translateChunkChars: 900,
  maxResponseBytes: 512 * 1024,
  cacheSize: 200,
  safeDescriptionBudget: 3900,
});

const FALLBACK_TITLE_EN = "Untitled gaming news";
const FALLBACK_TITLE_AR = "خبر ألعاب بدون عنوان";
const NO_SUMMARY_EN = "No summary is available for this article.";
const NO_SUMMARY_AR = "لا يتوفر ملخص لهذا الخبر.";

const KNOWN_SOURCES = Object.freeze({
  "ign.com": "IGN",
  "gamespot.com": "GameSpot",
  "nintendolife.com": "Nintendo Life",
  "purexbox.com": "Pure Xbox",
  "pushsquare.com": "Push Square",
  "polygon.com": "Polygon",
  "kotaku.com": "Kotaku",
  "eurogamer.net": "Eurogamer",
  "pcgamer.com": "PC Gamer",
  "gamesradar.com": "GamesRadar+",
  "vg247.com": "VG247",
  "destructoid.com": "Destructoid",
  "gematsu.com": "Gematsu",
  "videogameschronicle.com": "VGC",
  "rockpapershotgun.com": "Rock Paper Shotgun",
  "theverge.com": "The Verge",
  "gameinformer.com": "Game Informer",
  "windowscentral.com": "Windows Central",
  "dualshockers.com": "DualShockers",
  "siliconera.com": "Siliconera",
  "gamedeveloper.com": "Game Developer",
  "gamerant.com": "Game Rant",
  "thegamer.com": "TheGamer",
  "techradar.com": "TechRadar",
  "xbox.com": "Xbox Wire",
  "playstation.com": "PlayStation Blog",
  "nintendo.com": "Nintendo",
  "steampowered.com": "Steam",
});

// ───────────────────────────── أدوات عامة ─────────────────────────────

function toArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function toStr(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const s = toStr(entry);
      if (s) return s;
    }
    return "";
  }
  if (typeof value === "object") {
    if (typeof value._ === "string") return value._;
    if (typeof value["#text"] === "string") return value["#text"];
    if (typeof value.text === "string") return value.text;
    if (typeof value.name === "string") return value.name;
  }
  return "";
}

function attr(node, name) {
  if (!node || typeof node !== "object") return undefined;
  if (node[name] !== undefined) return node[name];
  if (node.$ && node.$[name] !== undefined) return node.$[name];
  if (node.attributes && node.attributes[name] !== undefined)
    return node.attributes[name];
  return undefined;
}

function truncate(text, max, ellipsis = "…") {
  const s = toStr(text);
  if (!Number.isFinite(max) || max <= 0) return "";
  if (s.length <= max) return s;
  if (max <= ellipsis.length) return s.slice(0, max);
  let cut = s.slice(0, max - ellipsis.length);
  const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  if (lastBreak > cut.length * 0.6) cut = cut.slice(0, lastBreak);
  cut = cut.replace(/[\s,;:\-–—(\[{""'']+$/u, "");
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut + ellipsis;
}

const ARABIC_CHAR =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

function isArabicText(text) {
  const s = toStr(text);
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters === 0) return false;
  const arabic = (s.match(ARABIC_CHAR) || []).length;
  return arabic / letters >= 0.5;
}

function hasArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
    toStr(text)
  );
}

function normalizeForCompare(text) {
  return toStr(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a, b) {
  const ta = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const tb = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

// ───────────────────────────── تنظيف النصوص ─────────────────────────────

const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "'",
  rsquo: "'",
    ldquo: '"',
    rdquo: '"',
  sbquo: "‚",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  bull: "•",
  middot: "·",
  times: "×",
  deg: "°",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  rarr: "→",
  larr: "←",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  ntilde: "ñ",
  ccedil: "ç",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  zwnj: "",
  zwj: "",
  shy: "",
});

function decodeEntities(input) {
  let out = String(input);
  for (let pass = 0; pass < 2 && out.includes("&"); pass += 1) {
    const next = out.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
      (match, code) => {
        if (code[0] === "#") {
          const cp =
            code[1].toLowerCase() === "x"
              ? parseInt(code.slice(2), 16)
              : parseInt(code.slice(1), 10);
          if (
            Number.isFinite(cp) &&
            cp > 0 &&
            cp <= 0x10ffff &&
            !(cp >= 0xd800 && cp <= 0xdfff)
          ) {
            return String.fromCodePoint(cp);
          }
          return "";
        }
        const exact = NAMED_ENTITIES[code];
        if (exact !== undefined) return exact;
        const lower = NAMED_ENTITIES[code.toLowerCase()];
        return lower !== undefined ? lower : match;
      }
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

function stripHtml(html) {
  return String(html)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|iframe|svg|template|head)\b[\s\S]*?<\/\1\s*>/gi,
      " "
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|table|section|article|figure|figcaption)\s*>/gi,
      "\n"
    )
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/?[a-z!][^>]*>/gi, " ");
}

function removeReadFullPhrases(text) {
  const re =
    /\b(?:read|view|see)\s+(?:the\s+)?(?:full|complete|entire|whole)\s+(?:article|story|post|review|news|piece)\b/gi;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index);
    let end = m.index + m[0].length;
    const src =
      /^[ \t]+(?:on|at|over at|from|here at)[ \t]+[A-Z][\w''&.-]*(?:[ \t]+[A-Z][\w''&.-]*){0,2}/.exec(
        text.slice(end)
      );
    if (src) end += src[0].length;
    end += /^[ \t.»›→>…!]*/.exec(text.slice(end))[0].length;
    last = end;
    re.lastIndex = end;
  }
  return out + text.slice(last);
}

const BOILERPLATE_PATTERNS = [
  /\bread\s+more\s*[»›→…]+/gi,
  /\bread\s+more\b(?:[ \t]*(?:here|»|›|→|>|…|\.\.\.))?[ \t]*$/gim,
  /\bcontinue\s+reading\b(?:\s+(?:this|the)\s+(?:article|story|post))?[ \t]*(?:[»›→…>]|\.{2,3})?/gi,
  /\bclick\s+here\s+to\s+(?:read|view|see|continue)\b[^\n.]*\.?/gi,
  /\bThe\s+post\s+[^\n]{1,300}?\s+appeared\s+first\s+on\s+[^\n]*/gi,
  /\[\s*(?:…|\.\.\.)\s*\]/g,
  /\b(?:sign\s+up\s+for|subscribe\s+to)\s+our\s+[^\n.]*newsletter[^\n.]*\.?/gi,
  /\bfollow\s+us\s+on\s+(?:twitter|x|facebook|instagram|youtube|tiktok|discord|bluesky)\b[^\n.]*\.?/gi,
  /\bThis\s+article\s+(?:was\s+)?(?:originally\s+)?(?:published|appeared)\s+(?:first\s+)?(?:on|at|in)\s+[A-Z][^\n.]{0,40}\.?/g,
];

const PROMO_LINE =
  /^(?:advertisement|ad|ads|sponsored(?:\s+content)?|promoted|related(?:\s+(?:articles?|stories|posts|reading))?:?|share\s+this:?|tags?:.*|filed\s+under:.*|source:\s*\S.*)$/i;
const SOCIAL_PROMO_LINE =
  /^(?:follow|subscribe|sign\s+up|join)\b.*\b(?:newsletter|twitter|facebook|youtube|discord|instagram|tiktok|bluesky|podcast)\b/i;

function cleanText(text, options = {}) {
  let s = toStr(text);
  if (!s) return "";

  s = stripHtml(s);
  s = decodeEntities(s);
  if (/<\/?[a-z][^>]*>/i.test(s)) s = stripHtml(s);

  s = s
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t]/g, " ");

  s = removeReadFullPhrases(s);
  for (const pattern of BOILERPLATE_PATTERNS) s = s.replace(pattern, " ");

  if (!options.keepUrls) {
    s = s
      .replace(/\bhttps?:\/\/[^\s<>"')\]]+/gi, " ")
      .replace(/\bwww\.[^\s<>"')\]]+/gi, " ")
      .replace(/\(\s*\)|\[\s*\]/g, " ");
  }

  const seenLong = new Set();
  const lines = [];
  for (const rawLine of s.split("\n")) {
    const line = rawLine
      .replace(/ {2,}/g, " ")
      .trim()
      .replace(/^[\s\-–—•|:·»›]+(?=\S)/u, (m) => (m.includes("•") ? "• " : ""));
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    if (/^[\s\-–—•|:·»›.…]+$/u.test(line)) continue;
    if (PROMO_LINE.test(line)) continue;
    if (line.length <= 160 && SOCIAL_PROMO_LINE.test(line)) continue;
    const key = line.toLowerCase();
    if (line.length > 20 && seenLong.has(key)) continue;
    if (line.length > 20) seenLong.add(key);
    if (lines.length && lines[lines.length - 1] === line) continue;
    lines.push(line);
  }
  while (lines.length && lines[lines.length - 1] === "") lines.pop();

  s = options.singleLine ? lines.filter(Boolean).join(" ") : lines.join("\n");
  s = s
    .replace(/[ \t]+([,.;:!?؟،])/g, "$1")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

// ───────────────────────────── التلخيص ─────────────────────────────

const ABBREVIATIONS =
  /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|Inc|Ltd|Co|Corp|No|Vol|Fig|approx|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\./g;

function splitSentences(text) {
  const protectedText = String(text)
    .replace(ABBREVIATIONS, "$1\u0001")
    .replace(/\b([A-Za-z])\.(?=[A-Za-z]\.)/g, "$1\u0001");
  return protectedText
    .split(/(?<=[.!?…؟][""'')\]]?)\s+(?=[""''(\[]?[A-Z0-9\u0600-\u06FF])/u)
    .map((s) => s.replace(/\u0001/g, ".").trim())
    .filter(Boolean);
}

function scoreSentence(sentence, index) {
  let score = index === 0 ? 5 : Math.max(0, 3 - index * 0.4);
  if (/\d/.test(sentence)) score += 1;
  const caps = (sentence.match(/\b[A-Z][a-z]+|\b[A-Z]{2,}\b/g) || []).length;
  score += Math.min(2, caps * 0.25);
  if (sentence.length < 30) score -= 1.5;
  if (sentence.length > 260) score -= 1;
  if (
    /\b(subscribe|click here|newsletter|follow us|affiliate|giveaway|sponsored)\b/i.test(
      sentence
    )
  )
    score -= 5;
  if (/\?\s*$/.test(sentence)) score -= 1;
  return score;
}

function removeTitleFromStart(text, title) {
  if (!title || title.length < 8) return text;
  if (text.toLowerCase().startsWith(title.toLowerCase())) {
    return text
      .slice(title.length)
      .replace(/^[\s:–—\-.,|]+/u, "")
      .trim();
  }
  return text;
}

function summarizeText(text, maxLength = DEFAULTS.enSummaryMax, title = "") {
  const max =
    Number.isFinite(maxLength) && maxLength >= 40
      ? Math.floor(maxLength)
      : DEFAULTS.enSummaryMax;
  let clean = cleanText(text, { singleLine: true });
  if (!clean) return "";

  const cleanTitle = cleanText(title, { singleLine: true });
  clean = removeTitleFromStart(clean, cleanTitle);
  if (!clean) return "";
  if (clean.length <= max)
    return isTitleDuplicate(clean, cleanTitle) ? "" : clean;

  const sentences = splitSentences(clean).filter(
    (s) => !isTitleDuplicate(s, cleanTitle)
  );
  if (sentences.length === 0) return "";

  const scored = sentences.map((s, i) => ({
    s,
    i,
    score: scoreSentence(s, i),
  }));
  const seed = scored.reduce(
    (best, cur) => (cur.score > best.score ? cur : best),
    scored[0]
  );
  if (seed.s.length > max) return truncate(seed.s, max);

  const chosen = new Map([[seed.i, seed.s]]);
  let total = seed.s.length;
  const rest = scored
    .filter((x) => x.i !== seed.i)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  for (const cand of rest) {
    if (cand.score < 1) continue;
    if (total + 1 + cand.s.length > max) continue;
    chosen.set(cand.i, cand.s);
    total += 1 + cand.s.length;
  }
  return [...chosen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, s]) => s)
    .join(" ");
}

function isTitleDuplicate(sentence, title) {
  if (!title) return false;
  const a = normalizeForCompare(sentence);
  const b = normalizeForCompare(title);
  if (!a || !b) return false;
  if (a === b) return true;
  return tokenSimilarity(sentence, title) >= 0.85;
}

// ───────────────────────────── الترجمة ─────────────────────────────

let activeTranslator = null;
const translationCache = new Map();

function setTranslator(fn) {
  if (fn !== null && typeof fn !== "function")
    throw new TypeError("setTranslator expects a function or null");
  activeTranslator = fn;
  translationCache.clear();
}

function cacheGet(key) {
  if (!translationCache.has(key)) return undefined;
  const value = translationCache.get(key);
  translationCache.delete(key);
  translationCache.set(key, value);
  return value;
}

function cacheSet(key, value) {
  translationCache.set(key, value);
  if (translationCache.size > DEFAULTS.cacheSize) {
    translationCache.delete(translationCache.keys().next().value);
  }
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
    clearTimeout(timer)
  );
}

function httpRequest(url, method = "GET", body = null, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https");
    const client = isHttps ? https : http;
    const req = client.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; TriviaBOT/1.0)",
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const parts = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > DEFAULTS.maxResponseBytes) {
            req.destroy(new Error("response too large"));
            return;
          }
          parts.push(chunk);
        });
        res.on("end", () => {
          try {
            const data = Buffer.concat(parts).toString("utf8");
            resolve({ status: res.statusCode, data, headers: res.headers });
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () =>
      req.destroy(
        new Error(`request timed out after ${timeoutMs}ms`)
      )
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function googleTranslate(text, { timeoutMs = DEFAULTS.translateTimeoutMs } = {}) {
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${encoded}`;
  
  try {
    const response = await withTimeout(
      httpRequest(url, "GET", null, timeoutMs),
      timeoutMs + 1000,
      "Google Translate"
    );
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = JSON.parse(response.data);
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error("unexpected response format");
    }
    
    return data[0]
      .map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
      .join("");
  } catch (err) {
    console.warn(`[translation] Google Translate failed: ${err.message}`);
    throw err;
  }
}

async function yandexTranslate(text, { timeoutMs = DEFAULTS.translateTimeoutMs } = {}) {
  const url = "https://translate.yandex.net/api/v1.5/tr.json/translate";
  const body = new URLSearchParams({
    key: process.env.YANDEX_TRANSLATOR_KEY || "dummy",
    text: text,
    lang: "ar",
  }).toString();
  
  try {
    const response = await withTimeout(
      httpRequest(
        url + "?" + body,
        "POST",
        null,
        timeoutMs
      ),
      timeoutMs + 1000,
      "Yandex Translate"
    );
    
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = JSON.parse(response.data);
    if (!Array.isArray(data.text) || !data.text[0]) {
      throw new Error("unexpected response format");
    }
    
    return data.text[0];
  } catch (err) {
    console.warn(`[translation] Yandex Translate failed: ${err.message}`);
    throw err;
  }
}

function chunkText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let current = "";
  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of splitSentences(text)) {
    if (sentence.length > maxChars) {
      push();
      let piece = "";
      for (const word of sentence.split(" ")) {
        if (piece && piece.length + 1 + word.length > maxChars) {
          chunks.push(piece);
          piece = word;
        } else {
          piece = piece ? `${piece} ${word}` : word;
        }
      }
      current = piece;
      continue;
    }
    if (current && current.length + 1 + sentence.length > maxChars) push();
    current = current ? `${current} ${sentence}` : sentence;
  }
  push();
  return chunks;
}

function cleanTranslation(text) {
  return toStr(text)
    .replace(/```[a-z]*\n?|```/gi, "")
    .replace(
      /^\s*(?:translation|translated text|الترجمة|النص المترجم)\s*[:：]\s*/i,
      ""
    )
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?؟،])/g, "$1")
    .trim();
}

async function translateToArabicDetailed(text, options = {}) {
  const source = cleanText(text, { singleLine: true });
  if (!source) return { text: "", translated: false, reason: "empty" };
  if (isArabicText(source))
    return { text: source, translated: true, reason: "already-arabic" };

  const useCache = typeof options.translator !== "function";
  const cached = useCache ? cacheGet(source) : undefined;
  if (cached) return { ...cached };

  const timeoutMs =
    Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULTS.translateTimeoutMs;

  const pieces = [];
  const providers = ["google", "yandex"];
  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`[translation] Attempting with ${provider}`);
      
      for (const chunk of chunkText(source, DEFAULTS.translateChunkChars)) {
        let result;
        
        if (provider === "google") {
          result = await withTimeout(
            googleTranslate(chunk, { timeoutMs }),
            timeoutMs + 1000,
            "Google Translate"
          );
        } else if (provider === "yandex") {
          if (!process.env.YANDEX_TRANSLATOR_KEY) {
            throw new Error("Yandex key not configured");
          }
          result = await withTimeout(
            yandexTranslate(chunk, { timeoutMs }),
            timeoutMs + 1000,
            "Yandex Translate"
          );
        }
        
        const cleaned = cleanTranslation(result);
        if (!cleaned) {
          throw new Error(`${provider} returned empty result`);
        }
        pieces.push(cleaned);
      }
      
      // Success with this provider
      console.log(`[translation] Success with ${provider}`);
      break;
    } catch (err) {
      lastError = err;
      console.warn(`[translation] ${provider} failed: ${err.message}`);
      pieces.length = 0; // Reset for next provider
      
      if (provider === providers[providers.length - 1]) {
        // All providers failed
        console.error(
          `[translation] All translation providers failed. Last error: ${err.message}`
        );
        return {
          text: source,
          translated: false,
          reason: "all-providers-failed",
          error: String(err.message),
        };
      }
    }
  }

  const joined = pieces.join(" ").trim();
  const sourceWords = source.split(/\s+/).length;
  
  if (!hasArabic(joined) && sourceWords >= 3) {
    return { text: source, translated: false, reason: "not-arabic" };
  }
  
  const outcome = { text: joined, translated: true, reason: "ok" };
  if (useCache) cacheSet(source, outcome);
  return { ...outcome };
}

async function translateToArabic(text, options = {}) {
  const result = await translateToArabicDetailed(text, options);
  return result.text;
}

// ───────────────────────────── الرابط والمصدر ─────────────────────────────

const TRACKING_PARAMS =
  /^(?:utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|ocid|cmpid)$/i;

function normalizeUrl(raw) {
  let s = decodeEntities(toStr(raw)).trim();
  if (!s || /\s/.test(s)) return null;
  if (s.startsWith("//")) s = `https:${s}`;
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  return url;
}

function isHomepage(url) {
  return (url.pathname === "/" || url.pathname === "") && !url.search;
}

function linkCandidates(item) {
  const out = [];
  for (const entry of toArray(item.link)) {
    if (typeof entry === "string") {
      out.push(entry);
    } else if (entry && typeof entry === "object") {
      const rel = toStr(attr(entry, "rel"));
      if (!rel || /alternate/i.test(rel))
        out.push(toStr(attr(entry, "href") || attr(entry, "url")));
    }
  }
  for (const key of ["url", "permalink", "canonicalUrl", "canonical"])
    out.push(toStr(item[key]));
  const guid = item.guid;
  if (guid) {
    const permaFlag = attr(guid, "isPermaLink");
    if (!(permaFlag === false || String(permaFlag).toLowerCase() === "false"))
      out.push(toStr(guid));
  }
  out.push(toStr(item.id));
  return out;
}

function getArticleUrl(item) {
  if (!item || typeof item !== "object") return null;
  for (const candidate of linkCandidates(item)) {
    const url = normalizeUrl(candidate);
    if (url && !isHomepage(url)) return url.href;
  }
  return null;
}

function hostOf(urlString) {
  try {
    return new URL(urlString).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function prettifyHost(host) {
  const parts = host.split(".").filter(Boolean);
  if (!parts.length) return "";
  const secondLevel = new Set(["co", "com", "org", "net", "gov", "edu"]);
  let idx = parts.length - 2;
  if (
    idx > 0 &&
    secondLevel.has(parts[idx]) &&
    parts[parts.length - 1].length === 2
  )
    idx -= 1;
  const label = parts[Math.max(0, idx)];
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function cleanSourceTitle(raw) {
  const first =
    cleanText(raw, { singleLine: true }).split(/\s+[|–—-]\s+|\s*:\s+/)[0] || "";
  return first.trim().slice(0, 60);
}

function getSourceInfo(item) {
  const empty = { name: "", domain: "", url: null };
  if (!item || typeof item !== "object") return empty;

  const url = getArticleUrl(item);
  let domain = url ? hostOf(url) : "";
  if (!domain) {
    const feedLink =
      toStr(item.feedUrl) ||
      toStr(item.feed && (item.feed.link || item.feed.feedUrl)) ||
      toStr(item.sourceUrl);
    domain = hostOf(feedLink);
  }

  let name = "";
  if (domain) {
    const known = Object.keys(KNOWN_SOURCES).find(
      (d) => domain === d || domain.endsWith(`.${d}`)
    );
    if (known) name = KNOWN_SOURCES[known];
  }
  if (!name) {
    const declared = [
      item.sourceName,
      item.source,
      item.feedTitle,
      item.feed && item.feed.title,
      item.siteName,
      item.publisher,
    ]
      .map((v) => cleanSourceTitle(toStr(v)))
      .find(Boolean);
    if (declared) name = declared;
  }
  if (!name && domain) name = prettifyHost(domain);
  return { name, domain, url };
}

// ───────────────────────────── الصور ─────────────────────────────

const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp|avif|bmp)$/i;
const NON_IMAGE_EXT =
  /\.(?:mp4|m4v|mov|webm|mp3|m4a|ogg|wav|pdf|zip|html?|php|aspx?|js|css|json|xml|svg|ico)$/i;
const TRACKING_IMAGE =
  /(?:pixel|beacon|tracker|doubleclick|feedburner\.com\/~|\/ads?\/|spacer|blank\.gif|1x1)/i;

function normalizeImageUrl(raw, base, trusted) {
  let s = decodeEntities(toStr(raw)).trim();
  if (!s || /\s/.test(s) || s.startsWith("data:")) return null;
  if (s.startsWith("//")) s = `https:${s}`;
  let url;
  try {
    url = base ? new URL(s, base) : new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (NON_IMAGE_EXT.test(url.pathname) || TRACKING_IMAGE.test(url.href))
    return null;
  if (IMAGE_EXT.test(url.pathname)) return url.href;
  return trusted ? url.href : null;
}

function nodeUrl(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node) || typeof node !== "object") return "";
  return toStr(
    node.url ||
      node.href ||
      node.src ||
      attr(node, "url") ||
      attr(node, "href") ||
      attr(node, "src")
  );
}

function htmlImageCandidates(html) {
  const out = [];
  const source = toStr(html);
  if (!source) return out;
  const decoded = source.includes("&lt;img") ? decodeEntities(source) : source;
  const meta =
    /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = meta.exec(decoded)) !== null)
    out.push({ url: m[1], trusted: true });
  const img = /<img\b[^>]*>/gi;
  while ((m = img.exec(decoded)) !== null) {
    const tag = m[0];
    const width = parseInt((/\bwidth=["']?(\d+)/i.exec(tag) || [])[1], 10);
    const height = parseInt((/\bheight=["']?(\d+)/i.exec(tag) || [])[1], 10);
    if (
      (Number.isFinite(width) && width <= 2) ||
      (Number.isFinite(height) && height <= 2)
    )
      continue;
    const src =
      (/\bdata-(?:lazy-)?src=["']([^"']+)["']/i.exec(tag) || [])[1] ||
      (/\bsrc=["']([^"']+)["']/i.exec(tag) || [])[1] ||
      (/\bsrcset=["']\s*([^\s"',]+)/i.exec(tag) || [])[1];
    if (src) out.push({ url: src, trusted: true });
  }
  return out;
}

function getNewsImage(item, options = {}) {
  if (!item || typeof item !== "object")
    return normalizeFallbackImages(options);
  const base = getArticleUrl(item) || undefined;
  const candidates = [];

  const media = [];
  for (const key of ["media:content", "mediaContent", "media_content"])
    media.push(...toArray(item[key]));
  for (const group of toArray(item["media:group"])) {
    if (group && typeof group === "object")
      media.push(...toArray(group["media:content"]));
  }
  const mediaImages = [];
  for (const node of media) {
    const url = nodeUrl(node);
    const type = `${toStr(attr(node, "type"))} ${toStr(attr(node, "medium"))}`;
    if (/video|audio/i.test(type)) continue;
    const declaredImage = /image/i.test(type);
    const width = parseInt(toStr(attr(node, "width")), 10) || 0;
    mediaImages.push({ url, trusted: declaredImage, width });
  }
  mediaImages.sort((a, b) => b.width - a.width);
  candidates.push(...mediaImages);

  for (const key of ["media:thumbnail", "mediaThumbnail", "media_thumbnail"]) {
    const thumbs = toArray(item[key]).map((n) => ({
      url: nodeUrl(n),
      trusted: true,
      width: parseInt(toStr(attr(n, "width")), 10) || 0,
    }));
    thumbs.sort((a, b) => b.width - a.width);
    candidates.push(...thumbs);
  }

  for (const enc of [...toArray(item.enclosure), ...toArray(item.enclosures)]) {
    const type = toStr(attr(enc, "type"));
    if (/video|audio/i.test(type)) continue;
    candidates.push({ url: nodeUrl(enc), trusted: /image/i.test(type) });
  }

  const fieldValues = [
    item.image,
    item.imageUrl,
    item.image_url,
    item.thumbnail,
    item.thumb,
    item.featuredImage,
    item.lead_image_url,
    item.ogImage,
    item["og:image"],
    item.itunes && item.itunes.image,
    item.openGraph && item.openGraph.image,
    item.og && item.og.image,
    item.metadata && item.metadata.image,
  ];
  for (const value of fieldValues) {
    for (const entry of toArray(value))
      candidates.push({ url: nodeUrl(entry), trusted: true });
  }

  for (const key of [
    "content:encoded",
    "contentEncoded",
    "content",
    "description",
    "summary",
  ]) {
    candidates.push(...htmlImageCandidates(item[key]));
  }

  for (const cand of candidates) {
    const normalized = normalizeImageUrl(cand.url, base, cand.trusted);
    if (normalized) return normalized;
  }
  return normalizeFallbackImages(options);
}

function normalizeFallbackImages(options) {
  const list = [
    ...toArray(options && options.fallbackImage),
    ...toArray(options && options.fallbackImages),
  ];
  for (const raw of list) {
    const normalized = normalizeImageUrl(raw, undefined, true);
    if (normalized) return normalized;
  }
  return null;
}

// ───────────────────────────── التاريخ ─────────────────────────────

function parseDate(value) {
  let d = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    d = new Date(value < 1e11 ? value * 1000 : value);
  } else {
    const s = toStr(value).trim();
    if (!s) return null;
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      d = new Date(s.length <= 10 ? n * 1000 : n);
    } else {
      d = new Date(s);
    }
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() < 1990) return null;
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  return d;
}

function getPublishedDate(item) {
  if (!item || typeof item !== "object") return null;
  for (const key of [
    "isoDate",
    "pubDate",
    "published",
    "date",
    "dc:date",
    "updated",
    "created",
    "publishedAt",
  ]) {
    const d = parseDate(item[key]);
    if (d) return d;
  }
  return null;
}

// ───────────────────────────── بناء الـ Embed ─────────────────────────────

function escapeMarkdown(text) {
  return toStr(text)
    .replace(/\\/g, "\\\\")
    .replace(/([*_~`|\[\]])/g, "\\$1")
    .replace(/^(\s*)([#>+-])/, "$1\\$2")
    .replace(/@(everyone|here)/gi, "@\u200B$1")
    .replace(/<@/g, "<\u200B@");
}

function markdownUrl(url) {
  return String(url).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function buildDescription(p) {
  const blocks = [];

  if (p.showArabic) {
    const lines = [
      "🇸🇦 **ملخص الخبر بالعربي**",
      `**${escapeMarkdown(p.arTitle)}**`,
    ];
    lines.push(escapeMarkdown(p.arSummary));
    blocks.push(lines.join("\n"));
    if (p.url)
      blocks.push(
        `🔗 **[اقرأ الخبر كاملًا | ${escapeMarkdown( p.sourceLabel )}](${markdownUrl(p.url)})**`
      );
  }

  if (p.showEnglish) {
    blocks.push(
      [
        "🇬🇧 **English Summary**",
        `**${escapeMarkdown(p.enTitle)}**`,
        escapeMarkdown(p.enSummary),
      ].join("\n")
    );
    if (p.url)
      blocks.push(
        `🔗 **[Read the full article | ${escapeMarkdown( p.sourceLabel )}](${markdownUrl(p.url)})**`
      );
  }

  return blocks.join("\n\n");
}

function embedLength(embed) {
  return (
    toStr(embed.description).length +
    toStr(embed.author && embed.author.name).length +
    toStr(embed.footer && embed.footer.text).length
  );
}

function fitDescription(parts) {
  const current = { ...parts };
  let description = buildDescription(current);
  let guard = 0;
  while (description.length > DEFAULTS.safeDescriptionBudget && guard < 12) {
    guard += 1;
    current.arSummary = truncate(
      current.arSummary,
      Math.max(120, Math.floor(current.arSummary.length * 0.8))
    );
    current.enSummary = truncate(
      current.enSummary,
      Math.max(120, Math.floor(current.enSummary.length * 0.8))
    );
    if (guard > 6) {
      current.arTitle = truncate(current.arTitle, 120);
      current.enTitle = truncate(current.enTitle, 120);
    }
    description = buildDescription(current);
  }
  if (description.length > LIMITS.description)
    description = truncate(description, LIMITS.description);
  return description;
}

function pickBodyText(item) {
  let best = "";
  for (const key of [
    "content:encoded",
    "contentEncoded",
    "content",
    "contentSnippet",
    "description",
    "summary",
    "subtitle",
  ]) {
    const cleaned = cleanText(item[key]);
    if (cleaned.length > best.length) best = cleaned;
  }
  return best;
}

function safe(label, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.error(`[news/formatter] ${label} failed:`, err);
    return fallback;
  }
}

async function buildEmbed(item, options) {
  const enTitleRaw = safe(
    "title cleanup",
    () => cleanText(item.title, { singleLine: true }),
    ""
  );
  const enTitle = truncate(enTitleRaw || FALLBACK_TITLE_EN, DEFAULTS.titleMax);
  const hasTitle = Boolean(enTitleRaw);

  const body = safe("body extraction", () => pickBodyText(item), "");
  const enSummary = safe(
    "summary",
    () => summarizeText(body, options.enSummaryMax, enTitleRaw),
    ""
  );

  const url = safe("article url", () => getArticleUrl(item), null);
  const source = safe("source info", () => getSourceInfo(item), {
    name: "",
    domain: "",
    url: null,
  });
  const sourceLabel = source.name || source.domain || "Source";
  const image = safe(
    "image extraction",
    () => getNewsImage(item, options),
    null
  );
  const date = safe("date parsing", () => getPublishedDate(item), null);

  const sourceIsArabic =
    isArabicText(enTitleRaw) && (!enSummary || isArabicText(enSummary));

  let arTitle = "";
  let arSummary = "";

  if (!sourceIsArabic) {
    console.log(`[translation] Starting translation for: ${enTitle.slice(0, 50)}...`);
    
    const [titleResult, summaryResult] = await Promise.all([
      hasTitle
        ? translateToArabicDetailed(enTitleRaw, options)
        : Promise.resolve(null),
      enSummary
        ? translateToArabicDetailed(enSummary, options)
        : Promise.resolve(null),
    ]);

    if (!titleResult || !titleResult.translated) {
      console.log(`[translation] FAILED - Title translation unsuccessful`);
      return null; // لا نرسل الخبر — يجب أن يكون مترجم
    }

    if (!summaryResult || !summaryResult.translated) {
      console.log(`[translation] FAILED - Summary translation unsuccessful`);
      return null; // لا نرسل الخبر — يجب أن يكون مترجم
    }

    arTitle = titleResult.text || FALLBACK_TITLE_AR;
    arSummary = summaryResult.text || NO_SUMMARY_AR;
    
    console.log(`[translation] SUCCESS - Both title and summary translated`);
  } else {
    arTitle = enTitleRaw;
    arSummary = enSummary || NO_SUMMARY_AR;
    console.log(`[translation] Source already in Arabic`);
  }

  arTitle = truncate(arTitle, DEFAULTS.titleMax);
  arSummary = truncate(arSummary, options.arSummaryMax);

  const description = fitDescription({
    showArabic: true,
    showEnglish: !sourceIsArabic,
    arTitle,
    arSummary,
    enTitle,
    enSummary: enSummary || NO_SUMMARY_EN,
    url,
    sourceLabel,
  });

  const embed = {
    color: options.color,
    description,
    footer: { text: truncate(options.footerText, LIMITS.footerText) },
  };
  if (source.name)
    embed.author = { name: truncate(source.name, LIMITS.authorName) };
  if (image) embed.image = { url: image };
  if (date && options.includeTimestamp) embed.timestamp = date.toISOString();

  if (embedLength(embed) > LIMITS.total) {
    embed.description = truncate(
      embed.description,
      LIMITS.total -
        toStr(embed.author && embed.author.name).length -
        embed.footer.text.length -
        10
    );
  }
  return embed;
}

function buildMinimalEmbed(item, options) {
  let title = "";
  let url = null;
  try {
    title = truncate(
      cleanText(item && item.title, { singleLine: true }),
      DEFAULTS.titleMax
    );
    url = getArticleUrl(item);
  } catch {
    // يبقى العنوان والرابط فارغين
  }
  const lines = [`**${escapeMarkdown(title || FALLBACK_TITLE_EN)}**`];
  if (url) lines.push(`🔗 **[Read the full article](${markdownUrl(url)})**`);
  return {
    color: options.color,
    description: lines.join("\n\n"),
    footer: { text: truncate(options.footerText, LIMITS.footerText) },
  };
}

/** يبني Discord Embed لخبر واحد.
 * إذا فشلت الترجمة، يرجع null بدل إرسال خبر بدون ترجمة.
 * الخبر سيُحفظ في Queue للمحاولة لاحقًا.
 */
async function formatNews(item, options = {}) {
  if (!item || typeof item !== "object") {
    console.warn(
      "[news/formatter] formatNews received an invalid item; skipped."
    );
    return null;
  }
  const opts = {
    ...options,
    color: Number.isInteger(options.color) ? options.color : EMBED_COLOR,
    footerText: toStr(options.footerText) || BOT_NAME,
    includeTimestamp: options.includeTimestamp !== false,
    enSummaryMax: Number.isFinite(options.enSummaryMax)
      ? options.enSummaryMax
      : DEFAULTS.enSummaryMax,
    arSummaryMax: Number.isFinite(options.arSummaryMax)
      ? options.arSummaryMax
      : DEFAULTS.arSummaryMax,
  };
  try {
    return await buildEmbed(item, opts);
  } catch (err) {
    console.error(
      "[news/formatter] formatNews failed unexpectedly:",
      err
    );
    return null; // فشل غير متوقع — لا نرسل الخبر
  }
}

/** يعالج مجموعة أخبار بالتتابع؛ فشل خبر واحد لا يوقف الباقي.
 * فقط الأخبار المترجمة بنجاح تُرجع كـ embeds.
 */
async function formatNewsBatch(items, options = {}) {
  const results = [];
  for (const item of Array.isArray(items) ? items : []) {
    try {
      const embed = await formatNews(item, options);
      if (embed) results.push(embed);
    } catch (err) {
      console.error("[news/formatter] formatNewsBatch: item skipped:", err);
    }
  }
  return results;
}

module.exports = {
  formatNews,
  formatNewsBatch,
  translateToArabic,
  translateToArabicDetailed,
  summarizeText,
  cleanText,
  getNewsImage,
  getArticleUrl,
  getSourceInfo,
  getPublishedDate,
  setTranslator,
};
