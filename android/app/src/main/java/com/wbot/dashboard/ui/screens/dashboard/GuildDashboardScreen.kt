package com.wbot.dashboard.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wbot.dashboard.data.model.CommandItem
import com.wbot.dashboard.data.model.GuildStats
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GuildDashboardScreen(
    guildId: String,
    onBackClick: () -> Unit,
    onNavigateToTickets: (String) -> Unit,
    viewModel: GuildDashboardViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val isSaving by viewModel.isSaving.collectAsState()
    val saveMessage by viewModel.saveSuccessMessage.collectAsState()

    var selectedTab by remember { mutableIntStateOf(0) }

    val tabs = listOf(
        "عام",
        "الترحيب",
        "السجلات",
        "التذاكر",
        "الحماية",
        "الأوامر",
        "الإحصائيات"
    )

    LaunchedEffect(guildId) {
        viewModel.loadGuildDashboard(guildId)
    }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(saveMessage) {
        saveMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.saveSuccessMessage.value = null
        }
    }

    Scaffold(
        topBar = {
            val title = (uiState as? DashboardUiState.Success)?.guild?.name ?: "Dashboard السيرفر"
            WBotTopAppBar(
                title = title,
                showBackButton = true,
                onBackClick = onBackClick,
                actions = {
                    IconButton(onClick = { viewModel.loadGuildDashboard(guildId) }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "تحديث",
                            tint = TextPrimary
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = BackgroundDark
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is DashboardUiState.Loading -> LoadingState(message = "جاري تحميل إعدادات السيرفر...")
                is DashboardUiState.Error -> ErrorState(message = state.message, onRetry = { viewModel.loadGuildDashboard(guildId) })
                is DashboardUiState.Success -> {
                    val channels = state.channels.map { it.id to "#${it.name}" }
                    val textChannels = state.channels.filter { it.type == 0 }.map { it.id to "#${it.name}" }

                    Column(modifier = Modifier.fillMaxSize()) {
                        // Scrollable Tab Row
                        ScrollableTabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = SurfaceDark,
                            contentColor = DiscordBlurple,
                            edgePadding = 16.dp
                        ) {
                            tabs.forEachIndexed { index, tabTitle ->
                                Tab(
                                    selected = selectedTab == index,
                                    onClick = { selectedTab = index },
                                    text = {
                                        Text(
                                            text = tabTitle,
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal,
                                            color = if (selectedTab == index) DiscordBlurple else TextSecondary
                                        )
                                    }
                                )
                            }
                        }

                        // Tab Content
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            when (selectedTab) {
                                0 -> GeneralTab(viewModel, textChannels)
                                1 -> WelcomeTab(viewModel, textChannels)
                                2 -> LoggingTab(viewModel, textChannels)
                                3 -> TicketsTab(viewModel, state.stats, onNavigateToTickets = { onNavigateToTickets(guildId) })
                                4 -> ProtectionTab(viewModel)
                                5 -> CommandsTab(state.commands)
                                6 -> StatisticsTab(state.stats)
                            }
                        }

                        // Bottom Save Button
                        if (selectedTab in 0..4) {
                            Surface(
                                color = SurfaceDark,
                                tonalElevation = 8.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(modifier = Modifier.padding(16.dp)) {
                                    WBotButton(
                                        text = "حفظ التغييرات",
                                        onClick = { viewModel.saveConfig(guildId) },
                                        isLoading = isSaving,
                                        icon = Icons.Default.Save
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GeneralTab(
    viewModel: GuildDashboardViewModel,
    textChannels: List<Pair<String, String>>
) {
    val prefix by viewModel.prefix.collectAsState()
    val logChannelId by viewModel.logChannelId.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "⚙️ الإعدادات العامة",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        WBotCard {
            WBotTextField(
                value = prefix,
                onValueChange = { viewModel.prefix.value = it },
                label = "Prefix السيرفر",
                placeholder = "!"
            )

            Spacer(modifier = Modifier.height(16.dp))

            WBotDropdown(
                label = "روم اللوج والسجلات العامة",
                options = textChannels,
                selectedId = logChannelId,
                onOptionSelected = { viewModel.logChannelId.value = it.ifEmpty { null } }
            )
        }
    }
}

@Composable
private fun WelcomeTab(
    viewModel: GuildDashboardViewModel,
    textChannels: List<Pair<String, String>>
) {
    val welcomeEnabled by viewModel.welcomeEnabled.collectAsState()
    val welcomeChannelId by viewModel.welcomeChannelId.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "👋 نظام الترحيب بالأعضاء الجدد",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        WBotCard {
            WBotSwitchRow(
                title = "تفعيل الترحيب",
                description = "إرسال رسالة ترحيبية تلقائية مع صورة العضو عند انضمامه للسيرفر",
                checked = welcomeEnabled,
                onCheckedChange = { viewModel.welcomeEnabled.value = it }
            )

            if (welcomeEnabled) {
                Spacer(modifier = Modifier.height(16.dp))
                WBotDropdown(
                    label = "اختيار قناة الترحيب",
                    options = textChannels,
                    selectedId = welcomeChannelId,
                    onOptionSelected = { viewModel.welcomeChannelId.value = it.ifEmpty { null } }
                )
            }
        }
    }
}

@Composable
private fun LoggingTab(
    viewModel: GuildDashboardViewModel,
    textChannels: List<Pair<String, String>>
) {
    val logChannelId by viewModel.logChannelId.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "📋 نظام السجلات واللوج",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        WBotCard {
            Text(
                text = "سجلات الحماية والإدارة",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "يتم إرسال إشعارات الحظر، الكتم، حذف الرومات والرتب، والتعديلات الأمنية في هذا الروم",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )

            Spacer(modifier = Modifier.height(16.dp))

            WBotDropdown(
                label = "روم سجلات الحماية (Security Log Channel)",
                options = textChannels,
                selectedId = logChannelId,
                onOptionSelected = { viewModel.logChannelId.value = it.ifEmpty { null } }
            )
        }
    }
}

@Composable
private fun TicketsTab(
    viewModel: GuildDashboardViewModel,
    stats: GuildStats,
    onNavigateToTickets: () -> Unit
) {
    val ticketsEnabled by viewModel.ticketsEnabled.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "🎫 نظام التذاكر المتقدم",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        WBotCard {
            WBotSwitchRow(
                title = "تفعيل نظام التذاكر",
                description = "السماح للأعضاء بفتح تذاكر دعم وإبلاغ وتوثيق واقتراحات",
                checked = ticketsEnabled,
                onCheckedChange = { viewModel.ticketsEnabled.value = it }
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WBotStatCard(
                title = "التذاكر المفتوحة",
                value = "${stats.openTickets}",
                icon = Icons.Default.ConfirmationNumber,
                iconColor = WarningGold,
                modifier = Modifier.weight(1f)
            )
            WBotStatCard(
                title = "التذاكر المغلقة",
                value = "${stats.closedTickets}",
                icon = Icons.Default.TaskAlt,
                iconColor = InfoBlue,
                modifier = Modifier.weight(1f)
            )
        }

        WBotButton(
            text = "عرض وإدارة جميع تذاكر السيرفر 🎫",
            onClick = onNavigateToTickets,
            color = DiscordBlurple,
            icon = Icons.Default.OpenInNew
        )
    }
}

@Composable
private fun ProtectionTab(
    viewModel: GuildDashboardViewModel
) {
    val protectionEnabled by viewModel.protectionEnabled.collectAsState()
    val antiBot by viewModel.antiBot.collectAsState()
    val antiMassBan by viewModel.antiMassBan.collectAsState()
    val antiMassKick by viewModel.antiMassKick.collectAsState()
    val antiChannelDelete by viewModel.antiChannelDelete.collectAsState()
    val antiRoleDelete by viewModel.antiRoleDelete.collectAsState()
    val antiSpam by viewModel.antiSpam.collectAsState()
    val antiInvites by viewModel.antiInvites.collectAsState()
    val antiMassMention by viewModel.antiMassMention.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "🛡️ أنظمة الحماية والأمان",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        WBotCard {
            WBotSwitchRow(
                title = "الحماية العامة مفعلة",
                description = "تشغيل أو إيقاف جميع أنظمة الحماية التلقائية",
                checked = protectionEnabled,
                onCheckedChange = { viewModel.protectionEnabled.value = it }
            )
        }

        if (protectionEnabled) {
            WBotCard {
                Text(
                    text = "أنظمة الحماية التلقائية:",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )

                Spacer(modifier = Modifier.height(12.dp))

                WBotSwitchRow(
                    title = "🤖 Anti Bot",
                    description = "منع حظر البوتات غير المصرح بها فور انضمامها",
                    checked = antiBot,
                    onCheckedChange = { viewModel.antiBot.value = it }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "🚨 Anti Mass Ban",
                    description = "حظر من يقدم على حظر عدة أعضاء في وقت قصير",
                    checked = antiMassBan,
                    onCheckedChange = { viewModel.antiMassBan.value = it }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "👢 Anti Mass Kick",
                    description = "حظر من يقدم على طرد عدة أعضاء في وقت قصير",
                    checked = antiMassKick,
                    onCheckedChange = { viewModel.antiMassKick.value = it }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "📁 Anti Channel Delete / Create",
                    description = "حظر من يحذف أو ينشئ عدة رومات بكثرة",
                    checked = antiChannelDelete,
                    onCheckedChange = {
                        viewModel.antiChannelDelete.value = it
                        viewModel.antiChannelCreate.value = it
                    }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "🎭 Anti Role Delete / Create",
                    description = "حظر من يحذف أو ينشئ عدة رتب بكثرة",
                    checked = antiRoleDelete,
                    onCheckedChange = {
                        viewModel.antiRoleDelete.value = it
                        viewModel.antiRoleCreate.value = it
                    }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "🚫 Anti Spam",
                    description = "كتم العضو تلقائيًا لمدة 10 دقائق عند تكرار الرسائل بكثرة",
                    checked = antiSpam,
                    onCheckedChange = { viewModel.antiSpam.value = it }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "🔗 Anti Invites",
                    description = "حذف روابط دعوات السيرفرات تلقائيًا",
                    checked = antiInvites,
                    onCheckedChange = { viewModel.antiInvites.value = it }
                )

                HorizontalDivider(color = CardBorder, modifier = Modifier.padding(vertical = 4.dp))

                WBotSwitchRow(
                    title = "📢 Anti Mass Mention",
                    description = "حذف الرسالة وإعطاء تايم أوت فور المنشن الجماعي المكثف",
                    checked = antiMassMention,
                    onCheckedChange = { viewModel.antiMassMention.value = it }
                )
            }
        }
    }
}

@Composable
private fun CommandsTab(commands: List<CommandItem>) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(commands) { cmd ->
            WBotCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "/${cmd.name}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = DiscordBlurple
                    )
                    WBotBadge(text = cmd.category, color = InfoBlue)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = cmd.description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "الصلاحية المطلوبة: ${cmd.permission}",
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted
                )
            }
        }
    }
}

@Composable
private fun StatisticsTab(stats: GuildStats) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "📈 إحصائيات السيرفر الحالية",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WBotStatCard(
                title = "الأعضاء",
                value = "${stats.memberCount}",
                icon = Icons.Default.People,
                iconColor = SuccessGreen,
                modifier = Modifier.weight(1f)
            )
            WBotStatCard(
                title = "التحذيرات المسجلة",
                value = "${stats.totalWarnings}",
                icon = Icons.Default.Warning,
                iconColor = ErrorRed,
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WBotStatCard(
                title = "الرومات النصية",
                value = "${stats.textChannels}",
                icon = Icons.Default.Chat,
                iconColor = InfoBlue,
                modifier = Modifier.weight(1f)
            )
            WBotStatCard(
                title = "الرومات الصوتية",
                value = "${stats.voiceChannels}",
                icon = Icons.Default.Mic,
                iconColor = DiscordBlurple,
                modifier = Modifier.weight(1f)
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            WBotStatCard(
                title = "إجمالي التذاكر",
                value = "${stats.totalTickets}",
                icon = Icons.Default.ConfirmationNumber,
                iconColor = WarningGold,
                modifier = Modifier.weight(1f)
            )
            WBotStatCard(
                title = "التصنيفات (Categories)",
                value = "${stats.categoriesCount}",
                icon = Icons.Default.Folder,
                iconColor = TextSecondary,
                modifier = Modifier.weight(1f)
            )
        }
    }
}
