package com.wbot.dashboard.data.remote

import com.wbot.dashboard.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface WBotApiService {

    @GET("auth/discord")
    suspend fun getDiscordAuthUrl(): Response<AuthUrlResponse>

    @POST("auth/token")
    suspend fun exchangeToken(
        @Body request: AuthTokenRequest
    ): Response<AuthTokenResponse>

    @GET("api/me")
    suspend fun getMe(): Response<UserMeResponse>

    @GET("api/bot/stats")
    suspend fun getBotStats(): Response<BotStatsResponse>

    @GET("api/guilds")
    suspend fun getGuilds(): Response<GuildsResponse>

    @GET("api/guilds/{guildId}")
    suspend fun getGuildDetail(
        @Path("guildId") guildId: String
    ): Response<GuildDetailResponse>

    @GET("api/guilds/{guildId}/config")
    suspend fun getGuildConfig(
        @Path("guildId") guildId: String
    ): Response<GuildConfigResponse>

    @PUT("api/guilds/{guildId}/config")
    suspend fun updateGuildConfig(
        @Path("guildId") guildId: String,
        @Body config: GuildConfig
    ): Response<GuildConfigResponse>

    @GET("api/guilds/{guildId}/protection")
    suspend fun getProtectionSettings(
        @Path("guildId") guildId: String
    ): Response<ProtectionSettingsResponse>

    @PUT("api/guilds/{guildId}/protection")
    suspend fun updateProtectionSettings(
        @Path("guildId") guildId: String,
        @Body settings: ProtectionSettings
    ): Response<ProtectionSettingsResponse>

    @GET("api/guilds/{guildId}/channels")
    suspend fun getGuildChannels(
        @Path("guildId") guildId: String
    ): Response<ChannelsResponse>

    @GET("api/guilds/{guildId}/tickets")
    suspend fun getGuildTickets(
        @Path("guildId") guildId: String
    ): Response<TicketsResponse>

    @GET("api/guilds/{guildId}/tickets/{channelId}")
    suspend fun getTicketDetail(
        @Path("guildId") guildId: String,
        @Path("channelId") channelId: String
    ): Response<TicketDetailResponse>

    @POST("api/guilds/{guildId}/tickets/{channelId}/close")
    suspend fun closeTicket(
        @Path("guildId") guildId: String,
        @Path("channelId") channelId: String,
        @Body request: TicketCloseRequest
    ): Response<ActionResponse>

    @POST("api/guilds/{guildId}/tickets/{channelId}/reopen")
    suspend fun reopenTicket(
        @Path("guildId") guildId: String,
        @Path("channelId") channelId: String
    ): Response<ActionResponse>

    @POST("api/guilds/{guildId}/tickets/{channelId}/delete")
    suspend fun deleteTicket(
        @Path("guildId") guildId: String,
        @Path("channelId") channelId: String
    ): Response<ActionResponse>

    @GET("api/guilds/{guildId}/commands")
    suspend fun getGuildCommands(
        @Path("guildId") guildId: String
    ): Response<CommandsResponse>

    @GET("api/guilds/{guildId}/stats")
    suspend fun getGuildStats(
        @Path("guildId") guildId: String
    ): Response<GuildStatsResponse>
}
