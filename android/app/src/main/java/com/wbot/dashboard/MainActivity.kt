package com.wbot.dashboard

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.wbot.dashboard.ui.navigation.AppNavHost
import com.wbot.dashboard.ui.screens.auth.AuthViewModel
import com.wbot.dashboard.ui.theme.WBotDashboardTheme

class MainActivity : ComponentActivity() {

    private val authViewModel: AuthViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        handleIntent(intent)

        setContent {
            WBotDashboardTheme {
                AppNavHost()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data
        if (data != null && data.scheme == "wbot" && data.host == "auth") {
            val code = data.getQueryParameter("code")
            if (!code.isNullOrEmpty()) {
                authViewModel.handleOAuthCode(code)
            }
        }
    }
}
