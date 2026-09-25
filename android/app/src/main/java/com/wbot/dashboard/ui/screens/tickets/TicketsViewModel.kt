package com.wbot.dashboard.ui.screens.tickets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.model.TicketDetail
import com.wbot.dashboard.data.model.TicketGroups
import com.wbot.dashboard.data.repository.WBotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class TicketListUiState {
    object Loading : TicketListUiState()
    data class Success(val tickets: TicketGroups) : TicketListUiState()
    data class Error(val message: String) : TicketListUiState()
}

sealed class TicketDetailUiState {
    object Idle : TicketDetailUiState()
    object Loading : TicketDetailUiState()
    data class Success(val ticket: TicketDetail) : TicketDetailUiState()
    data class Error(val message: String) : TicketDetailUiState()
}

class TicketsViewModel : ViewModel() {

    private val _listState = MutableStateFlow<TicketListUiState>(TicketListUiState.Loading)
    val listState: StateFlow<TicketListUiState> = _listState

    private val _detailState = MutableStateFlow<TicketDetailUiState>(TicketDetailUiState.Idle)
    val detailState: StateFlow<TicketDetailUiState> = _detailState

    val isActionLoading = MutableStateFlow(false)
    val actionMessage = MutableStateFlow<String?>(null)

    fun loadTickets(guildId: String) {
        viewModelScope.launch {
            _listState.value = TicketListUiState.Loading
            val result = WBotRepository.getGuildTickets(guildId)
            result.onSuccess { groups ->
                _listState.value = TicketListUiState.Success(groups)
            }.onFailure { e ->
                _listState.value = TicketListUiState.Error(e.message ?: "تعذر تحميل التذاكر")
            }
        }
    }

    fun loadTicketDetail(guildId: String, channelId: String) {
        viewModelScope.launch {
            _detailState.value = TicketDetailUiState.Loading
            val result = WBotRepository.getTicketDetail(guildId, channelId)
            result.onSuccess { detail ->
                _detailState.value = TicketDetailUiState.Success(detail)
            }.onFailure { e ->
                _detailState.value = TicketDetailUiState.Error(e.message ?: "تعذر تحميل تفاصيل التذكرة")
            }
        }
    }

    fun closeTicket(guildId: String, channelId: String, reason: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            isActionLoading.value = true
            val result = WBotRepository.closeTicket(guildId, channelId, reason)
            isActionLoading.value = false
            result.onSuccess {
                actionMessage.value = "تم إغلاق التذكرة بنجاح! 🔒"
                loadTickets(guildId)
                onSuccess()
            }.onFailure { e ->
                actionMessage.value = "فشل إغلاق التذكرة: ${e.message}"
            }
        }
    }

    fun reopenTicket(guildId: String, channelId: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            isActionLoading.value = true
            val result = WBotRepository.reopenTicket(guildId, channelId)
            isActionLoading.value = false
            result.onSuccess {
                actionMessage.value = "تمت إعادة فتح التذكرة بنجاح! 🔓"
                loadTickets(guildId)
                onSuccess()
            }.onFailure { e ->
                actionMessage.value = "فشل إعادة فتح التذكرة: ${e.message}"
            }
        }
    }

    fun deleteTicket(guildId: String, channelId: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            isActionLoading.value = true
            val result = WBotRepository.deleteTicket(guildId, channelId)
            isActionLoading.value = false
            result.onSuccess {
                actionMessage.value = "تم حذف التذكرة بنجاح! 🗑️"
                loadTickets(guildId)
                onSuccess()
            }.onFailure { e ->
                actionMessage.value = "فشل حذف التذكرة: ${e.message}"
            }
        }
    }
}
