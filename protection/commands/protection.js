'use strict';

const {
  SlashCommandBuilder, ChannelType, MessageFlags,
} = require('discord.js');
const { FEATURES, MODES } = require('../core/ProtectionManager');
const { LABELS, buildMainPanel } = require('../dashboard/mainPanel');
const { buildIncidentsPanel } = require('../dashboard/incidentsPanel');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

function createProtectionCommand(manager) {
  return {
    data: new SlashCommandBuilder()
      .setName('protection')
      .setDescription('مركز إدارة نظام الحماية')
      .addSubcommand((sub) => sub.setName('panel').setDescription('عرض لوحة الحماية التفاعلية'))
      .addSubcommand((sub) => sub.setName('status').setDescription('عرض حالة النظام والوحدات'))
      .addSubcommand((sub) => sub.setName('toggle').setDescription('تشغيل أو إيقاف وحدة حماية')
        .addStringOption((option) => option.setName('feature').setDescription('وحدة الحماية').setRequired(true)
          .addChoices(...FEATURES.map((key) => ({ name: LABELS[key], value: key }))))
        .addBooleanOption((option) => option.setName('enabled').setDescription('الحالة المطلوبة').setRequired(true)))
      .addSubcommand((sub) => sub.setName('log-channel').setDescription('تحديد روم سجلات الحماية')
        .addChannelOption((option) => option.setName('channel').setDescription('روم السجلات').setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((sub) => sub.setName('mode').setDescription('تحديد وضع المراقبة أو التنفيذ')
        .addStringOption((option) => option.setName('mode').setDescription('وضع التشغيل').setRequired(true)
          .addChoices({ name: 'مراقبة فقط — بدون عقوبات تلقائية', value: 'monitor' }, { name: 'تنفيذ الإجراءات', value: 'enforce' }))
        .addBooleanOption((option) => option.setName('confirm').setDescription('أؤكد اختيار وضع التنفيذ عند الحاجة').setRequired(true)))
      .addSubcommand((sub) => sub.setName('system').setDescription('تشغيل نظام الحماية بالكامل أو إيقافه')
        .addBooleanOption((option) => option.setName('enabled').setDescription('تشغيل النظام').setRequired(true)))
      .addSubcommand((sub) => sub.setName('logs').setDescription('عرض آخر الحوادث الأمنية المسجلة')
        .addIntegerOption((option) => option.setName('limit').setDescription('عدد الحوادث').setMinValue(1).setMaxValue(10)))
      .addSubcommand((sub) => sub.setName('admin-role').setDescription('إضافة أو إزالة رتبة مسموح لها بإدارة الحماية')
        .addStringOption((option) => option.setName('action').setDescription('العملية').setRequired(true).addChoices({ name: 'إضافة', value: 'add' }, { name: 'إزالة', value: 'remove' }))
        .addRoleOption((option) => option.setName('role').setDescription('الرتبة الإدارية').setRequired(true)))
      .addSubcommand((sub) => sub.setName('link-domain').setDescription('إدارة دومينات الروابط المسموح بها')
        .addStringOption((option) => option.setName('action').setDescription('العملية').setRequired(true).addChoices({ name: 'إضافة', value: 'add' }, { name: 'إزالة', value: 'remove' }))
        .addStringOption((option) => option.setName('domain').setDescription('اسم النطاق مثل example.com').setRequired(true).setMinLength(3).setMaxLength(253)))
      .addSubcommand((sub) => sub.setName('link-policy').setDescription('تحديد سياسة الروابط')
        .addStringOption((option) => option.setName('policy').setDescription('سياسة الروابط').setRequired(true).addChoices(
          { name: 'حظر دعوات Discord فقط', value: 'invites' },
          { name: 'حظر كل الروابط غير المسموح بها', value: 'all' },
          { name: 'إيقاف حظر الروابط', value: 'none' },
        )))
      .addSubcommand((sub) => sub.setName('threshold').setDescription('تعديل حدود اكتشاف النشاط')
        .addStringOption((option) => option.setName('metric').setDescription('الحد الذي تريد تغييره').setRequired(true).addChoices(
          { name: 'عمليات Anti-Nuke', value: 'nuke-actions' },
          { name: 'رسائل Anti-Spam', value: 'spam-messages' },
          { name: 'تكرارات Anti-Spam', value: 'spam-duplicates' },
          { name: 'انضمامات Anti-Raid', value: 'raid-joins' },
        ))
        .addIntegerOption((option) => option.setName('value').setDescription('القيمة الجديدة ضمن النطاق المسموح').setRequired(true).setMinValue(3).setMaxValue(100)))
      .addSubcommand((sub) => sub.setName('nuke-response').setDescription('تحديد استجابة Anti-Nuke')
        .addStringOption((option) => option.setName('response').setDescription('الاستجابة').setRequired(true).addChoices(
          { name: 'تسجيل فقط', value: 'log' }, { name: 'Timeout', value: 'timeout' }, { name: 'إزالة الرتب الإدارية الحساسة', value: 'strip_roles' },
        )))
      .addSubcommand((sub) => sub.setName('spam-response').setDescription('تحديد استجابة Anti-Spam')
        .addStringOption((option) => option.setName('response').setDescription('الاستجابة').setRequired(true).addChoices(
          { name: 'حذف الرسالة', value: 'delete' }, { name: 'Timeout', value: 'timeout' }, { name: 'حذف وTimeout', value: 'delete_timeout' },
        )))
      .addSubcommand((sub) => sub.setName('raid-response').setDescription('تحديد استجابة Anti-Raid')
        .addStringOption((option) => option.setName('response').setDescription('الاستجابة').setRequired(true).addChoices(
          { name: 'تنبيه فقط', value: 'alert' }, { name: 'وضع الطوارئ', value: 'lockdown' },
        )))
      .addSubcommand((sub) => sub.setName('link-response').setDescription('تحديد استجابة Anti-Link')
        .addStringOption((option) => option.setName('response').setDescription('الاستجابة').setRequired(true).addChoices(
          { name: 'حذف الرسالة', value: 'delete' }, { name: 'Timeout', value: 'timeout' }, { name: 'حذف وTimeout', value: 'delete_timeout' },
        ))),
    async execute(interaction) {
      if (!interaction.guild) return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفر فقط.', ...EPHEMERAL });
      const config = await manager.getConfig(interaction.guild.id);
      if (!await manager.isDashboardAdmin(interaction, config)) {
        return interaction.reply({ content: 'تحتاج صلاحية Administrator أو رتبة تحكم مخصصة في إعدادات النظام.', ...EPHEMERAL });
      }
      const sub = interaction.options.getSubcommand();
      if (sub === 'panel' || sub === 'status') {
        const status = await manager.getStatus(interaction.guild.id);
        const payload = sub === 'panel' ? buildMainPanel(status) : {
          content: [
            `حالة النظام: ${status.enabled ? 'يعمل' : 'متوقف'}`,
            `الوضع: ${status.operatingMode === 'enforce' ? 'تنفيذ' : 'مراقبة فقط'}`,
            `الطوارئ: ${status.emergency ? 'مفعّلة' : 'متوقفة'}`,
            ...FEATURES.map((key) => `${LABELS[key]}: ${status.features[key] ? 'مفعّل' : 'متوقف'}`),
          ].join('\n'),
        };
        return interaction.reply({ ...payload, ...EPHEMERAL });
      }
      if (sub === 'toggle') {
        const feature = interaction.options.getString('feature', true);
        const enabled = interaction.options.getBoolean('enabled', true);
        await manager.setFeature(interaction.guild.id, feature, enabled);
        await manager.recordIncident(interaction.guild, 'CONFIG_FEATURE', `تم ${enabled ? 'تفعيل' : 'إيقاف'} ${LABELS[feature]}.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'low', { actorId: interaction.user.id, feature, enabled });
        return interaction.reply({ content: `تم ${enabled ? 'تفعيل' : 'إيقاف'} **${LABELS[feature]}**.`, ...EPHEMERAL });
      }
      if (sub === 'log-channel') {
        const channel = interaction.options.getChannel('channel', true);
        await manager.setLogChannel(interaction.guild.id, channel.id);
        await manager.recordIncident(interaction.guild, 'CONFIG_LOG_CHANNEL', 'تم تغيير روم سجلات الحماية.', [
          { name: 'القناة', value: `<#${channel.id}>`, inline: true },
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'low', { actorId: interaction.user.id, channelId: channel.id });
        return interaction.reply({ content: `تم تعيين ${channel} كروم لسجلات الحماية.`, ...EPHEMERAL });
      }
      if (sub === 'mode') {
        const mode = interaction.options.getString('mode', true);
        const confirm = interaction.options.getBoolean('confirm', true);
        if (!MODES.includes(mode)) return interaction.reply({ content: 'وضع التشغيل غير صالح.', ...EPHEMERAL });
        if (mode === 'enforce' && !confirm) return interaction.reply({ content: 'لم يتم تفعيل التنفيذ. اختر تأكيد = نعم بعد اختبار وضع المراقبة.', ...EPHEMERAL });
        await manager.setOperatingMode(interaction.guild.id, mode);
        await manager.recordIncident(interaction.guild, 'CONFIG_MODE', `تم تغيير وضع الحماية إلى ${mode}.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], mode === 'enforce' ? 'high' : 'low', { actorId: interaction.user.id, mode });
        return interaction.reply({ content: mode === 'enforce' ? '⚠️ تم تفعيل وضع التنفيذ. قد تُحذف الرسائل المخالفة وتُنفذ الاستجابات المحددة في الإعدادات.' : '✅ تم ضبط النظام على المراقبة فقط؛ لن تُنفذ عقوبات تلقائية.', ...EPHEMERAL });
      }
      if (sub === 'system') {
        const enabled = interaction.options.getBoolean('enabled', true);
        await manager.setSystemEnabled(interaction.guild.id, enabled);
        await manager.recordIncident(interaction.guild, 'CONFIG_SYSTEM', `تم ${enabled ? 'تشغيل' : 'إيقاف'} نظام الحماية بالكامل.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'medium', { actorId: interaction.user.id, enabled });
        return interaction.reply({ content: `تم ${enabled ? 'تشغيل' : 'إيقاف'} نظام الحماية بالكامل.`, ...EPHEMERAL });
      }


      if (sub === 'admin-role') {
        const action = interaction.options.getString('action', true);
        const role = interaction.options.getRole('role', true);
        const enabled = action === 'add';
        if (enabled && role.id === interaction.guild.id) return interaction.reply({ content: 'لا يمكن منح رتبة @everyone صلاحية إدارة الحماية.', ...EPHEMERAL });
        await manager.setDashboardRole(interaction.guild.id, role.id, enabled);
        await manager.recordIncident(interaction.guild, 'CONFIG_ADMIN_ROLE', `تم ${enabled ? 'السماح' : 'إلغاء السماح'} لرتبة بإدارة لوحة الحماية.`, [
          { name: 'الرتبة', value: `<@&${role.id}>`, inline: true },
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'medium', { actorId: interaction.user.id, roleId: role.id, enabled });
        return interaction.reply({ content: `تم ${enabled ? 'السماح' : 'إلغاء السماح'} للرتبة ${role} بإدارة الحماية.`, allowedMentions: { parse: [] }, ...EPHEMERAL });
      }
      if (sub === 'link-domain') {
        const action = interaction.options.getString('action', true);
        const rawDomain = interaction.options.getString('domain', true).trim().toLowerCase();
        const domainCandidate = rawDomain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        let domain;
        try {
          if (/[\s/?:#@]/.test(domainCandidate)) throw new Error('invalid domain');
          const url = new URL(`https://${domainCandidate}`);
          if (!url.hostname.includes('.') || url.hostname.length > 253) throw new Error('invalid domain');
          domain = url.hostname.toLowerCase();
        } catch {
          return interaction.reply({ content: 'اسم النطاق غير صالح. اكتب دومينًا فقط مثل example.com بدون مسار.', ...EPHEMERAL });
        }
        const enabled = action === 'add';
        await manager.setAllowedDomain(interaction.guild.id, domain, enabled);
        await manager.recordIncident(interaction.guild, 'CONFIG_LINK_DOMAIN', `تم ${enabled ? 'إضافة' : 'إزالة'} نطاق من قائمة السماح للروابط.`, [
          { name: 'النطاق', value: domain, inline: true },
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'low', { actorId: interaction.user.id, domain, enabled });
        return interaction.reply({ content: `تم ${enabled ? 'إضافة' : 'إزالة'} \`${domain}\` من قائمة النطاقات المسموح بها.`, ...EPHEMERAL });
      }

      if (sub === 'link-policy') {
        const policy = interaction.options.getString('policy', true);
        await manager.updateConfig(interaction.guild.id, (current) => {
          current.antiLink.blockInvites = policy === 'invites' || policy === 'all';
          current.antiLink.blockAllLinks = policy === 'all';
          return current;
        });
        await manager.recordIncident(interaction.guild, 'CONFIG_LINK_POLICY', `تم تغيير سياسة الروابط إلى ${policy}.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'low', { actorId: interaction.user.id, policy });
        const labels = { invites: 'حظر دعوات Discord فقط', all: 'حظر كل الروابط غير المسموح بها', none: 'إيقاف حظر الروابط' };
        return interaction.reply({ content: `تم ضبط سياسة الروابط: **${labels[policy]}**. تأكد أن وحدة Anti-Link مفعّلة إذا أردت تطبيقها.`, ...EPHEMERAL });
      }
      if (sub === 'threshold') {
        const metric = interaction.options.getString('metric', true);
        const value = interaction.options.getInteger('value', true);
        const ranges = {
          'nuke-actions': { path: ['antiNuke', 'maxActions'], min: 3, max: 20 },
          'spam-messages': { path: ['antiSpam', 'maxMessages'], min: 3, max: 30 },
          'spam-duplicates': { path: ['antiSpam', 'maxDuplicates'], min: 2, max: 20 },
          'raid-joins': { path: ['antiRaid', 'maxJoins'], min: 3, max: 100 },
        };
        const definition = ranges[metric];
        if (!definition || value < definition.min || value > definition.max) {
          return interaction.reply({ content: 'القيمة خارج النطاق المسموح لهذا الحد.', ...EPHEMERAL });
        }
        await manager.updateConfig(interaction.guild.id, (current) => {
          current[definition.path[0]][definition.path[1]] = value;
          return current;
        });
        await manager.recordIncident(interaction.guild, 'CONFIG_THRESHOLD', `تم تعديل الحد ${metric} إلى ${value}.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'low', { actorId: interaction.user.id, metric, value });
        return interaction.reply({ content: `تم تحديث الحد **${metric}** إلى **${value}**.`, ...EPHEMERAL });
      }
      if (['nuke-response', 'spam-response', 'raid-response', 'link-response'].includes(sub)) {
        const featureBySubcommand = {
          'nuke-response': 'antiNuke',
          'spam-response': 'antiSpam',
          'raid-response': 'antiRaid',
          'link-response': 'antiLink',
        };
        const feature = featureBySubcommand[sub];
        const response = interaction.options.getString('response', true);
        await manager.updateConfig(interaction.guild.id, (current) => {
          current[feature].response = response;
          return current;
        });
        await manager.recordIncident(interaction.guild, 'CONFIG_RESPONSE', `تم تغيير استجابة ${feature} إلى ${response}.`, [
          { name: 'بواسطة', value: `<@${interaction.user.id}>`, inline: true },
        ], 'medium', { actorId: interaction.user.id, feature, response });
        return interaction.reply({ content: `تم ضبط استجابة **${feature}** إلى **${response}**. يعمل التنفيذ الفعلي فقط عند تفعيل وضع التنفيذ.`, ...EPHEMERAL });
      }
      if (sub === 'logs') {
        const limit = interaction.options.getInteger('limit') || 5;
        const incidents = await manager.incidents.getRecent(interaction.guild.id, limit);
        if (!incidents.length) return interaction.reply({ content: 'لا توجد حوادث مسجلة حتى الآن.', ...EPHEMERAL });
        const embed = buildIncidentsPanel(incidents);
        return interaction.reply({ embeds: [embed], ...EPHEMERAL });
      }
    },
  };
}

module.exports = { createProtectionCommand, FEATURES, LABELS, buildPanel: buildMainPanel };
