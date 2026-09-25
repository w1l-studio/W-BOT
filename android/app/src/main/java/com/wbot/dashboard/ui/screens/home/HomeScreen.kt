package com.wbot.dashboard.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*

@Composable
fun HomeScreen(
    onNavigateToGuilds: () -> Unit,
    onNavigateToTickets: () -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Scaffold(
        topBar = {
            WBotTopAppBar(
                title = "W BOT Dashboard",
                statusOnline = (uiState as? HomeUiState.Success)?.stats?.isOnline,
                actions = {
                    IconButton(onClick = { viewModel.loadStats() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "تحديث",
                            tint = TextPrimary
                        )
                    }
                }
            )
        },
        containerColor = BackgroundDark
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (val state = uiState) {
                is HomeUiState.Loading -> LoadingState(message = "جاري جلب بيانات البوت...")
                is HomeUiState.Error -> ErrorState(message = state.message, onRetry = { viewModel.loadStats() })
                is HomeUiState.Success -> {
                    val stats = state.stats
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Status Card
                        WBotCard {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(
                                        text = "حالة البوت الحالية",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = TextSecondary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        WBotBadge(
                                            text = if (stats.isOnline) "🟢 متصل" else "🔴 غير متصل",
                                            color = if (stats.isOnline) SuccessGreen else ErrorRed
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(
                                            text = "Ping: ${stats.pingMs}ms",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "مدة التشغيل (Uptime)",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = TextMuted
                                    )
                                    Text(
                                        text = formatUptime(stats.uptimeSeconds),
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = InfoBlue
                                    )
                                }
                            }
                        }

                        Text(
                            text = "📊 الإحصائيات العامة",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        // Stats Grid
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            WBotStatCard(
                                title = "السيرفرات",
                                value = "${stats.totalGuilds}",
                                icon = Icons.Default.Dns,
                                iconColor = DiscordBlurple,
                                modifier = Modifier.weight(1f)
                            )
                            WBotStatCard(
                                title = "الأعضاء",
                                value = "${stats.totalMembers}",
                                icon = Icons.Default.People,
                                iconColor = SuccessGreen,
                                modifier = Modifier.weight(1f)
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

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = "⚡ الوصول السريع",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        // Quick Navigation Action Cards
                        WBotCard(onClick = onNavigateToGuilds) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Dns,
                                        contentDescription = null,
                                        tint = DiscordBlurple,
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text(
                                            text = "إدارة السيرفرات",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "اختر سيرفر للتحكم في الإعدادات والحماية والتذاكر",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                        }

                        WBotCard(onClick = onNavigateToTickets) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.ConfirmationNumber,
                                        contentDescription = null,
                                        tint = WarningGold,
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text(
                                            text = "إدارة التذاكر",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "عرض التذاكر المفتوحة والمغلقة وإدارتها مباشرة",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = TextSecondary
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
}

private fun formatUptime(seconds: Long): String {
    if (seconds <= 0) return "0 ثانية"
    val hours = seconds / 3600
    val minutes = (seconds % 3600) / 60
    val secs = seconds % 60
    return if (hours > 0) "${hours}س ${minutes}د" else if (minutes > 0) "${minutes}د ${secs}ث" else "${secs}ث"
}
