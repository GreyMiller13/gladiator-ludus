// ============================================================
//  Ставки: каждый день один бой 1 на 1 между чужими бойцами.
//  Шансы считаются прогоном боя BET_SIMS раз, коэффициент — от шанса
//  с долей устроителя игр. Пару подбирают почти равной по силе.
// ============================================================
const BET_MIN = 50, BET_STEP = 50;
const BET_MAX = [300, 600, 1200, 2500]; // предел ставки на арене Помпей, Капуи, Рима, Колизея
const BET_MARGIN = 0.08;                // доля устроителя игр
const BET_SIMS = 150;
const BET_BAND = 0.1;                   // шанс первого бойца — в пределах 50% ± BET_BAND
const BET_SCREEN = 30;                  // быстрый прогон: явно неравную пару дальше не считаем
const BET_TRIES = 12;
const BET_UNDERDOG = 2.5;               // «тёмная лошадка» — коэффициент не ниже этого

const betTier = () => clamp(Math.max(...unlockedTiers()), 0, TIERS.length - 1);
const betMax = () => BET_MAX[STATE.bet ? STATE.bet.tier : betTier()];
const betOdds = p => Math.max(1.05, Math.floor((1 - BET_MARGIN) / Math.max(0.03, p) * 20) / 20);
const betEvent = bet => ({ ...bet.ev, enemies: [bet.b] });
const cloneGlad = g => JSON.parse(JSON.stringify(g));

// Генератор случайных чисел с зерном (mulberry32)
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function withRandom(rng, fn) {
  const r = Math.random;
  Math.random = rng;
  try { return fn(); } finally { Math.random = r; }
}

// Бой дня с зерном ставки: исход задан заранее. Ход боя берёт случайность только из зерна
// (анимация на экране — из обычного Math.random), поэтому показанный бой, его повтор после
// перезагрузки и бой без показа при конце дня заканчиваются одинаково
function betBattle(bet) {
  const rng = seededRandom(bet.seed);
  const B = withRandom(rng, () => new Battle([cloneGlad(bet.a)], [cloneGlad(bet.b)], betEvent(bet), { mode: 'auto' }));
  for (const k of ['beginTurn', 'aiTurn']) {
    const f = B[k].bind(B);
    B[k] = (...args) => withRandom(rng, () => f(...args));
  }
  return B;
}

// Один бой без показа: 'player' — победил первый боец, 'enemy' — второй
function simDuel(a, b, ev) {
  return runDuel(new Battle([cloneGlad(a)], [cloneGlad(b)], ev, { mode: 'auto' }));
}
function runDuel(B) {
  let guard = 0;
  while (!B.over && guard++ < 4000) {
    const t = B.beginTurn();
    if (t.act && !B.over) B.aiTurn(t.u);
    B.events.length = 0;
    if (B.round > 60 && !B.over) {
      // затянувшийся бой решает распорядитель — как в показанном бою
      const hp = side => B.alive(side).reduce((s, u) => s + u.hp / u.maxHp, 0);
      B.over = true; B.winner = hp('player') >= hp('enemy') ? 'player' : 'enemy';
    }
  }
  return B.winner;
}

function betFighter(tier, lvl, cls, used) {
  const T = TIERS[tier];
  const free = NAMES.filter(n => !used.has(n));
  const name = pick(free.length ? free : NAMES);
  used.add(name);
  const g = createGladiator(cls, clamp(lvl + rnd(-1, 1), T.lvl[0], T.lvl[1]), { name, autoSpend: true, quality: () => rnd(T.quality[0], T.quality[1]) });
  if (!g.equip.helmet && chance(30)) g.equip.helmet = randomItem(rnd(T.quality[0], T.quality[1]), 'helmet');
  return g;
}

const winShare = (a, b, ev, n) => { let w = 0; for (let i = 0; i < n; i++) if (simDuel(a, b, ev) === 'player') w++; return w / n; };

// Бой дня для ставок: пара бойцов текущей арены, близких по силе, — исход угадать непросто.
// Пары перебираются, пока шанс не окажется в пределах 50% ± BET_BAND; иначе берётся самая ровная
function newBet() {
  const tier = betTier(), T = TIERS[tier];
  const lvl = clamp(Math.round(ludusLevel()) + rnd(-1, 1), T.lvl[0], T.lvl[1]);
  const ev = { id: uid(), kind: 'bet', tier, size: 1, title: 'Бой дня' };
  ensureField(ev);
  let best = null;
  for (let tries = 0; tries < BET_TRIES; tries++) {
    const used = new Set(STATE.gladiators.map(g => g.name));
    const ca = pick(CLASS_KEYS), cb = pick(CLASS_KEYS.filter(c => c !== ca));
    const a = betFighter(tier, lvl, ca, used), b = betFighter(tier, lvl, cb, used);
    if (best && Math.abs(winShare(a, b, ev, BET_SCREEN) - 0.5) > BET_BAND + 0.1) continue;
    const pa = winShare(a, b, ev, BET_SIMS);
    if (!best || Math.abs(pa - 0.5) < Math.abs(best.pa - 0.5)) best = { a, b, pa };
    if (Math.abs(pa - 0.5) <= BET_BAND) break;
  }
  const { a, b, pa } = best;
  return { day: STATE.day, tier, seed: rnd(1, 2 ** 31 - 1), a, b, ev, p: [pa, 1 - pa], odds: [betOdds(pa), betOdds(1 - pa)], pick: null, stake: 0, done: false, winner: null, payout: 0 };
}

// Сделать ставку: side — 0 (первый боец) или 1 (второй)
function placeBet(side, amount) {
  const bet = STATE.bet;
  if (!bet || bet.done || bet.watched || bet.pick !== null || (side !== 0 && side !== 1)) return false;
  if (!Number.isInteger(amount) || amount < BET_MIN || amount % BET_STEP || amount > betMax() || amount > STATE.gold) return false;
  STATE.gold -= amount;
  bet.pick = side; bet.stake = amount;
  return true;
}

// Отменить ставку, пока бой не начался. Возвращает возвращённую сумму (0 — отменять нечего)
function cancelBet() {
  const bet = STATE.bet;
  if (!bet || bet.done || bet.watched || bet.pick === null) return 0;
  const back = bet.stake;
  STATE.gold += back;
  bet.pick = null; bet.stake = 0;
  return back;
}

// Бой начался на глазах у игрока: ставку уже не сделать и не отменить, а прерванный бой доиграется при конце дня
function watchBet() {
  if (STATE.bet && !STATE.bet.done) STATE.bet.watched = true;
}

// Итог боя: winner — 0 или 1. Возвращает выплату (0, если ставка не сыграла или её не было)
function settleBet(winner) {
  const bet = STATE.bet;
  if (!bet || bet.done) return 0;
  bet.done = true; bet.winner = winner;
  if (bet.pick === null) return 0;
  const won = bet.pick === winner;
  bet.payout = won ? Math.round(bet.stake * bet.odds[bet.pick]) : 0;
  STATE.gold += bet.payout;
  if (typeof META !== 'undefined') META.track('bet', { won, odds: bet.odds[bet.pick], profit: bet.payout - bet.stake });
  return bet.payout;
}

// Бой дня для ставок появляется при первом взгляде на арену
function ensureBet() {
  if (!STATE.bet || STATE.bet.day !== STATE.day) { STATE.bet = newBet(); save(); }
  if (!STATE.bet.seed) { STATE.bet.seed = rnd(1, 2 ** 31 - 1); save(); }
  return STATE.bet;
}

// Новый день: ставка на несмотренный бой возвращается в казну, будто её и не было.
// Бой, начатый и прерванный (например, перезагрузкой), доигрывается без показа. Затем — новый бой дня
function betOnNewDay() {
  const bet = STATE.bet;
  let note = null;
  if (bet && !bet.done && bet.pick !== null && !bet.watched) {
    const back = cancelBet();
    bet.done = true;
    note = `Бой дня прошёл без вас — ставка ${back} денариев вернулась в казну.`;
    journal(note);
  } else if (bet && !bet.done && bet.pick !== null) {
    if (!bet.seed) bet.seed = rnd(1, 2 ** 31 - 1);
    const w = runDuel(betBattle(bet)) === 'player' ? 0 : 1;
    const pay = settleBet(w);
    note = `Бой дня доигран без вас: победил ${[bet.a, bet.b][w].name}. ${pay ? `Ставка сыграла: +${pay} денариев.` : `Ставка ${bet.stake} денариев проиграна.`}`;
    journal(note);
  }
  STATE.bet = newBet();
  return note;
}
