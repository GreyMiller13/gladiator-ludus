const assert = require('node:assert/strict');
const { loadGame, ev, DEFAULT_FILES } = require('./harness');

// Тактическое поле: очки действия, выход из боя, лицо и спина, окружение, выучка лучника
const game = () => { const ctx = loadGame([...DEFAULT_FILES, 'combat']); ev(ctx, 'newGame("Т")'); return ctx; };
// бой без препятствий: u (галл, игрок) и f (мурмиллон, противник) стоят рядом в середине поля, w — второй противник
const setup = ctx => ev(ctx, `(() => {
  const mk = c => createGladiator(c, 6, { forceSchool: true, autoSpend: true, quality: 1 });
  const e = { id: 1, kind: 'arena', tier: 0, size: 2 }; ensureField(e); e.field.obstacles = [];
  const B = new Battle([mk('gallus')], [mk('murmillo'), mk('thraex')], e, { mode: 'manual' });
  const [u, f, w] = B.units;
  u.c = 4; u.r = 2; f.c = 5; f.r = 2; w.c = 8; w.r = 0;
  B.updateFacing();
  Object.assign(globalThis, { B, u, f, w });
})()`);

module.exports = [
  { name: 'поле: ОД — 5 + инициатива / 4, от 5 до 9; удар — 4 ОД любым оружием, умение — 5', fn: () => {
    const ctx = game();
    assert.deepEqual([3, 7, 8, 16, 40].map(i => ev(ctx, `apOf(${i})`)), [5, 6, 7, 9, 9]);
    assert.deepEqual(['sica', 'gladius', 'spear', 'arcus', 'longsword'].map(b => ev(ctx, `attackAp(makeItem("${b}", 1))`)), [4, 4, 4, 4, 4]);
    assert.equal(ev(ctx, 'attackAp(null)'), 4);
    assert.equal(ev(ctx, 'abilityAp(computeStats(createGladiator("thraex", 5, { forceSchool: true })))'), 5);
  } },
  { name: 'поле: шаг прочь от соседнего противника стоит на 1 ОД дороже, шаг вдоль — нет', fn: () => {
    const ctx = game();
    setup(ctx);
    assert.equal(ev(ctx, 'B.reachable(u, 10).get(cellKey(3, 2)).d'), 2);
    assert.equal(ev(ctx, 'B.reachable(u, 10).get(cellKey(4, 1)).d'), 1);
    assert.equal(ev(ctx, 'B.reachable(u, 10).get(cellKey(2, 2)).d'), 3);
    // от оглушённого отходят свободно
    ev(ctx, 'f.stun = 1');
    assert.equal(ev(ctx, 'B.reachable(u, 10).get(cellKey(3, 2)).d'), 1);
  } },
  { name: 'поле: удар тратит 4 ОД, ударов — сколько хватит ОД, остаток — уклонение до следующего хода', fn: () => {
    const ctx = game();
    setup(ctx);
    ev(ctx, 'u.apLeft = 9; f.hp = f.maxHp = 9999');
    assert.equal(ev(ctx, 'B.cmdAttack(u, f)'), true);
    assert.equal(ev(ctx, 'u.apLeft'), 5);
    assert.equal(ev(ctx, 'B.cmdAttack(u, f)'), true, 'второй удар — ОД хватает');
    assert.equal(ev(ctx, 'u.apLeft'), 1);
    assert.equal(ev(ctx, 'B.cmdAttack(u, f)'), false, 'на третий не хватает');
    assert.equal(ev(ctx, 'u.hits'), 2);
    ev(ctx, 'B.current = u; B.queue = [f]; B.beginTurn()');
    assert.equal(ev(ctx, 'u.evade'), ev(ctx, 'u.apLeft * AP_DODGE'));
    assert.ok(ev(ctx, 'u.evade') > 0);
    ev(ctx, 'u.acted = false; u.apLeft = 1');
    assert.equal(ev(ctx, 'B.cmdAttack(u, f)'), false, 'на удар не хватает ОД');
  } },
  { name: 'поле: пропущенный ход (оглушение, сеть) уклонения не даёт', fn: () => {
    const ctx = game();
    setup(ctx);
    ev(ctx, 'f.stun = 1; B.current = u; B.queue = [f, w]; B.beginTurn(); B.beginTurn()');
    assert.equal(ev(ctx, 'f.evade'), 0);
  } },
  { name: 'поле: боец смотрит на того, кого атаковал; удар с другой стороны — в спину', fn: () => {
    const ctx = game();
    setup(ctx);
    // f смотрит влево, на u; w справа от f — у него за спиной
    assert.equal(ev(ctx, 'f.face'), -1);
    ev(ctx, 'w.c = 6; w.r = 2');
    assert.equal(ev(ctx, 'B.isBehind(f, w)'), true);
    assert.equal(ev(ctx, 'B.isBehind(f, u)'), false);
    // u бьёт f, а f разворачивается и бьёт... того, кто справа — теперь спиной к u стоит он сам
    ev(ctx, 'w.side = "player"; w.hp = w.maxHp = 9999; f.apLeft = 9; B.cmdAttack(f, w)');
    assert.equal(ev(ctx, 'f.face'), 1);
    assert.equal(ev(ctx, 'B.isBehind(f, u)'), true);
  } },
  { name: 'поле: в спину бьют только того, кто занят другим противником; один на один — всегда в лицо', fn: () => {
    const ctx = game();
    setup(ctx);
    // f дерётся с u (смотрит влево); u обходит его справа — f повернётся к нему, удар в лицо
    ev(ctx, 'u.c = 6; u.r = 2; B.updateFacing()');
    assert.equal(ev(ctx, 'B.backstab(f, u)'), false);
    // а если f занят w, удар u с другой стороны — в спину
    ev(ctx, 'w.side = "player"; w.c = 4; w.r = 2; f.lastTarget = w.uid; B.updateFacing()');
    assert.equal(ev(ctx, 'f.face'), -1);
    assert.equal(ev(ctx, 'B.backstab(f, u)'), true);
    assert.equal(ev(ctx, 'B.backstab(f, w)'), false);
  } },
  { name: 'поле: удар в спину вдвое чаще критический', fn: () => {
    const ctx = game();
    setup(ctx);
    const crits = side => ev(ctx, `(() => {
      f.hp = f.maxHp = 1e9; f.s.dodge = -999; f.s.block = 0; w.side = 'player'; w.s.acc = 999; w.s.crit = 25; w.crits = 0;
      w.c = ${side === 'back' ? 6 : 4}; w.r = ${side === 'back' ? 2 : 1};
      for (let i = 0; i < 1200; i++) { f.lastTarget = u.uid; f.face = -1; B.strike(w, f, { noCounter: true }); }
      return w.crits;
    })()`);
    const front = crits('front'), back = crits('back');
    assert.ok(front > 220 && front < 380, `спереди ${front}`);
    assert.ok(back > 500 && back < 700, `в спину ${back}`);
  } },
  { name: 'поле: окружённый не может отойти, пока оба противника держат его', fn: () => {
    const ctx = game();
    setup(ctx);
    // u смотрит вправо, на f; w заходит ему за спину
    ev(ctx, 'w.c = 3; w.r = 2; B.updateFacing()');
    assert.equal(ev(ctx, 'B.holders(u).length'), 2);
    const cells = ev(ctx, '[...B.reachable(u, 10).values()].map(n => [n.c, n.r])');
    for (const [c, r] of cells) assert.ok(Math.max(Math.abs(c - 5), Math.abs(r - 2)) <= 1 && Math.max(Math.abs(c - 3), Math.abs(r - 2)) <= 1, `${c},${r}`);
    assert.ok(cells.length > 1, 'переступить можно');
    // оглушённый не держит
    ev(ctx, 'w.stun = 1');
    assert.equal(ev(ctx, 'B.holders(u).length'), 0);
    assert.ok(ev(ctx, 'B.reachable(u, 10).has(cellKey(4, 4))'));
  } },
  { name: 'лучник школы: +15% к урону', fn: () => {
    const ctx = game();
    ev(ctx, 'var g = createGladiator("sagittarius", 6, { forceSchool: true, autoSpend: true, quality: 1 })');
    const own = ev(ctx, 'computeStats(g).dmgMult');
    const other = ev(ctx, 'computeStats({ ...g, cls: "thraex", perks: {} }).dmgMult');
    assert.ok(Math.abs(own - other - 0.15) < 1e-9, `${own} vs ${other}`);
  } },
];
