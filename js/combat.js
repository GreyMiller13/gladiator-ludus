// ============================================================
//  Боевая система: тактический бой на поле до 3 на 3
//  Поле — сетка клеток с препятствиями. На своём ходу боец может
//  переместиться (число шагов зависит от инициативы) и совершить
//  одно действие: удар, умение, оборону или ожидание.
//  Движок пишет поток событий (this.events), который проигрывает
//  анимационный слой (arena.js). Управлять бойцами может ИИ или игрок.
// ============================================================

const FIELD_COLS = 10, FIELD_ROWS = 5;
const DEPLOY_COLS = { player: [0, 1, 2], enemy: [9, 8, 7] }; // тыл → фронт
// Препятствия: высокие (high) нельзя ни пройти, ни прострелить;
// низкие нельзя пройти, но лучник стреляет поверх них, а копьё бьёт через них
const OBSTACLES = {
  // Помпеи — провинция: камни, плетни, амфоры, частокол
  boulder:      { name: 'Валун',              high: true },
  palisade:     { name: 'Частокол',           high: true },
  fence:        { name: 'Плетень',            high: false },
  amphorae:     { name: 'Груда амфор',        high: false },
  // Капуя — травертин и колонны
  column:       { name: 'Колонна',            high: true },
  herm:         { name: 'Герма на постаменте', high: true },
  lowWall:      { name: 'Каменный парапет',   high: false },
  fallenColumn: { name: 'Упавшая колонна',    high: false },
  // Статилиев амфитеатр — деревянный, военный: ящики, щиты, рогатки, телеги
  crates:       { name: 'Штабель ящиков',     high: true },
  mantlet:      { name: 'Осадный щит',        high: true },
  barricade:    { name: 'Рогатки',            high: false },
  cart:         { name: 'Опрокинутая телега', high: false },
  // Колизей — мрамор и статуи
  statue:       { name: 'Статуя',             high: true },
  obelisk:      { name: 'Обелиск',            high: true },
  parapet:      { name: 'Мраморный парапет',  high: false },
  rocks:        { name: 'Камни',              high: false },
};
const VENUE_OBSTACLES = [
  { high: ['boulder', 'palisade'], low: ['fence', 'amphorae', 'rocks'] },
  { high: ['column', 'herm'],      low: ['lowWall', 'fallenColumn'] },
  { high: ['crates', 'mantlet'],   low: ['barricade', 'cart'] },
  { high: ['statue', 'obelisk', 'column'], low: ['parapet', 'fallenColumn'] },
];
const FIELD_VERSION = 2;
const cellKey = (c, r) => c + ',' + r;
const cheb = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const isHigh = type => !!(OBSTACLES[type] && OBSTACLES[type].high);

// Дальность удара (шаги по полю — moveOf в core.js)
function reachOf(g) {
  const w = g.equip && g.equip.weapon;
  if (!w) return 1;
  const b = ITEM_BASES[w.base];
  const look = b.look || w.base;
  if (b.ranged) return 6;
  return look === 'spear' || look === 'trident' ? 2 : 1;
}

// Детерминированный генератор для расстановки препятствий
function seededRng(seed) {
  let a = (seed | 0) || 1;
  return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
}

// Препятствия ставятся в нейтральной полосе (столбцы 3–6) так, чтобы между
// зонами всегда оставался проход — и даже один боец не мог перекрыть его целиком
function makeField(seed, tier = 0) {
  const R = seededRng(seed);
  const set = VENUE_OBSTACLES[clamp(tier, 0, 3)];
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = 4 + Math.floor(R() * 4);
    const obstacles = [];
    const used = new Set();
    while (obstacles.length < n) {
      const c = 3 + Math.floor(R() * 4), r = Math.floor(R() * FIELD_ROWS);
      const k = cellKey(c, r);
      if (used.has(k)) continue;
      used.add(k);
      const pool = R() < 0.45 ? set.high : set.low;
      obstacles.push({ c, r, type: pool[Math.floor(R() * pool.length)] });
    }
    if (fieldRobust(used)) return { v: FIELD_VERSION, cols: FIELD_COLS, rows: FIELD_ROWS, obstacles };
  }
  return { v: FIELD_VERSION, cols: FIELD_COLS, rows: FIELD_ROWS, obstacles: [] };
}
// Проход есть, даже если любую одну свободную клетку нейтральной полосы займёт боец
function fieldRobust(blocked) {
  if (!fieldConnected(blocked)) return false;
  for (let c = 3; c <= 6; c++) {
    if (blocked.size && [...blocked].filter(k => k.startsWith(c + ',')).length > FIELD_ROWS - 2) return false;
    for (let r = 0; r < FIELD_ROWS; r++) {
      const k = cellKey(c, r);
      if (blocked.has(k)) continue;
      const b2 = new Set(blocked); b2.add(k);
      if (!fieldConnected(b2)) return false;
    }
  }
  return true;
}
// Связаны ли зоны расстановки (по тем же правилам хода, что и в бою)
function fieldConnected(blocked) {
  const free = (c, r) => c >= 0 && r >= 0 && c < FIELD_COLS && r < FIELD_ROWS && !blocked.has(cellKey(c, r));
  const seen = new Set(), q = [];
  for (let r = 0; r < FIELD_ROWS; r++) if (free(2, r)) { seen.add(cellKey(2, r)); q.push({ c: 2, r }); }
  while (q.length) {
    const p = q.shift();
    if (p.c >= 7) return true;
    for (const [dc, dr] of DIRS8) {
      const c = p.c + dc, r = p.r + dr, k = cellKey(c, r);
      if (!free(c, r) || seen.has(k)) continue;
      if (dc && dr && !free(p.c + dc, p.r) && !free(p.c, p.r + dr)) continue;
      seen.add(k); q.push({ c, r });
    }
  }
  return false;
}
function ensureField(ev) {
  if (!ev.field || ev.field.v !== FIELD_VERSION) ev.field = makeField((ev.id || 1) * 7919 + 13, ev.tier);
  return ev.field;
}

// Роль бойца в строю: фронт, середина, тыл
function lineRole(g) {
  const w = g.equip && g.equip.weapon;
  if (w && ITEM_BASES[w.base].ranged) return 0;
  return ['murmillo', 'secutor', 'hoplomachus', 'gallus'].includes(g.cls) ? 2 : 1;
}
// Авторасстановка: тяжёлые — вперёд, лучники — в тыл, ряды от центра
function autoDeployCells(glads, side, field) {
  const cols = DEPLOY_COLS[side];
  const blocked = new Set(field.obstacles.map(o => cellKey(o.c, o.r)));
  const taken = new Set();
  const rowsPref = [2, 1, 3, 0, 4];
  const order = glads.map((g, i) => ({ g, i, role: lineRole(g) })).sort((a, b) => b.role - a.role);
  const out = [];
  for (const { i, role } of order) {
    const colOrder = [cols[role], ...cols.filter(c => c !== cols[role])];
    let cell = null;
    for (const c of colOrder) {
      for (const r of rowsPref) {
        const k = cellKey(c, r);
        if (!taken.has(k) && !blocked.has(k)) { cell = { c, r }; break; }
      }
      if (cell) break;
    }
    taken.add(cellKey(cell.c, cell.r));
    out[i] = cell;
  }
  return out;
}

class Battle {
  // opts: { mode: 'auto'|'manual', placement: [{c, r}, ...] — расстановка игрока }
  constructor(playerGlads, enemyGlads, event, opts = {}) {
    this.event = event;
    this.tier = TIERS[clamp(event.tier || 0, 0, TIERS.length - 1)];
    this.mode = opts.mode || 'auto';
    this.nonLethal = !!event.nonLethal;
    this.field = ensureField(event);
    this.blocked = new Set(this.field.obstacles.map(o => cellKey(o.c, o.r)));
    this.highBlocked = new Set(this.field.obstacles.filter(o => isHigh(o.type)).map(o => cellKey(o.c, o.r)));
    this.units = [];
    const pc = opts.placement || autoDeployCells(playerGlads, 'player', this.field);
    const ec = autoDeployCells(enemyGlads, 'enemy', this.field);
    playerGlads.forEach((g, i) => this.units.push(this.makeUnit(g, 'player', i, pc[i])));
    enemyGlads.forEach((g, i) => this.units.push(this.makeUnit(g, 'enemy', i, ec[i])));
    this.round = 0;
    this.queue = [];
    this.log = [];
    this.events = [];
    this.over = false;
    this.winner = null;
    this.surrendered = false;
    this.current = null;
    this.extraAction = false;
    this.updateFacing();
    this.say(`${this.tier.place}. ${this.nonLethal ? 'Бой до сдачи — не на смерть.' : this.tier.mood}`, 'sys');
  }

  makeUnit(g, side, slot, cell) {
    const s = computeStats(g);
    return {
      uid: side + slot, g, side, slot, s,
      c: cell.c, r: cell.r, ap: s.ap, apLeft: s.ap, acted: false, reach: s.reach,
      face: side === 'player' ? 1 : -1, evade: 0, lastTarget: null, lastAttacker: null,
      hp: s.maxHp, maxHp: s.maxHp, alive: true,
      cd: 0, stun: 0, net: 0, bleeds: [], shred: 0, fury: 0,
      defending: false, spearWall: false, firstAttackDone: false, windUsed: false,
      kills: 0, dmgDealt: 0, crits: 0, flair: 0, killedBy: null, abilityUses: 0,
    };
  }

  // --------------------------------------------------------
  //  Вспомогательное
  // --------------------------------------------------------
  say(text, kind = '') { this.log.push({ text, kind, round: this.round }); }
  ev(e) { this.events.push(e); return e; }
  unit(uid) { return this.units.find(u => u.uid === uid); }
  alive(side) { return this.units.filter(u => u.side === side && u.alive); }
  enemiesOf(u) { return this.alive(u.side === 'player' ? 'enemy' : 'player'); }
  alliesOf(u) { return this.alive(u.side); }
  nm(u) { return `<b class="${u.side}">${u.g.name}</b>`; }
  pv(u, id, key) { return pv(u.g, id, key); }
  isPlayerControlled(u) { return this.mode === 'manual' && u.side === 'player'; }

  checkEnd() {
    if (this.over) return true;
    const p = this.alive('player').length, e = this.alive('enemy').length;
    if (p === 0 || e === 0) {
      this.over = true;
      this.winner = p > 0 ? 'player' : 'enemy';
      // бой дня на ставки: игрок лишь зритель
      if (this.event.kind === 'bet') this.say(`Толпа ревёт — победил ${this.alive(this.winner)[0] ? this.alive(this.winner)[0].g.name : 'сильнейший'}!`, 'sys big');
      else this.say(this.winner === 'player' ? 'Толпа ревёт — победа за вашим лудусом!' : 'Ваши бойцы повержены.', 'sys big');
      this.ev({ t: 'end', winner: this.winner });
    }
    return this.over;
  }

  // --------------------------------------------------------
  //  Геометрия поля
  // --------------------------------------------------------
  inField(c, r) { return c >= 0 && r >= 0 && c < FIELD_COLS && r < FIELD_ROWS; }
  unitAt(c, r) { return this.units.find(u => u.alive && u.c === c && u.r === r) || null; }
  isBlocked(c, r) { return this.blocked.has(cellKey(c, r)); }
  obstacleAt(c, r) { return this.field.obstacles.find(o => o.c === c && o.r === r) || null; }
  // Клетка закрыта для прохода: препятствие или любой живой боец (кроме самого идущего)
  closed(c, r, u) { if (!this.inField(c, r) || this.isBlocked(c, r)) return true; const o = this.unitAt(c, r); return !!(o && o !== u); }

  // Линия выстрела: между центрами клеток не должно быть высокого препятствия
  // (низкие — парапеты, плетни, рогатки — не мешают стрелять поверх)
  los(a, b) {
    const n = Math.max(2, Math.ceil(Math.hypot(b.c - a.c, b.r - a.r) * 4));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const c = Math.round(a.c + (b.c - a.c) * t), r = Math.round(a.r + (b.r - a.r) * t);
      if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) continue;
      if (this.highBlocked.has(cellKey(c, r))) return false;
    }
    return true;
  }

  // Клетки, куда боец может дойти на ap очков: Map ключ → { c, r, d, prev }, d — цена пути в ОД.
  // Шаг — 1 ОД; шаг прочь от соседнего противника (выход из ближнего боя) — ещё DISENGAGE_AP.
  // Окружённый (противник перед ним и за спиной) не отходит ни от кого из них
  reachable(u, ap = u.apLeft) {
    const start = { c: u.c, r: u.r, d: 0, prev: null };
    const map = new Map([[cellKey(u.c, u.r), start]]);
    const holders = this.holders(u);
    const foes = this.enemiesOf(u).filter(f => this.free(f));
    const q = [start];
    while (q.length) {
      q.sort((a, b) => a.d - b.d);
      const p = q.shift();
      if (map.get(cellKey(p.c, p.r)) !== p) continue;
      for (const [dc, dr] of DIRS8) {
        const c = p.c + dc, r = p.r + dr, k = cellKey(c, r), n = { c, r };
        // на клетке может стоять только один боец, и сквозь бойцов (даже своих) не пройти
        if (this.closed(c, r, u)) continue;
        // по диагонали нельзя протиснуться между двумя занятыми клетками
        if (dc && dr && this.closed(p.c + dc, p.r, u) && this.closed(p.c, p.r + dr, u)) continue;
        if (holders.some(h => cheb(n, h) > 1)) continue;
        const leave = foes.some(f => cheb(p, f) === 1 && cheb(n, f) > 1);
        const d = p.d + 1 + (leave ? DISENGAGE_AP : 0);
        if (d > ap) continue;
        const old = map.get(k);
        if (old && old.d <= d) continue;
        n.d = d; n.prev = p;
        map.set(k, n); q.push(n);
      }
    }
    return map;
  }
  // Направление взгляда: к тому, кого боец атаковал последним; если сам ещё не бил — к тому,
  // кто последним атаковал его; иначе к ближайшему противнику. Смотрят только влево или вправо
  focusOf(u) {
    for (const id of [u.lastTarget, u.lastAttacker]) { const x = id && this.unit(id); if (x && x.alive) return x; }
    const foes = this.enemiesOf(u);
    return foes.length ? foes.reduce((a, b) => (cheb(u, b) < cheb(u, a) ? b : a)) : null;
  }
  updateFacing() {
    for (const u of this.units) {
      if (!u.alive) continue;
      const f = this.focusOf(u);
      if (f && f.c !== u.c) u.face = Math.sign(f.c - u.c);
    }
  }
  // Стоит ли a за спиной у t (по ту сторону, куда t не смотрит)
  isBehind(t, a) { return a.c !== t.c && Math.sign(a.c - t.c) === -t.face; }
  // Окружён: рядом противник перед бойцом и противник за спиной (оглушённые и в сети не держат).
  // Возвращает тех, от кого он не может отойти, или пустой список
  holders(u) {
    const adj = this.enemiesOf(u).filter(f => cheb(u, f) === 1 && this.free(f));
    const front = adj.filter(f => Math.sign(f.c - u.c) === u.face), back = adj.filter(f => this.isBehind(u, f));
    return front.length && back.length ? front.concat(back) : [];
  }
  // Сколько клеток противник может пройти и ещё ударить в свой ход
  threat(f) { return Math.max(0, f.ap - f.s.atkAp) + f.reach; }
  pathOf(node) {
    const path = [];
    for (let n = node; n && n.prev; n = n.prev) path.unshift({ c: n.c, r: n.r });
    return path;
  }

  // Может ли боец атаковать цель f, стоя в клетке cell
  canHit(u, cell, f, range = u.reach) {
    const d = cheb(cell, f);
    if (d < 1 || d > range) return false;
    return d === 1 || this.los(cell, f);
  }
  abilityRange(u) {
    const id = clsOf(u.g).ability?.id;
    if (id === 'netThrow') return 3;
    if (id === 'aimedShot' || id === 'spearWall') return u.reach;
    return 1;
  }
  // Цели умения из клетки (для вихря — соседние противники)
  abilityTargets(u, cell) {
    const A = clsOf(u.g).ability;
    if (!A || u.cd > 0) return [];
    const range = this.abilityRange(u);
    return this.enemiesOf(u).filter(f => this.canHit(u, cell, f, range));
  }
  adjacentFoes(u) { return this.enemiesOf(u).filter(f => cheb(u, f) === 1); }

  // --------------------------------------------------------
  //  Ход боя
  // --------------------------------------------------------
  startRound() {
    this.round++;
    const order = this.units.filter(u => u.alive).map(u => ({ u, ini: u.s.init + rnd(0, 6) }));
    order.sort((a, b) => b.ini - a.ini);
    this.queue = order.map(o => o.u);
    this.say(`— Раунд ${this.round} —`, 'round');
    this.ev({ t: 'round', n: this.round });
  }

  // Начало хода: эффекты, пропуск. Возвращает { u, act } — нужно ли действие
  beginTurn() {
    this.events = [];
    if (this.over) return { u: null, act: false };
    // ход окончен: неистраченные ОД становятся уклонением до следующего хода бойца
    const prev = this.current;
    if (prev && prev.alive) prev.evade = prev.apLeft * AP_DODGE;
    this.updateFacing();
    if (this.extraAction && this.current && this.current.alive) {
      this.extraAction = false;
      this.current.apLeft = this.current.ap; this.current.acted = false; this.current.evade = 0;
      this.ev({ t: 'turn', u: this.current.uid, extra: true });
      return { u: this.current, act: true };
    }
    this.extraAction = false;
    let u = null;
    while (!u) {
      if (!this.queue.length) this.startRound();
      const c = this.queue.shift();
      if (c.alive) u = c;
    }
    this.current = u;
    // ОД тратятся на шаги до и после действия; удар или умение — одно за ход
    u.apLeft = u.ap; u.acted = false; u.evade = 0;
    this.ev({ t: 'turn', u: u.uid });
    u.defending = false; u.spearWall = false;
    if (u.cd > 0) u.cd--;
    if (u.bleeds.length) {
      let total = 0;
      for (const b of u.bleeds) { total += b.dmg; b.turns--; }
      const src = u.bleeds[u.bleeds.length - 1].src;
      u.bleeds = u.bleeds.filter(b => b.turns > 0);
      this.say(`${this.nm(u)} истекает кровью: −${total}`, 'bleed');
      const e = this.ev({ t: 'bleed', u: u.uid, dmg: total });
      this.damage(u, total, src);
      e.hp = u.hp;
      if (this.checkEnd() || !u.alive) return { u, act: false };
    }
    if (u.stun > 0) {
      u.stun--;
      this.say(`${this.nm(u)} оглушён и пропускает ход.`, 'status skipturn');
      this.ev({ t: 'skip', u: u.uid, why: 'stun' });
      return { u, act: false };
    }
    if (u.net > 0) {
      u.net--;
      this.say(`${this.nm(u)} бьётся в сети и пропускает ход.`, 'status skipturn');
      this.ev({ t: 'skip', u: u.uid, why: 'net' });
      return { u, act: false };
    }
    return { u, act: true };
  }

  // Ход целиком под управлением ИИ (для автобоя и симуляций)
  advance() {
    const t = this.beginTurn();
    if (t.act) { const pre = this.events; this.aiTurn(t.u); this.events = pre.concat(this.events); }
  }

  surrender() {
    this.over = true;
    this.winner = 'enemy';
    this.surrendered = true;
    this.say('Ланиста поднимает руку — ваши бойцы сдаются на милость толпы.', 'sys big');
  }

  // --------------------------------------------------------
  //  Команды (игрок и ИИ пользуются одними и теми же)
  // --------------------------------------------------------
  cmdMove(u, c, r) {
    this.events = [];
    if (u.apLeft <= 0 || this.over) return false;
    const node = this.reachable(u).get(cellKey(c, r));
    if (!node || (c === u.c && r === u.r)) return false;
    this.moveTo(u, node);
    return true;
  }
  finishAct() { this.checkEnd(); }
  cmdAttack(u, t) {
    this.events = [];
    if (u.acted || u.apLeft < u.s.atkAp || !t || !t.alive || !this.canHit(u, u, t)) return false;
    u.acted = true; u.apLeft -= u.s.atkAp;
    this.doAttack(u, t);
    this.finishAct();
    return true;
  }
  cmdAbility(u, t) {
    this.events = [];
    const A = clsOf(u.g).ability;
    if (!A || u.cd > 0 || u.acted || u.apLeft < abilityAp(u.s)) return false;
    if (A.id === 'whirl') { if (!this.adjacentFoes(u).length) return false; }
    else if (!t || !this.abilityTargets(u, u).includes(t)) return false;
    u.acted = true; u.apLeft -= abilityAp(u.s);
    this.doAbility(u, t);
    this.finishAct();
    return true;
  }
  cmdDefend(u) { this.events = []; this.doDefend(u); return true; }
  cmdWait(u) {
    this.events = [];
    this.say(`${this.nm(u)} выжидает.`, 'status');
    this.ev({ t: 'wait', u: u.uid });
    return true;
  }

  // Что может сделать боец из текущей клетки (для интерфейса ручного боя)
  options(u) {
    const reach = u.apLeft > 0 ? this.reachable(u) : new Map([[cellKey(u.c, u.r), { c: u.c, r: u.r, d: 0, prev: null }]]);
    const atk = u.s.atkAp;
    const foes = u.acted || u.apLeft < atk ? [] : this.enemiesOf(u);
    const attackNow = foes.filter(f => this.canHit(u, u, f));
    const abilityNow = u.acted || u.apLeft < abilityAp(u.s) ? [] : this.abilityTargets(u, u);
    // подойти и ударить: лучшая клетка (ближайшая), откуда на удар ещё хватит ОД
    const approach = new Map();
    for (const f of foes) {
      if (attackNow.includes(f)) continue;
      let best = null;
      for (const n of reach.values()) if (n.d <= u.apLeft - atk && this.canHit(u, n, f) && (!best || n.d < best.d)) best = n;
      if (best) approach.set(f.uid, best);
    }
    return { reach, attackNow, abilityNow, approach };
  }

  // --------------------------------------------------------
  //  ИИ: выбирает клетку и действие по полезности
  // --------------------------------------------------------
  targetValue(u, f) {
    let x = 1 + (1 - f.hp / f.maxHp) * 2;
    if (f.net > 0 || f.stun > 0) x += 0.8;
    if (this.pv(f, 'mur_guard')) x *= 2.2;
    if (f.hp <= (u.s.dmgMin + u.s.dmgMax) / 2 * u.s.dmgMult * 0.9) x += 1.5;
    if (f.s.ranged) x += 0.4;
    return x;
  }
  // Сколько вражеских бойцов ближнего боя смогут достать клетку в следующий ход
  danger(u, cell) {
    let d = 0;
    for (const f of this.enemiesOf(u)) {
      if (f.s.ranged) continue;
      if (cheb(f, cell) <= this.threat(f)) d += 1;
    }
    return d;
  }
  abilityScore(u, A, cell, f) {
    switch (A.id) {
      case 'whirl': {
        const n = this.enemiesOf(u).filter(x => cheb(cell, x) === 1).length;
        return n >= 2 ? 2 * n : 0.3;
      }
      case 'netThrow': return f.net === 0 && f.stun === 0 ? 2 + f.s.dmgMax / 20 : -5;
      case 'shieldBash': return f.net === 0 && f.stun === 0 ? 1.8 : 0.4;
      case 'slash': return f.bleeds.length ? 0.5 : 1.8;
      case 'cleave': return 1.5 + (this.enemiesOf(u).some(x => x !== f && cheb(cell, x) === 1) ? 1 : 0);
      case 'aimedShot': return 2;
      default: return 1.7;
    }
  }

  aiTurn(u) {
    this.events = [];
    const foes = this.enemiesOf(u);
    if (!foes.length || u.acted) return; // действие уже сделано (ход передан ИИ после удара)
    const A = clsOf(u.g).ability;
    const ready = A && u.cd === 0;
    const reach = this.reachable(u);
    const ranged = u.s.ranged;
    const atk = u.s.atkAp, abC = abilityAp(u.s);
    let best = null;
    const consider = o => { if (!best || o.score > best.score) best = o; };
    for (const n of reach.values()) {
      const left = u.apLeft - n.d;
      // неистраченные ОД — уклонение: лишние шаги чуть хуже
      const dz = this.danger(u, n) * (ranged ? 0.9 : 0.12) + n.d * 0.03;
      for (const f of foes) {
        // удар в спину — вдвое больше шанс крита
        const back = this.isBehind(f, n) ? 0.6 : 0;
        if (left >= atk && this.canHit(u, n, f)) {
          const pb = ranged && cheb(n, f) === 1 ? 1.2 : 0;
          consider({ cell: n, type: 'attack', f, score: this.targetValue(u, f) + back - pb - dz + Math.random() * 0.3 });
        }
        if (ready && left >= abC && A.id !== 'whirl' && this.canHit(u, n, f, this.abilityRange(u))) {
          consider({ cell: n, type: 'ability', f, score: this.targetValue(u, f) + back + this.abilityScore(u, A, n, f) - dz + Math.random() * 0.3 });
        }
      }
      if (ready && left >= abC && A.id === 'whirl') {
        const adj = foes.filter(f => cheb(n, f) === 1);
        if (adj.length) consider({ cell: n, type: 'ability', f: null, score: 1 + this.abilityScore(u, A, n, null) - dz });
      }
    }
    const low = u.hp / u.maxHp < 0.25 && foes.length > 1;
    if (best) {
      this.moveTo(u, best.cell);
      if (!u.alive || this.over) return;
      if (low && best.type === 'attack' && chance(20)) return this.doDefend(u);
      u.acted = true;
      u.apLeft -= best.type === 'ability' ? abC : atk;
      if (best.type === 'ability') this.doAbility(u, best.f);
      else this.doAttack(u, best.f);
      this.checkEnd();
      // боец ближнего боя после удара отходит, только если на оставшиеся ОД можно уйти туда,
      // где его не достанут; иначе стоит — неистраченные ОД дадут уклонение
      if (!ranged && u.alive && !this.over && u.apLeft > 0 && this.danger(u, u) > 0) {
        let safe = null;
        for (const n of this.reachable(u).values()) if (!this.danger(u, n) && (!safe || n.d < safe.d)) safe = n;
        if (safe) this.moveTo(u, safe);
      }
      // лучник отходит на оставшиеся ОД подальше от бойцов ближнего боя
      if (ranged && u.alive && !this.over && u.apLeft > 0 && this.danger(u, u) > 0) {
        let safe = null;
        for (const n of this.reachable(u).values()) {
          const sc = this.danger(u, n) * 2 - Math.min(...this.enemiesOf(u).map(f => cheb(n, f))) * 0.3 + n.d * 0.05;
          if (!safe || sc < safe.sc) safe = { n, sc };
        }
        if (safe) this.moveTo(u, safe.n);
      }
      return;
    }
    // никого не достать: идём к ближайшей позиции для удара
    const goal = this.goalDistance(u);
    let step = null;
    for (const n of reach.values()) {
      const g = goal.get(cellKey(n.c, n.r));
      const score = (g === undefined ? 99 : g) + this.danger(u, n) * (ranged ? 0.6 : 0) + Math.random() * 0.2;
      if (!step || score < step.score) step = { n, score };
    }
    const moved = step && (step.n.c !== u.c || step.n.r !== u.r);
    if (step) this.moveTo(u, step.n);
    if (!u.alive || this.over) return;
    if (low && chance(40)) this.doDefend(u);
    else if (moved || !step) this.ev({ t: 'wait', u: u.uid, silent: true });
  }
  moveTo(u, node) {
    if (node.c === u.c && node.r === u.r) return;
    const path = this.pathOf(node);
    u.c = node.c; u.r = node.r; u.apLeft = Math.max(0, u.apLeft - node.d);
    this.ev({ t: 'move', u: u.uid, path });
    this.updateFacing();
  }
  // Расстояние (в шагах) от каждой клетки до ближайшей позиции, откуда можно ударить.
  // Сначала с учётом всех бойцов; если путь перекрыт своими — без учёта союзников
  goalDistance(u) {
    const build = passAllies => {
      const closed = (c, r) => {
        if (!this.inField(c, r) || this.isBlocked(c, r)) return true;
        const o = this.unitAt(c, r);
        return !!(o && o !== u && !(passAllies && o.side === u.side));
      };
      const dist = new Map(), q = [];
      for (let c = 0; c < FIELD_COLS; c++) for (let r = 0; r < FIELD_ROWS; r++) {
        if (closed(c, r)) continue;
        const cell = { c, r };
        if (this.enemiesOf(u).some(f => this.canHit(u, cell, f))) { dist.set(cellKey(c, r), 0); q.push(cell); }
      }
      while (q.length) {
        const p = q.shift(), d = dist.get(cellKey(p.c, p.r));
        for (const [dc, dr] of DIRS8) {
          const c = p.c + dc, r = p.r + dr, k = cellKey(c, r);
          if (dist.has(k) || closed(c, r)) continue;
          if (dc && dr && closed(p.c + dc, p.r) && closed(p.c, p.r + dr)) continue;
          dist.set(k, d + 1); q.push({ c, r });
        }
      }
      return dist;
    };
    const dist = build(false);
    return dist.has(cellKey(u.c, u.r)) ? dist : build(true);
  }

  // --------------------------------------------------------
  //  Действия
  // --------------------------------------------------------
  // Оборона: −40% урона и +20% блока до следующего хода; неистраченные ОД дадут ещё и уклонение
  doDefend(u) {
    u.defending = true;
    this.say(`${this.nm(u)} закрывается в глухой обороне.`, 'status');
    this.ev({ t: 'defend', u: u.uid });
  }

  doAttack(u, t, opts = {}) {
    if (!t || !t.alive) return;
    const res = this.strike(u, t, { kind: 'basic', ...opts });
    if (res.aborted) return;
    // быстрая тетива сагиттария
    const quick = this.pv(u, 'sag_quick');
    if (quick && u.alive && u.s.ranged && chance(quick)) {
      const foes = this.enemiesOf(u).filter(f => this.canHit(u, u, f));
      if (foes.length) {
        this.say(`${this.nm(u)} тут же выпускает вторую стрелу!`, 'skill');
        this.strike(u, pick(foes), { mult: 0.7, noCounter: true, kind: 'arrow2' });
      }
    }
    // серия ударов димахера
    if (t.alive && res.hit !== undefined) {
      let p = this.pv(u, 'dim_twin');
      const cap = this.pv(u, 'dim_cap');
      if (p) p += cap ? 15 : 0;
      let n = 0;
      while (p > 0 && t.alive && u.alive && chance(p) && n < 4) {
        n++;
        this.say(`${this.nm(u)} наносит ещё удар вторым клинком!`, 'skill');
        this.strike(u, t, { mult: 0.75, noCounter: true, kind: 'twin' });
        if (!cap) break;
        p = p / 2;
      }
    }
  }

  doAbility(u, t) {
    const A = clsOf(u.g).ability;
    if (!A || u.cd > 0) return this.doAttack(u, t);
    u.cd = A.cd + 1; // +1, потому что уменьшается в начале собственного хода
    u.flair += 1;
    u.abilityUses++;
    const cap = A.id === 'netThrow' && this.pv(u, 'ret_cap');
    const targets = A.id === 'whirl' ? this.adjacentFoes(u)
      : cap ? this.enemiesOf(u).filter(f => this.canHit(u, u, f, 3)) : [t];
    this.ev({ t: 'ability', u: u.uid, id: A.id, name: A.name, targets: targets.map(x => x.uid) });

    switch (A.id) {
      case 'shieldBash': {
        const legion = this.pv(u, 'mur_cap');
        if (legion) u.cd--;
        this.say(`${this.nm(u)}: «${A.name}» — цель ${this.nm(t)}!`, 'skill');
        const r = this.strike(u, t, { mult: legion ? 1.3 : 0.8, noCounter: true, kind: 'shieldBash' });
        if (r.hit && t.alive) this.tryControl(u, t, 'stun', legion ? 100 : 60, 1);
        break;
      }
      case 'netThrow': {
        this.say(`${this.nm(u)} бросает сеть${targets.length > 1 ? ' на всех противников рядом' : ` — цель ${this.nm(t)}`}!`, 'skill');
        for (const x of targets) this.tryControl(u, x, 'net', 85 + u.s.netBonus, 1);
        break;
      }
      case 'onslaught': {
        this.say(`${this.nm(u)}: «${A.name}» — цель ${this.nm(t)}!`, 'skill');
        this.strike(u, t, { mult: 1.5, accBonus: 15, ignoreArmor: 0.5, noCounter: true, kind: 'onslaught' });
        break;
      }
      case 'slash': {
        this.say(`${this.nm(u)}: «${A.name}» — цель ${this.nm(t)}!`, 'skill');
        const r = this.strike(u, t, { mult: 0.7, accBonus: 10, kind: 'slash' });
        if (r.hit && t.alive) {
          const turns = this.pv(u, 'thr_cap') ? 5 : 3;
          const per = Math.max(2, Math.round((u.s.dmgMin + u.s.dmgMax) / 2 * 0.45));
          this.addBleed(u, t, per, turns);
        }
        break;
      }
      case 'whirl': {
        this.say(`${this.nm(u)} закручивает «${A.name}»!`, 'skill');
        const mult = 0.75 * (1 + this.pv(u, 'dim_storm') / 100);
        for (const x of targets) if (x.alive && u.alive) this.strike(u, x, { mult, noCounter: true, kind: 'whirl' });
        break;
      }
      case 'spearWall': {
        if (this.pv(u, 'hop_cap')) u.cd--;
        this.say(`${this.nm(u)}: «${A.name}» — выпад в ${this.nm(t)}!`, 'skill');
        this.strike(u, t, { mult: 1.4, unblockable: true, noCounter: true, kind: 'lunge' });
        if (u.alive) {
          u.spearWall = true;
          this.say(`${this.nm(u)} выставляет копьё: каждый, кто подойдёт, получит встречный удар.`, 'status');
          this.ev({ t: 'stance', u: u.uid, kind: 'spearWall' });
        }
        break;
      }
      case 'aimedShot': {
        const cap2 = this.pv(u, 'sag_cap');
        if (cap2) u.cd--;
        this.say(`${this.nm(u)} натягивает тетиву до уха — «${A.name}» в ${this.nm(t)}!`, 'skill');
        this.strike(u, t, { mult: 1.5, accBonus: 20, critBonus: 10, forceCrit: !!cap2, unblockable: true, noCounter: true, kind: 'aimed' });
        const volley = this.pv(u, 'sag_volley');
        if (volley && u.alive) {
          for (const x of this.enemiesOf(u)) if (x !== t && x.alive && this.canHit(u, u, x)) this.strike(u, x, { mult: volley / 100, noCounter: true, kind: 'volley' });
        }
        break;
      }
      case 'cleave': {
        this.say(`${this.nm(u)}: «${A.name}» — с плеча по ${this.nm(t)}!`, 'skill');
        this.strike(u, t, { mult: 1.4, unblockable: true, noCounter: true, kind: 'cleave' });
        if (!u.alive) break;
        const all = this.pv(u, 'gal_cap');
        const rest = this.adjacentFoes(u).filter(x => x !== t);
        const extra = all ? rest : rest.length ? [pick(rest)] : [];
        for (const x of extra) if (x.alive && u.alive) this.strike(u, x, { mult: all ? 0.7 : 0.6, unblockable: true, noCounter: true, kind: 'cleave2' });
        break;
      }
    }
  }

  tryControl(u, t, kind, base, turns) {
    if (t.s.resist >= 100) {
      this.say(`${this.nm(t)} неумолим — эффект не действует.`, 'status');
      this.ev({ t: 'control', u: t.uid, src: u.uid, kind, ok: false, immune: true });
      return false;
    }
    const resist = clamp(t.s.resist, 0, 100);
    const p = clamp(base - resist * (base >= 100 ? 0.5 : 1), 5, 100);
    const pr = Math.round(p);
    if (chance(p)) {
      t[kind] = Math.max(t[kind], turns);
      this.say(`${this.nm(t)} ${kind === 'stun' ? 'оглушён' : 'опутан сетью'} (шанс ${pr}%) и пропустит свой следующий ход!`, 'status');
      this.ev({ t: 'control', u: t.uid, src: u.uid, kind, ok: true, p: pr });
      u.flair += 1;
      return true;
    }
    this.say(`${this.nm(t)} ${kind === 'net' ? 'уходит от сети' : 'устоял на ногах'} (шанс был ${pr}%).`, 'status');
    this.ev({ t: 'control', u: t.uid, src: u.uid, kind, ok: false, p: pr });
    return false;
  }

  addBleed(src, t, dmg, turns) {
    if (this.pv(src, 'thr_cap')) dmg *= 2;
    t.bleeds.push({ dmg, turns, src });
    this.say(`${this.nm(t)} истекает кровью (${dmg} за ход, ${turns} хода).`, 'bleed');
    this.ev({ t: 'bleedOn', u: t.uid });
  }

  // Может ли боец ответить ударом (жив и не обездвижен)
  free(u) { return u.alive && u.stun === 0 && u.net === 0; }

  // Один удар: попадание, крит, блок, броня
  strike(u, t, opts = {}) {
    const mult = opts.mult ?? 1;
    const kind = opts.kind || 'basic';
    const ranged = u.s.ranged && !['counter', 'intercept'].includes(kind);
    const melee = !ranged;
    const dist = cheb(u, t);
    // удар в спину (по взгляду цели до удара), затем оба поворачиваются друг к другу
    const back = t !== u && this.isBehind(t, u);
    if (t !== u) { u.lastTarget = t.uid; t.lastAttacker = u.uid; this.updateFacing(); }
    // встречный удар копья: гопломах бьёт первым
    if (melee && !opts.noCounter && t !== u && this.free(t) && u.alive && dist <= t.reach) {
      const reach = this.pv(t, 'hop_reach');
      if (t.spearWall || (reach && chance(reach))) {
        this.say(`${this.nm(t)} встречает ${this.nm(u)} ударом копья!`, 'skill');
        const cap = this.pv(t, 'hop_cap');
        this.strike(t, u, { mult: cap ? 1.1 : 0.8, noCounter: true, noCrit: !cap, kind: 'intercept' });
        if (!u.alive) return { hit: false, aborted: true };
      }
    }
    let dodge = t.s.dodge + (t.evade || 0);
    const helpless = t.net > 0 || t.stun > 0;
    if (helpless) dodge = 0;
    // стрельба в упор неудобна
    const pointBlank = ranged && dist <= 1 ? -20 : 0;
    const hitChance = hitChanceOf(u.s.acc + (opts.accBonus || 0) + pointBlank, dodge);
    if (!chance(hitChance)) {
      this.say(helpless ? `${this.nm(u)} промахивается по беспомощному ${this.nm(t)}.` : `${this.nm(u)} ${ranged ? 'стреляет' : 'бьёт'} мимо — ${this.nm(t)} уклоняется.`, 'miss');
      this.ev({ t: 'strike', a: u.uid, d: t.uid, kind, res: 'miss', hp: t.hp, ranged, helpless });
      if (!helpless) t.flair += 0.5;
      const evd = this.pv(t, 'ret_evade');
      if (evd && melee && !opts.noCounter && this.free(t) && dist <= t.reach && chance(evd)) {
        this.say(`${this.nm(t)} уходит от удара и контратакует!`, 'skill');
        this.strike(t, u, { mult: 0.8, noCounter: true, kind: 'counter' });
      }
      return { hit: false };
    }

    let dmg = rnd(u.s.dmgMin, u.s.dmgMax) * mult * u.s.dmgMult;
    if (u.hp / u.maxHp < 0.35) dmg *= 1 + this.pv(u, 'mur_last') / 100;
    if (!u.firstAttackDone) dmg *= 1 + this.pv(u, 'ret_reach') / 100;
    u.firstAttackDone = true;
    if (t.hp / t.maxHp < 0.5) dmg *= 1 + this.pv(u, 'sec_exec') / 100;
    const bleeding = t.bleeds.length > 0;
    if (bleeding) dmg *= 1 + this.pv(u, 'thr_thirst') / 100;
    dmg *= 1 + u.fury * this.pv(u, 'dim_fury') / 100;
    const rage = this.pv(u, 'gal_rage');
    if (rage) dmg *= 1 + Math.floor((1 - u.hp / u.maxHp) * 10) * rage / 100;
    const cry = Math.max(0, ...this.alliesOf(u).filter(a => a !== u).map(a => this.pv(a, 'gal_cry')));
    if (cry) dmg *= 1 + cry / 100;

    const crit = !opts.noCrit && (opts.forceCrit || chance(Math.min(100, (u.s.crit + (opts.critBonus || 0)) * (back ? 2 : 1))));
    if (crit) { dmg *= u.s.critMult; u.crits++; u.flair += 1; }

    let blocked = false;
    const blockChance = opts.unblockable ? 0 : t.s.block + (t.defending ? 20 : 0) - u.s.blockPierce;
    if (blockChance > 0 && !helpless && chance(blockChance)) { blocked = true; dmg *= 0.4; }

    let armor = Math.max(0, t.s.armor - t.shred);
    armor *= 1 - (opts.ignoreArmor || 0);
    armor *= 1 - this.pv(u, 'thr_flank') / 100;
    if (ranged) armor *= 1 - this.pv(u, 'sag_weak') / 100;
    dmg *= 25 / (25 + armor);

    if (t.defending) dmg *= 0.6;
    if (t.net > 0) dmg *= 1 + this.maxNetHunter(t) / 100;
    dmg *= 1 + this.pv(t, 'dim_reckless', 'v2') / 100;
    if (t.hp / t.maxHp < 0.35) dmg *= 1 - this.pv(t, 'mur_last', 'v2') / 100;
    const guard = Math.max(0, ...this.alliesOf(t).filter(a => a !== t).map(a => this.pv(a, 'mur_guard')));
    if (guard) dmg *= 1 - guard / 100;
    const phalanx = this.pv(t, 'hop_phalanx');
    if (phalanx) dmg *= 1 - (1 + Math.min(2, this.alliesOf(t).length - 1)) * phalanx / 100;

    dmg = Math.max(1, Math.round(dmg));
    const tag = crit ? ' <span class="crit">КРИТ!</span>' : '';
    const btag = blocked ? ' (блок щитом)' : '';
    this.say(`${this.nm(u)} → ${this.nm(t)}${back ? ' в спину' : ''}: −${dmg}${tag}${btag}`, crit ? 'hit crit' : 'hit');
    const e = this.ev({ t: 'strike', a: u.uid, d: t.uid, kind, res: blocked ? 'block' : 'hit', dmg, crit, ranged, back });
    this.damage(t, dmg, u, e);

    // эффекты при попадании
    u.fury = Math.min(10, u.fury + 1);
    const crush = this.pv(u, 'sec_crush');
    if (crush && t.alive) t.shred = Math.min(12, t.shred + crush);
    const thirst = this.pv(u, 'thr_thirst', 'v2');
    if (bleeding && thirst && u.alive) this.heal(u, Math.round(dmg * thirst / 100), 'vamp');
    const feast = this.pv(u, 'gal_feast');
    if (feast && u.alive) this.heal(u, Math.round(dmg * feast / 100), 'vamp');
    if (t.alive) {
      const barb = this.pv(u, 'sag_barb');
      if (barb && ranged && chance(barb)) this.addBleed(u, t, Math.max(2, Math.round(dmg * 0.3)), 3);
      const pin = this.pv(u, 'hop_pin') + this.pv(u, 'gal_crush');
      if (pin && chance(pin)) this.tryControl(u, t, 'stun', 100, 1);
      const sting = this.pv(u, 'ret_sting');
      if (sting && chance(sting)) this.addBleed(u, t, Math.max(2, Math.round(dmg * 0.3)), 3);
      const tb = this.pv(u, 'thr_blood');
      if (crit && tb && chance(tb)) this.addBleed(u, t, Math.max(2, Math.round(dmg * 0.35)), 3);
      if (u.s.stun && chance(u.s.stun)) this.tryControl(u, t, 'stun', 100, 1);
    }
    if (blocked && this.free(t) && u.alive && melee && !opts.noCounter && dist <= t.reach) {
      const c = this.pv(t, 'mur_counter');
      if (c && chance(c)) {
        this.say(`${this.nm(t)} отбивает удар щитом и бьёт в ответ!`, 'skill');
        this.strike(t, u, { mult: 0.9, noCounter: true, kind: 'counter' });
      }
    }
    return { hit: true, dmg, crit, blocked };
  }

  maxNetHunter(t) {
    return Math.max(0, ...this.enemiesOf(t).map(e => this.pv(e, 'ret_hunter')));
  }

  heal(u, amount, kind = 'heal') {
    if (amount <= 0) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + amount);
    const d = u.hp - before;
    if (d > 0) {
      if (kind !== 'vamp') this.say(`${this.nm(u)} восстанавливает ${d} здоровья.`, 'heal');
      this.ev({ t: 'heal', u: u.uid, amount: d, hp: u.hp, kind });
    }
  }

  // e — событие удара, в которое записывается здоровье после урона
  damage(t, dmg, src, e = null) {
    if (!t.alive) return;
    t.hp -= dmg;
    if (src) src.dmgDealt += Math.min(dmg, dmg + Math.min(0, t.hp));
    if (t.hp <= 0) t.hp = 0;
    if (e) e.hp = t.hp;
    if (t.hp <= 0) {
      t.alive = false; t.killedBy = src || null;
      if (src && src !== t) {
        src.kills++;
        src.flair += 2;
        this.say(this.nonLethal ? `${this.nm(t)} не может продолжать бой — выбыл! Победил его ${this.nm(src)}` : `${this.nm(t)} повержен! Добил: ${this.nm(src)}`, 'kill');
        this.ev({ t: 'fall', u: t.uid, by: src.uid });
        if (this.pv(src, 'gal_cap') && src.alive) src.cd = 0;
        const reap = this.pv(src, 'dim_reap');
        if (reap && src.alive) this.heal(src, Math.round(src.maxHp * reap / 100));
        if (this.pv(src, 'sec_cap') && src.alive && src === this.current && !this.over) {
          this.extraAction = true;
          this.say(`${this.nm(src)} в охотничьем азарте — дополнительный ход!`, 'skill');
          this.ev({ t: 'extra', u: src.uid });
        }
      } else {
        this.say(`${this.nm(t)} падает на песок.`, 'kill');
        this.ev({ t: 'fall', u: t.uid, by: null });
      }
      return;
    }
    const wind = this.pv(t, 'sec_wind');
    if (wind && !t.windUsed && t.hp / t.maxHp < 0.4) {
      t.windUsed = true;
      this.say(`${this.nm(t)} обретает второе дыхание!`, 'skill');
      this.heal(t, Math.round(t.maxHp * wind / 100));
    }
  }
}

// ============================================================
//  Приговор толпы: шанс помилования проигравшего гладиатора
// ============================================================
function mercyBreakdown(unit, battle, bribed = false) {
  const parts = [];
  const add = (label, v) => { if (v) parts.push({ label, v: Math.round(v) }); };
  const T = battle.tier;
  const foes = battle.units.filter(u => u.side !== unit.side);
  const foeHp = foes.reduce((s, u) => s + u.maxHp, 0);

  add('Милосердие толпы', 20);
  if (unit.kills > 0) add(`Поверг противника${unit.kills > 1 ? ` (×${unit.kills})` : ''}`, 35 + (unit.kills - 1) * 10);
  const share = unit.dmgDealt / Math.max(1, foeHp);
  add(`Нанесённый урон (${unit.dmgDealt})`, Math.min(15, share * 30));
  if (unit.dmgDealt === 0) add('Пал, не нанеся ни одного удара', -10);
  add('Зрелищность боя', Math.min(10, unit.flair * 1.5));
  add(`Воля (${unit.s.attrs.wil})`, unit.s.attrs.wil * 1.5);
  add(`Слава гладиатора (${unit.g.fame})`, Math.min(15, unit.g.fame * 0.5));
  if (unit.s.mercy) add('Снаряжение, любимое толпой', unit.s.mercy);
  add('Нрав публики', T.mercy);
  if (battle.surrendered && unit.alive) add('Сдался, оставаясь на ногах', 15);
  if (bribed) add('Подкуп распорядителя игр', 15);

  const raw = parts.reduce((s, p) => s + p.v, 0);
  const cap = unit.kills > 0 ? 90 : 50;
  const total = clamp(raw, 5, cap);
  return { parts, raw, cap, total, capped: raw > cap };
}

function bribeCost(battle) { return 30 + clamp(battle.event.tier || 0, 0, 3) * 40; }
