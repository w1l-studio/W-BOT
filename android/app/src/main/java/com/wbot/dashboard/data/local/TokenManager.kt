package com.wbot.dashboard.data.local

import android.content.Context
import android.content.SharedPreferences

object TokenManager {

    private const val PREF_NAME = "wbot_prefs"
    private const val KEY_JWT_TOKEN = "jwt_token"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_AVATAR = "user_avatar"

    const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000" // Default for Android Emulator to host

    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun saveToken(token: String) {
        prefs.edit().putString(KEY_JWT_TOKEN, token).apply()
    }

    fun getToken(): String? {
        return prefs.getString(KEY_JWT_TOKEN, null)
    }

    fun clearToken() {
        prefs.edit()
            .remove(KEY_JWT_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_AVATAR)
            .apply()
    }

    fun isLoggedIn(): Boolean {
        return !getToken().isNull_orEmpty()
    }

    fun saveServerUrl(url: String) {
        var formatted = url.trim()
        if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
            formatted = "http://$formatted"
        }
        if (formatted.endsWith("/")) {
            formatted = formatted.dropLast(1)
        }
        prefs.edit().putString(KEY_SERVER_URL, formatted).apply()
    }

    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun saveUserProfile(id: String, username: String, avatar: String?) {
        prefs.edit()
            .putString(KEY_USER_ID, id)
            .putString(KEY_USER_NAME, username)
            .putString(KEY_USER_AVATAR, avatar)
            .apply()
    }

    fun getUserName(): String? = prefs.getString(KEY_USER_NAME, null)
    fun getUserAvatar(): String? = prefs.getString(KEY_USER_AVATAR, null)
}

private fun String?.isNull_orEmpty(): Boolean = this == null || this.isEmpty()
