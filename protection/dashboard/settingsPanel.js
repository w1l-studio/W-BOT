'use strict';

const { EmbedBuilder } = require('discord.js');

function buildSettingsPanel(config) {
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('⚙️ إعدادات Trivia Security')
    .setDescription(`**الوضع:** ${config.operatingMode === 'enforce' ? 'تنفيذ' : 'مراقبة فقط'}\n**النظام العام:** ${config.enabled ? 'مفعّل' : 'متوقف'}\n**روم السجلات:** ${config.logChannelId ? `<#${config.logChannelId}>` : 'غير محدد'}`)
    .addFields(
      { name: 'Anti-Nuke', value: `${config.antiNuke.maxActions} عمليات خلال ${config.antiNuke.windowMs / 1000} ثانية • الاستجابة: ${config.antiNuke.response}`, inline: false },
      { name: 'Anti-Spam', value: `${config.antiSpam.maxMessages} رسائل خلال ${config.antiSpam.windowMs / 1000} ثانية • الاستجابة: ${config.antiSpam.response}`, inline: false },
      { name: 'Anti-Raid', value: `${config.antiRaid.maxJoins} انضمامات خلال ${config.antiRaid.windowMs / 1000} ثانية • الاستجابة: ${config.antiRaid.response}`, inline: false },
      { name: 'Anti-Link', value: `حالة الوحدة: ${config.antiLink.enabled ? 'مفعّلة' : 'متوقفة'} • حظر الدعوات: ${config.antiLink.blockInvites ? 'نعم' : 'لا'}`, inline: false },
    )
    .setTimestamp();
}

module.exports = { buildSettingsPanel };
