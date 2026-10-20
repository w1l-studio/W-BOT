# Quick Integration Checklist

- [ ] Copy `systems/stats` into project root.
- [ ] Add `registerStatsSystem(client)` once in main startup.
- [ ] Ensure project intents include `GuildMessages` and `GuildMembers` as applicable.
- [ ] Add `commands/stats.js` and `commands/stats-admin.js` to the existing command loader.
- [ ] Register/deploy `/stats` and `/stats-admin` using the existing deployment script.
- [ ] Set `adminRoleIds` in startup options if staff roles other than ManageGuild/Administrator need access.
- [ ] Call `recordGame(client, data)` after completed games.
- [ ] Call `recordEconomy(client, data)` after successful economy transactions.
- [ ] Test components, permissions, restart persistence, and reports in a test server.
