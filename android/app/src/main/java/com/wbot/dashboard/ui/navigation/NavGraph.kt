package com.wbot.dashboard.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.wbot.dashboard.ui.screens.auth.LoginScreen
import com.wbot.dashboard.ui.screens.dashboard.GuildDashboardScreen
import com.wbot.dashboard.ui.screens.guilds.GuildsScreen
import com.wbot.dashboard.ui.screens.home.HomeScreen
import com.wbot.dashboard.ui.screens.settings.SettingsScreen
import com.wbot.dashboard.ui.screens.splash.SplashScreen
import com.wbot.dashboard.ui.screens.tickets.TicketDetailScreen
import com.wbot.dashboard.ui.screens.tickets.TicketListScreen

object NavRoutes {
    const val Splash = "splash"
    const val Login = "login"
    const val Home = "home"
    const val Guilds = "guilds"
    const val GuildDashboard = "guild_dashboard/{guildId}"
    const val TicketsGlobal = "tickets_global"
    const val GuildTickets = "guild_tickets/{guildId}"
    const val TicketDetail = "ticket_detail/{guildId}/{channelId}"
    const val Settings = "settings"

    fun guildDashboard(guildId: String) = "guild_dashboard/$guildId"
    fun guildTickets(guildId: String) = "guild_tickets/$guildId"
    fun ticketDetail(guildId: String, channelId: String) = "ticket_detail/$guildId/$channelId"
}

@Composable
fun AppNavHost(
    navController: NavHostController = rememberNavController()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    val showBottomBar = currentRoute in listOf(
        NavRoutes.Home,
        NavRoutes.Guilds,
        NavRoutes.TicketsGlobal,
        NavRoutes.Settings
    )

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                BottomNavigationBar(
                    currentRoute = currentRoute,
                    onNavigate = { route ->
                        if (currentRoute != route) {
                            navController.navigate(route) {
                                popUpTo(NavRoutes.Home) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    }
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = NavRoutes.Splash,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(NavRoutes.Splash) {
                SplashScreen(
                    onNavigateToHome = {
                        navController.navigate(NavRoutes.Home) {
                            popUpTo(NavRoutes.Splash) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.navigate(NavRoutes.Login) {
                            popUpTo(NavRoutes.Splash) { inclusive = true }
                        }
                    }
                )
            }

            composable(NavRoutes.Login) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(NavRoutes.Home) {
                            popUpTo(NavRoutes.Login) { inclusive = true }
                        }
                    }
                )
            }

            composable(NavRoutes.Home) {
                HomeScreen(
                    onNavigateToGuilds = { navController.navigate(NavRoutes.Guilds) },
                    onNavigateToTickets = { navController.navigate(NavRoutes.Guilds) }
                )
            }

            composable(NavRoutes.Guilds) {
                GuildsScreen(
                    onGuildSelect = { guildId ->
                        navController.navigate(NavRoutes.guildDashboard(guildId))
                    }
                )
            }

            composable(
                route = NavRoutes.GuildDashboard,
                arguments = listOf(navArgument("guildId") { type = NavType.StringType })
            ) { backStackEntry ->
                val guildId = backStackEntry.arguments?.getString("guildId") ?: ""
                GuildDashboardScreen(
                    guildId = guildId,
                    onBackClick = { navController.popBackStack() },
                    onNavigateToTickets = { gId ->
                        navController.navigate(NavRoutes.guildTickets(gId))
                    }
                )
            }

            composable(NavRoutes.TicketsGlobal) {
                GuildsScreen(
                    onGuildSelect = { guildId ->
                        navController.navigate(NavRoutes.guildTickets(guildId))
                    }
                )
            }

            composable(
                route = NavRoutes.GuildTickets,
                arguments = listOf(navArgument("guildId") { type = NavType.StringType })
            ) { backStackEntry ->
                val guildId = backStackEntry.arguments?.getString("guildId") ?: ""
                TicketListScreen(
                    guildId = guildId,
                    onBackClick = { navController.popBackStack() },
                    onTicketSelect = { gId, channelId ->
                        navController.navigate(NavRoutes.ticketDetail(gId, channelId))
                    }
                )
            }

            composable(
                route = NavRoutes.TicketDetail,
                arguments = listOf(
                    navArgument("guildId") { type = NavType.StringType },
                    navArgument("channelId") { type = NavType.StringType }
                )
            ) { backStackEntry ->
                val guildId = backStackEntry.arguments?.getString("guildId") ?: ""
                val channelId = backStackEntry.arguments?.getString("channelId") ?: ""
                TicketDetailScreen(
                    guildId = guildId,
                    channelId = channelId,
                    onBackClick = { navController.popBackStack() }
                )
            }

            composable(NavRoutes.Settings) {
                SettingsScreen(
                    onLogout = {
                        navController.navigate(NavRoutes.Login) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
