package com.wbot.dashboard.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = DiscordBlurple,
    secondary = InfoBlue,
    tertiary = SuccessGreen,
    background = BackgroundDark,
    surface = SurfaceDark,
    onPrimary = TextPrimary,
    onSecondary = TextPrimary,
    onBackground = TextPrimary,
    onSurface = TextPrimary,
    error = ErrorRed,
    onError = TextPrimary,
    surfaceVariant = CardDark,
    onSurfaceVariant = TextSecondary,
    outline = CardBorder
)

@Composable
fun WBotDashboardTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}
