'use strict';

const { createMcqGame } = require('../shared/mcqEngine');
const words = require('./words');

module.exports = createMcqGame({
    id: 'scramble',
    label: 'فك الكلمة',
    description: 'رتّب الحروف واختر الكلمة الصحيحة',
    emoji: '🔤',
    mode: 'scramble',
    questions: words,
});
