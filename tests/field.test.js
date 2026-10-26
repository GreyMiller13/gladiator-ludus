const assert = require('node:assert/strict');
const { loadGame, ev, DEFAULT_FILES } = require('./harness');

// Тактическое поле: шаги, удар вдогонку, выучка лучника
const game = () => { const ctx = loadGame([...DEFAULT_FILES, 'combat']); ev(ctx, 'newGame("Т")'); return ctx; };
// бой 1 на 1, бойцы стоят рядом в середине поля
const duel = ctx => ev(ctx, `(() => {
  const a = createGladiator('gallus', 6, { forceSchool: true, autoSpend: true, quality: 1 });
  const b = createGladiator('murmillo', 6, { forceSchool: true, autoSpend: true, quality: 1 });
  const e = { id: 1, kind: 'arena', tier: 0, size: 1 }; ensureField(e); e.field.obstacles = [];
  const B = new Battle([a], [b], e, { mode: 'manual' });
  const [u, f] = B.units;
  u.c = 4; u.r = 2; f.c = 5; f.r = 2; u.mpLeft = 3;
  globalThis.B = B; globalThis.u = u; globalThis.f = f;
})()`);

module.exports = [
  { name: 'поле: шагов от 2 до 5, они растут с инициативой', fn: () => {
    const ctx = game();
    assert.deepEqual([3, 7, 8, 12, 16, 40].map(i => ev(ctx, `moveOf(${i})`)), [2, 2, 3, 4, 5, 5]);
  } },
  { name: 'поле: кто уходит от соседнего противника, получает удар вдогонку', fn: () => {
    const ctx = game();
    duel(ctx);
    assert.equal(ev(ctx, 'B.cmdMove(u, 2, 2)'), true);
    assert.ok(ev(ctx, 'B.log.some(l => l.text.includes("вдогонку"))'));
    assert.ok(ev(ctx, 'B.events.some(e => e.t === "strike" && e.a === f.uid)'));
  } },
  { name: 'поле: шаг вдоль противника и уход от обездвиженного — без удара вдогонку', fn: () => {
    const ctx = game();
    duel(ctx);
    ev(ctx, 'B.cmdMove(u, 4, 1)'); // всё ещё рядом
    assert.equal(ev(ctx, 'B.log.some(l => l.text.includes("вдогонку"))'), false);
    ev(ctx, 'f.stun = 1; B.cmdMove(u, 2, 1)');
    assert.equal(ev(ctx, 'B.log.some(l => l.text.includes("вдогонку"))'), false);
  } },
  { name: 'лучник школы: +15% к урону', fn: () => {
    const ctx = game();
    ev(ctx, 'var g = createGladiator("sagittarius", 6, { forceSchool: true, autoSpend: true, quality: 1 })');
    const own = ev(ctx, 'computeStats(g).dmgMult');
    const other = ev(ctx, 'computeStats({ ...g, cls: "thraex", perks: {} }).dmgMult');
    assert.ok(Math.abs(own - other - 0.15) < 1e-9, `${own} vs ${other}`);
  } },
];
