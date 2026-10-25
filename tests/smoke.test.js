const assert = require('node:assert/strict');
const { ev } = require('./harness');

module.exports = [
  { name: 'новая игра создаёт лудус с одним бойцом', fn: ctx => {
    ev(ctx, 'newGame("Тест")');
    assert.equal(ev(ctx, 'STATE.gladiators.length'), 1);
    assert.equal(ev(ctx, 'STATE.gold'), 200);
  } },
];
