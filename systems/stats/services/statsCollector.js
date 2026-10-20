"use strict";

/**
 * Discord event collector. It intentionally stores counts/IDs only, not message contents.
 * Game/economy data must be explicitly reported by the existing game/economy modules.
 */
function attachStatsCollector(client, repository, logger = console) {
  if (client.__triviaStatsCollectorAttached) return;
  client.__triviaStatsCollectorAttached = true;

  client.on("messageCreate", (message) => {
    try {
      if (!message.guildId || !message.author || message.author.bot || !message.channelId) return;
      repository.recordMessage({ guildId: message.guildId, userId: message.author.id, channelId: message.channelId, timestamp: message.createdTimestamp || Date.now() });
    } catch (error) {
      logger.error(`[STATS] Message collector error: ${error.message}`);
    }
  });

  client.on("guildMemberAdd", (member) => {
    try {
      repository.recordMemberJoin({ guildId: member.guild.id, userId: member.id, memberCount: member.guild.memberCount, timestamp: Date.now() });
    } catch (error) {
      logger.error(`[STATS] Join collector error: ${error.message}`);
    }
  });

  client.on("guildMemberRemove", (member) => {
    try {
      repository.recordMemberLeave({ guildId: member.guild.id, userId: member.id, memberCount: member.guild.memberCount, timestamp: Date.now() });
    } catch (error) {
      logger.error(`[STATS] Leave collector error: ${error.message}`);
    }
  });

  client.once("ready", () => {
    logger.log("[STATS] Collector ready. Message and member events will be counted from now on.");
  });
}

module.exports = { attachStatsCollector };
