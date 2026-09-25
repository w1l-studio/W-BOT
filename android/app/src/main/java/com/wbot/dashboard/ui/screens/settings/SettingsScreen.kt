package com.wbot.dashboard.ui.screens.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Storage
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
import com.wbot.dashboard.ui.components.*
import com.wbot.dashboard.ui.theme.*

@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = viewModel()
) {
    val userName by viewModel.userName.collectAsState()
    val userAvatar by viewModel.userAvatar.collectAsState()
    val serverUrl by viewModel.serverUrl.collectAsState()

    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            WBotTopAppBar(
                title = "إعدادات التطبيق"
            )
        },
        containerColor = BackgroundDark
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // User Account Card
                WBotCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!userAvatar.isNullOrEmpty()) {
                            AsyncImage(
                                model = userAvatar,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(CircleShape)
                                    .background(DiscordBlurple),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = null,
                                    tint = TextPrimary,
                                    modifier = Modifier.size(32.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(16.dp))

                        Column {
                            Text(
                                text = userName,
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "مسجل الدخول بواسطة Discord",
                                style = MaterialTheme.typography.bodyMedium,
                                color = SuccessGreen
                            )
                        }
                    }
                }

                // Backend Server URL Configuration
                WBotCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Storage,
                            contentDescription = null,
                            tint = InfoBlue,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "روم خادم Backend API",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    WBotTextField(
                        value = serverUrl,
                        onValueChange = { viewModel.updateServerUrl(it) },
                        label = "رابط الخادم (Base URL)",
                        placeholder = "http://10.0.2.2:3000"
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "يمكنك تغيير رابط الخادم إذا كنت تستخدم خادمًا خارجيًا أو VPS.",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted
                    )
                }

                // About W BOT
                WBotCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = DiscordBlurple,
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = "عن W BOT Dashboard",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = "التطبيق العربي الرسمي لإدارة وتحكم بوت Discord W BOT بالكامل عبر الجوال، بتصميم حديث وأداء فائق مع المزامنة الفورية.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    HorizontalDivider(color = CardBorder)

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("إصدار التطبيق", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
                        Text("v1.0.0 (Native Android)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Logout Button
                WBotButton(
                    text = "تسجيل الخروج",
                    onClick = { showLogoutDialog = true },
                    color = ErrorRed,
                    icon = Icons.AutoMirrored.Filled.Logout
                )
            }

            // Logout Confirmation Dialog
            if (showLogoutDialog) {
                AlertDialog(
                    onDismissRequest = { showLogoutDialog = false },
                    title = {
                        Text(
                            text = "تسجيل الخروج",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    },
                    text = {
                        Text(
                            text = "هل أنت تأكد من أنك تريد تسجيل الخروج من تطبيق W BOT Dashboard؟",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    },
                    confirmButton = {
                        Button(
                            onClick = {
                                showLogoutDialog = false
                                viewModel.logout(onLogout)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                        ) {
                            Text("نعم، تسجيل الخروج", color = TextPrimary)
                        }
                    },
                    dismissButton = {
                        TextButton(onClick = { showLogoutDialog = false }) {
                            Text("إلغاء", color = TextSecondary)
                        }
                    },
                    containerColor = SurfaceDark
                )
            }
        }
    }
}
