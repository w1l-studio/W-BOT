'use strict';

const MAX_ATTEMPTS = 6;
const definition = {
    id: 'number',
    label: 'خمّن الرقم',
    description: 'اكتشف الرقم من 1 إلى 20 خلال محاولات محدودة',
    emoji: '🔢',
};

function createSession(ownerId) {
    return {
        gameId: definition.id,
        ownerId,
        secret: Math.floor(Math.random() * 20) + 1,
        guesses: [],
        lastHint: null,
        score: 0,
        correctAnswers: 0,
        finished: false,
        winner: null,
        completionNotified: false,
    };
}

function handleAction(session, action) {
    if (session.finished) return { error: 'انتهت هذه اللعبة بالفعل.' };
    if (!action.startsWith('number:')) return { error: 'هذا الإجراء غير متاح للعبة تخمين الرقم.' };

    const guess = Number(action.split(':')[1]);
    if (!Number.isInteger(guess) || guess < 1 || guess > 20 || session.guesses.includes(guess)) {
        return { error: 'هذا التخمين غير صالح أو تم استخدامه.' };
    }

    session.guesses.push(guess);
    if (guess === session.secret) {
        session.score = Math.max(1, MAX_ATTEMPTS - session.guesses.length + 2);
        session.correctAnswers = 1;
        session.winner = session.ownerId;
        session.lastHint = `🎉 صحيح! الرقم هو **${session.secret}**.`;
        session.finished = true;
        return { changed: true, completed: true };
    }

    if (session.guesses.length >= MAX_ATTEMPTS) {
        session.lastHint = `انتهت المحاولات. الرقم الصحيح كان **${session.secret}**.`;
        session.finished = true;
        return { changed: true, completed: true };
    }

    session.lastHint = guess < session.secret
        ? '⬆️ الرقم الصحيح أكبر من تخمينك.'
        : '⬇️ الرقم الصحيح أصغر من تخمينك.';

    return { changed: true };
}

module.exports = { MAX_ATTEMPTS, definition, createSession, handleAction };
