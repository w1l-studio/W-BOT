const { getHistory, addMessage } = require("./memory");
const { buildContext, contextToSystemPrompt } = require("./context");
const { getResponse } = require("./groq");
const { SYSTEM_PROMPT } = require("./systemPrompt");
const { EXCLUDED_CHANNELS } = require("./config");

function getMemoryKey(message) {
  // Isolate each member's AI history per server.
  return `${message.guild?.id || "dm"}:${message.author.id}`;
}

async function getAiReply(message, userMessage) {
  if (!message?.author || !message?.channel) return null;

  // Ignore excluded channels intentionally and silently.
  if (EXCLUDED_CHANNELS.includes(message.channel.id)) {
    return null;
  }

  const memoryKey = getMemoryKey(message);

  try {
    addMessage(memoryKey, "user", userMessage);

    const context = buildContext(message);
    const dynamicContext = contextToSystemPrompt(context);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: dynamicContext },
      ...getHistory(memoryKey),
    ];

    const reply = await getResponse(messages);

    if (reply) {
      addMessage(memoryKey, "assistant", reply);
    }

    return reply;
  } catch (error) {
    console.error("[AI Service Error]", error);
    return "يا زول حصلت مشكلة مؤقتة في خدمة الذكاء الاصطناعي، جرب تاني بعد لحظات.";
  }
}

module.exports = { getAiReply };
