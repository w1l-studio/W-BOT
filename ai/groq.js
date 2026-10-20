const Groq = require("groq-sdk");
const {
  GROQ_API_KEY,
  MODEL_NAME,
  TEMPERATURE,
  MAX_TOKENS,
  AI_TIMEOUT,
  AI_RETRIES,
} = require("./config");
const { classifyError } = require("./errors");

let client = null;

function getClient() {
  if (!client) {
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY غير موجود في ملف .env الرئيسي");
    }
    client = new Groq({ apiKey: GROQ_API_KEY });
  }

  return client;
}

async function callOnce(messages) {
  const groq = getClient();
  const controller = new AbortController();
  let timedOut = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT);

  try {
    return await groq.chat.completions.create(
      {
        model: MODEL_NAME,
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      },
      { signal: controller.signal }
    );
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error("انتهت مهلة طلب Groq");
      timeoutError.name = "AbortError";
      timeoutError.code = "ETIMEDOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getResponse(messages) {
  let lastError;

  const attempts = Math.max(1, Number(AI_RETRIES) || 1);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await callOnce(messages);
      const content = response?.choices?.[0]?.message?.content;

      if (typeof content !== "string" || !content.trim()) {
        throw new Error("Groq returned an empty response");
      }

      return content.trim();
    } catch (err) {
      lastError = classifyError(err);

      console.error(
        `[AI] محاولة ${attempt}/${attempts} فشلت:`,
        lastError.code
      );

      if (!lastError.retryable || attempt === attempts) break;

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  console.error("[AI] فشل نهائي:", lastError?.code || "UNKNOWN");
  return "يا زول السيرفر مشغول شوية أو الاتصال متعطل، جرب تاني بعد لحظات.";
}

module.exports = { getResponse };
