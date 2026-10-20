'use strict';

const { ButtonStyle } = require('discord.js');
const { makeRow, gameEmbed, button, stopButton } = require('../shared/ui');
const logic = require('./logic');

function render(session) {
    const remaining = logic.MAX_ATTEMPTS - session.guesses.length;
    let description = `حاول تخمين رقم من **1 إلى 20**. لديك **${logic.MAX_ATTEMPTS} محاولات**.\n\nالمحاولات المتبقية: **${remaining}**`;
    if (session.lastHint) description += `\n\n${session.lastHint}`;
    if (session.guesses.length) description += `\nالأرقام التي جرّبتها: ${session.guesses.join('، ')}`;

    if (session.finished) {
        return {
            embeds: [gameEmbed(`${logic.definition.emoji} ${logic.definition.label}`,
                `${description}\n\nالنقاط: **${session.score}**`, session.winner ? 0x57F287 : 0xED4245)],
            components: [],
            allowedMentions: { parse: [] },
        };
    }

    const buttons = Array.from({ length: 20 }, (_, index) => {
        const value = index + 1;
        return button(`number:${value}`, String(value), ButtonStyle.Secondary, session.guesses.includes(value));
    });

    const rows = [];
    for (let index = 0; index < buttons.length; index += 5) rows.push(makeRow(buttons.slice(index, index + 5)));
    rows.push(makeRow([stopButton()]));

    return {
        embeds: [gameEmbed(`${logic.definition.emoji} ${logic.definition.label}`, description)],
        components: rows,
        allowedMentions: { parse: [] },
    };
}

module.exports = {
    definition: logic.definition,
    createSession: logic.createSession,
    handleAction: logic.handleAction,
    render,
};
