'use strict';

const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function createWhitelistCommand(manager) {
  return {
    data: new SlashCommandBuilder()
      .setName('whitelist')
      .setDescription('إدارة قائمة الاستثناءات الموثوقة للحماية')
      .addSubcommand((s) => s.setName('add-user').setDescription('إضافة عضو موثوق')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
      .addSubcommand((s) => s.setName('remove-user').setDescription('إزالة عضو موثوق')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
      .addSubcommand((s) => s.setName('add-role').setDescription('إضافة رتبة موثوقة')
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true)))
      .addSubcommand((s) => s.setName('remove-role').setDescription('إزالة رتبة موثوقة')
        .addRoleOption((o) => o.setName('role').setDescription('الرتبة').setRequired(true)))
      .addSubcommand((s) => s.setName('add-channel').setDescription('استثناء قناة من فلاتر الرسائل')
        .addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((s) => s.setName('remove-channel').setDescription('إلغاء استثناء قناة')
        .addChannelOption((o) => o.setName('channel').setDescription('القناة').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((s) => s.setName('list').setDescription('عرض قائمة الاستثناءات الموثوقة')),
    async execute(interaction) {
      if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفر فقط.', ...EPHEMERAL });
      const config = await manager.getConfig(interaction.guild.id);
      if (!await manager.isDashboardAdmin(interaction, config)) return interaction.reply({ content: 'ليس لديك صلاحية إدارة قائمة الاستثناءات.', ...EPHEMERAL });
      const sub = interaction.options.getSubcommand();
      if (sub === 'list') {
        const users = config.whitelistUserIds.slice(0, 25).map((id) => `<@${id}>`).join('\n') || 'لا يوجد';
        const roles = config.whitelistRoleIds.slice(0, 25).map((id) => `<@&${id}>`).join('\n') || 'لا يوجد';
        const channels = config.whitelistChannelIds.slice(0, 25).map((id) => `<#${id}>`).join('\n') || 'لا يوجد';
        return interaction.reply({ content: `**الأعضاء:**\n${users}\n\n**الرتب:**\n${roles}\n\n**القنوات المستثناة من فلاتر الرسائل:**\n${channels}`, allowedMentions: { parse: [] }, ...EPHEMERAL });
      }
      let kind; let item; let enabled;
      if (sub.endsWith('-user')) {
        kind = 'user'; item = interaction.options.getUser('user', true); enabled = sub === 'add-user';
      } else if (sub.endsWith('-role')) {
        kind = 'role'; item = interaction.options.getRole('role', true); enabled = sub === 'add-role';
      } else {
        kind = 'channel'; item = interaction.options.getChannel('channel', true); enabled = sub === 'add-channel';
      }
      if (kind === 'role' && enabled && item.id === interaction.guild.id) {
        return interaction.reply({ content: 'لا يمكن إضافة رتبة @everyone إلى قائمة الموثوقين.', ...EPHEMERAL });
      }
      await manager.setWhitelist(interaction.guild.id, kind, item.id, enabled);
      const mention = kind === 'user' ? `<@${item.id}>` : kind === 'role' ? `<@&${item.id}>` : `<#${item.id}>`;
      await manager.recordIncident(interaction.guild, 'CONFIG_WHITELIST', `تم ${enabled ? 'إضافة' : 'إزالة'} عنصر في قائمة الاستثناءات.`, [
        { name: 'النوع', value: kind, inline: true },
        { name: 'المعرّف', value: item.id, inline: true },
        { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
      ], 'low', { actorId: interaction.user.id, kind, targetId: item.id, enabled });
      return interaction.reply({ content: `تم ${enabled ? 'إضافة' : 'إزالة'} ${mention} ${kind === 'channel' ? 'من قائمة استثناء فلاتر الرسائل' : 'من قائمة العناصر الموثوقة'}.`, allowedMentions: { parse: [] }, ...EPHEMERAL });
    },
  };
}

module.exports = { createWhitelistCommand };
