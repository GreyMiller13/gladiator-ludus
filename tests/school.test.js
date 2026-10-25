const assert = require('node:assert/strict');
const { ev } = require('./harness');

// очки школы (специализации) даются за уровни начиная с SCHOOL_LEVEL: на 5-м — 1, на 6-м — 2 и т. д.
module.exports = [
  { name: 'очки школы: до 5-го уровня не копятся, с 5-го — по одному за уровень', fn: ctx => {
    ev(ctx, 'newGame("Т"); var g = createGladiator(null, 1)');
    assert.equal(ev(ctx, 'g.freeSpec'), 0);
    ev(ctx, 'for (let i = 1; i < 4; i++) levelUp(g)');
    assert.equal(ev(ctx, 'g.level'), 4);
    assert.equal(ev(ctx, 'g.freeSpec'), 0);
    ev(ctx, 'levelUp(g)');
    assert.equal(ev(ctx, 'g.freeSpec'), 1);
    ev(ctx, 'levelUp(g)');
    assert.equal(ev(ctx, 'g.freeSpec'), 2);
  } },
  { name: 'очки школы: боец школы 12-го уровня (противник) получает 8 очков', fn: ctx => {
    ev(ctx, 'newGame("Т"); var e = createGladiator("murmillo", 12, { autoSpend: true })');
    assert.equal(ev(ctx, 'e.freeSpec + Object.values(e.perks).reduce((s, r) => s + r, 0)'), 8);
  } },
  { name: 'загрузка: у бойца без школы лишние очки школы снимаются', fn: ctx => {
    ev(ctx, 'newGame("Т"); var g = createGladiator(null, 6); g.freeSpec = 6; STATE.gladiators.push(g); var m = createGladiator(null, 3); m.freeSpec = 3; STATE.market.push(m); migrateState()');
    assert.equal(ev(ctx, 'g.freeSpec'), 2);
    assert.equal(ev(ctx, 'm.freeSpec'), 0);
  } },
  { name: 'ступени школы: I открывается на 5-м уровне, II — на 8-м', fn: ctx => {
    ev(ctx, 'newGame("Т"); var g = createGladiator("murmillo", 5); g.freeSpec = 3');
    assert.equal(ev(ctx, 'canLearnPerk(g, { ...PERKS.mur_wall, cls: "murmillo" })'), true);
    assert.equal(ev(ctx, 'canLearnPerk(g, { ...PERKS.mur_iron, cls: "murmillo" })'), false);
    ev(ctx, 'levelUp(g); levelUp(g); levelUp(g)');
    assert.equal(ev(ctx, 'canLearnPerk(g, { ...PERKS.mur_iron, cls: "murmillo" })'), true);
  } },
  { name: 'загрузка: навыки закрытых по уровню ступеней возвращаются очками', fn: ctx => {
    ev(ctx, 'newGame("Т"); var g = createGladiator("murmillo", 6); g.perks = { mur_wall: 1, mur_iron: 2 }; g.freeSpec = 0; STATE.gladiators.push(g); migrateState()');
    assert.equal(ev(ctx, 'JSON.stringify(g.perks)'), '{"mur_wall":1}');
    assert.equal(ev(ctx, 'g.freeSpec'), 2);
  } },
  { name: 'школы: у каждой — главные, полезные и лишние характеристики и совет по развитию', fn: ctx => {
    assert.equal(ev(ctx, 'JSON.stringify(classBuild("murmillo"))'), '{"main":["end","str"],"useful":["skl","wil"],"low":["agi"]}');
    assert.equal(ev(ctx, 'JSON.stringify(classBuild("retiarius").main)'), '["agi","skl"]');
    assert.equal(ev(ctx, 'JSON.stringify(classBuild("gallus").main)'), '["str","end"]');
    for (const c of ev(ctx, 'CLASS_KEYS')) {
      assert.ok(ev(ctx, `classBuild("${c}").main.length`) >= 2, c);
      assert.ok(ev(ctx, `CLASSES.${c}.build.length`) > 20, c);
    }
  } },
];
