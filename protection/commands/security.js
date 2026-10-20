'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function createSecurityCommand(manager) {
  return {
    data: new SlashCommandBuilder()
      .setName('security')
      .setDescription('إدارة طوارئ الحماية')
      .addSubcommand((s) => s.setName('status').setDescription('عرض حالة وضع الطوارئ'))
      .addSubcommand((s) => s.setName('emergency-on').setDescription('تفعيل إغلاق مؤقت للقنوات النصية')
        .addBooleanOption((o) => o.setName('confirm').setDescription('تأكيد تفعيل وضع الطوارئ').setRequired(true)))
      .addSubcommand((s) => s.setName('emergency-off').setDescription('استعادة صلاحيات القنوات المحفوظة')
        .addBooleanOption((o) => o.setName('confirm').setDescription('تأكيد استعادة صلاحيات القنوات').setRequired(true))),
    async execute(interaction) {
      if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفر فقط.', ...EPHEMERAL });
      const config = await manager.getConfig(interaction.guild.id);
      if (!await manager.isDashboardAdmin(interaction, config)) return interaction.reply({ content: 'ليس لديك صلاحية إدارة الحماية.', ...EPHEMERAL });
      const sub = interaction.options.getSubcommand();
      if (sub === 'status') {
        const current = await manager.getConfig(interaction.guild.id);
        const failed = current.emergency.failedChannelIds || [];
        return interaction.reply({ content: `وضع الطوارئ: **${current.emergency.enabled ? 'مفعّل' : 'متوقف'}**\nقنوات تحت الإغلاق: **${current.emergency.snapshot?.length || 0}**\nقنوات تحتاج مراجعة: **${failed.length}**${failed.length ? `\n${failed.slice(0, 10).map((id) => `<#${id}>`).join(' ')}` : ''}`, ...EPHEMERAL });
      }
      const confirm = interaction.options.getBoolean('confirm', true);
      if (!confirm) return interaction.reply({ content: 'تم إلغاء العملية؛ يجب تأكيد الإجراء صراحةً.', ...EPHEMERAL });
      const enabled = sub === 'emergency-on';
      await interaction.deferReply(EPHEMERAL);
      const result = await manager.setEmergency(interaction.guild, enabled, interaction.user.id, enabled ? 'Manual security lockdown' : 'Manual security unlockdown');
      let content;
      if (enabled) {
        content = result.alreadyActive
          ? `وضع الطوارئ مفعّل بالفعل. القنوات التي تحتاج مراجعة: ${(result.failed || []).length}.`
          : `🚨 تم تفعيل وضع الطوارئ. تم منع إرسال الرسائل في ${result.applied} قناة نصية؛ فشل التعديل في ${result.failed.length} قناة. استخدم /security status لمراجعة الحالة.`;
      } else {
        content = result.alreadyInactive
          ? 'وضع الطوارئ غير مفعّل ولا توجد صلاحيات محفوظة للاستعادة.'
          : `تمت استعادة الصلاحيات في ${result.restored} قناة. القنوات التي تحتاج مراجعة: ${result.failed.length}. ${result.failed.length ? 'أعد المحاولة بعد إصلاح صلاحيات البوت.' : ''}`;
      }
      return interaction.editReply({ content, allowedMentions: { parse: [] } });
    },
  };
}

module.exports = { createSecurityCommand };
