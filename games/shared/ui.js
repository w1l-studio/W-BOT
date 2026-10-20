'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

const PREFIX = 'playextras';
const SESSION_TTL_MS = 15 * 60 * 1000;

function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function makeRow(components) {
    return new ActionRowBuilder().addComponents(components);
}

function actionId(action) {
    return `${PREFIX}:action:${action}`;
}

function gameEmbed(title, description, color = 0x5865F2) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(String(title).slice(0, 256))
        .setDescription(String(description || '').slice(0, 4096))
        .setFooter({ text: 'Trivia BOT • /play' })
        .setTimestamp();
}

function button(action, label, style = ButtonStyle.Secondary, disabled = false) {
    return new ButtonBuilder()
        .setCustomId(actionId(action))
        .setLabel(String(label).slice(0, 80))
        .setStyle(style)
        .setDisabled(Boolean(disabled));
}

function stopButton(disabled = false, label = 'إنهاء اللعبة') {
    return button('stop', label, ButtonStyle.Danger, disabled);
}

function buildExtraGamesRow(ownerId, games) {
    if (!ownerId) throw new TypeError('ownerId is required to build the /play games menu.');

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`${PREFIX}:select:${ownerId}`)
        .setPlaceholder('اختر لعبة إضافية من /play')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(games.map(game => ({
            label: game.label,
            value: game.id,
            description: game.description,
            emoji: game.emoji,
        })));

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
    PREFIX,
    SESSION_TTL_MS,
    shuffle,
    makeRow,
    actionId,
    gameEmbed,
    button,
    stopButton,
    buildExtraGamesRow,
};
