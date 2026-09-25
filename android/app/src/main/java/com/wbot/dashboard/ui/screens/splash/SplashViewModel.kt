package com.wbot.dashboard.ui.screens.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.local.TokenManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class SplashState {
    object Loading : SplashState()
    object Authenticated : SplashState()
    object Unauthenticated : SplashState()
}

class SplashViewModel : ViewModel() {

    private val _splashState = MutableStateFlow<SplashState>(SplashState.Loading)
    val splashState: StateFlow<SplashState> = _splashState

    init {
        checkAuth()
    }

    fun checkAuth() {
        viewModelScope.launch {
            delay(1200) // Smooth splash delay
            if (TokenManager.isLoggedIn()) {
                _splashState.value = SplashState.Authenticated
            } else {
                _splashState.value = SplashState.Unauthenticated
            }
        }
    }
}
