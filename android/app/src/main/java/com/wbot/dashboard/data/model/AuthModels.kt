package com.wbot.dashboard.data.model

import com.google.gson.annotations.SerializedName

data class AuthUrlResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("url") val url: String? = null,
    @SerializedName("error") val error: String? = null
)

data class AuthTokenRequest(
    @SerializedName("code") val code: String
)

data class AuthTokenResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("token") val token: String? = null,
    @SerializedName("user") val user: UserProfile? = null,
    @SerializedName("error") val error: String? = null
)

data class UserProfile(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("globalName") val globalName: String? = null,
    @SerializedName("avatar") val avatar: String? = null
)

data class UserMeResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("user") val user: UserProfile? = null,
    @SerializedName("error") val error: String? = null
)
