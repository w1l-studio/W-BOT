package com.wbot.dashboard.ui.screens.guilds

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
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
import com.wbot.dashboard.data.model.GuildItem
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*

@Composable
fun GuildsScreen(
    onGuildSelect: (String) -> Unit,
    viewModel: GuildsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    Scaffold(
        topBar = {
            WBotTopAppBar(
                title = "السيرفرات المتاحة",
                actions = {
                    IconButton(onClick = { viewModel.loadGuilds() }) {
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
                is GuildsUiState.Loading -> LoadingState(message = "جاري جلب السيرفرات التي تملك صلاحية إدارتها...")
                is GuildsUiState.Error -> ErrorState(message = state.message, onRetry = { viewModel.loadGuilds() })
                is GuildsUiState.Success -> {
                    val filteredGuilds = state.guilds.filter {
                        it.name.contains(searchQuery, ignoreCase = true) || it.id.contains(searchQuery)
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp)
                    ) {
                        WBotTextField(
                            value = searchQuery,
                            onValueChange = { viewModel.searchQuery.value = it },
                            label = "بحث عن سيرفر",
                            placeholder = "اكتب اسم السيرفر أو الآيدي...",
                            trailingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = null,
                                    tint = TextSecondary
                                )
                            }
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        if (filteredGuilds.isEmpty()) {
                            EmptyState(
                                title = "لم يتم العثور على سيرفرات",
                                subtitle = "تأكد من وجود البوت في السيرفر وأنك تملك صلاحية الإدارة"
                            )
                        } else {
                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                items(filteredGuilds) { guild ->
                                    GuildCardItem(guild = guild, onClick = { onGuildSelect(guild.id) })
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
fun GuildCardItem(
    guild: GuildItem,
    onClick: () -> Unit
) {
    WBotCard(onClick = onClick) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                if (!guild.icon.isNullOrEmpty()) {
                    AsyncImage(
                        model = guild.icon,
                        contentDescription = guild.name,
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(DiscordBlurple),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = guild.name.take(2).uppercase(),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = guild.name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "ID: ${guild.id}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextMuted
                    )
                }
            }

            WBotBadge(
                text = if (guild.botPresent) "البوت موجود" else "البوت غير موجود",
                color = if (guild.botPresent) SuccessGreen else WarningGold
            )
        }
    }
}
