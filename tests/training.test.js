const assert = require('node:assert/strict');
const { loadGame, ev } = require('./harness');

const FILES = ['data', 'core', 'training'];
// боец ближнего боя или лучник заданного уровня; w — дней ранения
const setup = () => {
  const ctx = loadGame(FILES);
  ev(ctx, `newGame("Т");
    var mk = (bow, lvl = 1, w = 0) => { const g = createGladiator(null, lvl); g.equip.weapon = makeItem(bow ? 'arcus' : 'gladius', 0); g.wounded = w; return g; };
    var names = p => ({ rest: p.rest.map(g => g.name), pairs: p.pairs.map(x => x.map(g => g.name)), dummy: p.dummy ? p.dummy.name : null, range: p.range.map(g => g.name) });`);
  return ctx;
};

module.exports = [
  { name: 'тренировка: один боец — на манекене, двое — в паре', fn: () => {
    const ctx = setup();
    ev(ctx, 'var a = mk(false), b = mk(false)');
    let p = ev(ctx, 'trainingPlan([a])');
    assert.equal(p.dummy, ev(ctx, 'a')); assert.equal(p.pairs.length, 0);
    p = ev(ctx, 'trainingPlan([a, b])');
    assert.equal(p.pairs.length, 1); assert.equal(p.dummy, null);
  } },
  { name: 'тренировка: нечётное число — пары, оставшийся на манекене', fn: () => {
    const ctx = setup();
    const p = ev(ctx, 'trainingPlan([mk(false), mk(false), mk(false), mk(false), mk(false)])');
    assert.equal(p.pairs.length, 2); assert.ok(p.dummy);
  } },
  { name: 'тренировка: лучник стреляет в мишень, боец без пары — на манекене', fn: () => {
    const ctx = setup();
    ev(ctx, 'var m = mk(false), r = mk(true)');
    const p = ev(ctx, 'trainingPlan([m, r])');
    assert.equal(p.range.length, 1); assert.equal(p.range[0], ev(ctx, 'r'));
    assert.equal(p.dummy, ev(ctx, 'm')); assert.equal(p.pairs.length, 0);
  } },
  { name: 'тренировка: несколько лучников — все на стрельбище', fn: () => {
    const ctx = setup();
    const p = ev(ctx, 'trainingPlan([mk(false), mk(true), mk(true), mk(true), mk(true), mk(true)])');
    assert.equal(p.range.length, 5); assert.ok(p.dummy); assert.equal(p.pairs.length, 0);
  } },
  { name: 'тренировка: раненые сидят на песке и не тренируются', fn: () => {
    const ctx = setup();
    ev(ctx, 'var w1 = mk(false, 1, 2), w2 = mk(true, 1, 1), a = mk(false), b = mk(false)');
    const p = ev(ctx, 'trainingPlan([w1, a, w2, b])');
    assert.deepEqual(new Set(p.rest), new Set([ev(ctx, 'w1'), ev(ctx, 'w2')]));
    assert.equal(p.pairs.length, 1); assert.equal(p.range.length, 0); assert.equal(p.dummy, null);
  } },
  { name: 'тренировка: больше шести — в шапке шесть самых мощных', fn: () => {
    const ctx = setup();
    ev(ctx, 'var all = [1, 9, 2, 8, 3, 7, 4, 6].map(l => mk(false, l))');
    const p = ev(ctx, 'trainingPlan(all)');
    const shown = ev(ctx, 'p => [...p.rest, ...p.pairs.flat(), ...(p.dummy ? [p.dummy] : []), ...p.range]')(p);
    assert.equal(shown.length, 6);
    const pw = ev(ctx, 'all.map(combatPower).sort((a, b) => b - a)');
    const min = Math.min(...shown.map(g => ev(ctx, 'combatPower')(g)));
    assert.ok(min >= pw[5], `${min} < ${pw[5]}`);
  } },
];
