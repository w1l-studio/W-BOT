package com.wbot.dashboard.ui.screens.tickets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wbot.dashboard.data.model.TicketItem
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TicketListScreen(
    guildId: String,
    onBackClick: () -> Unit,
    onTicketSelect: (String, String) -> Unit, // guildId, channelId
    viewModel: TicketsViewModel = viewModel()
) {
    val listState by viewModel.listState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Open, 1: Closed

    LaunchedEffect(guildId) {
        viewModel.loadTickets(guildId)
    }

    Scaffold(
        topBar = {
            WBotTopAppBar(
                title = "إدارة التذاكر",
                showBackButton = true,
                onBackClick = onBackClick,
                actions = {
                    IconButton(onClick = { viewModel.loadTickets(guildId) }) {
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
            when (val state = listState) {
                is TicketListUiState.Loading -> LoadingState(message = "جاري تحميل التذاكر...")
                is TicketListUiState.Error -> ErrorState(message = state.message, onRetry = { viewModel.loadTickets(guildId) })
                is TicketListUiState.Success -> {
                    val openTickets = state.tickets.open
                    val closedTickets = state.tickets.closed

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                    ) {
                        TabRow(
                            selectedTabIndex = selectedTab,
                            containerColor = SurfaceDark,
                            contentColor = DiscordBlurple
                        ) {
                            Tab(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                text = {
                                    Text(
                                        text = "المفتوحة (${openTickets.size})",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Normal,
                                        color = if (selectedTab == 0) DiscordBlurple else TextSecondary
                                    )
                                }
                            )
                            Tab(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                text = {
                                    Text(
                                        text = "المغلقة (${closedTickets.size})",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Normal,
                                        color = if (selectedTab == 1) DiscordBlurple else TextSecondary
                                    )
                                }
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        val activeList = if (selectedTab == 0) openTickets else closedTickets

                        if (activeList.isEmpty()) {
                            EmptyState(
                                title = if (selectedTab == 0) "لا توجد تذاكر مفتوحة حاليًا" else "لا توجد تذاكر مغلقة",
                                subtitle = "أي تذكرة جديدة يتم إنشاؤها عبر البوت ستظهر هنا مباشرة"
                            )
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(activeList) { ticket ->
                                    TicketCardItem(
                                        ticket = ticket,
                                        onClick = { onTicketSelect(guildId, ticket.channelId) }
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
fun TicketCardItem(
    ticket: TicketItem,
    onClick: () -> Unit
) {
    val isClosed = ticket.closedAt != null

    WBotCard(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "تذكرة #${ticket.ticketNumber}",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "القسم: ${getTicketTypeLabel(ticket.type)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = InfoBlue
                )
            }

            WBotBadge(
                text = if (isClosed) "مغلقة 🔒" else if (ticket.claimedBy != null) "مقبولة ✅" else "بانتظار الإدارة ⏳",
                color = if (isClosed) ErrorRed else if (ticket.claimedBy != null) SuccessGreen else WarningGold
            )
        }

        Spacer(modifier = Modifier.height(10.dp))
        HorizontalDivider(color = CardBorder)
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "صاحب التذكرة: <@${ticket.ownerId}>",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
                if (ticket.claimedBy != null) {
                    Text(
                        text = "المسؤول: <@${ticket.claimedBy}>",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }

            ticket.createdAt?.let {
                Text(
                    text = formatDate(it),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted
                )
            }
        }

        if (isClosed && !ticket.closeReason.isNullOrEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "سبب الإغلاق: ${ticket.closeReason}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = ErrorRed
            )
        }

        if (ticket.rating != null) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "التقييم: ${ticket.rating}/5 ⭐",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = WarningGold
            )
        }
    }
}

private fun getTicketTypeLabel(type: String): String {
    return when (type.lowercase()) {
        "support" -> "🛠️ الدعم الفني"
        "report" -> "🚨 الإبلاغ"
        "verification" -> "🎀 التوثيق"
        "suggestions" -> "💡 الاقتراحات"
        else -> type.uppercase()
    }
}

private fun formatDate(timestamp: Long): String {
    val sdf = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}
