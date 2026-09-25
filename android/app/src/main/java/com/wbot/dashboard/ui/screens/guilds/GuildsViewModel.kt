package com.wbot.dashboard.ui.screens.guilds

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.model.GuildItem
import com.wbot.dashboard.data.repository.WBotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class GuildsUiState {
    object Loading : GuildsUiState()
    data class Success(val guilds: List<GuildItem>) : GuildsUiState()
    data class Error(val message: String) : GuildsUiState()
}

class GuildsViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<GuildsUiState>(GuildsUiState.Loading)
    val uiState: StateFlow<GuildsUiState> = _uiState

    val searchQuery = MutableStateFlow("")

    init {
        loadGuilds()
    }

    fun loadGuilds() {
        viewModelScope.launch {
            _uiState.value = GuildsUiState.Loading
            val result = WBotRepository.getGuilds()
            result.onSuccess { list ->
                _uiState.value = GuildsUiState.Success(list)
            }.onFailure { e ->
                _uiState.value = GuildsUiState.Error(e.message ?: "تعذر تحميل قائمة السيرفرات")
            }
        }
    }
}
