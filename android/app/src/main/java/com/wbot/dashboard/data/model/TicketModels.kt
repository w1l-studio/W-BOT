package com.wbot.dashboard.data.model

import com.google.gson.annotations.SerializedName

data class TicketsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("tickets") val tickets: TicketGroups? = null,
    @SerializedName("error") val error: String? = null
)

data class TicketGroups(
    @SerializedName("open") val open: List<TicketItem> = emptyList(),
    @SerializedName("closed") val closed: List<TicketItem> = emptyList(),
    @SerializedName("totalCount") val totalCount: Int = 0,
    @SerializedName("openCount") val openCount: Int = 0,
    @SerializedName("closedCount") val closedCount: Int = 0
)

data class TicketItem(
    @SerializedName("channelId") val channelId: String,
    @SerializedName("ticketNumber") val ticketNumber: String,
    @SerializedName("type") val type: String = "support",
    @SerializedName("ownerId") val ownerId: String,
    @SerializedName("createdAt") val createdAt: Long? = null,
    @SerializedName("claimedBy") val claimedBy: String? = null,
    @SerializedName("claimedAt") val claimedAt: Long? = null,
    @SerializedName("closerId") val closerId: String? = null,
    @SerializedName("closedAt") val closedAt: Long? = null,
    @SerializedName("closeReason") val closeReason: String? = null,
    @SerializedName("durationMs") val durationMs: Long? = null,
    @SerializedName("rating") val rating: Int? = null,
    @SerializedName("ratedAt") val ratedAt: Long? = null,
    @SerializedName("deletedBy") val deletedBy: String? = null,
    @SerializedName("deletedAt") val deletedAt: Long? = null
)

data class TicketDetailResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("ticket") val ticket: TicketDetail? = null,
    @SerializedName("error") val error: String? = null
)

data class TicketDetail(
    @SerializedName("channelId") val channelId: String,
    @SerializedName("ticketNumber") val ticketNumber: String,
    @SerializedName("type") val type: String = "support",
    @SerializedName("ownerId") val ownerId: String,
    @SerializedName("createdAt") val createdAt: Long? = null,
    @SerializedName("claimedBy") val claimedBy: String? = null,
    @SerializedName("claimedAt") val claimedAt: Long? = null,
    @SerializedName("closerId") val closerId: String? = null,
    @SerializedName("closedAt") val closedAt: Long? = null,
    @SerializedName("closeReason") val closeReason: String? = null,
    @SerializedName("durationMs") val durationMs: Long? = null,
    @SerializedName("rating") val rating: Int? = null,
    @SerializedName("ratedAt") val ratedAt: Long? = null,
    @SerializedName("channelName") val channelName: String? = null,
    @SerializedName("channelExists") val channelExists: Boolean = true,
    @SerializedName("messages") val messages: List<TicketMessage> = emptyList()
)

data class TicketMessage(
    @SerializedName("id") val id: String,
    @SerializedName("authorId") val authorId: String,
    @SerializedName("authorName") val authorName: String,
    @SerializedName("authorAvatar") val authorAvatar: String? = null,
    @SerializedName("content") val content: String,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("attachments") val attachments: List<String> = emptyList()
)

data class TicketCloseRequest(
    @SerializedName("reason") val reason: String
)

data class ActionResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)
