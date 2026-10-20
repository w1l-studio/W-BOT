'use strict';

const { createMcqGame } = require('../shared/mcqEngine');
const questions = require('./questions');

module.exports = createMcqGame({
    id: 'quiz',
    label: 'تحدي المعلومات',
    description: 'أسئلة عامة واختيارات متعددة',
    emoji: '🧠',
    mode: 'quiz',
    questions,
});
