// Ускоренная симуляция истории простым игроком — для подбора расписания долга.
// node tests/sim.js [прогонов=40] [дней=160]
const { loadGame, ev } = require('./harness');

const RUNS = +process.argv[2] || 40, DAYS = +process.argv[3] || 160;

// Код игрока исполняется внутри контекста игры
const PLAYER = `
function simBattle(ev, team) {
  const b = new Battle(team, ev.enemies, ev, { mode: 'auto' });
  let guard = 0;
  while (!b.over && guard++ < 4000) {
    const t = b.beginTurn();
    if (t.act && !b.over) b.aiTurn(t.u);
    b.events.length = 0;
    if (b.round > 60 && !b.over) {
      const hp = side => b.alive(side).reduce((s, u) => s + u.hp / u.maxHp, 0);
      b.over = true; b.winner = hp('player') >= hp('enemy') ? 'player' : 'enemy';
      for (const u of b.alive(b.winner === 'player' ? 'enemy' : 'player')) { u.alive = false; u.hp = 0; }
    }
  }
  return b;
}

// Итог боя — упрощённо, как finishBattle/revealVerdicts в ui.js
function simApply(ev, b) {
  const win = b.winner === 'player', kind = ev.kind || 'arena', T = TIERS[ev.tier];
  const gold0 = STATE.gold;
  const xpK = kind === 'contract' ? (ev.xpMult ?? 0.6) : 1;
  ev.done = true;
  const players = b.units.filter(u => u.side === 'player'), enemies = b.units.filter(u => u.side === 'enemy');
  for (const u of players) {
    const g = u.g;
    g.foughtToday = true; g.record.fights++;
    if (win) g.record.wins++; else g.record.losses++;
    addXp(g, Math.round(T.xp * ((win ? 50 : 20) + u.kills * 20) * xpK));
    if (!g.cls && g.level >= SCHOOL_LEVEL) g.cls = bestClasses(g, 1)[0].c;
    autoSpend(g);
    if (kind !== 'contract') g.fame += (clamp(ev.tier, 0, 3) + 1) * ((win ? 1 : 0) + u.kills * 2);
    if (!u.alive && (win || kind === 'contract')) g.wounded = Math.max(g.wounded, 1);
  }
  if (kind === 'contract') {
    STATE.gold += win ? ev.gold : Math.round(ev.gold * 0.15);
    if (win) STATE.fame += ev.fame || 0;
  } else if (win) {
    STATE.gold += ev.gold; STATE.fame += ev.fame;
    for (const u of enemies) if (!(kind === 'final' || ev.training) && !chance(mercyBreakdown(u, b).total)) STATE.fame += 1;
    if (kind === 'final') STATE.finalWon = true;
  } else {
    STATE.fame = Math.max(0, STATE.fame - 1);
    for (const u of players) {
      // подкуп распорядителя, если деньги есть
      const cost = bribeCost(b), bribe = STATE.gold - cost >= reserve() + 20;
      if (bribe) STATE.gold -= cost;
      const m = mercyBreakdown(u, b, bribe);
      if (ev.training || chance(m.total)) u.g.wounded = Math.max(u.g.wounded, u.alive ? 1 : (u.kills ? 2 : 3));
      else { STATE.gladiators = STATE.gladiators.filter(x => x !== u.g); SIM.deaths++; }
    }
  }
  STORY.onBattle({ kind, win, tier: ev.tier, training: !!ev.training, boss: ev.boss || null, story: ev.story || null, surrendered: false });
  const w = Math.floor((STATE.day - 1) / 7);
  SIM.income[w] = (SIM.income[w] || 0) + Math.max(0, STATE.gold - gold0);
}

const power = gs => gs.reduce((s, g) => s + powerScore(g), 0);
// запас к платежу: в начале недели игрок тратит смелее, к сроку — бережёт деньги
const reserve = () => { const n = debtNext(); return n ? Math.round(n.amount * clamp(1 - (n.daysLeft - 1) / DEBT_EVERY, SIM.resK, 1)) + upkeepCost() * (n.daysLeft + 1) + 10 : 0; };

function simShop() {
  // у каждого бойца должно быть оружие — самое дешёвое подходящее
  for (const g of STATE.gladiators) if (!g.equip.weapon) {
    const w = STATE.smith.filter(it => it.slot === 'weapon' && !isRanged(it) && !isTwoHanded(it)).sort((a, b) => a.price - b.price)[0];
    if (w && STATE.gold - w.price >= reserve()) { STATE.gold -= w.price; STATE.smith = STATE.smith.filter(x => x !== w); equipItem(g, w); }
  }
  // новобранец (с запасом на оружие), если после покупки платёж не под угрозой
  if (STATE.gladiators.length < 6 && STATE.market.length && STATE.gladiators.every(g => g.equip.weapon)) {
    const g = STATE.market.slice().sort((a, b) => powerScore(b) / b.price - powerScore(a) / a.price)[0];
    if (STATE.gold - g.price - 40 >= reserve()) {
      STATE.gold -= g.price; STATE.market = STATE.market.filter(x => x !== g); delete g.price; STATE.gladiators.push(g);
    }
  }
  // снаряжение: лучшее по цене, на что хватает свободных денег
  const value = (it, g) => (it ? it.price * (itemFits(it, g.cls) ? 1.25 : 1) : 0);
  for (const g of STATE.gladiators.slice().sort((a, b) => powerScore(b) - powerScore(a))) {
    for (const it of STATE.smith.slice().sort((a, b) => b.price - a.price)) {
      if (STATE.gold - it.price < reserve()) continue;
      if (isRanged(it) && g.cls !== 'sagittarius') continue;
      if (it.slot === 'weapon' && g.cls && !itemFits(it, g.cls)) continue;
      if (it.slot === 'offhand' && (ITEM_BASES[it.base].needsBow || isTwoHanded(g.equip.weapon))) continue;
      if (value(it, g) <= value(g.equip[it.slot], g) * 1.15) continue;
      STATE.gold -= it.price; STATE.smith = STATE.smith.filter(x => x !== it);
      equipItem(g, it);
    }
  }
}

function simDay() {
  simShop();
  // заказы идут не насмерть — безопасный заработок, их простой игрок берёт охотнее
  const list = [...STATE.events, ...(STATE.contracts || [])];
  const fe = finalEvent(); if (fe) list.push(fe);
  list.sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0) || (b.training ? 1 : 0) - (a.training ? 1 : 0) || b.tier - a.tier || b.size - a.size);
  for (const e of list) {
    if (e.done) continue;
    const n = e.playerSize ?? e.size;
    const avail = STATE.gladiators.filter(canFight).sort((a, b) => powerScore(b) - powerScore(a));
    if (avail.length < n) continue;
    const team = avail.slice(0, n);
    const k = e.boss || e.kind === 'final' || e.story ? SIM.bossK : e.kind === 'contract' ? SIM.contractK : SIM.fightK;
    if (!e.training && power(team) < power(e.enemies) * k) continue;
    e.enemies.forEach(x => { if (!x.equip) x.equip = emptyEquip(); });
    simApply(e, simBattle(e, team));
  }
  STORY.update();
  const before = STATE.debt.idx;
  const r = nextDay();
  if (r.debt) STORY.onDebt(r.debt);
  if (STATE.debt.idx > before) SIM.slack.push(STATE.gold);
  SIM.chapter[STATE.story.chapter] = SIM.chapter[STATE.story.chapter] || STATE.day;
}

const SIM = { deaths: 0, slack: [], chapter: [1], income: [], fightK: +(globalThis.SIM_FIGHT || .95), contractK: +(globalThis.SIM_CONTRACT || .75), bossK: +(globalThis.SIM_BOSS || 1), resK: +(globalThis.SIM_RES || 1) };
function simRun(days) {
  newGame('Сим', { story: true });
  STATE.story.queue = [];
  for (let d = 0; d < days; d++) {
    if (STATE.lost || STATE.finalWon) break;
    simDay();
    if (!STATE.gladiators.length && STATE.gold < 60) { STATE.lost = { day: STATE.day, reason: 'empty' }; break; }
  }
  return {
    lost: STATE.lost ? STATE.lost.reason : null, lostDay: STATE.lost ? STATE.lost.day : null,
    chapters: SIM.chapter.slice(1), finalDay: STATE.finalWon ? STATE.day : null,
    debtDone: STATE.debt.cleared ? debtDay(STATE.debt.plan.length - 1) : null, paid: STATE.debt.idx,
    income: SIM.income, minSlack: SIM.slack.length ? Math.min(...SIM.slack) : null, deaths: SIM.deaths, fame: STATE.fame, day: STATE.day,
  };
}
`;

const med = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : '—'; };
const p10 = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.1)] : '—'; };
const p90 = a => { const s = a.filter(x => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.9)] : '—'; };

const res = [];
for (let i = 0; i < RUNS; i++) {
  const ctx = loadGame(['data', 'core', 'debt', 'story', 'combat']);
  for (const k of ['SIM_FIGHT', 'SIM_BOSS', 'SIM_RES', 'SIM_CONTRACT']) if (process.env[k]) ctx[k] = process.env[k];
  if (process.env.SIM_PLAN) ev(ctx, `DEBT_PLAN.splice(0, DEBT_PLAN.length, ...${process.env.SIM_PLAN})`);
  ev(ctx, PLAYER);
  res.push(ev(ctx, `simRun(${DAYS})`));
}
const by = k => res.map(r => r[k]);
const debtLost = res.filter(r => r.lost === 'debt');
console.log(`Прогонов: ${RUNS}, дней не более ${DAYS}. План: ${loadGame(['data']) && ev(loadGame(['data']), 'DEBT_PLAN.join(", ")')}`);
for (let c = 0; c < 3; c++) {
  const days = res.map(r => r.chapters[c] ?? null);
  console.log(`Глава ${['II', 'III', 'IV'][c]} открыта: медиана ${med(days)}, 10% ${p10(days)}, 90% ${p90(days)}, дошли ${days.filter(Boolean).length}/${RUNS}`);
}
console.log(`Последний платёж: медиана ${med(by('debtDone'))}, долг погашен в ${by('debtDone').filter(Boolean).length}/${RUNS}`);
console.log(`Финал выигран: медиана дня ${med(by('finalDay'))}, ${by('finalDay').filter(Boolean).length}/${RUNS}`);
console.log(`Проигрыш из-за долга: ${debtLost.length}/${RUNS} (${Math.round(debtLost.length / RUNS * 100)}%), дни: ${debtLost.map(r => r.lostDay).join(', ') || '—'}`);
console.log(`До 14-го дня: ${debtLost.filter(r => r.lostDay <= 14).length}; первый платёж не внесён: ${res.filter(r => r.paid < 1).length}`);
console.log(`Минимальный запас после платежа: медиана ${med(by('minSlack'))}, 10% ${p10(by('minSlack'))}. Погибших бойцов: медиана ${med(by('deaths'))}`);
console.log(`Пустой лудус: ${res.filter(r => r.lost === 'empty').length}`);
console.log('Доход по неделям (медиана среди живых): ' + Array.from({ length: 14 }, (_, w) => med(res.filter(r => (r.lostDay || 999) > (w + 1) * 7).map(r => r.income[w] || 0))).join(' · '));
