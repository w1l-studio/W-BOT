# Trivia BOT — Stats System

A modular Discord.js v14-style statistics subsystem with exactly two slash commands:

- `/stats` — private member dashboard.
- `/stats-admin` — private admin analytics dashboard.

The `stats-admin` slash command is registered with Discord's default `ManageGuild` command permission and checks `Administrator`/`ManageGuild` again in code. If you want a custom staff role without those permissions to invoke it, grant that role access to the command in Discord's Application Commands permissions settings as well as adding its ID to `adminRoleIds`.

The UI sections are navigated with a select menu and refresh/close buttons. The subsystem does not register slash commands with Discord by itself: import the command files with your existing loader/deployment flow.

## What is collected automatically

- Message counts by guild, user, channel, UTC day and UTC hour. Message content is never stored; bot messages are ignored.
- Member joins and leaves from the time the collector is enabled.

## What must be integrated explicitly

Game and economy outcomes cannot be inferred safely from generic Discord events. Call the public helpers after the existing system has confirmed a completed event.

```js
const { recordGame, recordEconomy } = require("./systems/stats");

// After a game round/session has actually finished:
recordGame(client, {
  guildId: interaction.guildId,
  userId: playerId,
  gameId: "trivia",
  gameName: "Trivia Quiz",
  answers: 10,
  correct: 8,
  wins: 1,
  participants: 1,
  durationMs: 45000,
  bestStreak: 5,
});

// After the existing economy system successfully applies an earning/spending transaction:
recordEconomy(client, {
  guildId: interaction.guildId,
  userId: interaction.user.id,
  type: "earned", // earned | spent | transfer | received
  amount: 25,
  // peerUserId: "recipient-id", // optional for type: "transfer"
});
```

Only call these functions once the underlying game/economy action succeeds, otherwise the statistics can be inaccurate. For transfers, `type: "transfer"` records value transferred out and optionally the recipient as `peerUserId`.

## Integration steps

1. Copy the `systems/stats` directory into the root of your existing `Trivia BOT` project.
2. In your main startup file, after creating the Discord client and before/after login, add:

   ```js
   const { registerStatsSystem } = require("./systems/stats");
   registerStatsSystem(client, {
     // Optional: role IDs allowed to open the admin dashboard in addition to ManageGuild/Administrator.
     adminRoleIds: ["YOUR_ADMIN_ROLE_ID"],
     // Optional: absolute or relative path. Default is systems/stats/data/stats.json.
     // dataFile: "./systems/stats/data/stats.json",
   });
   ```

3. Adapt `systems/stats/commands/stats.js` and `stats-admin.js` to the export shape expected by your command loader, if needed. They currently use the common Discord.js command-module pattern: `{ data, execute }`.
4. Make sure your bot has the `GuildMessages`, `MessageContent` (not required for content parsing but commonly part of existing setup), and `GuildMembers` intents for the events you want to collect. Message content is not read or stored by this system.
5. Add the two slash command definitions to your existing deployment/registration process. Do not deploy the same command twice.
6. Connect game and economy systems using `recordGame` / `recordEconomy` as shown above.
7. Test in a development server first, then restart the bot.

## Permission model

- `/stats` is ephemeral and shows the invoking member's own profile.
- `/stats-admin` is ephemeral, defaults to requiring `ManageGuild`, and checks `Administrator`/`ManageGuild` or any configured `adminRoleIds` again in code.
- Dashboard component IDs are bound to the user who opened the panel. Other users cannot navigate or export that panel.

## Storage and retention

- A JSON database is created at `systems/stats/data/stats.json` on first write. Do not commit this file to a public repository because it contains guild/user IDs and activity counts.
- Daily breakdowns are retained for 90 days by default; lifetime counters remain available. Change `historyDays` in `config.js` to adjust this.
- A delayed atomic write reduces disk writes during message bursts. Call `flushStats(client)` for a manual flush before a controlled shutdown if your bot architecture supports it.
- Daily boundaries and hourly statistics use UTC.

## Current scope / honest limitations

- Existing historical messages, past joins/leaves, and old game sessions are not magically backfilled.
- Member online/presence statistics are not included; these depend on presence intents and should be added only if actually needed.
- Member count comes from Discord's current guild cache; join/leave trends start once the collector is active.
- The economy panel reports only transactions sent to `recordEconomy`; it is not a current balance reader. Link it to your existing economy storage if you need wallet balances.
- Charts are rendered as compact text bars/sparklines in Discord embeds, not external graphical attachments.
- Discord embed limits still apply, so long lists are capped.

## Syntax check

From your project root on Windows CMD:

```cmd
for /r systems\stats %f in (*.js) do @node --check "%f"
```

In a `.bat` file, use `%%f` instead of `%f`.
