// ============================================================
//  Ставки: каждый день один бой 1 на 1 между чужими бойцами.
//  Шансы считаются прогоном боя BET_SIMS раз, коэффициент — от шанса
//  с долей устроителя игр.
// ============================================================
const BET_MIN = 50, BET_STEP = 50;
const BET_MAX = [300, 600, 1200, 2500]; // предел ставки на арене Помпей, Капуи, Рима, Колизея
const BET_MARGIN = 0.08;                // доля устроителя игр
const BET_SIMS = 150;
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

// Бой дня для ставок: пара бойцов текущей арены, без явного фаворита с шансом выше 90%
function newBet() {
  const tier = betTier(), T = TIERS[tier];
  const used = new Set(STATE.gladiators.map(g => g.name));
  const lvl = clamp(Math.round(ludusLevel()) + rnd(-1, 1), T.lvl[0], T.lvl[1]);
  let bet = null;
  for (let tries = 0; tries < 4; tries++) {
    const ca = pick(CLASS_KEYS), cb = pick(CLASS_KEYS.filter(c => c !== ca));
    const a = betFighter(tier, lvl, ca, used), b = betFighter(tier, lvl, cb, used);
    const ev = { id: uid(), kind: 'bet', tier, size: 1, title: 'Бой дня' };
    ensureField(ev);
    let wins = 0;
    for (let i = 0; i < BET_SIMS; i++) if (simDuel(a, b, ev) === 'player') wins++;
    const pa = wins / BET_SIMS;
    bet = { day: STATE.day, tier, seed: rnd(1, 2 ** 31 - 1), a, b, ev, p: [pa, 1 - pa], odds: [betOdds(pa), betOdds(1 - pa)], pick: null, stake: 0, done: false, winner: null, payout: 0 };
    if (pa >= 0.1 && pa <= 0.9) break;
  }
  return bet;
}

// Сделать ставку: side — 0 (первый боец) или 1 (второй)
function placeBet(side, amount) {
  const bet = STATE.bet;
  if (!bet || bet.done || bet.pick !== null || (side !== 0 && side !== 1)) return false;
  if (!Number.isInteger(amount) || amount < BET_MIN || amount % BET_STEP || amount > betMax() || amount > STATE.gold) return false;
  STATE.gold -= amount;
  bet.pick = side; bet.stake = amount;
  return true;
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

// Бой дня для ставок есть всегда: в новой игре и в старом сохранении он появляется при первом взгляде
function ensureBet() {
  if (!STATE.bet || STATE.bet.day !== STATE.day) { STATE.bet = newBet(); save(); }
  if (!STATE.bet.seed) { STATE.bet.seed = rnd(1, 2 ** 31 - 1); save(); }
  return STATE.bet;
}

// Новый день: несыгранная ставка решается боем без показа, затем — новый бой дня
function betOnNewDay() {
  const bet = STATE.bet;
  let note = null;
  if (bet && !bet.done && bet.pick !== null) {
    if (!bet.seed) bet.seed = rnd(1, 2 ** 31 - 1);
    const w = runDuel(betBattle(bet)) === 'player' ? 0 : 1;
    const pay = settleBet(w);
    note = `Бой дня прошёл без вас: победил ${[bet.a, bet.b][w].name}. ${pay ? `Ставка сыграла: +${pay} денариев.` : `Ставка ${bet.stake} денариев проиграна.`}`;
    journal(note);
  }
  STATE.bet = newBet();
  return note;
}
