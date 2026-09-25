package com.wbot.dashboard.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wbot.dashboard.data.model.*
import com.wbot.dashboard.data.repository.WBotRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class DashboardUiState {
    object Loading : DashboardUiState()
    data class Success(
        val guild: GuildDetail,
        val config: GuildConfig,
        val protection: ProtectionSettings,
        val channels: List<ChannelItem>,
        val commands: List<CommandItem>,
        val stats: GuildStats
    ) : DashboardUiState()
    data class Error(val message: String) : DashboardUiState()
}

class GuildDashboardViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState

    val isSaving = MutableStateFlow(false)
    val saveSuccessMessage = MutableStateFlow<String?>(null)

    // Form states
    val prefix = MutableStateFlow("!")
    val logChannelId = MutableStateFlow<String?>(null)
    val welcomeEnabled = MutableStateFlow(false)
    val welcomeChannelId = MutableStateFlow<String?>(null)
    val ticketsEnabled = MutableStateFlow(true)

    // Protection form states
    val protectionEnabled = MutableStateFlow(true)
    val antiBot = MutableStateFlow(true)
    val antiMassBan = MutableStateFlow(true)
    val antiMassKick = MutableStateFlow(true)
    val antiChannelDelete = MutableStateFlow(true)
    val antiChannelCreate = MutableStateFlow(true)
    val antiRoleDelete = MutableStateFlow(true)
    val antiRoleCreate = MutableStateFlow(true)
    val antiSpam = MutableStateFlow(true)
    val antiInvites = MutableStateFlow(true)
    val antiMassMention = MutableStateFlow(true)

    fun loadGuildDashboard(guildId: String) {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading

            val guildRes = WBotRepository.getGuildDetail(guildId)
            val configRes = WBotRepository.getGuildConfig(guildId)
            val protectionRes = WBotRepository.getProtectionSettings(guildId)
            val channelsRes = WBotRepository.getGuildChannels(guildId)
            val commandsRes = WBotRepository.getGuildCommands(guildId)
            val statsRes = WBotRepository.getGuildStats(guildId)

            if (guildRes.isSuccess) {
                val guild = guildRes.getOrThrow()
                val config = configRes.getOrDefault(GuildConfig())
                val protection = protectionRes.getOrDefault(ProtectionSettings())
                val channels = channelsRes.getOrDefault(emptyList())
                val commands = commandsRes.getOrDefault(emptyList())
                val stats = statsRes.getOrDefault(GuildStats())

                // Populate Form States
                prefix.value = config.prefix
                logChannelId.value = config.logChannelId
                welcomeEnabled.value = config.welcomeEnabled
                welcomeChannelId.value = config.welcomeChannelId
                ticketsEnabled.value = config.ticketsEnabled

                protectionEnabled.value = protection.enabled
                antiBot.value = protection.antiBot
                antiMassBan.value = protection.antiMassBan
                antiMassKick.value = protection.antiMassKick
                antiChannelDelete.value = protection.antiChannelDelete
                antiChannelCreate.value = protection.antiChannelCreate
                antiRoleDelete.value = protection.antiRoleDelete
                antiRoleCreate.value = protection.antiRoleCreate
                antiSpam.value = protection.antiSpam
                antiInvites.value = protection.antiInvites
                antiMassMention.value = protection.antiMassMention

                _uiState.value = DashboardUiState.Success(
                    guild = guild,
                    config = config,
                    protection = protection,
                    channels = channels,
                    commands = commands,
                    stats = stats
                )
            } else {
                _uiState.value = DashboardUiState.Error(
                    guildRes.exceptionOrNull()?.message ?: "تعذر تحميل بيانات السيرفر"
                )
            }
        }
    }

    fun saveConfig(guildId: String) {
        viewModelScope.launch {
            isSaving.value = true
            val updatedConfig = GuildConfig(
                prefix = prefix.value,
                logChannelId = logChannelId.value,
                welcomeEnabled = welcomeEnabled.value,
                welcomeChannelId = welcomeChannelId.value,
                ticketsEnabled = ticketsEnabled.value
            )

            val configResult = WBotRepository.updateGuildConfig(guildId, updatedConfig)

            val updatedProtection = ProtectionSettings(
                enabled = protectionEnabled.value,
                logChannelId = logChannelId.value,
                antiBot = antiBot.value,
                antiMassBan = antiMassBan.value,
                antiMassKick = antiMassKick.value,
                antiChannelDelete = antiChannelDelete.value,
                antiChannelCreate = antiChannelCreate.value,
                antiRoleDelete = antiRoleDelete.value,
                antiRoleCreate = antiRoleCreate.value,
                antiSpam = antiSpam.value,
                antiInvites = antiInvites.value,
                antiMassMention = antiMassMention.value
            )
            WBotRepository.updateProtectionSettings(guildId, updatedProtection)

            isSaving.value = false
            if (configResult.isSuccess) {
                saveSuccessMessage.value = "تم حفظ الإعدادات وتطبيقها بنجاح! ✅"
            } else {
                saveSuccessMessage.value = "حدث خطأ أثناء حفظ الإعدادات ❌"
            }
        }
    }
}
