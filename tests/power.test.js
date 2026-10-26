const assert = require('node:assert/strict');
const { ev } = require('./harness');

// Мощь бойца и посильный бой дня
module.exports = [
  { name: 'мощь: новобранец 1-го уровня — около 100, опыт и снаряжение её растят', fn: ctx => {
    ev(ctx, 'newGame("Т"); var g = STATE.gladiators[0]');
    const p = ev(ctx, 'combatPower(g)');
    assert.ok(p >= 70 && p <= 140, String(p));
    ev(ctx, 'var h = createGladiator("gallus", 10, { forceSchool: true, autoSpend: true, quality: 2 })');
    assert.ok(ev(ctx, 'combatPower(h)') > p * 2.5);
    assert.equal(ev(ctx, 'teamPower([g, h])'), ev(ctx, 'combatPower(g) + combatPower(h)'));
  } },
  { name: 'мощь: расклад сил по отношению мощи', fn: ctx => {
    assert.equal(ev(ctx, 'powerVerdict(1.5).cls'), 'pw-good');
    assert.equal(ev(ctx, 'powerVerdict(1).cls'), 'pw-even');
    assert.equal(ev(ctx, 'powerVerdict(0.6).cls'), 'pw-bad');
  } },
  { name: 'посильный бой: если на младшей арене нет боя по силам лудуса, один бой становится по размеру', fn: ctx => {
    ev(ctx, 'newGame("Т")');
    ev(ctx, 'var evs = [2, 3].map(size => ({ id: uid(), tier: 0, size, enemies: generateEnemyTeam(0, size), gold: 50, fame: 3, done: false })); ensureEasyEvent(evs)');
    assert.ok(ev(ctx, 'evs.some(e => e.easy && e.size === 1 && e.enemies.length === 1)'));
    assert.ok(ev(ctx, 'evs.filter(e => e.easy).every(e => e.size <= STATE.gladiators.length)'));
  } },
  { name: 'посильный бой: каждый день на младшей арене есть бой, где ваши лучшие сильнее в 1.4 раза', fn: ctx => {
    ev(ctx, 'newGame("Т")');
    for (let day = 0; day < 12; day++) {
      ev(ctx, 'STATE.gold = 99999; nextDay()');
      const ok = ev(ctx, `STATE.events.some(e => !e.training && !e.boss && e.size <= STATE.gladiators.length
        && teamPower(bestTeam(e.size)) >= EASY_RATIO * teamPower(e.enemies))`);
      assert.ok(ok, `день ${day}`);
    }
    // и с несколькими бойцами
    ev(ctx, 'for (let i = 0; i < 2; i++) STATE.gladiators.push(createGladiator(null, 2, { autoSpend: true })); nextDay()');
    assert.ok(ev(ctx, 'STATE.events.some(e => e.easy && teamPower(bestTeam(e.size)) >= EASY_RATIO * teamPower(e.enemies))'));
  } },
];
