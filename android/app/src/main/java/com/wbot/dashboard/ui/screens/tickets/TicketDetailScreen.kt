package com.wbot.dashboard.ui.screens.tickets

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.wbot.dashboard.data.model.TicketDetail
import com.wbot.dashboard.data.model.TicketMessage
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun TicketDetailScreen(
    guildId: String,
    channelId: String,
    onBackClick: () -> Unit,
    viewModel: TicketsViewModel = viewModel()
) {
    val detailState by viewModel.detailState.collectAsState()
    val isActionLoading by viewModel.isActionLoading.collectAsState()
    val actionMessage by viewModel.actionMessage.collectAsState()

    var showCloseDialog by remember { mutableStateOf(false) }
    var closeReasonInput by remember { mutableStateOf("") }

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(guildId, channelId) {
        viewModel.loadTicketDetail(guildId, channelId)
    }

    LaunchedEffect(actionMessage) {
        actionMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.actionMessage.value = null
        }
    }

    Scaffold(
        topBar = {
            val title = (detailState as? TicketDetailUiState.Success)?.ticket?.let {
                "تذكرة #${it.ticketNumber}"
            } ?: "تفاصيل التذكرة"

            WBotTopAppBar(
                title = title,
                showBackButton = true,
                onBackClick = onBackClick,
                actions = {
                    IconButton(onClick = { viewModel.loadTicketDetail(guildId, channelId) }) {
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
            when (val state = detailState) {
                is TicketDetailUiState.Loading -> LoadingState(message = "جاري تحميل سجل المحادثة والمعلومات...")
                is TicketDetailUiState.Error -> ErrorState(message = state.message, onRetry = { viewModel.loadTicketDetail(guildId, channelId) })
                is TicketDetailUiState.Success -> {
                    val ticket = state.ticket
                    val isClosed = ticket.closedAt != null

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                    ) {
                        // Metadata Card
                        TicketMetadataCard(ticket = ticket)

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "💬 سجل الرسائل (${ticket.messages.size})",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Chat Messages List
                        Box(modifier = Modifier.weight(1f)) {
                            if (ticket.messages.isEmpty()) {
                                EmptyState(
                                    title = "لا توجد رسائل مسجلة",
                                    subtitle = "لم يتم إرسال أي رسائل داخل هذه التذكرة بعد"
                                )
                            } else {
                                LazyColumn(
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    items(ticket.messages) { msg ->
                                        MessageItemRow(msg = msg)
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Action Buttons Bar
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            if (!isClosed) {
                                WBotButton(
                                    text = "إغلاق التذكرة",
                                    onClick = { showCloseDialog = true },
                                    color = ErrorRed,
                                    icon = Icons.Default.Lock,
                                    isLoading = isActionLoading,
                                    modifier = Modifier.weight(1f)
                                )
                            } else {
                                WBotButton(
                                    text = "إعادة فتح",
                                    onClick = { viewModel.reopenTicket(guildId, channelId, onBackClick) },
                                    color = SuccessGreen,
                                    icon = Icons.Default.LockOpen,
                                    isLoading = isActionLoading,
                                    modifier = Modifier.weight(1f)
                                )
                                WBotButton(
                                    text = "حذف",
                                    onClick = { viewModel.deleteTicket(guildId, channelId, onBackClick) },
                                    color = ErrorRed,
                                    icon = Icons.Default.Delete,
                                    isLoading = isActionLoading,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
                else -> {}
            }

            // Close Reason Dialog
            if (showCloseDialog) {
                AlertDialog(
                    onDismissRequest = { showCloseDialog = false },
                    title = {
                        Text(
                            text = "سبب إغلاق التذكرة",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    },
                    text = {
                        Column {
                            Text(
                                text = "اكتب السبب بوضوح، وسيصل السبب إلى صاحب التذكرة وسجل الإدارة:",
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            WBotTextField(
                                value = closeReasonInput,
                                onValueChange = { closeReasonInput = it },
                                label = "سبب الإغلاق",
                                placeholder = "مثال: تم معالجة المشكلة بنجاح",
                                singleLine = false
                            )
                        }
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                if (closeReasonInput.isNotBlank()) {
                                    showCloseDialog = false
                                    viewModel.closeTicket(guildId, channelId, closeReasonInput) {
                                        closeReasonInput = ""
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                        ) {
                            Text("إغلاق الآن", color = TextPrimary)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showCloseDialog = false }) {
                            Text("إلغاء", color = TextSecondary)
                        }
                    },
                    containerColor = SurfaceDark
                )
            }
        }
    }
}

@Composable
fun TicketMetadataCard(ticket: TicketDetail) {
    WBotCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "صاحب التذكرة: <@${ticket.ownerId}>",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                if (ticket.claimedBy != null) {
                    Text(
                        text = "الإداري المستلم: <@${ticket.claimedBy}>",
                        style = MaterialTheme.typography.bodyMedium,
                        color = InfoBlue
                    )
                }
            }

            WBotBadge(
                text = if (ticket.closedAt != null) "مغلقة 🔒" else "مفتوحة 🟢",
                color = if (ticket.closedAt != null) ErrorRed else SuccessGreen
            )
        }

        if (ticket.closedAt != null) {
            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider(color = CardBorder)
            Spacer(modifier = Modifier.height(8.dp))

            ticket.closeReason?.let {
                Text(
                    text = "سبب الإغلاق: $it",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = ErrorRed
                )
            }

            ticket.rating?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "التقييم المسجل: $it/5 ⭐",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = WarningGold
                )
            }
        }
    }
}

@Composable
fun MessageItemRow(msg: TicketMessage) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = SurfaceDark,
        border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            if (!msg.authorAvatar.isNullOrEmpty()) {
                AsyncImage(
                    model = msg.authorAvatar,
                    contentDescription = null,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(DiscordBlurple),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = msg.authorName.take(1).uppercase(),
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = msg.authorName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        text = formatTime(msg.timestamp),
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = msg.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextPrimary
                )
            }
        }
    }
}

private fun formatTime(timestamp: Long): String {
    val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
    return sdf.format(Date(timestamp))
}
