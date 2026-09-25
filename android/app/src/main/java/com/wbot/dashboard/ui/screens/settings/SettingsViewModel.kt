package com.wbot.dashboard.ui.screens.settings

import androidx.lifecycle.ViewModel
import com.wbot.dashboard.data.local.TokenManager
import kotlinx.coroutines.flow.MutableStateFlow

class SettingsViewModel : ViewModel() {

    val userName = MutableStateFlow(TokenManager.getUserName() ?: "مستخدم Discord")
    val userAvatar = MutableStateFlow(TokenManager.getUserAvatar())
    val serverUrl = MutableStateFlow(TokenManager.getServerUrl())

    fun updateServerUrl(url: String) {
        serverUrl.value = url
        TokenManager.saveServerUrl(url)
    }

    fun logout(onLogoutSuccess: () -> Unit) {
        TokenManager.clearToken()
        onLogoutSuccess()
    }
}
