// Баланс школ: доля побед каждой школы в дуэлях (каждая против каждой) и в боях 3 на 3 со случайными составами.
// Бойцы одного уровня, в добротном снаряжении, очки распределены ИИ.
//   node tools/balance.js [уровень=8] [дуэлей на пару=30] [боёв 3 на 3=600]
const { loadGame, ev } = require('../tests/harness');

const ctx = loadGame(['data', 'core', 'debt', 'story', 'combat', 'bets']);
const LVL = +process.argv[2] || 8, N = +process.argv[3] || 30, TEAMS = +process.argv[4] || 600;
ev(ctx, 'newGame("Т")');
const res = ev(ctx, `(() => {
  const mk = c => createGladiator(c, ${LVL}, { forceSchool: true, autoSpend: true, quality: 2 });
  const fmt = (w, n) => Object.fromEntries(CLASS_KEYS.map(c => [CLASSES[c].name, Math.round(w[c] / n[c] * 100) + '%']));
  const zero = () => Object.fromEntries(CLASS_KEYS.map(c => [c, 0]));
  // дуэли
  const dw = zero(), dn = zero(), e1 = { id: 1, kind: 'bet', tier: 1, size: 1 };
  for (const a of CLASS_KEYS) for (const b of CLASS_KEYS) if (a < b) for (let i = 0; i < ${N}; i++) {
    e1.field = null; e1.id = i + 1; ensureField(e1);
    const w = runDuel(new Battle([mk(a)], [mk(b)], e1, { mode: 'auto' })) === 'player' ? a : b;
    dw[w]++; dn[a]++; dn[b]++;
  }
  // 3 на 3
  const tw = zero(), tn = zero(), e3 = { id: 1, kind: 'arena', tier: 1, size: 3 };
  for (let i = 0; i < ${TEAMS}; i++) {
    e3.field = null; e3.id = i + 1; ensureField(e3);
    const A = [pick(CLASS_KEYS), pick(CLASS_KEYS), pick(CLASS_KEYS)], Bc = [pick(CLASS_KEYS), pick(CLASS_KEYS), pick(CLASS_KEYS)];
    const win = runDuel(new Battle(A.map(mk), Bc.map(mk), e3, { mode: 'auto' })) === 'player' ? A : Bc;
    for (const c of A.concat(Bc)) tn[c]++;
    for (const c of win) tw[c]++;
  }
  return { duels: fmt(dw, dn), teams: fmt(tw, tn) };
})()`);
console.log(`Уровень ${LVL}. Дуэли (1 на 1):`, res.duels);
console.log('Бои 3 на 3:', res.teams);
