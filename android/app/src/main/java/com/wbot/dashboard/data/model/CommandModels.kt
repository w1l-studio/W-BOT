package com.wbot.dashboard.data.model

import com.google.gson.annotations.SerializedName

data class CommandsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("commands") val commands: List<CommandItem> = emptyList(),
    @SerializedName("error") val error: String? = null
)

data class CommandItem(
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String,
    @SerializedName("category") val category: String = "عامة",
    @SerializedName("permission") val permission: String = "جميع الأعضاء"
)
