const assert = require('node:assert/strict');
const { ev } = require('./harness');

// бой меньшинством: на арене можно выйти на одного бойца меньше — награда за победу ×2
module.exports = [
  { name: 'меньшинство: на бой 2 на 2 можно выйти одним, награда удваивается', fn: ctx => {
    ev(ctx, 'newGame("Т"); var e = STATE.events.find(x => x.size === 2)');
    assert.equal(ev(ctx, 'setShort(e, true)'), true);
    assert.equal(ev(ctx, 'e.playerSize'), 1);
    assert.equal(ev(ctx, 'winReward(e).gold'), ev(ctx, 'e.gold * 2'));
    assert.equal(ev(ctx, 'winReward(e).fame'), ev(ctx, 'e.fame * 2'));
    ev(ctx, 'setShort(e, false)');
    assert.equal(ev(ctx, 'e.playerSize'), undefined);
    assert.equal(ev(ctx, 'winReward(e).gold'), ev(ctx, 'e.gold'));
  } },
  { name: 'меньшинство: не для 1 на 1, учебного боя, хозяина арены и заказов', fn: ctx => {
    ev(ctx, 'newGame("Т", { story: true })');
    assert.equal(ev(ctx, 'setShort(STATE.events.find(x => x.size === 1 && !x.training), true)'), false);
    assert.equal(ev(ctx, 'setShort(STATE.events.find(x => x.training), true)'), false);
    assert.equal(ev(ctx, 'setShort(STORY.bossEvent("varus"), true)'), false);
    assert.equal(ev(ctx, 'setShort({ kind: "contract", size: 3, gold: 10, fame: 0 }, true)'), false);
  } },
];
