function canMemberViewChannel(channel, member) {
  if (!channel || !member || typeof channel.permissionsFor !== "function") {
    return false;
  }

  try {
    return Boolean(channel.permissionsFor(member)?.has("ViewChannel"));
  } catch {
    return false;
  }
}

function buildContext(message) {
  const { author, guild, channel, client, member } = message;

  const currentChannelVisible = canMemberViewChannel(channel, member);

  // Only include channels the requesting member can view. Never include
  // messages or metadata from those channels; this is names/IDs only.
  const visibleChannels = guild
    ? guild.channels.cache
        .filter((ch) => canMemberViewChannel(ch, member))
        .map((ch) => ({
          id: ch.id,
          name: ch.name || "unnamed-channel",
          type: ch.type,
        }))
    : [];

  // Only the requesting member's own roles are included, not other members'
  // roles or a server-wide role inventory.
  const memberRoles = member?.roles?.cache
    ? member.roles.cache
        .filter((role) => role.id !== guild?.id)
        .map((role) => role.name)
    : [];

  return {
    user: {
      id: author.id,
      username: author.username,
      displayName: author.displayName || author.username,
      isAdmin: member?.permissions?.has("Administrator") || false,
      roles: memberRoles,
    },
    server: {
      id: guild?.id || null,
      name: guild?.name || null,
      memberCount: guild?.memberCount ?? null,
      currentChannelName: currentChannelVisible ? (channel?.name || null) : null,
      visibleChannels,
      visibleChannelListComplete: Boolean(guild && member),
    },
    bot: {
      id: client.user.id,
      name: client.user.username,
    },
    knowledge: getKnowledge(),
  };
}

function getKnowledge() {
  return `
- البوت اسمه: Trivia BOT
- طوره: xjn_1
- الأوامر المتاحة:
  * /daily - المكافأة اليومية
  * /balance - الرصيد
  * /pay - تحويل كوينز
  * /stocks - مراهنة
  * /ticket - نظام التذاكر
  * /play - الألعاب
  * /help - قائمة الأوامر
  * /ping - سرعة البوت

ملاحظة أمنية: لا تملك معلومات عن أعضاء آخرين أو أرصدتهم، ولا عن محتوى الرسائل في القنوات الأخرى.
`.trim();
}

function contextToSystemPrompt(context) {
  const { user, server, knowledge } = context;

  const visibleChannels = (server.visibleChannels || [])
    .map((ch) => `- #${ch.name} (ID: ${ch.id})`)
    .join("\n") || "- لا توجد قنوات مرئية مؤكدة ضمن السياق.";

  const roles = (user.roles || []).join(", ") || "لا توجد رتب إضافية معروفة";

  return `
[معلومات العضو الحالي]
- الاسم: ${user.displayName} (@${user.username})
- مشرف: ${user.isAdmin ? "نعم" : "لا"}
- رتب العضو نفسه: ${roles}

[معلومات السيرفر]
- اسم السيرفر: ${server.name || "غير معروف"}
- عدد الأعضاء: ${server.memberCount ?? "غير معروف"}
- القناة الحالية: ${server.currentChannelName ? `#${server.currentChannelName}` : "غير متاحة في السياق"}

[القنوات التي يستطيع العضو الحالي رؤيتها فقط]
${visibleChannels}

[قواعد استخدام قائمة القنوات]
- هذه القائمة هي المصدر الوحيد الموثوق لأسماء القنوات التي تعرفها.
- لا تخمّن أسماء قنوات غير موجودة في القائمة ولا تؤكد وجودها أو محتواها.
- إذا سأل المستخدم عن قناة غير مدرجة، قل إنك لا تملك معلومات عنها.
- لا توجد لديك رسائل أو محتويات القنوات الأخرى، حتى لو كانت أسماؤها في القائمة.
- لا تكشف معلومات شخصية عن أعضاء آخرين أو أرصدتهم.

[معرفة البوت]
${knowledge}
`.trim();
}

module.exports = { buildContext, contextToSystemPrompt };
