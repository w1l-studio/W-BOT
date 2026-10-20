# Trivia BOT — Protection v1.1

نظام حماية مستقل قابل للتوسع، مكتوب بـ CommonJS ومتوافق مع `discord.js v14`. يشمل مراقبة التخريب الإداري، السبام، موجات الانضمام، الروابط، الرتب والقنوات والـ Webhooks؛ إعدادات لكل سيرفر؛ سجل حوادث دائم؛ قوائم موثوقة؛ ولوحة إدارة خاصة.

## أهم تغييرات v1.1

- الوضع الافتراضي `monitor`: يرصد ويُسجّل فقط، ولا يحذف الرسائل أو ينفّذ عقوبات تلقائية.
- تفعيل الوضع التنفيذي يتطلب تغييرًا إداريًا صريحًا عبر `/protection mode` مع التأكيد.
- سجل الحوادث محفوظ في `protection/data/incidents.json` وآخر 100 حادثة لكل سيرفر.
- إعدادات كل سيرفر محفوظة في `protection/data/guild-configs.json` مع كتابة ذرّية ونسخ ملفات JSON التالفة بدل الكتابة فوقها.
- `/security emergency-on` يطبّق منعًا مؤقتًا لإرسال الرسائل على القنوات النصية التي يستطيع البوت تعديلها، مع استثناء روم السجلات، ويحفظ الحالات السابقة لاستعادتها عبر `emergency-off`.
- حماية من تكرار الحوادث والعقوبات، وتحقق أدق من دومينات الروابط المسموح بها.
- أوامر التحكم تستخدم `MessageFlags.Ephemeral` بدل خيار `ephemeral` المتقادم.

## المتطلبات

- Node.js 18 أو أحدث (يُوصى بإصدار LTS حديث).
- `discord.js` v14.
- تفعيل الـ intents اللازمة في Discord Developer Portal وفي `Client`.
- صلاحيات البوت بحسب الوحدات المُفعّلة:
  - `View Audit Log` لمراقبة أحداث السجل الإداري.
  - `Manage Messages` لحذف الرسائل المخالفة.
  - `Moderate Members` لتطبيق Timeout.
  - `Manage Roles` لإزالة الرتب الحساسة، مع رتبة البوت أعلى من الرتب التي سيعدلها.
  - `Manage Channels` لتفعيل/استعادة وضع الطوارئ.
  - `View Channel`, `Send Messages`, و`Embed Links` في روم السجلات.

### Gateway intents

أضف إلى `Client` عند الحاجة:

- `GatewayIntentBits.Guilds`
- `GatewayIntentBits.GuildMembers` (Anti-Raid؛ يتطلب تفعيل Server Members Intent من البوابة)
- `GatewayIntentBits.GuildModeration` (أحداث سجل التدقيق)
- `GatewayIntentBits.GuildMessages` و`GatewayIntentBits.MessageContent` (Anti-Spam وAnti-Link؛ يتطلب Message Content Intent من البوابة)

تحتاج بعض الميزات أيضًا إلى صلاحية السيرفر المناسبة. لا يمكن للنظام ضمان منع كل عمليات التخريب قبل وقوعها؛ قد تصل أحداث Audit Log متأخرة، وقد تفشل الاستجابة بسبب ترتيب الرتب أو نقص الصلاحيات.

## الربط مع البوت

### إذا لم يكن عندك Router مركزي للأوامر

داخل `index.js` بعد إنشاء `client` وقبل `client.login(...)`:

```js
const { setupProtection } = require('./protection');
const security = setupProtection(client);
```

أضف تعريفات أوامر الحماية إلى نظام التسجيل الحالي:

```js
const protectionCommandData = security.commands.map((command) => command.data.toJSON());
// ادمج protectionCommandData مع أوامرك الحالية عند تسجيلها في Discord.
```

لا ترسل أوامر الحماية مرتين إلى Discord. لا يُسجّل هذا الملف أوامر التطبيق عبر REST تلقائيًا.

### إذا كان عندك Router مركزي للأوامر

```js
const { setupProtection } = require('./protection');
const security = setupProtection(client, { handleCommands: false });
```

في هذه الحالة يستمر النظام في التعامل مع أزرار لوحة الحماية، لكن أضف `security.commands` إلى الـ Router المركزي ودعه يستدعي `command.execute(interaction)` للأوامر الثلاثة. هذا يمنع التنفيذ المكرر أو الرد مرتين.

يجب إزالة المستمع عبر `await security.destroy()` إذا كان التطبيق يحمّل الأنظمة أو يعيد تشغيلها دون إعادة تشغيل العملية.

## الأوامر

### `/protection`

- `panel`: لوحة التحكم التفاعلية.
- `status`: حالة النظام والوحدات.
- `toggle`: تشغيل/إيقاف وحدة.
- `log-channel`: تحديد روم السجلات.
- `mode`: `monitor` أو `enforce`؛ يتطلب `confirm = true` لتفعيل التنفيذ.
- `system`: تشغيل النظام العام أو إيقافه.
- `logs`: عرض آخر الحوادث.
- `threshold`: تعديل حدود عدد عمليات Anti-Nuke، رسائل/تكرارات Anti-Spam وانضمامات Anti-Raid ضمن نطاقات آمنة.
- `nuke-response`, `spam-response`, `raid-response`, `link-response`: ضبط الاستجابة المناسبة لكل وحدة دون عرض اختيارات غير متوافقة. الإجراءات الفعلية تعمل فقط في وضع `enforce`.
- `admin-role`: منح/إزالة رتبة صلاحية إدارة النظام.
- `link-domain`: إدارة نطاقات الروابط المسموح بها.
- `link-policy`: اختيار حظر دعوات Discord فقط أو كل الروابط غير المسموح بها أو إيقاف الحظر.

### `/whitelist`

- `add-user` و`remove-user`
- `add-role` و`remove-role`
- `add-channel` و`remove-channel` (استثناء القناة من فلاتر الرسائل)
- `list`

### `/security`

- `status`
- `emergency-on` مع `confirm = true`
- `emergency-off` مع `confirm = true`

وضع الطوارئ يطبّق رفض إرسال الرسائل على `@everyone` في القنوات النصية، ويترك روم السجلات مفتوحًا. قد تستمر أدوار لها سماح صريح على القناة في الإرسال، كما يستطيع مشرفو `Administrator` تجاوز صلاحيات القنوات. استعادة الصلاحيات تُعيد فقط البتّات التي غيّرها النظام، للحفاظ على بقية إعدادات الـ overwrites قدر الإمكان. إذا توقّف البوت أثناء الإغلاق الآلي، يُستأنف المؤقت عند عودته. وإذا تعذرت استعادة قناة، يبقى معرّفها محفوظًا لإعادة المحاولة بدل اعتبار العملية ناجحة بالكامل.

## الوحدات وسلوكها

| الوحدة | السلوك |
|---|---|
| Anti-Nuke | يجمع عمليات Audit Log حسب المنفذ والفترة. افتراضيًا يسجل التنبيه فقط. |
| Anti-Spam | يكتشف كثافة الرسائل وتكرارها. لا يحذف في وضع المراقبة. |
| Anti-Raid | يرصد موجات الانضمام، والاستجابة الافتراضية تنبيه فقط. |
| Anti-Link | متوقف افتراضيًا؛ بعد تفعيله يمكن حظر الدعوات أو الروابط وفق الإعداد. |
| Anti-Role | يسجّل إضافة صلاحيات إدارية حساسة؛ لا يعيد تغيير الصلاحيات تلقائيًا. |
| Anti-Channel | يسجّل إنشاء/حذف القنوات وفق الإعدادات. |
| Anti-Webhook | يسجّل إنشاء/حذف/تعديل الـ Webhooks حسب الإعداد. |

المالك والأعضاء/الرتب في قائمة الموثوقين مستثنون من وحدات التصفية المعتادة. استثناء القنوات يؤثر في Anti-Spam وAnti-Link فقط.

## التخزين والخصوصية

- الإعدادات: `protection/data/guild-configs.json`
- الحوادث: `protection/data/incidents.json`
- تُحفظ الحوادث بحد أقصى 100 حادثة لكل سيرفر.
- لا يحفظ Anti-Spam نص الرسالة في ملف الحوادث؛ يُسجّل أعداد الرسائل والقناة ومعرّف العضو.
- لا ترفع مجلد `protection/data/` إلى مستودع عام؛ يحتوي معرّفات وإعدادات تشغيل السيرفر.

## الاختبار

شغّل اختبارات المنطق والتخزين المحلية:

```bash
node protection/tests/run.js
```

ثم جرّب في سيرفر خاص بالاختبار قبل تفعيل `enforce`: عيّن روم السجلات، تأكد من ظهور الحوادث، اختبر الروابط والسبام بحساب اختبار، ثم اختبر تفعيل/فك الطوارئ وتأكد من استعادة الصلاحيات. تأكد من `node --check` لكل الملفات بعد أي تعديل.

## إضافة وحدة جديدة

1. أنشئ مجلدًا في `modules/<moduleName>/` وصدّر handler واضحًا من `index.js`.
2. أضف listener واحدًا في `core/ModuleLoader.js` باستخدام `EventRegistry`.
3. عرّف إعدادات افتراضية في `config.js` مع وضع مراقبة آمن.
4. افصل الكشف عن الاستجابة إذا احتاجت الوحدة عقوبات أو إجراءات ذات آثار خارجية.
5. أضف اختبارات وتوثيقًا، وتأكد أن `destroy()` يزيل كل listeners والـ timers.
