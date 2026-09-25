package com.wbot.dashboard.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.local.TokenManager
import com.wbot.dashboard.data.repository.WBotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class OAuthUrlReady(val url: String) : AuthUiState()
    object Success : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState

    val serverUrl = MutableStateFlow(TokenManager.getServerUrl())

    fun updateServerUrl(url: String) {
        serverUrl.value = url
        TokenManager.saveServerUrl(url)
    }

    fun startDiscordAuth() {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            TokenManager.saveServerUrl(serverUrl.value)
            val result = WBotRepository.getDiscordAuthUrl()
            result.onSuccess { url ->
                _uiState.value = AuthUiState.OAuthUrlReady(url)
            }.onFailure { e ->
                _uiState.value = AuthUiState.Error(e.message ?: "تعذر الاتصال بالخادم. تحقق من رابط السيرفر.")
            }
        }
    }

    fun handleOAuthCode(code: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            val result = WBotRepository.exchangeToken(code)
            result.onSuccess { res ->
                if (res.success && !res.token.isNullOrEmpty()) {
                    TokenManager.saveToken(res.token)
                    res.user?.let { u ->
                        TokenManager.saveUserProfile(u.id, u.username, u.avatar)
                    }
                    _uiState.value = AuthUiState.Success
                } else {
                    _uiState.value = AuthUiState.Error(res.error ?: "فشل تسجيل الدخول بواسطة Discord")
                }
            }.onFailure { e ->
                _uiState.value = AuthUiState.Error(e.message ?: "فشل الاتصال بالخادم أثناء تسجيل الدخول")
            }
        }
    }

    fun resetState() {
        _uiState.value = AuthUiState.Idle
    }
}
