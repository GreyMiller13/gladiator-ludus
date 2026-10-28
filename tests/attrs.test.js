const assert = require('node:assert/strict');
const { loadGame, ev } = require('./harness');

const fresh = () => {
  const ctx = loadGame();
  ev(ctx, 'newGame("Тест"); var g = STATE.gladiators[0]; g.freeAttr = 3; var base = { ...g.attrs }');
  return ctx;
};

module.exports = [
  { name: 'очки характеристик: черновик показывает вложенное, но боец не меняется', fn: () => {
    const ctx = fresh();
    ev(ctx, 'var v = attrDraftView(g, { str: 2, agi: 1 })');
    assert.equal(ev(ctx, 'v.attrs.str'), ev(ctx, 'base.str + 2'));
    assert.equal(ev(ctx, 'v.attrs.agi'), ev(ctx, 'base.agi + 1'));
    assert.equal(ev(ctx, 'v.freeAttr'), 0);
    assert.equal(ev(ctx, 'g.attrs.str'), ev(ctx, 'base.str'));
    assert.equal(ev(ctx, 'g.freeAttr'), 3);
    assert.equal(ev(ctx, 'attrDraftView(g, null)'), ev(ctx, 'g'));
  } },
  { name: 'очки характеристик: «Закрепить» переносит черновик в бойца', fn: () => {
    const ctx = fresh();
    assert.equal(ev(ctx, 'commitAttrDraft(g, { str: 2, agi: 1 })'), true);
    assert.equal(ev(ctx, 'g.attrs.str'), ev(ctx, 'base.str + 2'));
    assert.equal(ev(ctx, 'g.attrs.agi'), ev(ctx, 'base.agi + 1'));
    assert.equal(ev(ctx, 'g.freeAttr'), 0);
  } },
  { name: 'очки характеристик: больше свободных или отрицательные не закрепляются', fn: () => {
    const ctx = fresh();
    assert.equal(ev(ctx, 'commitAttrDraft(g, { str: 4 })'), false);
    assert.equal(ev(ctx, 'commitAttrDraft(g, { str: 2, agi: -1 })'), false);
    assert.equal(ev(ctx, 'g.attrs.str'), ev(ctx, 'base.str'));
    assert.equal(ev(ctx, 'g.attrs.agi'), ev(ctx, 'base.agi'));
    assert.equal(ev(ctx, 'g.freeAttr'), 3);
  } },
];
