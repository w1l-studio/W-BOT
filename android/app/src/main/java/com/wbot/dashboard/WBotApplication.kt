package com.wbot.dashboard

import android.app.Application
import com.wbot.dashboard.data.local.TokenManager

class WBotApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        TokenManager.init(this)
    }
}
