package com.wbot.dashboard.data.model

import com.google.gson.annotations.SerializedName

data class GuildsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("guilds") val guilds: List<GuildItem> = emptyList(),
    @SerializedName("error") val error: String? = null
)

data class GuildItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("botPresent") val botPresent: Boolean = false,
    @SerializedName("memberCount") val memberCount: Int = 0
)

data class GuildDetailResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("guild") val guild: GuildDetail? = null,
    @SerializedName("error") val error: String? = null
)

data class GuildDetail(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("icon") val icon: String? = null,
    @SerializedName("ownerId") val ownerId: String? = null,
    @SerializedName("memberCount") val memberCount: Int = 0,
    @SerializedName("textChannelsCount") val textChannelsCount: Int = 0,
    @SerializedName("voiceChannelsCount") val voiceChannelsCount: Int = 0,
    @SerializedName("botPresent") val botPresent: Boolean = true
)

data class ChannelsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("channels") val channels: List<ChannelItem> = emptyList(),
    @SerializedName("error") val error: String? = null
)

data class ChannelItem(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("type") val type: Int,
    @SerializedName("typeName") val typeName: String
)

data class GuildStatsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("stats") val stats: GuildStats? = null,
    @SerializedName("error") val error: String? = null
)

data class GuildStats(
    @SerializedName("memberCount") val memberCount: Int = 0,
    @SerializedName("textChannels") val textChannels: Int = 0,
    @SerializedName("voiceChannels") val voiceChannels: Int = 0,
    @SerializedName("categoriesCount") val categoriesCount: Int = 0,
    @SerializedName("totalTickets") val totalTickets: Int = 0,
    @SerializedName("openTickets") val openTickets: Int = 0,
    @SerializedName("closedTickets") val closedTickets: Int = 0,
    @SerializedName("totalWarnings") val totalWarnings: Int = 0
)
