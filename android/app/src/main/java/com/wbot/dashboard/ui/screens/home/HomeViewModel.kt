package com.wbot.dashboard.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.model.BotStats
import com.wbot.dashboard.data.repository.WBotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(val stats: BotStats) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

class HomeViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState

    init {
        loadStats()
    }

    fun loadStats() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading
            val result = WBotRepository.getBotStats()
            result.onSuccess { stats ->
                _uiState.value = HomeUiState.Success(stats)
            }.onFailure { e ->
                _uiState.value = HomeUiState.Error(e.message ?: "تعذر تحميل إحصائيات البوت")
            }
        }
    }
}
