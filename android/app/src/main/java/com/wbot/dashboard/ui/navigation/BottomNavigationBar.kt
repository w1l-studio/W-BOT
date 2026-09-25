package com.wbot.dashboard.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.wbot.dashboard.ui.theme.*

sealed class BottomNavItem(val route: String, val title: String, val icon: ImageVector) {
    object Home : BottomNavItem("home", "الرئيسية", Icons.Default.Home)
    object Guilds : BottomNavItem("guilds", "السيرفرات", Icons.Default.Dns)
    object Tickets : BottomNavItem("tickets_global", "التذاكر", Icons.Default.ConfirmationNumber)
    object Settings : BottomNavItem("settings", "الإعدادات", Icons.Default.Settings)
}

@Composable
fun BottomNavigationBar(
    currentRoute: String?,
    onNavigate: (String) -> Unit
) {
    val items = listOf(
        BottomNavItem.Home,
        BottomNavItem.Guilds,
        BottomNavItem.Tickets,
        BottomNavItem.Settings
    )

    NavigationBar(
        containerColor = SurfaceDark,
        tonalElevation = 8.dp
    ) {
        items.forEach { item ->
            val selected = currentRoute == item.route
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = { Icon(item.icon, contentDescription = item.title) },
                label = { Text(item.title) },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = TextPrimary,
                    selectedTextColor = DiscordBlurple,
                    indicatorColor = DiscordBlurple,
                    unselectedIconColor = TextMuted,
                    unselectedTextColor = TextMuted
                )
            )
        }
    }
}
