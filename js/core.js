// ============================================================
//  Ядро: утилиты, генерация, расчёт характеристик, состояние лудуса
// ============================================================

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = p => Math.random() * 100 < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const weightedPick = (keys, weights) => {
  const total = keys.reduce((s, k) => s + weights[k], 0);
  let r = Math.random() * total;
  for (const k of keys) { r -= weights[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
};

let STATE = null;
const uid = () => (STATE ? ++STATE.nextId : Math.floor(Math.random() * 1e9));

// ------------------------------------------------------------
//  Предметы: характеристики зависят только от шаблона и качества
// ------------------------------------------------------------
function itemStatsFor(baseId, q) {
  const base = ITEM_BASES[baseId];
  if (base.artifact || base.rare) return { ...base.stats }; // у реликвий и редкостей характеристики заданы окончательно
  const Q = QUALITIES[q];
  const stats = {};
  for (const [k, v] of Object.entries(base.stats)) {
    // штрафы не растут с качеством, бонусы — растут
    stats[k] = v > 0 ? Math.max(1, Math.round(v * Q.mult)) : v;
  }
  (base.bonus || []).forEach(([k, v], i) => {
    const from = 2 + i;
    if (q < from) return;
    stats[k] = (stats[k] || 0) + Math.round(v * (1 + (q - from) * 0.5));
  });
  if (stats.dmgMin > stats.dmgMax) stats.dmgMax = stats.dmgMin;
  return stats;
}

function itemPrice(baseId, q) {
  if (ITEM_BASES[baseId].artifact || ITEM_BASES[baseId].rare) return ITEM_BASES[baseId].price;
  const extra = Math.max(0, Math.min(3, q - 1));
  return Math.round(ITEM_BASES[baseId].price * QUALITIES[q].price * (1 + extra * 0.15));
}

function makeItem(baseId, q = 1) {
  const base = ITEM_BASES[baseId];
  return {
    id: uid(), base: baseId, slot: base.slot, q,
    name: base.name, stats: itemStatsFor(baseId, q), price: itemPrice(baseId, q),
  };
}

// Приводит старый предмет к текущим правилам (фиксированные характеристики, новые слоты)
function normalizeItem(it) {
  if (!it || !ITEM_BASES[it.base]) return null;
  const base = ITEM_BASES[it.base];
  it.slot = base.slot; it.name = base.name;
  it.stats = itemStatsFor(it.base, it.q);
  it.price = itemPrice(it.base, it.q);
  return it;
}

function randomItem(q, slot = null) {
  const pool = Object.keys(ITEM_BASES).filter(k => isCommonBase(k) && (!slot || ITEM_BASES[k].slot === slot));
  return makeItem(pick(pool), q);
}

const isCommonBase = k => !ITEM_BASES[k].artifact && !ITEM_BASES[k].rare;
const itemFits = (it, cls) => !!(it && cls && ITEM_BASES[it.base].classes.includes(cls));
const isTwoHanded = it => !!(it && ITEM_BASES[it.base].twoHanded);
const isRanged = it => !!(it && ITEM_BASES[it.base].ranged);

// Характеристики предмета с учётом школьной выучки
function effectiveItemStats(it, cls) {
  const fit = itemFits(it, cls);
  const out = {};
  for (const [k, v] of Object.entries(it.stats)) out[k] = fit && v > 0 ? Math.round(v * FIT_MULT) : v;
  if (fit && it.slot === 'weapon') out.acc = (out.acc || 0) + FIT_ACC;
  return out;
}

function statsText(s) {
  const parts = [];
  if (s.dmgMin !== undefined) parts.push(`Урон ${s.dmgMin}–${s.dmgMax}`);
  for (const [k, v] of Object.entries(s)) {
    if (k === 'dmgMin' || k === 'dmgMax' || !v) continue;
    const sign = v > 0 ? '+' : '';
    parts.push(`${STAT_NAMES[k]} ${sign}${v}${PCT_STATS.has(k) ? '%' : ''}`);
  }
  return parts.join(', ');
}
const itemStatsText = (item, cls = null) => statsText(cls ? effectiveItemStats(item, cls) : item.stats);

// ------------------------------------------------------------
//  Гладиаторы
// ------------------------------------------------------------
function xpToNext(level) { return 80 + (level - 1) * 60; }

function randomName() {
  const used = new Set(STATE ? STATE.gladiators.map(g => g.name) : []);
  const free = NAMES.filter(n => !used.has(n));
  return pick(free.length ? free : NAMES);
}

// Школу можно выбрать только с этого уровня
const SCHOOL_LEVEL = 5;

// cls = null — новобранец без школы. Бойцы ниже SCHOOL_LEVEL всегда новобранцы.
// opts.quality задаёт качество снаряжения (для противников): школьный набор или
// случайное снаряжение новобранца
function createGladiator(cls, level = 1, opts = {}) {
  if (level < SCHOOL_LEVEL && !opts.forceSchool) cls = null;
  const C = CLASSES[cls] || TIRO;
  const g = {
    id: uid(), name: opts.name || randomName(), origin: pick(ORIGINS), cls: CLASSES[cls] ? cls : null, level: 1, xp: 0,
    look: typeof randomLook === 'function' ? randomLook() : null,
    attrs: {}, freeAttr: 0, freeSpec: 1, perks: {},
    equip: emptyEquip(),
    wounded: 0, foughtToday: false, trainedToday: false,
    fame: 0, record: { wins: 0, losses: 0, kills: 0, fights: 0, spared: 0 },
  };
  if (g.cls) {
    for (const k of ATTR_KEYS) g.attrs[k] = Math.max(1, C.base[k] + rnd(-1, 1));
  } else {
    // склонности новобранца: случайный «талант», от которого зависит, к какой школе он годится
    g.talent = {};
    for (const k of ATTR_KEYS) { g.talent[k] = rnd(1, 5); g.attrs[k] = 3; }
    for (let i = 0; i < 12; i++) g.attrs[weightedPick(ATTR_KEYS, g.talent)]++;
  }
  for (let i = 1; i < level; i++) levelUp(g, true);
  if (opts.quality !== undefined) {
    if (g.cls) giveSchoolKit(g, opts.quality);
    else giveNoviceKit(g, opts.quality);
  }
  if (opts.autoSpend) autoSpend(g);
  return g;
}

// Случайное снаряжение новобранца-противника: оружие и что придётся
function giveNoviceKit(g, q = 0) {
  const Q = () => (typeof q === 'function' ? q() : q);
  const common = slot => Object.keys(ITEM_BASES).filter(k => isCommonBase(k) && ITEM_BASES[k].slot === slot);
  const weapons = common('weapon').filter(k => !ITEM_BASES[k].ranged || chance(25));
  equipItem(g, makeItem(pick(weapons), Q()));
  if (isRanged(g.equip.weapon)) { if (chance(60)) equipItem(g, makeItem('pharetra', Q())); }
  else if (!isTwoHanded(g.equip.weapon) && chance(60)) equipItem(g, makeItem(pick(['scutum', 'parma', 'parma', 'pugio']), Q()));
  for (const [slot, p] of [['helmet', 50], ['arms', 40], ['legs', 45], ['belt', 40], ['armor', 15]]) {
    if (chance(p)) g.equip[slot] = makeItem(pick(common(slot)), Q());
  }
}

// Учебное снаряжение школы — только в пустые слоты
function giveSchoolKit(g, q = 0) {
  const C = CLASSES[g.cls];
  if (!C) return [];
  const given = [];
  for (const [slot, baseId] of Object.entries(C.start)) {
    if (!baseId || g.equip[slot]) continue;
    if (slot === 'offhand' && isTwoHanded(g.equip.weapon) && !(ITEM_BASES[baseId].needsBow && isRanged(g.equip.weapon))) continue;
    g.equip[slot] = makeItem(baseId, typeof q === 'function' ? q() : q);
    given.push(g.equip[slot]);
  }
  return given;
}

// Насколько характеристики бойца подходят школе (0..1, относительно других школ)
function rawAptitude(g, cls) {
  const w = CLASSES[cls].weights;
  const total = ATTR_KEYS.reduce((s, k) => s + w[k], 0);
  return ATTR_KEYS.reduce((s, k) => s + g.attrs[k] * w[k], 0) / total;
}
function classAptitude(g, cls) {
  const all = CLASS_KEYS.map(c => rawAptitude(g, c));
  const lo = Math.min(...all), hi = Math.max(...all);
  return hi - lo < 1e-6 ? 0.6 : 0.2 + 0.8 * (rawAptitude(g, cls) - lo) / (hi - lo);
}
function bestClasses(g, n = 3) {
  return CLASS_KEYS.map(c => ({ c, a: classAptitude(g, c) })).sort((x, y) => y.a - x.a).slice(0, n);
}

function levelUp(g, silent = false) {
  g.level++;
  g.freeAttr += 3;
  g.freeSpec += 1;
}

function addXp(g, amount) {
  const ups = [];
  if (g.level >= MAX_LEVEL) return ups;
  g.xp += amount;
  while (g.level < MAX_LEVEL && g.xp >= xpToNext(g.level)) {
    g.xp -= xpToNext(g.level);
    levelUp(g);
    ups.push(g.level);
  }
  return ups;
}

function perkRank(g, id) { return g.perks[id] || 0; }

function canLearnPerk(g, perk) {
  if (g.freeSpec <= 0 || !g.cls) return false;
  if (perk.cls && perk.cls !== g.cls) return false;
  if (g.level < TIER_LEVEL[perk.tier]) return false;
  return perkRank(g, perk.id) < perk.max;
}

// Распределение свободных очков (для противников и рекрутов)
function autoSpend(g) {
  const C = clsOf(g);
  const weights = g.cls ? C.weights : (g.talent || C.weights);
  while (g.freeAttr > 0) {
    g.attrs[weightedPick(ATTR_KEYS, weights)]++;
    g.freeAttr--;
  }
  if (!g.cls) return; // очки специализации новобранца ждут выбора школы
  // ИИ предпочитает углубляться в 2–3 перка
  const favored = new Set();
  let guard = 50;
  while (g.freeSpec > 0 && guard-- > 0) {
    const avail = C.perks.filter(p => canLearnPerk(g, { ...p, cls: g.cls }));
    if (!avail.length) break;
    const fav = avail.filter(p => favored.has(p.id) || p.tier === 4);
    const p = fav.length && Math.random() < 0.7 ? pick(fav) : pick(avail);
    favored.add(p.id);
    g.perks[p.id] = perkRank(g, p.id) + 1;
    g.freeSpec--;
  }
}

// Значение перка (v или v2) с учётом ранга
function pv(g, id, key = 'v') {
  const r = perkRank(g, id);
  return r ? PERKS[id][key][r - 1] : 0;
}

// Надевает предмет; возвращает снятые предметы
function equipItem(g, it) {
  const off = [];
  const take = slot => { if (g.equip[slot]) { off.push(g.equip[slot]); g.equip[slot] = null; } };
  take(it.slot);
  g.equip[it.slot] = it;
  const w = g.equip.weapon, oh = g.equip.offhand;
  if (it.slot === 'weapon' && oh) {
    // двуручное оружие занимает обе руки (колчан остаётся при луке)
    if (isTwoHanded(it) && !(ITEM_BASES[oh.base].needsBow && isRanged(it))) take('offhand');
    else if (!isRanged(it) && ITEM_BASES[oh.base].needsBow) take('offhand');
  }
  if (it.slot === 'offhand') {
    if (ITEM_BASES[it.base].needsBow) { if (w && !isRanged(w)) take('weapon'); }
    else if (isTwoHanded(w)) take('weapon');
  }
  return off;
}

// ------------------------------------------------------------
//  Итоговые характеристики гладиатора
// ------------------------------------------------------------
function computeStats(g) {
  const a = { ...g.attrs };
  const it = { dmgMin: 0, dmgMax: 0, acc: 0, dodge: 0, armor: 0, crit: 0, block: 0, init: 0, stun: 0, hp: 0, resist: 0, mercy: 0 };
  let fits = 0;
  for (const item of Object.values(g.equip)) {
    if (!item) continue;
    if (itemFits(item, g.cls)) fits++;
    for (const [k, v] of Object.entries(effectiveItemStats(item, g.cls))) {
      if (k in a) a[k] += v; else it[k] = (it[k] || 0) + v;
    }
  }
  const weapon = g.equip.weapon;
  if (!weapon) { it.dmgMin += 2; it.dmgMax += 4; } // кулаки
  const ranged = isRanged(weapon);

  const s = {
    attrs: a, fits, ranged, twoHanded: isTwoHanded(weapon),
    maxHp: 30 + a.end * 7 + it.hp,
    dmgMin: it.dmgMin + a.str * (ranged ? 0.8 : 1.2),
    dmgMax: it.dmgMax + a.str * (ranged ? 0.8 : 1.2),
    dmgMult: 1,
    acc: a.skl * 1.5 + it.acc,
    dodge: a.agi * 1.5 + it.dodge,
    armor: it.armor,
    crit: 3 + a.skl * 0.8 + it.crit,
    critMult: 1.6,
    block: it.block,
    blockPierce: 0,
    init: a.agi + it.init,
    stun: it.stun,
    resist: a.wil * 3 + it.resist,
    mercy: it.mercy,
    netBonus: g.equip.offhand && g.equip.offhand.base === 'rete' ? 10 : 0,
  };
  // перки, влияющие на базовые параметры
  s.block += pv(g, 'mur_wall');
  s.dmgMult += pv(g, 'mur_heavy') / 100;
  s.maxHp = Math.round(s.maxHp * (1 + pv(g, 'mur_iron') / 100 + pv(g, 'gal_hide') / 100));
  s.dodge += pv(g, 'ret_dance');
  s.acc += pv(g, 'ret_calm'); s.crit += pv(g, 'ret_calm');
  s.netBonus += pv(g, 'ret_hunter', 'v2');
  s.armor += pv(g, 'sec_skin');
  s.acc += pv(g, 'sec_pursuit');
  s.resist += pv(g, 'sec_relent');
  s.crit += pv(g, 'thr_blade');
  s.dodge += pv(g, 'thr_quick'); s.init += pv(g, 'thr_quick', 'v2');
  s.critMult += pv(g, 'thr_death') / 100;
  s.dodge += pv(g, 'dim_steel'); s.acc += pv(g, 'dim_steel');
  s.dmgMult += pv(g, 'dim_reckless') / 100;
  s.acc += pv(g, 'hop_aim'); s.init += pv(g, 'hop_aim', 'v2');
  s.blockPierce += pv(g, 'hop_pierce');
  s.block += pv(g, 'hop_parmula'); s.dodge += pv(g, 'hop_parmula', 'v2');
  s.acc += pv(g, 'sag_eye');
  s.dodge += pv(g, 'sag_light');
  s.dmgMult += pv(g, 'gal_heft') / 100;

  s.dmgMin = Math.round(s.dmgMin); s.dmgMax = Math.round(s.dmgMax);
  s.dodge = Math.round(s.dodge); s.acc = Math.round(s.acc); s.crit = Math.round(s.crit);
  s.dodge = Math.max(0, s.dodge); s.block = Math.max(0, s.block);
  // тактическое поле: шаги за ход и дальность удара
  s.move = clamp(2 + Math.floor(s.init / 5), 2, 5);
  s.reach = typeof reachOf === 'function' ? reachOf(g) : 1;
  return s;
}

// Шанс попасть: базовые 72% + точность атакующего − уклонение цели (10..97%)
const BASE_HIT = 72;
const hitChanceOf = (acc, dodge) => clamp(BASE_HIT + acc - dodge, 10, 97);

// Грубая оценка силы бойца — для цены рекрута и подбора противников
function powerScore(g) {
  const s = computeStats(g);
  const avgDmg = (s.dmgMin + s.dmgMax) / 2 * s.dmgMult;
  return Math.round(s.maxHp * 0.5 + avgDmg * 4 + s.armor * 2 + s.dodge + s.acc * 0.5 + s.crit);
}

// ------------------------------------------------------------
//  Состояние лудуса
// ------------------------------------------------------------
const SAVE_KEY = 'gladiator_ludus_proto_v1';

// opts.story — новая история: долг отца, главы и задачи; opts.lanista — { portrait, sex } игрока
function newGame(ludusName = 'Лудус', opts = {}) {
  STATE = {
    ludusName, gold: 200, fame: 0, day: 1, nextId: 1,
    gladiators: [], armory: [], smith: [], market: [], events: [], graveyard: [],
    journal: [],
  };
  // первый новобранец: лишь грубый гладиус; денариев хватит на снаряжение или второго бойца
  const g = createGladiator(null, 1);
  g.equip.weapon = makeItem('gladius', 0);
  STATE.gladiators.push(g);
  if (opts.story) {
    STATE.lanista = { portrait: 'm1', sex: 'm', ...(opts.lanista || {}) };
    STATE.debt = newDebt();
    if (typeof STORY !== 'undefined') STATE.story = STORY.create();
  }
  refreshSmith(); refreshMarket(); generateEvents(); refreshRareShop(true);
  journal(`Вы приобрели лудус и единственного новобранца. Купите ему снаряжение или найдите второго бойца на рынке. С ${SCHOOL_LEVEL}-го уровня бойца можно посвятить в школу.`);
  if (typeof META !== 'undefined') META.init();
  save();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(STATE)); } catch (e) { /* хранилище недоступно */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { STATE = JSON.parse(raw); return true; }
  } catch (e) { /* повреждённое сохранение */ }
  return false;
}

// Миграция старых сохранений: новые слоты, фиксированные характеристики предметов
function migrateGladiator(g, spare = null) {
  if (!g) return;
  const old = g.equip || {};
  g.equip = emptyEquip();
  for (const it of Object.values(old)) {
    if (!normalizeItem(it)) continue;
    if (!g.equip[it.slot]) g.equip[it.slot] = it;
    else if (spare) spare.push(it);
  }
  if (g.cls && !CLASSES[g.cls]) g.cls = null;
  if (!g.cls && !g.talent) { g.talent = {}; for (const k of ATTR_KEYS) g.talent[k] = 3; }
}
function migrateState() {
  for (const g of STATE.gladiators) migrateGladiator(g, STATE.armory);
  for (const g of STATE.market) migrateGladiator(g);
  for (const e of STATE.events) for (const g of e.enemies) migrateGladiator(g);
  STATE.armory = STATE.armory.filter(normalizeItem);
  STATE.smith = STATE.smith.filter(normalizeItem);
  if (!STATE.rareShop) refreshRareShop(true);
  for (const d of STATE.graveyard) if (d.equip) for (const k of Object.keys(d.equip)) if (d.equip[k] && !normalizeItem(d.equip[k])) d.equip[k] = null;
}

function journal(text) {
  STATE.journal.unshift({ day: STATE.day, text });
  STATE.journal.length = Math.min(STATE.journal.length, 60);
}

const MAX_GLADIATORS = 10;
const unlockedTiers = () => TIERS.map((t, i) => i).filter(i => STATE.fame >= TIERS[i].fameReq);
const maxTier = () => Math.max(...unlockedTiers());
const upkeepCost = () => STATE.gladiators.length * 4;
const trainCost = g => 12 + g.level * 6;
const healCost = g => 25 + g.level * 5;

// Кузница: ассортимент по всем слотам, качество растёт с открытыми аренами.
// Больше половины оружия и щитов — для школ, которые уже есть в лудусе.
const SMITH_PLAN = { weapon: 4, offhand: 2, helmet: 2, armor: 1, arms: 1, legs: 1, belt: 1 };
function refreshSmith() {
  const mt = maxTier();
  const qFor = () => {
    let q = clamp(mt - 1 + rnd(0, 2), 0, 3);
    if (mt >= 3 && chance(8)) q = 4;
    else if (mt >= 2 && chance(10)) q = Math.min(4, q + 1);
    return q;
  };
  const schools = new Set(STATE.gladiators.map(g => g.cls).filter(Boolean));
  const items = [];
  for (const [slot, n] of Object.entries(SMITH_PLAN)) {
    const pool = Object.keys(ITEM_BASES).filter(k => isCommonBase(k) && ITEM_BASES[k].slot === slot).sort(() => Math.random() - 0.5);
    const mine = pool.filter(k => ITEM_BASES[k].classes.some(c => schools.has(c)));
    const chosen = [];
    for (let i = 0; i < n; i++) {
      const src = mine.filter(k => !chosen.includes(k)).length && chance(60) ? mine : pool;
      const k = src.find(x => !chosen.includes(x)) || pick(pool);
      chosen.push(k);
      items.push(makeItem(k, qFor()));
    }
  }
  items.sort((a, b) => SLOT_KEYS.indexOf(a.slot) - SLOT_KEYS.indexOf(b.slot) || a.base.localeCompare(b.base) || b.q - a.q);
  STATE.smith = items;
}

// Лавка редкостей: 4 уникальные вещи, товар меняется раз в 3 дня
const rareShopOpen = () => STATE.fame >= RARE_SHOP_FAME;
function refreshRareShop(force = false) {
  STATE.rareBought = STATE.rareBought || [];
  const shop = STATE.rareShop;
  if (!force && shop && STATE.day - shop.day < 3) return;
  const pool = Object.keys(RARE_BASES).filter(id => !STATE.rareBought.includes(id)).sort(() => Math.random() - 0.5);
  STATE.rareShop = { day: STATE.day, items: pool.slice(0, 4).map(id => makeItem(id, 4)) };
}
const rareShopDaysLeft = () => (STATE.rareShop ? Math.max(1, 3 - (STATE.day - STATE.rareShop.day)) : 3);

function recruitPrice(g) {
  return Math.round(40 + powerScore(g) * 0.9 + (g.level - 1) * 45);
}

function refreshMarket() {
  const mt = maxTier();
  STATE.market = [];
  for (let i = 0; i < 4; i++) {
    const lvl = clamp(rnd(1, 1 + mt * 2), 1, 8);
    const g = createGladiator(null, lvl, { autoSpend: true });
    g.price = recruitPrice(g);
    STATE.market.push(g);
  }
}

// Средний уровень лучших бойцов лудуса — противники подбираются вокруг него
function ludusLevel() {
  const lv = STATE.gladiators.map(g => g.level).sort((a, b) => b - a).slice(0, 3);
  return lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 1;
}

function generateEnemyTeam(tierIdx, size) {
  const T = TIERS[tierIdx];
  const team = [];
  const used = new Set(STATE.gladiators.map(g => g.name));
  const lvl = clamp(Math.round(ludusLevel()) + rnd(-1, 1), T.lvl[0], T.lvl[1]);
  const q = () => rnd(T.quality[0], T.quality[1]);
  for (let i = 0; i < size; i++) {
    const l = clamp(lvl + rnd(-1, 1), T.lvl[0], T.lvl[1]);
    const free = NAMES.filter(n => !used.has(n));
    const name = pick(free.length ? free : NAMES);
    used.add(name);
    const g = createGladiator(pick(CLASS_KEYS), l, { name, autoSpend: true, quality: q });
    // иногда у противника есть дополнительная броня
    if (!g.equip.helmet && chance(30)) g.equip.helmet = randomItem(q(), 'helmet');
    if (tierIdx >= 1 && !g.equip.armor && chance(40)) g.equip.armor = randomItem(q(), 'armor');
    team.push(g);
  }
  return team;
}

function generateEvents() {
  const tiers = unlockedTiers();
  const events = [];
  const plan = [];
  // хотя бы по одному событию на каждой доступной арене + случайные
  for (const t of tiers.slice(-3)) plan.push(t);
  while (plan.length < 5) plan.push(pick(tiers));
  // каждый день доступны все форматы: 1 на 1, 2 на 2, 3 на 3
  const sizes = [1, 2, 3, pick([1, 2]), pick([2, 3])].sort(() => Math.random() - 0.5);
  for (const t of plan) {
    const size = sizes.pop();
    const T = TIERS[t];
    events.push({
      id: uid(), tier: t, size,
      enemies: generateEnemyTeam(t, size),
      gold: Math.round(T.gold * FORMAT_MULT[size] * (0.9 + Math.random() * 0.3)),
      fame: Math.round(T.fame * FORMAT_MULT[size]),
      done: false,
    });
  }
  events.sort((a, b) => a.tier - b.tier || a.size - b.size);
  STATE.events = events;
}

// Новый день: содержание бойцов, обновление рынка и событий, платёж по долгу.
// Возвращает { cost, debt }: debt — результат debtOnNewDay() или null
function nextDay() {
  if (STATE.lost) return { cost: 0, debt: null };
  const cost = upkeepCost();
  STATE.gold -= cost;
  STATE.day++;
  for (const g of STATE.gladiators) {
    g.foughtToday = false; g.trainedToday = false;
    if (g.wounded > 0) g.wounded--;
  }
  refreshSmith(); refreshMarket(); generateEvents(); refreshRareShop();
  journal(`Наступил день ${STATE.day}. Содержание бойцов: −${cost} денариев.`);
  const debt = STATE.debt && typeof debtOnNewDay === 'function' ? debtOnNewDay() : null;
  if (typeof META !== 'undefined') META.onNewDay();
  save();
  return { cost, debt };
}

function gladiatorStatus(g) {
  if (g.wounded > 0) return { key: 'wounded', text: `Ранен (${g.wounded} дн.)` };
  if (g.foughtToday) return { key: 'tired', text: 'Сражался сегодня' };
  return { key: 'ready', text: 'Готов к бою' };
}
const canFight = g => g.wounded === 0 && !g.foughtToday;

// ------------------------------------------------------------
//  Финал: «Игры за рудис свободы»
// ------------------------------------------------------------
const FINAL_FAME = 1000, FINAL_LEVEL = 18;
const FINAL_CHAMPIONS = [
  { name: 'Спикул', cls: 'murmillo' },
  { name: 'Карпофор', cls: 'sagittarius' },
  { name: 'Фламма', cls: 'secutor' },
];
const finalUnlocked = () => STATE.fame >= FINAL_FAME && !STATE.finalWon;

// Финальный бой: три легендарных чемпиона 18-го уровня в мастерском снаряжении с легендарным оружием
function finalEvent() {
  if (!finalUnlocked()) return null;
  // проигранный финал можно повторить на следующий день — с новыми силами чемпионов
  const fe = STATE.finalEvent;
  if (fe && (fe.day === STATE.day || !fe.done)) { fe.day = STATE.day; return fe; }
  const enemies = FINAL_CHAMPIONS.map(c => {
    const g = createGladiator(c.cls, FINAL_LEVEL, { name: c.name, autoSpend: true, quality: 3 });
    g.fame = 200;
    g.equip.weapon = makeItem(g.equip.weapon.base, 4); // оружие чемпиона — легендарное
    return g;
  });
  STATE.finalEvent = {
    id: uid(), kind: 'final', tier: 3, size: 3, enemies, day: STATE.day,
    gold: 3000, fame: 300, done: false,
  };
  return STATE.finalEvent;
}
