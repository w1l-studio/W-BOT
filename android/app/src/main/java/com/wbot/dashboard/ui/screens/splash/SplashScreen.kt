package com.wbot.dashboard.ui.screens.splash

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.wbot.dashboard.R
import com.wbot.dashboard.ui.theme.BackgroundDark
import com.wbot.dashboard.ui.theme.DiscordBlurple
import com.wbot.dashboard.ui.theme.TextPrimary
import com.wbot.dashboard.ui.theme.TextSecondary

@Composable
fun SplashScreen(
    onNavigateToHome: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: SplashViewModel = viewModel()
) {
    val splashState by viewModel.splashState.collectAsState()

    LaunchedEffect(splashState) {
        when (splashState) {
            is SplashState.Authenticated -> onNavigateToHome()
            is SplashState.Unauthenticated -> onNavigateToLogin()
            else -> {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.ic_wbot_logo),
                contentDescription = "W BOT Logo",
                modifier = Modifier.size(120.dp)
            )
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = "W BOT Dashboard",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "لوحة التحكم الذكية للسيرفرات",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(48.dp))
            CircularProgressIndicator(
                color = DiscordBlurple,
                strokeWidth = 3.dp,
                modifier = Modifier.size(36.dp)
            )
        }
    }
}
