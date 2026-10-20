'use strict';

const { createMcqGame } = require('../shared/mcqEngine');
const questions = require('./riddles');

module.exports = createMcqGame({
    id: 'riddles',
    label: 'حل الألغاز',
    description: 'ألغاز وتلميحات تدريجية',
    emoji: '🧩',
    mode: 'riddles',
    questions,
});
