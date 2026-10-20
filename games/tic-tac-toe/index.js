'use strict';

const { ButtonStyle } = require('discord.js');
const { makeRow, gameEmbed, button, stopButton } = require('../shared/ui');
const logic = require('./logic');

function render(session) {
    let description;
    if (!session.playerO) {
        description = `بدأت اللعبة مع <@${session.playerX}> كـ **X**. اضغط **انضمام للعب** لتكون اللاعب O.\nلن تبدأ الحركة حتى ينضم لاعب آخر.`;
    } else if (session.finished) {
        description = session.winner
            ? `🏆 الفائز: <@${session.winner}>\nX: <@${session.playerX}> • O: <@${session.playerO}>`
            : `🤝 انتهت اللعبة بالتعادل.\nX: <@${session.playerX}> • O: <@${session.playerO}>`;
    } else {
        const currentPlayer = session.turn === 'X' ? session.playerX : session.playerO;
        description = `X: <@${session.playerX}>\nO: <@${session.playerO}>\n\nالدور الحالي: <@${currentPlayer}> (**${session.turn}**)`;
    }

    const rows = [];
    for (let rowIndex = 0; rowIndex < 3; rowIndex++) {
        const cells = [];
        for (let col = 0; col < 3; col++) {
            const index = rowIndex * 3 + col;
            const mark = session.board[index];
            const style = mark === 'X' ? ButtonStyle.Primary
                : mark === 'O' ? ButtonStyle.Success
                    : ButtonStyle.Secondary;
            cells.push(button(`ttt-cell:${index}`, mark || '·', style,
                session.finished || !session.playerO || Boolean(mark)));
        }
        rows.push(makeRow(cells));
    }

    if (!session.finished && !session.playerO) {
        rows.push(makeRow([
            button('ttt-join', 'انضمام للعب كـ O', ButtonStyle.Success),
            stopButton(false, 'إلغاء اللعبة'),
        ]));
    } else if (!session.finished) {
        rows.push(makeRow([stopButton()]));
    }

    return {
        embeds: [gameEmbed(`${logic.definition.emoji} ${logic.definition.label}`, description,
            session.finished ? 0x57F287 : 0x5865F2)],
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
