class AIError extends Error {
  constructor(message, code, retryable = false) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
  }
}

function classifyError(error) {
  const status = error?.status || error?.response?.status;
  const code = error?.code;
  const name = error?.name;

  if (status === 401 || status === 403) {
    return new AIError("تعذر التحقق من صلاحية مفتاح Groq", "AUTH", false);
  }

  if (status === 429) {
    return new AIError("تجاوزنا حد الاستخدام", "RATE_LIMIT", true);
  }

  if ([408, 409, 425, 500, 502, 503, 504].includes(status)) {
    return new AIError("خدمة Groq مشغولة مؤقتًا", "SERVER", true);
  }

  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    ["ETIMEDOUT", "ECONNABORTED"].includes(code)
  ) {
    return new AIError("انتهت مهلة الطلب", "TIMEOUT", true);
  }

  if (
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "EAI_AGAIN",
      "ENOTFOUND",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(code)
  ) {
    return new AIError("تعذر الاتصال بخدمة Groq", "NETWORK", true);
  }

  return new AIError("خطأ غير متوقع في خدمة الذكاء الاصطناعي", "UNKNOWN", false);
}

module.exports = { AIError, classifyError };
