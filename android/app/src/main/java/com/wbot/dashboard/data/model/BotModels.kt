package com.wbot.dashboard.data.model

import com.google.gson.annotations.SerializedName

data class BotStatsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("stats") val stats: BotStats? = null,
    @SerializedName("error") val error: String? = null
)

data class BotStats(
    @SerializedName("status") val status: String,
    @SerializedName("isOnline") val isOnline: Boolean,
    @SerializedName("pingMs") val pingMs: Long,
    @SerializedName("uptimeSeconds") val uptimeSeconds: Long,
    @SerializedName("totalGuilds") val totalGuilds: Int,
    @SerializedName("totalMembers") val totalMembers: Int,
    @SerializedName("totalTickets") val totalTickets: Int,
    @SerializedName("openTickets") val openTickets: Int,
    @SerializedName("closedTickets") val closedTickets: Int
)

data class GuildConfigResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("config") val config: GuildConfig? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class GuildConfig(
    @SerializedName("prefix") val prefix: String = "!",
    @SerializedName("logChannelId") val logChannelId: String? = null,
    @SerializedName("welcomeEnabled") val welcomeEnabled: Boolean = false,
    @SerializedName("welcomeChannelId") val welcomeChannelId: String? = null,
    @SerializedName("ticketsEnabled") val ticketsEnabled: Boolean = true
)

data class ProtectionSettingsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("protection") val protection: ProtectionSettings? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

data class ProtectionSettings(
    @SerializedName("enabled") val enabled: Boolean = true,
    @SerializedName("logChannelId") val logChannelId: String? = null,
    @SerializedName("whitelist") val whitelist: List<String> = emptyList(),
    @SerializedName("antiBot") val antiBot: Boolean = true,
    @SerializedName("antiMassBan") val antiMassBan: Boolean = true,
    @SerializedName("antiMassKick") val antiMassKick: Boolean = true,
    @SerializedName("antiChannelDelete") val antiChannelDelete: Boolean = true,
    @SerializedName("antiChannelCreate") val antiChannelCreate: Boolean = true,
    @SerializedName("antiRoleDelete") val antiRoleDelete: Boolean = true,
    @SerializedName("antiRoleCreate") val antiRoleCreate: Boolean = true,
    @SerializedName("antiWebhook") val antiWebhook: Boolean = true,
    @SerializedName("antiSpam") val antiSpam: Boolean = true,
    @SerializedName("antiMassMention") val antiMassMention: Boolean = true,
    @SerializedName("antiInvites") val antiInvites: Boolean = true,
    @SerializedName("actionLimit") val actionLimit: Int = 3,
    @SerializedName("actionWindow") val actionWindow: Int = 10,
    @SerializedName("spamMessageLimit") val spamMessageLimit: Int = 6
)
