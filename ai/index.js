const { getAiReply } = require("./service");

function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let remaining = String(text || "");

  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf("\n", maxLength);

    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = remaining.lastIndexOf(" ", maxLength);
    }

    if (splitAt < Math.floor(maxLength * 0.5)) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function handleAiMessage(message, client) {
  if (!message.guild) return false;
  if (message.author.bot) return false;
  if (!message.mentions.has(client.user)) return false;

  const mentionPattern = new RegExp(`<@!?${client.user.id}>`, "g");
  const userMessage = message.content.replace(mentionPattern, "").trim();

  try {
    await message.channel.sendTyping();

    const reply = userMessage
      ? await getAiReply(message, userMessage)
      : "نعم؟ كيف أقدر أساعدك؟";

    // A null response means this channel is intentionally excluded.
    if (!reply) return true;

    for (const chunk of splitMessage(reply, 2000)) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error("[AI] Error:", error);
    await message.reply("حصلت مشكلة، جرب تاني.").catch(() => {});
  }

  return true;
}

module.exports = { handleAiMessage };
