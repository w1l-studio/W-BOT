
'use strict';

const { ProtectionManager } = require('./core/ProtectionManager');
const { JsonStorage } = require('./storage/json/JsonStorage');

const { createProtectionCommand } = require('./commands/protection');
const { createWhitelistCommand } = require('./commands/whitelist');
const { createSecurityCommand } = require('./commands/security');
const { createModerationCommands } = require('./commands/moderation');

const { ModerationService } = require('./services/moderationService');
const { handleDashboardInteraction } = require('./dashboard/interactionHandler');
const { DEFAULT_CONFIG } = require('./config');

const { MessageFlags } = require('discord.js');

function setupProtection(client, options = {}) {
    if (!client || typeof client.on !== 'function') {
        throw new TypeError(
            'setupProtection requires a Discord.js client.'
        );
    }

    const storage = options.storage
        || new JsonStorage(options.dataDir);

    const manager = new ProtectionManager(client, {
        storage,
        logger: options.logger,
        defaults: options.defaults || DEFAULT_CONFIG,
    });

    void manager.start();

    const moderationService = new ModerationService(manager);

    const commands = [
        createProtectionCommand(manager),
        createWhitelistCommand(manager),
        createSecurityCommand(manager),
        ...createModerationCommands(manager, moderationService),
    ];

    const onInteraction = async (interaction) => {
        if (
            !interaction.isChatInputCommand?.() &&
            !interaction.isButton?.() &&
            !interaction.isStringSelectMenu?.()
        ) {
            return;
        }

        try {
            if (
                await handleDashboardInteraction(
                    interaction,
                    manager
                )
            ) {
                return;
            }

            // سيُنفّذ index.js أوامر Slash من قائمة commands.
            // نبقي هذا المسار معطّلًا لتجنب تنفيذ الأمر مرتين.
            if (options.handleCommands === false) {
                return;
            }

            if (!interaction.isChatInputCommand?.()) {
                return;
            }

            const command = commands.find(
                (item) =>
                    item.data.name === interaction.commandName
            );

            if (command) {
                await command.execute(interaction);
            }
        } catch (error) {
            manager.logger.error(
                'Interaction handler failed',
                error
            );

            const payload = {
                content:
                    'حدث خطأ أثناء تنفيذ الأمر. راجع سجلات البوت.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    };

    client.on('interactionCreate', onInteraction);

    return {
        manager,
        commands,
        moderationService,

        async destroy() {
            client.off('interactionCreate', onInteraction);
            await manager.stop();
        },
    };
}

module.exports = {
    setupProtection,
    ProtectionManager,
    ModerationService,
    DEFAULT_CONFIG,
};
