'use strict';

const definition = {
    id: 'ttt',
    label: 'إكس أو',
    description: 'تحدٍّ بين عضوين',
    emoji: '⭕',
};

function createSession(ownerId) {
    return {
        gameId: definition.id,
        ownerId,
        playerX: ownerId,
        playerO: null,
        board: Array(9).fill(null),
        turn: 'X',
        winner: null,
        score: 0,
        correctAnswers: 0,
        finished: false,
        completionNotified: false,
    };
}

function winningLine(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    return lines.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]) || null;
}

function handleAction(session, action, userId) {
    if (session.finished) return { error: 'انتهت هذه اللعبة بالفعل.' };

    if (action === 'ttt-join') {
        if (userId === session.playerX) return { error: 'أنت بدأت اللعبة كـ X؛ دع عضوًا آخر ينضم.' };
        if (session.playerO) return { error: 'انضم لاعب آخر بالفعل.' };
        session.playerO = userId;
        return { changed: true };
    }

    if (!action.startsWith('ttt-cell:')) {
        return { error: 'هذا الإجراء غير متاح للعبة إكس أو.' };
    }

    if (!session.playerO) return { error: 'انتظر حتى ينضم لاعب ثانٍ.' };
    if (![session.playerX, session.playerO].includes(userId)) return { error: 'أنت لست أحد لاعبي هذه الجولة.' };

    const currentPlayer = session.turn === 'X' ? session.playerX : session.playerO;
    if (userId !== currentPlayer) return { error: 'ليس دورك الآن.' };

    const cell = Number(action.split(':')[1]);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8 || session.board[cell]) {
        return { error: 'هذا المربع غير متاح.' };
    }

    session.board[cell] = session.turn;
    if (winningLine(session.board)) {
        session.finished = true;
        session.winner = userId;
        session.score = 1;
        session.correctAnswers = 1;
        return { changed: true, completed: true };
    }

    if (session.board.every(Boolean)) {
        session.finished = true;
        session.winner = null;
        return { changed: true, completed: true };
    }

    session.turn = session.turn === 'X' ? 'O' : 'X';
    return { changed: true };
}

module.exports = { definition, createSession, winningLine, handleAction };
