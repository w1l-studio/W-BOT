package com.wbot.dashboard.data.repository

import com.wbot.dashboard.data.local.TokenManager
import com.wbot.dashboard.data.model.*
import com.wbot.dashboard.data.remote.AuthInterceptor
import com.wbot.dashboard.data.remote.WBotApiService
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object WBotRepository {

    private var currentBaseUrl: String = ""
    private var apiService: WBotApiService? = null

    private fun getApiService(): WBotApiService {
        val serverUrl = TokenManager.getServerUrl()
        if (apiService == null || currentBaseUrl != serverUrl) {
            currentBaseUrl = serverUrl

            val loggingInterceptor = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val client = OkHttpClient.Builder()
                .addInterceptor(AuthInterceptor())
                .addInterceptor(loggingInterceptor)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            val baseUrl = if (serverUrl.endsWith("/")) serverUrl else "$serverUrl/"

            val retrofit = Retrofit.Builder()
                .baseUrl(baseUrl)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()

            apiService = retrofit.create(WBotApiService::class.java)
        }
        return apiService!!
    }

    suspend fun getDiscordAuthUrl(): Result<String> {
        return safeApiCall { getApiService().getDiscordAuthUrl() }.map {
            it.url ?: throw Exception("Auth URL is null")
        }
    }

    suspend fun exchangeToken(code: String): Result<AuthTokenResponse> {
        return safeApiCall { getApiService().exchangeToken(AuthTokenRequest(code)) }
    }

    suspend fun getMe(): Result<UserMeResponse> {
        return safeApiCall { getApiService().getMe() }
    }

    suspend fun getBotStats(): Result<BotStats> {
        return safeApiCall { getApiService().getBotStats() }.map {
            it.stats ?: throw Exception("Bot stats null")
        }
    }

    suspend fun getGuilds(): Result<List<GuildItem>> {
        return safeApiCall { getApiService().getGuilds() }.map { it.guilds }
    }

    suspend fun getGuildDetail(guildId: String): Result<GuildDetail> {
        return safeApiCall { getApiService().getGuildDetail(guildId) }.map {
            it.guild ?: throw Exception("Guild detail null")
        }
    }

    suspend fun getGuildConfig(guildId: String): Result<GuildConfig> {
        return safeApiCall { getApiService().getGuildConfig(guildId) }.map {
            it.config ?: GuildConfig()
        }
    }

    suspend fun updateGuildConfig(guildId: String, config: GuildConfig): Result<GuildConfig> {
        return safeApiCall { getApiService().updateGuildConfig(guildId, config) }.map {
            it.config ?: config
        }
    }

    suspend fun getProtectionSettings(guildId: String): Result<ProtectionSettings> {
        return safeApiCall { getApiService().getProtectionSettings(guildId) }.map {
            it.protection ?: ProtectionSettings()
        }
    }

    suspend fun updateProtectionSettings(guildId: String, settings: ProtectionSettings): Result<ProtectionSettings> {
        return safeApiCall { getApiService().updateProtectionSettings(guildId, settings) }.map {
            it.protection ?: settings
        }
    }

    suspend fun getGuildChannels(guildId: String): Result<List<ChannelItem>> {
        return safeApiCall { getApiService().getGuildChannels(guildId) }.map { it.channels }
    }

    suspend fun getGuildTickets(guildId: String): Result<TicketGroups> {
        return safeApiCall { getApiService().getGuildTickets(guildId) }.map {
            it.tickets ?: TicketGroups()
        }
    }

    suspend fun getTicketDetail(guildId: String, channelId: String): Result<TicketDetail> {
        return safeApiCall { getApiService().getTicketDetail(guildId, channelId) }.map {
            it.ticket ?: throw Exception("Ticket detail null")
        }
    }

    suspend fun closeTicket(guildId: String, channelId: String, reason: String): Result<ActionResponse> {
        return safeApiCall { getApiService().closeTicket(guildId, channelId, TicketCloseRequest(reason)) }
    }

    suspend fun reopenTicket(guildId: String, channelId: String): Result<ActionResponse> {
        return safeApiCall { getApiService().reopenTicket(guildId, channelId) }
    }

    suspend fun deleteTicket(guildId: String, channelId: String): Result<ActionResponse> {
        return safeApiCall { getApiService().deleteTicket(guildId, channelId) }
    }

    suspend fun getGuildCommands(guildId: String): Result<List<CommandItem>> {
        return safeApiCall { getApiService().getGuildCommands(guildId) }.map { it.commands }
    }

    suspend fun getGuildStats(guildId: String): Result<GuildStats> {
        return safeApiCall { getApiService().getGuildStats(guildId) }.map {
            it.stats ?: GuildStats()
        }
    }

    private inline fun <T> safeApiCall(apiCall: () -> Response<T>): Result<T> {
        return try {
            val response = apiCall()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "API Call failed (${response.code()})"
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
