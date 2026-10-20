'use strict';

const { ButtonStyle } = require('discord.js');
const {
    shuffle,
    makeRow,
    gameEmbed,
    button,
    stopButton,
} = require('./ui');

const ROUNDS_PER_GAME = 5;

function createMcqGame(config) {
    const { id, label, description, emoji, questions, mode } = config;

    function makeQuestion(item, allItems) {
        if (mode !== 'scramble') {
            return { ...item, options: shuffle(item.options) };
        }

        const distractors = shuffle(allItems.filter(word => word.word !== item.word))
            .slice(0, 3)
            .map(word => word.word);

        let scrambled = shuffle(item.word.split('')).join('');
        if (scrambled === item.word && item.word.length > 2) {
            scrambled = item.word.slice(1) + item.word[0];
        }

        return {
            word: item.word,
            meaning: item.meaning,
            scrambled,
            answer: item.word,
            options: shuffle([item.word, ...distractors]),
        };
    }

    function createSession(ownerId) {
        return {
            gameId: id,
            ownerId,
            questions: shuffle(questions)
                .slice(0, ROUNDS_PER_GAME)
                .map(item => makeQuestion(item, questions)),
            round: 0,
            score: 0,
            correctAnswers: 0,
            stage: 'question',
            finished: false,
            hintRevealed: false,
            lastAnswerCorrect: false,
            lastPoints: 0,
            completionNotified: false,
        };
    }

    function answerOf(question) {
        return mode === 'scramble' ? question.answer : question.a;
    }

    function render(session) {
        const current = session.questions[session.round];
        if (!current) {
            return {
                embeds: [gameEmbed(`${emoji} ${label}`, `انتهت اللعبة. مجموع نقاطك: **${session.score}**`, 0x57F287)],
                components: [],
                allowedMentions: { parse: [] },
            };
        }

        if (session.stage === 'question') {
            let text;
            if (mode === 'scramble') {
                text = `رتّب الحروف لاكتشاف الكلمة التي تعني **${current.meaning}**.\n\n**الحروف:** ${current.scrambled.split('').join(' · ')}`;
            } else {
                text = current.q;
            }

            if (mode === 'riddles' && session.hintRevealed) {
                text += `\n\n💡 **التلميح:** ${current.hint}`;
            }

            text += `\n\nالجولة **${session.round + 1}/${session.questions.length}** • نقاطك **${session.score}**`;

            const answerButtons = current.options.map((option, index) =>
                button(`answer:${index}`, String(option), ButtonStyle.Secondary)
            );

            const rows = [makeRow(answerButtons)];
            if (mode === 'riddles') {
                rows.push(makeRow([
                    button('hint', session.hintRevealed ? 'تم عرض التلميح' : 'عرض تلميح', ButtonStyle.Primary, session.hintRevealed),
                    stopButton(),
                ]));
            } else {
                rows.push(makeRow([stopButton()]));
            }

            return {
                embeds: [gameEmbed(`${emoji} ${label}`, text)],
                components: rows,
                allowedMentions: { parse: [] },
            };
        }

        const lastRound = session.round === session.questions.length - 1;
        const correct = session.lastAnswerCorrect;
        const status = correct ? '✅ إجابة صحيحة!' : '❌ إجابة غير صحيحة.';
        const answer = answerOf(current);
        const pointText = correct ? `\nحصلت على **${session.lastPoints}** نقطة.` : '';
        const summary = lastRound
            ? `انتهت الجولات • مجموع النقاط: **${session.score}**`
            : `النقاط: **${session.score}** • الجولة ${session.round + 1}/${session.questions.length}`;

        const embed = gameEmbed(
            `${emoji} ${label}`,
            `${status}\nالإجابة الصحيحة: **${answer}**${pointText}\n\n${summary}`,
            correct ? 0x57F287 : 0xED4245
        );

        if (lastRound || session.stage === 'finished') {
            return { embeds: [embed], components: [], allowedMentions: { parse: [] } };
        }

        return {
            embeds: [embed],
            components: [makeRow([
                button('next', 'السؤال التالي', ButtonStyle.Primary),
                stopButton(),
            ])],
            allowedMentions: { parse: [] },
        };
    }

    function handleAction(session, action) {
        if (session.finished) return { error: 'انتهت هذه اللعبة بالفعل.' };

        if (action === 'hint' && mode === 'riddles') {
            if (session.stage !== 'question') return { error: 'يمكن طلب التلميح أثناء السؤال فقط.' };
            if (session.hintRevealed) return { error: 'استخدمت التلميح لهذا السؤال بالفعل.' };
            session.hintRevealed = true;
            return { changed: true };
        }

        if (action.startsWith('answer:')) {
            if (session.stage !== 'question') return { error: 'لقد أجبت عن هذا السؤال بالفعل.' };
            const index = Number(action.split(':')[1]);
            const current = session.questions[session.round];

            if (!Number.isInteger(index) || index < 0 || index >= current.options.length) {
                return { error: 'اختيار غير صالح.' };
            }

            const correct = current.options[index] === answerOf(current);
            const points = correct
                ? mode === 'riddles'
                    ? (session.hintRevealed ? 1 : 2)
                    : 1
                : 0;

            session.lastAnswerCorrect = correct;
            session.lastPoints = points;
            session.score += points;
            if (correct) session.correctAnswers++;

            const lastRound = session.round === session.questions.length - 1;
            session.stage = lastRound ? 'finished' : 'result';
            if (lastRound) session.finished = true;

            return { changed: true, completed: lastRound };
        }

        if (action === 'next') {
            if (session.stage !== 'result') return { error: 'أجب عن السؤال الحالي أولًا.' };
            session.round++;
            session.stage = 'question';
            session.hintRevealed = false;
            return { changed: true };
        }

        return { error: 'هذا الإجراء غير متاح لهذه اللعبة.' };
    }

    return {
        definition: { id, label, description, emoji },
        createSession,
        render,
        handleAction,
    };
}

module.exports = { createMcqGame };
