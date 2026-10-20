'use strict';

const { EmbedBuilder } = require('discord.js');

function buildIncidentsPanel(incidents) {
  const colorFor = (severity) => severity === 'high' || severity === 'critical' ? 0xED4245 : severity === 'low' ? 0xFEE75C : 0x5865F2;
  const first = incidents[0];
  const embed = new EmbedBuilder()
    .setColor(colorFor(first?.severity))
    .setTitle('🧾 آخر الحوادث الأمنية')
    .setDescription(incidents.map((item, index) => {
      const seconds = Math.floor(new Date(item.timestamp).getTime() / 1000);
      const safeType = String(item.type || 'UNKNOWN').replace(/[`*_~|]/g, '\\$&').slice(0, 100);
      const safeDescription = String(item.description || '').replace(/[`*_~|]/g, '\\$&').slice(0, 700);
      const safeId = String(item.id || '').replace(/[`*_~|]/g, '\\$&').slice(0, 100);
      const severity = ({ low: '🟡 منخفضة', medium: '🔵 متوسطة', high: '🟠 عالية', critical: '🔴 حرجة' })[item.severity] || '🔵 متوسطة';
      return `**${index + 1}. ${safeType}** • ${severity}\n${safeDescription}\n<t:${Number.isFinite(seconds) ? seconds : 0}:R> • ID: ${safeId}`;
    }).join('\n\n').slice(0, 4000))
    .setFooter({ text: 'سجل الحوادث محفوظ محليًا • أقصى عرض 10 حوادث' })
    .setTimestamp();
  return embed;
}

module.exports = { buildIncidentsPanel };
