package com.wbot.dashboard.ui.screens.auth

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wbot.dashboard.R
import com.wbot.dashboard.ui.components.WBotButton
import com.wbot.dashboard.ui.components.WBotCard
import com.wbot.dashboard.ui.components.WBotTextField
import com.wbot.dashboard.ui.theme.*

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: AuthViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val serverUrl by viewModel.serverUrl.collectAsState()

    var showUrlConfig by remember { mutableStateOf(false) }

    LaunchedEffect(uiState) {
        when (val state = uiState) {
            is AuthUiState.OAuthUrlReady -> {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(state.url))
                context.startActivity(intent)
                viewModel.resetState()
            }
            is AuthUiState.Success -> {
                onLoginSuccess()
            }
            else -> {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.ic_wbot_logo),
                contentDescription = null,
                modifier = Modifier.size(100.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "تسجيل الدخول",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "سجل الدخول بحسابك في Discord للتحكم بالبوت وإدارة سيرفراتك بكل سهولة",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(32.dp))

            if (uiState is AuthUiState.Error) {
                val errorMsg = (uiState as AuthUiState.Error).message
                WBotCard(
                    modifier = Modifier.padding(bottom = 20.dp)
                ) {
                    Text(
                        text = "❌ $errorMsg",
                        style = MaterialTheme.typography.bodyMedium,
                        color = ErrorRed
                    )
                }
            }

            WBotButton(
                text = "Login with Discord",
                onClick = { viewModel.startDiscordAuth() },
                isLoading = uiState is AuthUiState.Loading,
                color = DiscordBlurple
            )

            Spacer(modifier = Modifier.height(24.dp))

            TextButton(onClick = { showUrlConfig = !showUrlConfig }) {
                Text(
                    text = if (showUrlConfig) "إخفاء إعدادات السيرفر" else "⚙️ إعدادات رابط Backend API",
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }

            if (showUrlConfig) {
                Spacer(modifier = Modifier.height(12.dp))
                WBotCard {
                    Text(
                        text = "رابط الخادم (Backend URL):",
                        style = MaterialTheme.typography.titleMedium,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    WBotTextField(
                        value = serverUrl,
                        onValueChange = { viewModel.updateServerUrl(it) },
                        label = "API Base URL",
                        placeholder = "http://10.0.2.2:3000"
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "ملاحظة: محاكي الأندرويد يستخدم http://10.0.2.2:3000 للتواصل مع الجهاز المضيف.",
                        style = MaterialTheme.typography.labelSmall,
                        color = TextMuted
                    )
                }
            }
        }
    }
}
