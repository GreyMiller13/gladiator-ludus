// ============================================================
//  Интерфейс: экраны лудуса, модальное окно гладиатора, бой, приговор
// ============================================================

const UI = {
  tab: 'ludus',
  gladId: null,         // открытый в модальном окне гладиатор
  eventId: null,        // выбранный бой на арене
  picked: [],           // выбранные для боя гладиаторы
  battle: null,
  smithFilter: 'all',   // фильтр кузницы по школе
};

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const EMBLEMS = {
  murmillo: '<rect x="13" y="5" width="22" height="38" rx="4"/><circle cx="24" cy="24" r="4"/><path d="M24 7v13M24 28v13M15 24h5M28 24h5"/>',
  retiarius: '<path d="M24 45V12"/><path d="M14 5v8c0 6 4 8 10 8s10-2 10-8V5"/><path d="M24 3v10"/><path d="M11 33c4 3 9 3 13 0s9-3 13 0" opacity=".6"/>',
  secutor: '<path d="M12 42V23a12 15 0 0 1 24 0v19z"/><circle cx="19" cy="27" r="2.2"/><circle cx="29" cy="27" r="2.2"/><path d="M24 8v5M16 36h16"/>',
  thraex: '<path d="M15 40C29 32 33 20 34 6c4 16-2 30-17 37z"/><path d="M9 35l10 10M12 41l4-4"/>',
  dimachaerus: '<path d="M9 9l26 26M39 9L13 35"/><path d="M30 37l8-8M10 29l8 8"/><path d="M34 41l4-4M10 37l4 4"/>',
  hoplomachus: '<path d="M8 40L40 8"/><path d="M40 8l-9 2 7 7z"/><circle cx="17" cy="31" r="9"/><circle cx="17" cy="31" r="3"/>',
  sagittarius: '<path d="M14 6c14 6 14 30 0 36"/><path d="M14 6v36"/><path d="M8 24h32"/><path d="M40 24l-6-4M40 24l-6 4M10 21l-3 3 3 3"/>',
  gallus: '<path d="M24 4v30"/><path d="M15 34h18M24 34v8"/><path d="M20 4h8l-4 6z"/><path d="M10 16c4-6 10-6 14-2M38 16c-4-6-10-6-14-2"/>',
  tiro: '<path d="M14 40l20-32"/><path d="M12 36l6 6"/><circle cx="31" cy="34" r="6"/>',
};
const emblem = cls => `<div class="emblem"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EMBLEMS[cls || 'tiro']}</svg></div>`;
const stars = a => '★'.repeat(Math.max(1, Math.round(a * 5))) + '☆'.repeat(5 - Math.max(1, Math.round(a * 5)));
const THUMB = '<svg class="thumb" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M18 22l6-14c3 0 5 2 4 6l-2 7h11c3 0 5 3 4 6l-3 11c-1 3-3 4-6 4H18z"/><path d="M8 22h10v22H8z"/></svg>';

function toast(text, bad = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.innerHTML = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

const glad = id => STATE.gladiators.find(g => g.id === id);
const fmtPct = v => `${Math.round(v)}%`;
const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return a;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return b;
  return c;
};

// ------------------------------------------------------------
//  Главный рендер
// ------------------------------------------------------------
function render() {
  if (typeof MENU !== 'undefined' && MENU.open) renderMenu();
  if (!STATE) return; // игра ещё не начата — на экране главное меню
  renderHeader();
  renderNav();
  if (typeof renderTaskBar === 'function') renderTaskBar();
  const screens = {
    ludus: screenLudus, arena: screenArena, smith: screenSmith, bazaar: screenBazaar, market: screenMarket, armory: screenArmory, necro: screenNecro, rules: screenRules,
    contracts: () => (typeof META !== 'undefined' ? META.screenContracts() : ''),
    glory: () => (typeof META !== 'undefined' ? META.screenAchievements() : ''),
  };
  $('main').innerHTML = screens[UI.tab]();
  renderModal();
}

function renderHeader() {
  const res = (icon, label, value, cls = '') => `<div>${ICON[icon]}<div class="rv"><label>${label}</label><strong class="${cls}">${value}</strong></div></div>`;
  $('header').innerHTML = `
    <div class="brand">${ICON.crest}<div><span>лудус</span><h1>${esc(STATE.ludusName)}</h1></div></div>
    <div class="res">
      ${res('coin', 'денарии', STATE.gold, STATE.gold < 0 ? 'neg' : '')}
      ${debtRes()}
      ${res('laurel', 'слава лудуса', STATE.fame)}
      ${res('helm', 'бойцы', `${STATE.gladiators.length}/${MAX_GLADIATORS}`)}
      ${res('sun', 'день', STATE.day)}
      ${soundBtn()}
      <button class="small" data-act="menu" title="Главное меню: сохранение, новая игра, справочник">Меню</button>
      <button class="primary" data-act="nextDay" title="Содержание бойцов: ${upkeepCost()} денариев">Завершить день</button>
    </div>`;
}

// Долг отца в шапке: остаток и ближайший платёж; красный, если срок близко, а денег не хватает
function debtRes() {
  const n = STATE.debt && typeof debtNext === 'function' ? debtNext() : null;
  if (!n) return '';
  const when = n.daysLeft <= 0 ? 'сегодня' : n.daysLeft === 1 ? 'завтра' : `через ${n.daysLeft} дн.`;
  return `<button class="debtres ${debtUrgent() ? 'urgent' : ''}" data-act="debtInfo" title="Долг отца. Ближайший платёж: ${n.amount} ден. (${when}). Нажмите, чтобы увидеть расписание">${ICON.tablet}
    <div class="rv"><label>долг</label><strong>${debtLeft()}</strong><small>−${n.amount} ${when}</small></div></button>`;
}

function showDebtDialog() {
  const d = STATE.debt;
  if (!d) return;
  const n = debtNext();
  const rows = n ? d.plan.slice(d.idx, d.idx + 3).map((a, k) => `<tr><td>${debtDay(d.idx + k)}-й день</td><td>${a} ден.</td></tr>`).join('') : '';
  showDialog({
    title: 'Долг отца', cls: 'debtdlg',
    body: `<img class="debt-face" src="${PORTRAIT.url(d.holder, 'neutral', 96)}" alt="">
      <p>Долг держит <b>${debtHolderName()}</b>. ${n ? `Осталось выплатить <b>${debtLeft()}</b> ден.` : 'Долг закрыт.'} Выплачено: ${d.paid} ден.</p>
      ${rows ? `<table class="debt-plan"><caption>Ближайшие платежи</caption>${rows}</table>` : ''}
      <p class="small muted">Платёж списывается сам в день срока. Если денег не хватит — лудус отберут.</p>`,
    ok: 'Понятно', cancel: false,
  });
}

// Итог проигрыша: кредитор забирает лудус
function showDebtLost() {
  const L = STATE.lost || {}, holder = L.holder || 'lender';
  $('#modal').innerHTML = `<div class="modal-bg"><div class="modal lostdebt">
    <img class="debt-face" src="${PORTRAIT.url(holder, 'pleased', 120)}" alt="">
    <h2>Лудус отобран</h2>
    <p>${holder === 'rival' ? 'Гней Вар' : 'Лукрион'} забирает школу за долги отца: на ${L.day}-й день на платёж ${L.amount || 0} ден. не хватило ${L.short || 0}.</p>
    <p class="muted">Дней прожито: ${STATE.day}. Бойцов в казарме: ${STATE.gladiators.length}. Павших: ${fallenCount()}. Выплачено по долгу: ${STATE.debt ? STATE.debt.paid : 0} ден.</p>
    <div class="center"><button class="primary" data-act="newGameAsk">Новая игра</button> <button data-act="saveAsk">Загрузить сохранение</button></div>
  </div></div>`;
}

function debtToast(r) {
  const holder = debtHolderName();
  if (r.type === 'warn') toast(`Через ${r.daysLeft} ${r.daysLeft === 1 ? 'день' : 'дня'} платёж по долгу: ${r.amount} ден. (${holder}).`, STATE.gold - upkeepCost() * r.daysLeft < r.amount);
  if (r.type === 'paid') toast(`<img class="toast-face" src="${PORTRAIT.url(STATE.debt.holder, 'pleased', 28)}" alt="">Платёж ${r.amount} ден. внесён. Осталось ${r.left}.`);
  if (r.type === 'cleared') toast('Последний платёж внесён — долг отца уплачен!');
}

// История: отметить выполненные задачи, сообщить о новых, показать накопившиеся сцены
function storyTick() {
  if (!STATE || !STATE.story || typeof STORY === 'undefined') return;
  STORY.update();
  for (const n of STORY.takeNews()) toast(n.type === 'done' ? `Задача выполнена: ${n.text}` : `Новая задача: ${n.text}`);
  save();
  render();
  flushScenes();
}

// Конец дня: содержание, платёж по долгу, сцены истории
function endDay() {
  const { cost, debt, bet } = nextDay();
  UI.eventId = null; UI.picked = [];
  toast(`День ${STATE.day}. Содержание бойцов: −${cost} ден.`, STATE.gold < 0);
  if (bet) toast(bet);
  if (STATE.gold < 0 && !STATE.lost) toast('Казна ушла в минус! Покупки недоступны, пока денарии не вернутся.', true);
  if (debt) debtToast(debt);
  if (debt && debt.type === 'cleared') track('debtCleared');
  if (STATE.story && debt) STORY.onDebt(debt);
  render();
  if (STATE.lost) { flushScenes(() => showDebtLost()); return; }
  storyTick();
  checkGameOver();
}

// Значки шапки (рисуются линией, цвет — от текста)
const ICON = {
  crest: '<svg class="crest" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 40L35 10M39 40L13 10"/><path d="M31 9l6-1-1 6M17 9l-6-1 1 6"/><path d="M15 36l-4 4M33 36l4 4"/><path d="M17 30c0-9 3-14 7-14s7 5 7 14l-2 5h-10z" fill="currentColor" fill-opacity=".25"/><path d="M24 16v-5M20 12c1-3 7-3 8 0"/><path d="M21 26h6"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="1.5 1.5"/><path d="M10 9.5h3.2a1.6 1.6 0 010 3.2H10v-3.2zm0 3.2h3.6a1.6 1.6 0 010 3.2H10z"/></svg>',
  laurel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 21c-5-2-8-6-8-12M12 21c5-2 8-6 8-12"/><path d="M5 9c1 1 2 1 3 0-1-1-2-1-3 0zM4.5 13c1 .8 2.2.8 3-.2-1-.8-2.2-.8-3 .2zM6 16.8c1 .5 2.2.3 2.8-.7-1-.5-2.2-.3-2.8.7zM19 9c-1 1-2 1-3 0 1-1 2-1 3 0zM19.5 13c-1 .8-2.2.8-3-.2 1-.8 2.2-.8 3 .2zM18 16.8c-1 .5-2.2.3-2.8-.7 1-.5 2.2-.3 2.8.7z" fill="currentColor"/></svg>',
  helm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 18c0-8 3-12 7-12s7 4 7 12l-3 1v-4h-8v4z"/><path d="M12 6V3M9 4c1-1.5 5-1.5 6 0"/><path d="M9 12h6"/></svg>',
  tablet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="1.5"/><rect x="7" y="7" width="10" height="10" fill="currentColor" fill-opacity=".2"/><path d="M9 10h6M9 13h4" stroke-linecap="round"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
};

const soundBtn = () => {
  if (typeof SFX === 'undefined') return '';
  const on = !SFX.muted, mus = !SFX.musicMuted;
  return `<button class="small sound ${on ? '' : 'off'}" data-act="toggleSound" title="Все звуки ${on ? 'включены' : 'выключены'}">${on ? 'Звук: вкл' : 'Звук: выкл'}</button>`
    + `<button class="small sound ${mus && on ? '' : 'off'}" data-act="toggleMusic" title="Фоновая музыка ${mus ? 'включена' : 'выключена'}">${mus ? 'Музыка: вкл' : 'Музыка: выкл'}</button>`;
};
const music = track => { if (typeof SFX !== 'undefined' && SFX.music) SFX.music(track); };

function renderNav() {
  const pts = STATE.gladiators.filter(g => g.freeAttr > 0 || (g.cls && g.freeSpec > 0) || (!g.cls && g.level >= SCHOOL_LEVEL)).length;
  const evs = STATE.events.filter(e => !e.done).length + (finalUnlocked() ? 1 : 0);
  const cons = (STATE.contracts || []).filter(e => !e.done).length;
  const meta = typeof META !== 'undefined';
  const tabs = [
    ['ludus', 'Лудус', pts], ['arena', 'Арена', evs], ...(meta ? [['contracts', 'Заказы', cons]] : []), ['smith', 'Кузнец'],
    ...(rareShopOpen() ? [['bazaar', 'Лавка редкостей']] : []), ['market', 'Невольничий рынок'],
    ['armory', 'Склад', STATE.armory.length], ...(meta ? [['glory', 'Достижения']] : []), ['necro', 'Некрополь'], ['rules', 'Справочник'],
  ];
  $('nav').innerHTML = tabs.map(([k, n, b]) =>
    `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('');
}

// ------------------------------------------------------------
//  Лудус
// ------------------------------------------------------------
function gladCard(g, opts = {}) {
  const C = clsOf(g);
  const s = computeStats(g);
  const st = gladiatorStatus(g);
  const pts = g.freeAttr || (g.cls && g.freeSpec);
  // флажок «Выберите школу» — только когда выбор действительно доступен
  const flag = !g.cls && g.level >= SCHOOL_LEVEL ? '<span class="flag school">Выберите школу</span>' : pts ? '<span class="flag">Есть очки</span>' : '';
  return `
  <div class="gcard ${opts.sel ? 'sel' : ''} ${opts.disabled ? 'disabled' : ''}" data-act="${opts.act || 'openGlad'}" data-id="${g.id}">
    ${!opts.noFlag ? flag : ''}
    <img class="portrait" src="${portrait(g, 64, 80, { bust: true })}" alt="">
    <div>
      <div class="gname">${esc(g.name)}</div>
      <div class="gsub">${C.name} · ур. ${g.level} · ${esc(g.origin)}</div>
      <div style="margin-top:4px"><span class="st ${st.key}">${st.text}</span></div>
    </div>
    <div class="gbody">
      <div class="bar" title="Опыт ${g.xp}/${xpToNext(g.level)}"><div style="width:${g.level >= MAX_LEVEL ? 100 : g.xp / xpToNext(g.level) * 100}%"></div></div>
      <div class="kv">
        <span>Здоровье <b>${s.maxHp}</b></span><span>Урон <b>${s.dmgMin}–${s.dmgMax}</b></span><span>Броня <b>${s.armor}</b></span>
        <span>Победы <b>${g.record.wins}</b></span><span>Поражения <b>${g.record.losses}</b></span><span>Убийства <b>${g.record.kills}</b></span><span>Слава <b>${g.fame}</b></span>
      </div>
    </div>
  </div>`;
}

function screenLudus() {
  const list = STATE.gladiators.length
    ? `<div class="grid">${STATE.gladiators.map(g => gladCard(g)).join('')}</div>`
    : '<p class="empty-note">В казармах пусто. Купите бойцов на невольничьем рынке.</p>';
  return `
  <div class="screen-title"><h2>Казармы</h2><p>Нажмите на бойца, чтобы распределить очки, сменить снаряжение или тренировать его.</p></div>
  <div class="two-col">
    <div>${list}</div>
    <div class="panel"><h3>Хроника лудуса</h3>
      <div class="journal">${STATE.journal.map(j => `<p><span class="d">День ${j.day}</span>${j.text}</p>`).join('')}</div>
    </div>
  </div>`;
}

// ------------------------------------------------------------
//  Модальное окно гладиатора
// ------------------------------------------------------------
function renderModal() {
  const host = $('#modal');
  const g = UI.gladId && glad(UI.gladId);
  if (!g) { host.innerHTML = ''; UI.gladId = null; return; }
  const scroll = host.querySelector('.modal-bg')?.scrollTop || 0;
  const colScroll = [...host.querySelectorAll('.gscroll, .stashbox')].map(el => el.scrollTop);
  const C = clsOf(g);
  const s = computeStats(g);
  const st = gladiatorStatus(g);

  const attrs = ATTR_KEYS.map(k => {
    const bonus = s.attrs[k] - g.attrs[k];
    return `<div class="attr">
      <span class="an" data-tip="${tipAttrHtml(tipAttr[k]())}">${ATTRS[k].name}</span>
      <span class="av">${g.attrs[k]}${bonus ? ` <small>+${bonus}</small>` : ''}</span>
      ${g.freeAttr > 0 ? `<button class="plus" data-act="addAttr" data-k="${k}">+</button>` : '<span></span>'}
    </div>`;
  }).join('');

  const derived = [
    ['Здоровье', s.maxHp, 'hp'], ['Урон', `${s.dmgMin}–${s.dmgMax}${s.dmgMult !== 1 ? ` ×${s.dmgMult.toFixed(2)}` : ''}`, 'dmg'],
    ['Точность', `${s.acc >= 0 ? '+' : ''}${s.acc}%`, 'acc'], ['Уклонение', `${s.dodge}%`, 'dodge'], ['Броня', `${s.armor}`, 'armor'],
    ['Шанс крита', `${s.crit}% · ×${s.critMult.toFixed(2)}`, 'crit'], ['Блок щитом', `${s.block}%`, 'block'],
    ['Инициатива', `${s.init} · шагов ${s.move}`, 'init'], ['Дальность', `${s.reach} кл.`, 'reach'], ['Сопротивление', `${Math.min(100, s.resist)}%`, 'resist'],
  ];
  if (s.stun) derived.push(['Оглушение при ударе', `${s.stun}%`, 'stun']);
  if (s.mercy) derived.push(['Милость толпы', `+${s.mercy}%`, 'mercy']);
  if (g.cls) derived.push(['Школьная выучка', s.fits ? `<span class="q2">${s.fits} ${plural(s.fits, 'предмет', 'предмета', 'предметов')}</span>` : '<span class="muted">нет</span>', 'fits']);
  const hitTable = `<div class="tiny muted mt"><span class="tiplink">Наведите на название характеристики, чтобы узнать, что она даёт.</span> <a href="#" data-act="openGuide" data-ch="stats">Все формулы — в справочнике</a></div>`;

  // «кукла»: фигура бойца и слоты снаряжения вокруг неё
  const sel = UI.slotSel && SLOTS[UI.slotSel] ? UI.slotSel : null;
  const tile = slot => {
    const it = g.equip[slot];
    const lock = slot === 'offhand' && !it && s.twoHanded && !s.ranged;
    const n = STATE.armory.filter(i => i.slot === slot).length;
    if (!it) return `<div class="dslot empty ${sel === slot ? 'on' : ''}" data-act="slotSel" data-slot="${slot}" data-drop="slot" data-tip="${lock ? 'Обе руки заняты двуручным оружием' : `${SLOTS[slot]}: пусто. Перетащите сюда вещь со склада или нажмите, чтобы отобрать подходящие.`}">
      <div class="dph">${SLOT_GLYPH[slot]}</div><div class="dtx"><label>${SLOTS[slot]}</label><span class="muted">${lock ? 'двуручное оружие' : 'пусто'}</span>${n ? `<span class="dcount">на складе: ${n}</span>` : ''}</div></div>`;
    const B = ITEM_BASES[it.base];
    const tipTxt = `${it.name} — ${B.artifact ? 'реликвия' : B.rare ? 'редкость' : QUALITIES[it.q].name.toLowerCase()}\n${itemStatsText(it, g.cls)}${itemFits(it, g.cls) ? '\nШкольная выучка: +25%' : ''}\nДля школ: ${B.classes.map(c => CLASSES[c].name).join(', ')}`;
    return `<div class="dslot ${QUALITIES[it.q].cls} ${B.artifact ? 'relic' : B.rare ? 'rare' : ''} ${sel === slot ? 'on' : ''}" data-act="slotSel" data-slot="${slot}" data-drag="eq" data-drop="slot" data-tip="${tipAttrHtml(`${tipTxt}\nПеретащите на склад, чтобы снять`)}">
      <img src="${itemIcon(it, 52)}" alt=""><div class="dtx"><label>${SLOTS[slot]}</label><span class="iname ${QUALITIES[it.q].cls}">${esc(it.name)}</span>${itemFits(it, g.cls) ? '<span class="fitbadge">школа</span>' : ''}</div>
      <button class="dx" data-act="unequip" data-slot="${slot}" title="Снять">✕</button></div>`;
  };
  const doll = `<div class="doll">
    <div class="dcol">${['helmet', 'armor', 'arms', 'belt'].map(tile).join('')}</div>
    <div class="dfig" data-drop="fig"><canvas id="glPreview" width="230" height="310"></canvas>
      <div class="pv-btns">
        <button class="small" data-act="pvPlay" data-clips="attack">Удар</button>
        ${C.ability ? `<button class="small" data-act="pvPlay" data-clips="ability">${C.ability.name}</button>` : ''}
        <button class="small" data-act="pvPlay" data-clips="block">Защита</button>
        <button class="small" data-act="pvPlay" data-clips="dodge">Уклонение</button>
        <button class="small" data-act="pvPlay" data-clips="salute">Салют</button>
      </div></div>
    <div class="dcol">${['weapon', 'offhand', 'legs'].map(tile).join('')}</div>
  </div>`;

  const stash = STATE.armory.filter(i => !sel || i.slot === sel)
    .sort((a, b) => SLOT_KEYS.indexOf(a.slot) - SLOT_KEYS.indexOf(b.slot) || itemFits(b, g.cls) - itemFits(a, g.cls) || b.q - a.q);
  const stashHtml = stash.length
    ? `<div class="stashgrid">${stash.map(it => itemRow(it, `<button class="small" data-act="equip" data-item="${it.id}">Надеть</button>`, true, g, false, `data-drag="st" data-item="${it.id}" data-slot="${it.slot}"`)).join('')}</div>`
    : `<p class="empty-note small">${sel ? `На складе нет вещей для слота «${SLOTS[sel]}».` : 'Склад пуст.'} Снаряжение можно купить у кузнеца или снять с поверженных врагов.</p>`;
  const ab = C.ability;

  host.innerHTML = `
  <div class="modal-bg" data-act="closeModalBg">
    <div class="modal glad">
      <button class="close" data-act="closeModal">✕</button>
      ${STATE.gladiators.length > 1 ? `<div class="glad-nav">
        <button class="small" data-act="gladStep" data-d="-1" title="Предыдущий боец (←)" aria-label="Предыдущий боец">‹</button>
        <span class="tiny muted">${STATE.gladiators.indexOf(g) + 1} / ${STATE.gladiators.length}</span>
        <button class="small" data-act="gladStep" data-d="1" title="Следующий боец (→)" aria-label="Следующий боец">›</button></div>` : ''}
      <div class="ghead">
        <img class="portrait" src="${portrait(g, 64, 80, { bust: true })}" alt="">
        <div>
          <h2>${esc(g.name)}</h2>
          <div class="muted">${C.name} (${C.latin}) · уровень ${g.level} · ${esc(g.origin)} · <span class="st ${st.key}">${st.text}</span></div>
          <div class="small muted" style="margin-top:4px;max-width:520px">${C.desc}</div>
          <div style="margin-top:6px;width:260px" title="Опыт"><div class="bar"><div style="width:${g.level >= MAX_LEVEL ? 100 : g.xp / xpToNext(g.level) * 100}%"></div></div>
          <span class="tiny muted">Опыт: ${g.xp} / ${xpToNext(g.level)}</span></div>
        </div>
        <div class="actions">
          <button data-act="train" ${!canTrain(g) ? 'disabled' : ''} title="Один раз в день, +${trainXp(g)} опыта">Тренировать (${trainCost(g)})</button>
          ${g.wounded ? `<button data-act="heal" ${STATE.gold < healCost(g) ? 'disabled' : ''}>Лекарь (${healCost(g)})</button>` : ''}
          <button data-act="rename">Имя</button>
          <button class="danger" data-act="dismiss">Продать (${sellGladPrice(g)})</button>
        </div>
      </div>
      <div class="gmain">
        <div class="gcolA">
          <div class="panel"><h3>Снаряжение</h3>${doll}</div>
          <div class="panel stash" data-drop="stash"><h3>Склад лудуса${sel ? `: ${SLOTS[sel].toLowerCase()} <button class="small" data-act="slotSel" data-slot="">Все слоты</button>` : ' <span class="muted small">перетащите вещь на бойца или нажмите на слот, чтобы отобрать подходящие</span>'}</h3><div class="stashbox">${stashHtml}</div></div>
        </div>
        <div class="panel gscroll attrs-panel"><h3>Характеристики</h3>
          ${g.freeAttr ? `<div class="points">Свободных очков: ${g.freeAttr}</div>` : ''}
          ${attrs}
          <div class="derived">${derived.map(([a, b, k]) => `<span data-tip="${tipAttrHtml(tipStat[k](s))}">${a}</span><span>${b}</span>`).join('')}</div>
          ${hitTable}
          <div class="kv" style="margin-top:12px">
            <span>Бои <b>${g.record.fights}</b></span><span>Победы <b>${g.record.wins}</b></span><span>Убийства <b>${g.record.kills}</b></span>
            <span>Помилован <b>${g.record.spared}</b></span><span>Слава <b>${g.fame}</b></span>
          </div>
        </div>
        <div class="panel gscroll school-panel">${g.cls ? `<h3>Специализация: ${C.name}</h3>${specTree(g)}` : `<h3>Выбор школы</h3>${schoolPicker(g)}`}</div>
      </div>
    </div>
  </div>`;
  host.querySelector('.modal-bg').scrollTop = scroll;
  host.querySelectorAll('.gscroll, .stashbox').forEach((el, i) => { el.scrollTop = colScroll[i] || 0; });
  UI.preview = new FigurePreview($('#glPreview'), g);
}

// Строка предмета. g — боец, для которого показывается выучка (если задан)
function itemRow(it, actionHtml = '', showSlot = false, g = null, showDesc = false, attrs = '') {
  const B = ITEM_BASES[it.base];
  const fit = g && itemFits(it, g.cls);
  const qname = B.artifact ? '<span class="relic">Реликвия</span>' : B.rare ? '<span class="rarity">Редкость</span>' : QUALITIES[it.q].name;
  const who = B.classes.map(c => `<span class="${g && g.cls === c ? 'fitname' : ''}">${CLASSES[c].name}</span>`).join(', ');
  const notes = [B.twoHanded ? (B.ranged ? 'двуручное, стрелковое' : 'двуручное') : '', B.needsBow ? 'только с луком' : ''].filter(Boolean).join(', ');
  return `<div class="item ${QUALITIES[it.q].cls} ${fit ? 'fit' : ''} ${B.artifact ? 'relic' : ''} ${B.rare ? 'rare' : ''}" ${B.desc && !showDesc ? `data-tip="${tipAttrHtml(B.desc)}"` : ''} ${attrs}>
    <img class="iicon" src="${itemIcon(it, 52)}" alt="">
    <div class="ibody"><div class="iname ${QUALITIES[it.q].cls}">${esc(it.name)}${fit ? ' <span class="fitbadge" title="Подходит школе бойца: +25% к характеристикам предмета">школа</span>' : ''}</div>
      <div class="istats">${showSlot ? `${SLOTS[it.slot]} · ` : ''}${qname}${notes ? ` · ${notes}` : ''}. ${itemStatsText(it)}</div>
      ${fit ? `<div class="istats fitline">С выучкой: ${itemStatsText(it, g.cls)}</div>` : ''}
      <div class="ifor">Для школ: ${who}</div>${showDesc && B.desc ? `<div class="idesc">${esc(B.desc)}</div>` : ''}</div>
    <div class="iside">${actionHtml}</div>
  </div>`;
}

// Выбор школы для новобранца
function schoolPicker(g) {
  const ranked = CLASS_KEYS.map(c => ({ c, a: classAptitude(g, c) })).sort((x, y) => y.a - x.a);
  const open = g.level >= SCHOOL_LEVEL;
  const cards = ranked.map(({ c, a }) => {
    const C = CLASSES[c];
    const kit = Object.values(C.start).filter(Boolean).map(b => ITEM_BASES[b].name).join(', ');
    return `<div class="school ${open ? '' : 'locked'}">
      <div class="sh">${emblem(c)}<div><b>${C.name}</b> <span class="muted tiny">${C.latin}</span><div class="apt" title="Насколько характеристики бойца подходят школе">${stars(a)}</div></div>
        ${open ? `<button class="small primary" data-act="chooseClass" data-cls="${c}">Посвятить</button>` : ''}</div>
      <div class="small">${C.desc}</div>
      <div class="tiny"><b>${C.ability.name}:</b> ${C.ability.desc}</div>
      <div class="tiny muted">Снаряжение школы (покупается у кузнеца): ${kit}</div>
    </div>`;
  }).join('');
  return `<p class="small">${TIRO.desc}</p>
    ${open ? '' : `<div class="points">Школу можно выбрать с ${SCHOOL_LEVEL}-го уровня (сейчас ${g.level}-й). Пока боец сражается тем оружием, что у него есть.</div>`}
    <p class="small muted">Звёзды показывают, насколько нынешние характеристики бойца подходят школе — распределяйте очки с прицелом на будущую школу. Накоплено очков специализации: <b>${g.freeSpec}</b> — их можно будет вложить сразу после выбора. Снаряжение школа не даёт: его нужно купить или добыть.</p>
    <div class="schools">${cards}</div>`;
}

function specTree(g) {
  const C = clsOf(g);
  const A = C.ability;
  let html = `<div class="ability"><h4>Умение: ${A.name}</h4><div class="small">${A.desc}</div><div class="tiny muted">Перезарядка: ${A.cd} хода</div></div>`;
  html += g.freeSpec ? `<div class="points">Очков специализации: ${g.freeSpec}</div>` : '<div class="points muted">Очки специализации: 0 (1 за каждый уровень начиная с 5-го)</div>';
  for (const tier of [1, 2, 3, 4]) {
    const perks = C.perks.filter(p => p.tier === tier);
    const locked = g.level < TIER_LEVEL[tier];
    html += `<div class="tier ${tier === 4 ? 'cap' : ''} ${locked ? 'locked' : ''}">
      <div class="tl"><b>${['I', 'II', 'III', 'IV'][tier - 1]}</b>ур. ${TIER_LEVEL[tier]}</div>
      ${perks.map(p => perkBox(g, p, locked)).join('')}
    </div>`;
  }
  html += `<div class="mt"><button class="small" data-act="respec" ${Object.keys(g.perks).length ? '' : 'disabled'}>Сбросить специализацию (${respecCost(g)})</button>
    <button class="small" data-act="changeClass">Сменить школу (${changeClassCost(g)})</button></div>`;
  return html;
}

function perkBox(g, p, locked) {
  const r = perkRank(g, p.id);
  const at = i => ({ v: p.v[i], v2: p.v2 ? p.v2[i] : 0 });
  const pips = Array.from({ length: p.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('');
  const can = canLearnPerk(g, { ...p, cls: g.cls });
  const cur = r ? p.desc(at(r - 1)) : p.desc(at(0));
  const next = r && r < p.max ? `<div class="pn2">Ранг ${r + 1}: ${p.desc(at(r))}</div>` : '';
  return `<div class="perk ${r ? 'has' : ''} ${r === p.max ? 'maxed' : ''}">
    <div class="ph"><span class="pn">${p.name}</span><span class="pips">${pips}</span>
      ${can && !locked ? `<button class="plus" data-act="learn" data-perk="${p.id}">+</button>` : ''}</div>
    <div class="pd">${r ? '' : '<span class="muted">Ранг 1: </span>'}${cur}</div>${next}
  </div>`;
}

const trainXp = g => 25 + g.level * 6;
const canTrain = g => !g.trainedToday && !g.wounded && g.level < MAX_LEVEL && STATE.gold >= trainCost(g);
const sellGladPrice = g => Math.round(recruitPrice(g) * 0.35);
const respecCost = g => 20 * g.level;
const changeClassCost = g => 40 * g.level;

// ------------------------------------------------------------
//  Арена
// ------------------------------------------------------------
function screenArena() {
  const tiers = TIERS.map((T, i) => ({ T, i }));
  let html = `<div class="screen-title"><h2>Арена</h2><p>Каждый боец может выйти на песок один раз в день. Раненые не сражаются.</p></div>`;
  html += betPanel();
  html += finalCard();
  for (const { T, i } of tiers) {
    if (!tierOpen(i)) {
      html += `<div class="locked-tier mt">${T.name} (${T.place}). ${STATE.story ? STORY.lockText(i) : `Откроется при славе лудуса ${T.fameReq}.`}</div>`;
      continue;
    }
    const evs = STATE.events.filter(e => e.tier === i);
    if (!evs.length) continue;
    html += `<h3 class="mt" style="color:var(--bronze);font-size:20px">${T.name} <span class="muted small" style="font-family:var(--font-body)">· ${T.place} · ${T.mood}</span></h3>
      <div class="grid mt" style="margin-top:8px">${evs.map(eventCard).join('')}</div>`;
  }
  html += eventPicker('arena') + eventPicker('final');
  return html;
}

// ------------------------------------------------------------
//  Ставки на бой дня
// ------------------------------------------------------------
const pct = p => `${Math.round(p * 100)}%`;
const xOdds = k => `×${k.toFixed(2)}`;
function betAmount() {
  const top = Math.min(betMax(), Math.floor(STATE.gold / BET_STEP) * BET_STEP);
  UI.betAmt = clamp(UI.betAmt || BET_MIN, BET_MIN, Math.max(BET_MIN, top));
  return { amt: UI.betAmt, top };
}

function betPanel() {
  if (typeof ensureBet !== 'function') return '';
  const bet = ensureBet(), F = [bet.a, bet.b];
  const open = !bet.done && bet.pick === null;
  const { amt, top } = betAmount();
  const canBet = open && top >= BET_MIN;
  const side = i => {
    const g = F[i], s = computeStats(g), fav = bet.p[i] > bet.p[1 - i];
    return `<div class="bet-side ${bet.pick === i ? 'picked' : ''} ${bet.done && bet.winner === i ? 'won' : ''}">
      <img class="portrait" src="${portrait(g, 64, 80, { bust: true, enemy: i === 1 })}" alt="">
      <div class="bet-who">
        <b>${esc(g.name)}</b> <span class="muted small">${clsOf(g).name}, ур. ${g.level}</span>
        <div class="tiny muted">Здоровье ${s.maxHp} · урон ${s.dmgMin}–${s.dmgMax} · броня ${s.armor} · уклонение ${s.dodge}%</div>
        <div class="bet-odds"><span class="bet-pct ${fav ? 'fav' : ''}">${pct(bet.p[i])}</span><span>коэффициент <b>${xOdds(bet.odds[i])}</b></span></div>
        <div class="bet-btns">
          <button class="small" data-act="betInspect" data-i="${i}">Подробнее</button>
          ${canBet ? `<button class="small primary" data-act="betPlace" data-i="${i}">Поставить ${amt} → ${Math.round(amt * bet.odds[i])}</button>` : ''}
          ${bet.pick === i ? `<span class="bet-tag">ваша ставка ${bet.stake}</span>` : ''}
          ${bet.done && bet.winner === i ? '<span class="bet-tag won">победитель</span>' : ''}
        </div>
      </div>
    </div>`;
  };
  let foot;
  if (bet.done) {
    const w = F[bet.winner];
    foot = `<p class="small">${bet.pick === null ? `Победил ${esc(w.name)}. Вы смотрели без ставки.` : bet.payout ? `Победил ${esc(w.name)} — ставка сыграла: <b class="q2">+${bet.payout}</b> денариев.` : `Победил ${esc(w.name)} — ставка ${bet.stake} денариев проиграна.`} Новый бой — завтра.</p>`;
  } else if (bet.pick !== null) {
    foot = `<div class="bet-stake"><span class="small">Ваша ставка: ${bet.stake} денариев, боец — ${esc(F[bet.pick].name)} (${xOdds(bet.odds[bet.pick])}). Если он победит — <b>${Math.round(bet.stake * bet.odds[bet.pick])}</b> денариев.</span>
      <span class="sp"></span><button class="primary" data-act="betWatch">Смотреть бой</button></div>`;
  } else {
    foot = `<div class="bet-stake">
      ${top >= BET_MIN ? `<span>Ставка:</span><button class="small" data-act="betAmt" data-d="-1" ${amt <= BET_MIN ? 'disabled' : ''} aria-label="Меньше">−</button><b class="bet-amt">${amt}</b><button class="small" data-act="betAmt" data-d="1" ${amt >= top ? 'disabled' : ''} aria-label="Больше">+</button>
      <span class="muted small">от ${BET_MIN} до ${betMax()} с шагом ${BET_STEP}</span>` : `<span class="muted small">Для ставки нужно хотя бы ${BET_MIN} денариев.</span>`}
      <span class="sp"></span><button data-act="betWatch">Смотреть без ставки</button></div>`;
  }
  return `<div class="panel betpanel mt">
    <div class="eh"><h3>Бой дня: ставки</h3><span class="fmt">1 на 1</span></div>
    <p class="small muted">Устроитель игр прогнал этот бой ${BET_SIMS} раз и назначил коэффициенты по шансам бойцов, оставив себе свою долю. Одна ставка в день.</p>
    <div class="bet-sides">${side(0)}<div class="bet-vs">vs</div>${side(1)}</div>
    ${foot}
  </div>`;
}

// Карточка чужого бойца: характеристики, снаряжение, школа и навыки
function showFighterInfo(g) {
  const s = computeStats(g), C = clsOf(g);
  const attrs = ATTR_KEYS.map(k => `<span>${ATTRS[k].name}</span><b>${s.attrs[k]}</b>`).join('');
  const derived = [['Здоровье', s.maxHp], ['Урон', `${s.dmgMin}–${s.dmgMax}`], ['Точность', `${s.acc >= 0 ? '+' : ''}${s.acc}%`], ['Уклонение', `${s.dodge}%`], ['Броня', s.armor],
    ['Шанс крита', `${s.crit}%`], ['Блок щитом', `${s.block}%`], ['Инициатива', s.init], ['Дальность', `${s.reach} кл.`]]
    .map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  const items = SLOT_KEYS.map(k => g.equip[k]).filter(Boolean);
  const perks = Object.entries(g.perks || {}).filter(([id, r]) => PERKS[id] && r > 0)
    .map(([id, r]) => `<li><b>${PERKS[id].name}</b> ${r}/${PERKS[id].max}</li>`).join('');
  showDialog({
    title: esc(g.name), cls: 'fighter-info', ok: false, cancel: 'Закрыть',
    body: `<div class="fi-head"><img class="portrait" src="${portrait(g, 64, 80, { bust: true })}" alt=""><div><b>${C.name}</b>${g.cls ? ` <span class="muted tiny">${C.latin}</span>` : ''} · уровень ${g.level} · ${esc(g.origin)}
        ${C.ability ? `<div class="small"><b>${C.ability.name}:</b> ${C.ability.desc}</div>` : '<div class="small muted">Без школы: ни особого приёма, ни навыков.</div>'}</div></div>
      <div class="fi-cols">
        <div><h4>Характеристики</h4><div class="fi-kv">${attrs}</div><div class="fi-kv mt">${derived}</div></div>
        <div><h4>Снаряжение</h4>${items.length ? `<div class="list">${items.map(it => itemRow(it, '', true, g)).join('')}</div>` : '<p class="small muted">Без снаряжения.</p>'}
          ${g.cls ? `<h4 class="mt">Навыки школы</h4>${perks ? `<ul class="fi-perks small">${perks}</ul>` : '<p class="small muted">Пока ни одного.</p>'}` : ''}</div>
      </div>`,
  });
}

function startBetBattle() {
  const bet = STATE.bet;
  if (!bet || bet.done) return;
  const B = betBattle(bet);
  B.units.forEach(u => ensureLook(u.g));
  openBattle(B, B.event, [], 'auto', { bet: true });
}

async function finishBetBattle(B) {
  const b = B.b, bet = STATE.bet;
  const w = b.winner === 'player' ? 0 : 1, F = [bet.a, bet.b];
  const pay = settleBet(w);
  journal(`Бой дня: победил ${F[w].name}, повержен ${F[1 - w].name}.${bet.pick === null ? '' : pay ? ` Ставка сыграла: +${pay} денариев.` : ` Ставка ${bet.stake} денариев проиграна.`}`);
  save();
  B.phase = 'scenes';
  updateBattleHud();
  await B.view.salute(b.winner);
  if (UI.battle !== B) return;
  B.phase = 'results';
  updateBattleHud();
  const sub = bet.pick === null ? 'Вы смотрели без ставки.' : pay ? `Ставка сыграла: +${pay} денариев.` : `Ставка ${bet.stake} денариев проиграна.`;
  $('#bresults').innerHTML = `<div class="panel results center"><h2 class="${pay ? 'win' : ''}">Победил ${esc(F[w].name)}</h2><div class="sub">${sub}</div><button class="primary" data-act="bClose">Вернуться на арену</button></div>`;
}

// Финал игры: открывается при славе FINAL_FAME
function finalCard() {
  if (STATE.finalWon) return `<div class="panel finalcard won mt"><h3>Рудис свободы получен</h3><p class="small">Ваш лудус победил чемпионов Рима в Колизее (день ${STATE.finalDay}). Игра продолжается — слава не бывает лишней.</p></div>`;
  if (!finalUnlocked()) return `<div class="locked-tier mt finallock">Финал — «Игры за рудис свободы» в Колизее против трёх легендарных чемпионов — откроется ${STATE.story && STATE.story.chapter < 3 ? 'в главе IV, когда лудус попадёт на игры Императора, и ' : ''}при славе лудуса ${FINAL_FAME} (сейчас ${STATE.fame}).</div>`;
  const ev = finalEvent();
  const sel = ev.id === UI.eventId;
  return `<div class="panel event finalcard ${sel ? 'sel' : ''} ${ev.done ? 'done' : ''}" data-act="${ev.done ? '' : 'pickEvent'}" data-id="${ev.id}">
    <div class="eh"><h3>${ev.done ? 'Финал проигран — чемпионы ждут завтра' : 'Финал: Игры за рудис свободы'}</h3><span class="fmt">3 на 3</span></div>
    <p class="small">Император выставляет трёх величайших гладиаторов Рима. Победа принесёт лудусу вечную славу и завершит историю. Бой смертельный — проигравших судит толпа.</p>
    <div class="foes">${ev.enemies.map(e => `<div class="foe"><img class="portrait sm" src="${portrait(e, 44, 55, { bust: true, enemy: true })}" alt=""><span><b class="enemy">${esc(e.name)}</b><br><span class="muted small">${clsOf(e).name}, ур. ${e.level}</span></span></div>`).join('')}</div>
    <div class="reward"><span>Награда <b>${ev.gold}</b> ден.</span><span>Слава <b>+${ev.fame}</b></span></div>
  </div>`;
}

function eventCard(ev) {
  const sel = ev.id === UI.eventId;
  const title = ev.done ? 'Бой окончен' : ev.boss ? esc(ev.title) : ev.training ? 'Учебный бой' : 'Поединок';
  return `<div class="panel event ${ev.boss ? 'boss' : ''} ${ev.training ? 'training' : ''} ${sel ? 'sel' : ''} ${ev.done ? 'done' : ''}" data-act="${ev.done ? '' : 'pickEvent'}" data-id="${ev.id}">
    <div class="eh"><h3>${title}</h3><span class="fmt">${ev.size} на ${ev.size}</span></div>
    ${ev.training ? '<div class="small ev-note">Без смертей · ручное управление · наставник подскажет</div>' : ''}
    ${ev.boss && !ev.done ? '<div class="small ev-note">Победа откроет следующую арену. Проигранный бой можно повторить завтра.</div>' : ''}
    <div class="foes">${ev.enemies.map(e => `<div class="foe"><img class="portrait sm" src="${portrait(e, 44, 55, { bust: true, enemy: true })}" alt=""><span><b class="enemy">${esc(e.name)}</b><br><span class="muted small">${clsOf(e).name}, ур. ${e.level}</span></span></div>`).join('')}</div>
    <div class="reward"><span>Награда <b>${ev.gold}</b> ден.</span><span>Слава <b>+${ev.fame}</b></span></div>
  </div>`;
}
const emblemMini = cls => `<svg viewBox="0 0 48 48" width="16" height="16" style="vertical-align:-3px;color:#c96b5e" fill="none" stroke="currentColor" stroke-width="3">${EMBLEMS[cls]}</svg>`;

function picker(ev) {
  const T = TIERS[clamp(ev.tier || 0, 0, 3)];
  const n = playerCount(ev);
  const avgLvl = ev.enemies.reduce((s, e) => s + e.level, 0) / ev.enemies.length;
  const cards = STATE.gladiators.map(g => gladCard(g, {
    act: canFight(g) ? 'pickGlad' : '', sel: UI.picked.includes(g.id), disabled: !canFight(g), noFlag: true,
  })).join('');
  const ready = UI.picked.length === n;
  const mode = battleMode();
  const note = ev.kind === 'contract'
    ? 'Бой не на смерть: выбывший боец просто сдаётся и отлёживается день. Приговора толпы не будет.'
    : `Помните: если ваша команда проиграет, толпа решит судьбу каждого бойца. Тот, кто успел повергнуть противника, имеет куда больше шансов на помилование. ${T.mood}`;
  return `<div class="panel picker">
    <h3>Выбор бойцов: ${n} на ${ev.size} · ${ev.kind === 'contract' ? esc(ev.title) : ev.kind === 'final' ? 'Финал' : T.name} (противники ~${avgLvl.toFixed(0)} ур.)</h3>
    <p class="small muted">${note}</p>
    <div class="grid">${cards || '<p class="empty-note">Нет бойцов.</p>'}</div>
    ${ev.training ? '<div class="modesel"><span class="muted small">Учебный бой — только ручное управление: вы сами командуете бойцом.</span></div>' : `<div class="modesel">
      <span>Режим боя:</span>
      <button class="small ${mode === 'auto' ? 'active' : ''}" data-act="setMode" data-m="auto" title="Бойцы расставляются и сражаются сами">Автобой</button>
      <button class="small ${mode === 'manual' ? 'active' : ''}" data-act="setMode" data-m="manual" title="Вы расставляете бойцов и командуете каждым ходом">Ручное управление</button>
      <span class="muted small">${mode === 'manual' ? 'Вы расставите бойцов на поле и будете отдавать приказы каждому. Перейти на автобой можно в любой момент.' : 'Бойцы встанут в строй и будут сражаться сами.'}</span>
    </div>`}
    ${canGoShort(ev) ? `<label class="modesel shortsel"><input type="checkbox" data-act="pickShort" ${ev.short ? 'checked' : ''}>
      <span>Выйти меньшинством: <b>${ev.size - 1} на ${ev.size}</b></span>
      <span class="muted small">Толпа любит смельчаков: за победу — <b>${winReward({ ...ev, short: true }).gold}</b> ден. и <b>+${winReward({ ...ev, short: true }).fame}</b> славы вместо ${ev.gold} и +${ev.fame}.</span></label>` : ''}
    <div class="bar-actions">
      <span>Выбрано: <b>${UI.picked.length}/${n}</b></span>
      <button class="primary" data-act="startBattle" ${ready ? '' : 'disabled'}>Выйти на арену</button>
      <button data-act="cancelPick">Отмена</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------
//  Кузнец, рынок, склад, некрополь
// ------------------------------------------------------------
const sellItemPrice = it => Math.max(1, Math.round(it.price * 0.4));

function screenSmith() {
  const f = UI.smithFilter;
  const shown = STATE.smith.filter(it => f === 'all' || ITEM_BASES[it.base].classes.includes(f));
  const chips = [['all', 'Все'], ...CLASS_KEYS.map(c => [c, CLASSES[c].name])].map(([k, n]) =>
    `<button class="small chip ${f === k ? 'active' : ''}" data-act="smithFilter" data-f="${k}">${n}</button>`).join('');
  const goods = shown.length
    ? shown.map(it => itemRow(it, `<span class="price">${it.price}</span><button class="small" data-act="buyItem" data-item="${it.id}" ${STATE.gold < it.price ? 'disabled' : ''}>Купить</button>`, true)).join('')
    : `<p class="empty-note">${STATE.smith.length ? 'Сегодня для этой школы ничего нет.' : 'Кузнец распродал всё. Приходите завтра.'}</p>`;
  const sell = STATE.armory.length
    ? STATE.armory.map(it => itemRow(it, `<span class="price">${sellItemPrice(it)}</span><button class="small" data-act="sellItem" data-item="${it.id}">Продать</button>`, true)).join('')
    : '<p class="empty-note">На складе ничего нет.</p>';
  return `<div class="screen-title"><h2>Кузница</h2><p>Товар обновляется каждый день: оружие, щиты и доспехи для всех слотов, больше всего — для школ вашего лудуса. С открытием новых арен качество растёт.${rareShopOpen() ? '' : ` При славе лудуса ${RARE_SHOP_FAME} откроется <b>лавка редкостей</b> с уникальными изделиями.`} Характеристики предмета зависят только от его вида и качества. Надеть можно на любого бойца, но <b>+25% к характеристикам</b> предмета («школьная выучка») получит только боец указанной школы.</p></div>
  <div class="chips">${chips}</div>
  <div class="two-col smithcols">
    <div class="panel"><h3>Товары кузнеца</h3><div class="list goods">${goods}</div></div>
    <div class="panel"><h3>Продать со склада (40% цены)</h3><div class="list">${sell}</div></div>
  </div>`;
}

function screenMarket() {
  const full = STATE.gladiators.length >= MAX_GLADIATORS;
  const cards = STATE.market.map(g => {
    const s = computeStats(g);
    const apt = bestClasses(g, 3).map(x => `${CLASSES[x.c].name} <span class="apt">${stars(x.a)}</span>`).join('<br>');
    return `<div class="panel">
      <div class="gcard" style="cursor:default;border:none;padding:0;background:none"><img class="portrait" src="${portrait(g, 64, 80, { bust: true })}" alt="">
        <div><div class="gname">${esc(g.name)}</div><div class="gsub">${clsOf(g).name} · ур. ${g.level} · ${esc(g.origin)}</div></div></div>
      <div class="kv">${ATTR_KEYS.map(k => `<span>${ATTRS[k].short} <b>${g.attrs[k]}</b></span>`).join('')}</div>
      <div class="kv"><span>Здоровье <b>${s.maxHp}</b></span><span>Очки специализации <b>${g.freeSpec}</b></span></div>
      <div class="small mt" style="margin-top:6px"><span class="muted">Лучше всего подойдёт:</span><br>${apt}</div>
      <div class="bar-actions" style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
        <span class="price">${g.price} ден.</span>
        <button class="primary" data-act="buyGlad" data-id="${g.id}" ${full || STATE.gold < g.price ? 'disabled' : ''}>Купить</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="screen-title"><h2>Невольничий рынок</h2><p>Новые рабы привозятся каждый день — без школы и без снаряжения. Школу вы выберете сами в лудусе, когда боец достигнет ${SCHOOL_LEVEL}-го уровня; снаряжение покупается у кузнеца. В лудусе может быть не больше ${MAX_GLADIATORS} бойцов${full ? ' — казармы заполнены' : ''}.</p></div>
    <div class="grid">${cards || '<p class="empty-note">Сегодня торговцы пусты.</p>'}</div>`;
}

function screenArmory() {
  const bySlot = Object.entries(SLOTS).map(([slot, label]) => {
    const items = STATE.armory.filter(i => i.slot === slot).sort((a, b) => b.q - a.q);
    return `<div class="panel"><h3>${label}</h3><div class="list">${items.length ? items.map(it => itemRow(it, `<span class="price">${sellItemPrice(it)}</span><button class="small" data-act="sellItem" data-item="${it.id}">Продать</button>`)).join('') : '<p class="empty-note small">Пусто</p>'}</div></div>`;
  }).join('');
  return `<div class="screen-title"><h2>Склад</h2><p>Здесь хранится снаряжение, снятое с бойцов, купленное у кузнеца или взятое с поверженных врагов. Надеть предмет можно в окне гладиатора.</p></div>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(420px,1fr))">${bySlot}</div>`;
}

function screenNecro() {
  const graves = STATE.graveyard.slice().reverse().map(d => `
    <div class="tomb ${d.freed ? 'freed' : ''}">
      <img class="portrait" style="margin:0 auto 8px;display:block" src="${portrait({ id: 'grave' + d.day + d.name, cls: d.cls, look: d.look, attrs: d.attrs || clsOf(d).base, equip: d.equip || {} }, 64, 80, { gray: !d.freed })}" alt="">
      <h3>${esc(d.name)}</h3>
      <div class="small muted">${clsOf(d).name} · ур. ${d.level} · ${esc(d.origin)}</div>
      <div class="kv" style="justify-content:center"><span>Бои <b>${d.record.fights}</b></span><span>Победы <b>${d.record.wins}</b></span><span>Убийства <b>${d.record.kills}</b></span></div>
      ${d.freed ? `<div class="epi">Отпущен на волю в день ${d.day}, ${esc(d.place)}. Получил рудис из рук ланисты.</div>` : `<div class="epi">Пал в день ${d.day}, ${esc(d.place)}. ${d.killer ? `Добил: ${esc(d.killer)}.` : ''} ${d.kills ? `В последнем бою поверг ${d.kills} ${plural(d.kills, 'противника', 'противников', 'противников')}, но толпа не пощадила.` : 'Толпа опустила палец.'}</div>`}
    </div>`).join('');
  return `<div class="screen-title"><h2>Некрополь</h2><p>${STATE.graveyard.some(d => d.freed) ? 'Здесь покоятся павшие и вспоминают отпущенных на волю.' : 'Здесь покоятся бойцы вашего лудуса.'}</p></div>
    ${graves ? `<div class="grid">${graves}</div>` : '<p class="empty-note">Пока ни один ваш боец не пал. Пусть так и останется.</p>'}`;
}

// ------------------------------------------------------------
//  Подсказки к характеристикам (всплывают при наведении)
// ------------------------------------------------------------
const tipAttr = {
  str: () => 'Сила.\nУрон оружием: +1.2 к урону за очко (у лука +0.8).\nЧуть крепче мускулатура на фигуре.',
  agi: () => 'Ловкость.\nУклонение: +1.5% за очко — по бойцу труднее попасть.\nИнициатива: +1 за очко — раньше ходит и дальше шагает по полю.',
  end: () => 'Выносливость.\nЗдоровье: +7 за очко.',
  skl: () => 'Мастерство.\nТочность: +1.5% за очко.\nШанс крита: +0.8% за очко.',
  wil: () => 'Воля.\nСопротивление сети и оглушению: +3% за очко.\nМилость толпы: +1.5% к шансу помилования за очко.',
};
// s — итоговые характеристики бойца
const tipStat = {
  hp: s => `Здоровье — сколько урона боец выдержит, прежде чем упадёт.\n30 + 7 × Выносливость + снаряжение (пояса, шлемы, доспехи) и навыки.`,
  dmg: s => `Урон одного удара до брони цели: случайное число из диапазона.\nУрон оружия + ${s.ranged ? '0.8' : '1.2'} × Сила.${s.dmgMult !== 1 ? `\nМножитель ×${s.dmgMult.toFixed(2)} — от навыков.` : ''}\nКрит умножает урон, броня цели — снижает.`,
  acc: s => `Точность прибавляется к шансу попасть.\nШанс попадания = 72% + точность − уклонение цели (от 10% до 97%).\nПо цели с уклонением 0 / 10 / 20 / 30%: ${[0, 10, 20, 30].map(v => hitChanceOf(s.acc, v) + '%').join(' / ')}.\nРастёт от Мастерства (+1.5 за очко), оружия и навыков.`,
  dodge: s => `Уклонение вычитается из шанса попасть по бойцу.\nВраг с точностью 0 / 10 / 20 / 30% попадёт: ${[0, 10, 20, 30].map(v => hitChanceOf(v, s.dodge) + '%').join(' / ')}.\nРастёт от Ловкости (+1.5 за очко). Тяжёлые щиты и доспехи его снижают.\nСвязанный или оглушённый боец не уклоняется.`,
  armor: s => `Броня снижает каждый попавший удар: урон × 25 / (25 + броня).\nСейчас: −${Math.round(100 - 2500 / (25 + s.armor))}% урона.`,
  crit: s => `Шанс критического удара.\n3% + 0.8 × Мастерство + снаряжение и навыки.`,
  critMult: s => `Во сколько раз крит сильнее обычного удара. Базово ×1.6, больше — от навыков фракийца.`,
  block: s => `Шанс принять удар на щит: урон −60%.\nДаёт щит и навыки. В обороне +20%.\nНе работает, если боец в сети или оглушён. Некоторые удары (выпад, рассекающий удар, прицельный выстрел) не блокируются.`,
  init: s => `Инициатива: кто ходит раньше в раунде (к ней добавляется случай 0–6) и сколько клеток боец проходит за ход: 2 + инициатива / 5, от 2 до 5.\nСейчас шагов: ${s.move}.`,
  resist: s => `Сопротивление: на столько процентов меньше шанс попасть в сеть или под оглушение.\n3% за очко Воли + снаряжение («Стойкость») и навыки. 100% — полная неуязвимость.`,
  reach: s => `Дальность удара в клетках. Обычное оружие — 1 (соседняя клетка, в том числе по диагонали), копьё и трезубец — 2, лук — 6.\nВысокие препятствия закрывают линию выстрела.`,
  stun: s => `Шанс оглушить цель при каждом попадании (булава, секира). Цель пропустит свой следующий ход.`,
  fits: s => `Школьная выучка: предметы, подходящие школе бойца, дают +25% к своим характеристикам, оружие — ещё +5% точности.`,
  mercy: s => `Милость толпы: прибавка к шансу помилования от снаряжения, которое любит публика.`,
};
// Значки пустых слотов «куклы»
const SLOT_GLYPH = {
  weapon: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 25L23 9l2-3-3 2L6 24z"/><path d="M5 21l6 6M9 27l-3 0 0-3"/></svg>',
  offhand: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4c5 2 9 2 10 3 0 11-4 17-10 21C10 24 6 18 6 7c1-1 5-1 10-3z"/><circle cx="16" cy="15" r="3"/></svg>',
  helmet: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 22c0-9 4-14 9-14s9 5 9 14l-4 1v-5H11v5z"/><path d="M16 8V4M12 5c2-2 6-2 8 0"/></svg>',
  armor: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5l6 3 6-3 4 4-2 6v10H8V15L6 9z"/><path d="M12 15h8M12 19h8"/></svg>',
  arms: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h8l3 4v14l-3 3h-6l-2-3z"/><path d="M10 12h9M10 17h9M10 22h8"/></svg>',
  legs: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4h5l1 18-2 5h-5l1-5z"/><path d="M11 9h5M11 14h5"/><path d="M20 6h3l1 16h-3"/></svg>',
  belt: '<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13h24v6H4z"/><rect x="13" y="11" width="6" height="10"/><path d="M16 14v4"/></svg>',
};
const tipAttrHtml = (txt) => esc(txt).replace(/\n/g, '&#10;');

// ------------------------------------------------------------
//  Справочник: разделы
// ------------------------------------------------------------
const GUIDE = [
  ['ludus', 'Лудус и школы'], ['stats', 'Характеристики'], ['combat', 'Бой и поле'],
  ['gear', 'Снаряжение и лавки'], ['crowd', 'Приговор толпы'], ['meta', 'Заказы, ставки, финал'], ['story', 'История и долг'],
];
function screenRules() {
  const ch = UI.guide || 'ludus';
  const nav = GUIDE.map(([k, n]) => `<button class="small ${k === ch ? 'active' : ''}" data-act="guide" data-ch="${k}">${n}</button>`).join('');
  return `<div class="screen-title"><h2>Справочник</h2><p>Все правила и формулы игры. В окне бойца у каждой характеристики есть подсказка — наведите на название.</p></div>
  <div class="guide"><div class="gnav">${nav}</div><div class="panel rules">${guideChapter(ch)}</div></div>`;
}
function guideChapter(ch) {
  switch (ch) {
    case 'story': return `
    <h3>Завязка</h3>
    <p>Ваш отец Марк, ланиста из Помпей, умер и оставил вам маленький лудус, одного новобранца, старого наставника Ферокса — и долг ростовщику Лукриону в ${DEBT_TOTAL} денариев. Отца разорил Гней Вар, ланиста из Капуи. Цель — расплатиться, пройти через арены Кампании и Рима и в Колизее разорить Вара.</p>
    <h3>Главы и хозяева арен</h3>
    <table class="gtable">
      <tr><th>Глава</th><th>Что нужно</th></tr>
      ${STORY.CHAPTERS.map(c => `<tr><td><b>${c.title}</b></td><td>${c.tasks.map(t => esc(t.text)).join(' → ')}</td></tr>`).join('')}
    </table>
    <p>Задачи главы выполняются по порядку; текущая видна в строке под шапкой, полный список — по нажатию на неё. Следующая арена открывается не славой, а победой над хозяином арены: он появляется среди боёв дня, когда выполнены все задачи перед ним. Проигранный бой с хозяином можно повторить на следующий день. Заказ сенатора в Риме тоже обязателен и не пропадает, пока не выигран.</p>
    <h3>Долг</h3>
    <ul>
      <li>Платёж — раз в ${DEBT_EVERY} дней; суммы растут: ${DEBT_PLAN.join(', ')} денариев.</li>
      <li>В день срока платёж списывается сам — после содержания бойцов. Если денег не хватает, лудус отбирают и игра проиграна. Отсрочек и досрочных выплат нет.</li>
      <li>За 3 дня и за 1 день до срока приходит напоминание, а накануне «Завершить день» переспросит, если денег не хватит. Остаток и расписание — по нажатию на счётчик долга в шапке.</li>
      <li>В Капуе долг выкупает Гней Вар и поднимает оставшиеся платежи в ${DEBT_RAISE} раза.</li>
      <li>Если финал выигран раньше последнего платежа, разорённый Вар больше ничего не требует — остаток списывается.</li>
    </ul>
    <h3>Эпилог</h3>
    <p>После победы в финале можно вручить рудис свободы лучшему бойцу: он уйдёт из лудуса, а в Некрополе появится запись «Отпущен на волю». Игру можно продолжить и после истории.</p>`;
    case 'stats': return `
    <h3>Пять атрибутов</h3>
    <table class="gtable">
      <tr><th>Атрибут</th><th>Что даёт</th></tr>
      ${ATTR_KEYS.map(k => `<tr><td><b>${ATTRS[k].name}</b></td><td>${esc(tipAttr[k]()).split('\n').slice(1).join('<br>')}</td></tr>`).join('')}
    </table>
    <p>За каждый уровень боец получает 3 очка атрибутов, а начиная с 5-го уровня — ещё 1 очко специализации. Предметы могут добавлять очки атрибутов напрямую.</p>
    <h3>Производные характеристики</h3>
    <table class="gtable">
      <tr><th>Характеристика</th><th>Как считается</th></tr>
      <tr><td><b>Здоровье</b></td><td>30 + 7 × Выносливость + снаряжение и навыки (у мурмиллона и галла есть навыки на % здоровья).</td></tr>
      <tr><td><b>Урон</b></td><td>Урон оружия + 1.2 × Сила (лук: 0.8 × Сила) × множитель навыков. Без оружия — кулаки 2–4.</td></tr>
      <tr><td><b>Точность</b></td><td>1.5 × Мастерство + оружие + навыки. Оружие своей школы — ещё +5%.</td></tr>
      <tr><td><b>Уклонение</b></td><td>1.5 × Ловкость + снаряжение (тяжёлые щиты и доспехи — со знаком минус) + навыки.</td></tr>
      <tr><td><b>Броня</b></td><td>Сумма брони снаряжения и навыков. Урон × 25 / (25 + броня): 10 брони — −29%, 25 — −50%.</td></tr>
      <tr><td><b>Шанс крита</b></td><td>3% + 0.8 × Мастерство + снаряжение и навыки. Крит: урон × 1.6 (больше с навыками фракийца).</td></tr>
      <tr><td><b>Блок щитом</b></td><td>От щита и навыков. Удар, принятый на щит, наносит лишь 40% урона.</td></tr>
      <tr><td><b>Инициатива</b></td><td>Ловкость + снаряжение и навыки. Определяет порядок ходов и число шагов: 2 + инициатива / 5 (2–5).</td></tr>
      <tr><td><b>Сопротивление</b></td><td>3 × Воля + «Стойкость» снаряжения + навыки: снижает шанс попасть в сеть или под оглушение.</td></tr>
      <tr><td><b>Дальность</b></td><td>1 клетка — обычное оружие, 2 — копьё и трезубец, 6 — лук.</td></tr>
    </table>
    <h3>Шанс попадания</h3>
    <p><b>Шанс = 72% + точность атакующего − уклонение цели</b>, но не меньше 10% и не больше 97%. Каждое очко точности ровно отменяет очко уклонения противника. Точность выше той, что нужна до потолка 97% против ваших обычных соперников, ничего не даёт — подсказка к точности в окне бойца показывает шанс против разного уклонения.</p>
    <table class="gtable hitt"><tr><th>Точность \\ уклонение цели</th>${[0, 10, 20, 30, 40].map(d => `<th>${d}%</th>`).join('')}</tr>
      ${[0, 10, 20, 30].map(a => `<tr><td><b>+${a}%</b></td>${[0, 10, 20, 30, 40].map(d => `<td>${hitChanceOf(a, d)}%</td>`).join('')}</tr>`).join('')}
    </table>
    <h3>Порядок расчёта удара</h3>
    <ol>
      <li>Встречный удар гопломаха (если атакуют его врукопашную).</li>
      <li>Попадание или промах (шанс выше). Связанный или оглушённый не уклоняется.</li>
      <li>Урон: случайное число из диапазона × навыки × ярость и т. п.</li>
      <li>Крит (шанс крита) — урон × множитель крита.</li>
      <li>Блок щитом — урон × 0.4.</li>
      <li>Броня — урон × 25 / (25 + броня).</li>
      <li>Оборона цели (−40%), защита соратников, навыки защиты.</li>
    </ol>`;
    case 'combat': return `
    <h3>Поле</h3>
    <ul>
      <li>Бой идёт на поле 10×5 клеток. Ваша зона расстановки — три левых столбца, противника — три правых.</li>
      <li>В каждой арене свои препятствия двух видов. <b>Высокие</b> (валуны, частокол, колонны, гермы, статуи, обелиски, штабеля ящиков, осадные щиты) нельзя ни пройти, ни прострелить. <b>Низкие</b> (плетни, амфоры, камни, парапеты, рогатки, телеги, упавшие колонны) нельзя пройти, но лучник стреляет поверх них, а копьё бьёт через них. Наведите курсор на препятствие, чтобы узнать его вид.</li>
      <li>На клетке стоит только один боец, и сквозь бойцов — даже своих — не пройти. Поле устроено так, что проход между зонами есть всегда и один боец не может перекрыть его целиком.</li>
    </ul>
    <h3>Ход</h3>
    <ul>
      <li>Порядок ходов — по инициативе (очередь видна над ареной). На своём ходу боец может переместиться (до 2–5 клеток) и совершить одно действие: удар, умение, оборону или ожидание.</li>
      <li>Шаги можно тратить до действия и после него: подойти на 2 клетки, ударить и отступить на оставшуюся. Тратить шаги не обязательно — «Конец хода» (пробел) оставляет бойца на месте. Клик по своему бойцу ничего не делает, так что промах мимо врага не съест ход, а если силуэт бойца закрывает клетку позади него, клик по ней всё равно ведёт на эту клетку. Если боец ещё может ударить, «Конец хода» нужно нажать дважды.</li>
      <li><b>Оборона</b> (клавиша D): боец остаётся на месте и до следующего хода получает −40% урона, +15% уклонения и +20% блока.</li>
      <li>Лучнику нужна линия выстрела без высоких препятствий. Стрельба в упор: −20% к точности. Сеть летит на 3 клетки.</li>
      <li><b>Сеть и оглушение</b> отнимают у цели её следующий ход. Если цель уже ходила в этом раунде, она пропустит ход в следующем. Пока боец в сети или оглушён, он не уклоняется, не блокирует и не контратакует.</li>
      <li>Сагиттария не достают встречные удары и контратаки. Гопломах встречает подходящих врагов ударом копья раньше, чем они ударят.</li>
    </ul>
    <h3>Режимы</h3>
    <ul>
      <li><b>Автобой</b>: бойцы сами встают в строй (щитоносцы вперёд, лучники в тыл) и сражаются.</li>
      <li><b>Ручное управление</b>: вы расставляете бойцов в своей зоне и командуете каждым ходом — синие клетки показывают, куда можно пойти, красные кольца — кого можно атаковать, при наведении на врага виден шанс попасть. Кнопка «Автобой» передаёт бой ИИ.</li>
      <li>Скорость: клавиши <b>1</b>, <b>2</b>, <b>3</b> — ×1, ×2, ×4. Бой можно пропустить или сдаться — сдавшиеся на ногах получают бонус к помилованию.</li>
    </ul>`;
    case 'gear': return `
    <h3>Слоты и качество</h3>
    <ul>
      <li>Семь слотов: оружие, вторая рука, шлем, доспех, руки и плечи, поножи и обувь, пояс.</li>
      <li>Качество: ${QUALITIES.map(q => `<span class="${q.cls}">${q.name.toLowerCase()}</span>`).join(', ')}. Характеристики зависят только от вида и качества — два одинаковых предмета всегда равны. С добротного качества появляются дополнительные свойства, у каждого вида свои.</li>
      <li>Вещи надевают и снимают в окне бойца кнопками или перетаскиванием: со склада на слот или на фигуру бойца — надеть, со слота на склад — снять. На телефоне вещь берут долгим нажатием.</li>
      <li>Любой предмет можно надеть на любого бойца, но <b>школьная выучка</b> (+25% к характеристикам предмета, оружию ещё +5% точности) достаётся только бойцу школы, указанной у предмета.</li>
      <li>Двуручное оружие (галльский меч, секира, луки) занимает обе руки. К луку можно взять колчан.</li>
    </ul>
    <h3>Где взять</h3>
    <ul>
      <li><b>Кузница</b>: каждый день новый набор — оружие, щиты, шлемы, доспехи, наручи, поножи и пояса. Больше половины оружия и щитов — для школ, что уже есть в лудусе. С открытием новых арен качество растёт.</li>
      <li><b>Лавка редкостей</b> открывается при славе лудуса ${RARE_SHOP_FAME}. В ней — именные изделия, каждое единственное в своём роде: сильнее любой кузнечной вещи, но стоят в разы дороже. Товар меняется раз в три дня — копите денарии.</li>
      <li><b>Трофеи</b>: с побеждённых на арене можно снять снаряжение — 7% за предмет, если противника помиловали, и 18%, если казнили.</li>
      <li><b>Реликвии</b> — снаряжение великих гладиаторов — только за достижения и легендарные заказы.</li>
      <li>Проданный предмет приносит 40% цены.</li>
    </ul>`;
    case 'crowd': return `
    <h3>Приговор толпы</h3>
    <p>Если ваша команда проиграла бой на арене, для <b>каждого</b> её бойца толпа решает: <i>missio</i> (помилование) или <i>iugula</i> (смерть). На шанс влияет:</p>
    <ul>
      <li><b>Поверг ли боец противника</b> — главное условие: +35% за первого, +10% за каждого следующего.</li>
      <li>Без поверженных противников шанс помилования <b>не превышает 50%</b>. Даже с ними — не выше 90%.</li>
      <li>Базовое милосердие 20%, нанесённый урон (до +15%), зрелищность — криты, умения, уклонения (до +10%), Воля (+1.5% за очко), слава бойца (до +15%), снаряжение с «Милостью толпы».</li>
      <li>Нрав публики: в провинции +5%, в Капуе 0, в Риме −10%, в Колизее −15%.</li>
      <li>Сдался, оставаясь на ногах: +15%. Подкуп распорядителя игр: +15%.</li>
    </ul>
    <p>Помилованный боец ранен на 1–3 дня. Погибший уходит в некрополь. Побеждённых противников толпа судит по тем же правилам.</p>`;
    case 'meta': return `
    <h3>Заказы</h3>
    <p>Каждый день — несколько показательных боёв по найму: у патронов, на пирах, свадьбах и праздниках. Это бои <b>не насмерть</b>: выбывший боец сдаётся и отлёживается день. Сложность от «Лёгкого» до «Опасного» — чем труднее, тем выше плата. У некоторых заказов есть условие (без потерь, за N раундов, в меньшинстве, продержаться). Провал приносит лишь плату за выход. Иногда появляется легендарный заказ с реликвией.</p>
    <h3>Бой меньшинством</h3>
    <p>На обычный бой арены 2 на 2 или 3 на 3 можно выйти на одного бойца меньше — отметьте это при выборе бойцов. Награда за победу (денарии и слава) — <b>×${SHORT_MULT}</b>. Учебный бой и бои с хозяевами арен — только поровну.</p>
    <h3>Ставки на бой дня</h3>
    <p>Каждый день на арене проходит один бой 1 на 1 между чужими бойцами текущей арены. Их снаряжение, характеристики, школу и навыки можно посмотреть заранее. Устроитель игр прогоняет бой ${BET_SIMS} раз и по шансам назначает коэффициенты, оставляя себе ${Math.round(BET_MARGIN * 100)}%: у слабого бойца коэффициент выше. Ставка — от ${BET_MIN} с шагом ${BET_STEP}, предел растёт с ареной: ${BET_MAX.join(' / ')} денариев (Помпеи / Капуя / Рим / Колизей). Выигрыш — ставка × коэффициент. Одна ставка в день; если не посмотреть бой, он пройдёт без вас при завершении дня.</p>
    <h3>Достижения и реликвии</h3>
    <p>Достижения дают денарии и славу, самые трудные — реликвии. Прогресс виден на вкладке «Достижения».</p>
    <h3>Финал</h3>
    <p>При славе лудуса ${FINAL_FAME} на арене открывается финал — «Игры за рудис свободы» в Колизее против трёх легендарных чемпионов ${FINAL_LEVEL}-го уровня. Победа завершает историю (играть можно и дальше). Проигранный финал можно повторить на следующий день.</p>`;
    default: return `
    <h3>Лудус</h3>
    <p>У вас может быть до ${MAX_GLADIATORS} гладиаторов, но на арену одновременно выходит не больше трёх. Каждый день стоит денег: содержание — 4 денария за бойца. Каждый боец может сражаться и тренироваться раз в день. Раненые не сражаются, лекарь ускоряет выздоровление.</p>
    <h3>Школы</h3>
    <ul>
      <li>Рабов на рынке продают <b>без школы и без снаряжения</b>. Школу можно выбрать в окне бойца, когда он достигнет <b>${SCHOOL_LEVEL}-го уровня</b>; звёзды подсказывают, к какой школе он пригоден. До этого он сражается как новобранец — без умения школы. Противники ниже ${SCHOOL_LEVEL}-го уровня — тоже новобранцы.</li>
      <li>Школа не даёт снаряжения: его нужно купить у кузнеца, в лавке редкостей или снять с побеждённых.</li>
      <li>Школы: ${CLASS_KEYS.map(c => `<b>${CLASSES[c].name}</b> — ${CLASSES[c].desc}`).join('<br>')}</li>
      <li>Сменить школу можно за плату — навыки при этом сбрасываются.</li>
    </ul>
    <h3>Развитие</h3>
    <ul>
      <li>За каждый уровень — 3 очка атрибутов, а с 5-го уровня — ещё 1 очко специализации: на 5-м уровне у бойца 1 очко, на 6-м — 2 и так далее. Если школу выбрать позже, накопленные с 5-го уровня очки достанутся ей сразу.</li>
      <li>Древо специализации у каждой школы своё: 4 ступени, открывающиеся на уровнях 5, 8, 11 и 14. В каждой ступени два навыка по 3 ранга, на IV ступени — венчающий навык. Всех навыков не взять — придётся выбирать путь.</li>
    </ul>`;
  }
}

// ------------------------------------------------------------
//  Лавка редкостей
// ------------------------------------------------------------
function screenBazaar() {
  if (!rareShopOpen()) return `<div class="screen-title"><h2>Лавка редкостей</h2><p>Сириец Абдаласт не продаёт свои редкости безвестным ланистам. Лавка откроется при славе лудуса ${RARE_SHOP_FAME} (сейчас ${STATE.fame}).</p></div>`;
  refreshRareShop();
  const items = STATE.rareShop.items;
  const goods = items.length
    ? items.map(it => itemRow(it, `<span class="price">${it.price}</span><button class="small primary" data-act="buyRare" data-item="${it.id}" ${STATE.gold < it.price ? 'disabled' : ''}>Купить</button>`, true, null, true)).join('')
    : '<p class="empty-note">Вы скупили все редкости, какие только были у торговца.</p>';
  const left = Object.keys(RARE_BASES).length - (STATE.rareBought || []).length;
  return `<div class="screen-title"><h2>Лавка редкостей</h2><p>Сириец Абдаласт привозит именные изделия со всей империи — каждое единственное в своём роде. Стоят они в разы дороже кузнечных, зато сильнее любой вещи из кузницы. Товар меняется раз в три дня (следующий завоз через ${rareShopDaysLeft()} ${plural(rareShopDaysLeft(), 'день', 'дня', 'дней')}). Осталось непроданных редкостей: ${left}.</p></div>
  <div class="panel bazaar"><div class="list">${goods}</div></div>`;
}

// ------------------------------------------------------------
//  Диалоги в стиле игры вместо браузерных confirm/prompt.
//  Живут в #dialog поверх всего (и боя, и окна бойца) — перерисовка экранов их не трогает.
// ------------------------------------------------------------
function showDialog(o) {
  UI.dlg = o;
  const btns = [
    o.ok !== false ? `<button class="${o.danger ? 'danger' : 'primary'}" data-act="dlgOk">${o.ok || 'Да'}</button>` : '',
    o.cancel !== false ? `<button data-act="dlgCancel">${o.cancel || 'Отмена'}</button>` : '',
  ].join('');
  $('#dialog').innerHTML = `<div class="modal-bg dlg-bg" data-act="dlgBg"><div class="modal dlg ${o.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
    <h2 id="dlgTitle">${o.title}</h2>
    ${o.text ? `<p>${o.text}</p>` : ''}${o.body || ''}
    ${o.input ? `<label class="dlg-field"><span>${o.input.label || ''}</span><input id="dlgInput" type="text" maxlength="${o.input.max || 28}" value="${esc(o.input.value || '')}" autocomplete="off"></label>` : ''}
    ${o.after || ''}
    <div class="dlg-btns">${btns}</div>
  </div></div>`;
  // у опасного действия по умолчанию в фокусе «Отмена», чтобы случайный Enter ничего не сломал
  const f = $('#dlgInput') || (o.danger && $('#dialog [data-act="dlgCancel"]')) || $('#dialog [data-act="dlgOk"]') || $('#dialog [data-act="dlgCancel"]');
  if (f) { f.focus(); if (f.select) f.select(); }
  if (o.onShow) o.onShow();
}
function closeDialog() { UI.dlg = null; $('#dialog').innerHTML = ''; }
const askConfirm = (title, text, onOk, opts = {}) => showDialog({ title, text, onOk, ...opts });

// ------------------------------------------------------------
//  Новая игра
// ------------------------------------------------------------
const TOUR_PREF = 'ludus_tutorial';
function showNewGameDialog() {
  let tourOn = true;
  try { tourOn = localStorage.getItem(TOUR_PREF) !== '0'; } catch (e) { /* хранилище недоступно */ }
  showDialog({
    title: 'Новая игра',
    cls: 'newgame',
    text: STATE
      ? 'Весь текущий прогресс — бойцы, снаряжение, денарии, слава, достижения и некрополь — будет <b>удалён без возможности восстановления</b>. Чтобы вернуться к нему позже, сначала скачайте файл в «Сохранении».'
      : 'Отец оставил вам лудус в Помпеях — и долг. Кто вы и как назовёте школу?',
    input: { label: 'Название лудуса', value: 'Лудус Батиата', max: 28 },
    after: `<div class="lanista-wrap"><span>Ваш ланиста</span><div class="lanista-pick">${PORTRAIT.LANISTAS.map((l, i) => `
      <button type="button" class="lp ${i ? '' : 'on'}" data-act="pickLanista" data-k="${l.key}" title="${esc(l.title)}. ${esc(l.desc)}" aria-pressed="${i ? 'false' : 'true'}">
        <img src="${PORTRAIT.url(l.key, 'neutral', 88)}" alt=""><span>${esc(l.title)}</span></button>`).join('')}</div></div>
      <label class="dlg-check"><input id="dlgTour" type="checkbox" ${tourOn ? 'checked' : ''}> Пройти обучение — наставник проведёт через первый бой</label>`,
    ok: STATE ? 'Удалить прогресс и начать' : 'Начать игру', danger: !!STATE,
    onOk: name => {
      const k = ($('.lanista-pick .lp.on') || { dataset: { k: 'm1' } }).dataset.k;
      const L = PORTRAIT.LANISTAS.find(x => x.key === k) || PORTRAIT.LANISTAS[0];
      startNewGame((name || '').trim().slice(0, 28) || 'Лудус', $('#dlgTour').checked, { portrait: L.key, sex: L.sex });
    },
  });
}
function startNewGame(name, tour, lanista = { portrait: 'm1', sex: 'm' }) {
  try { localStorage.removeItem(SAVE_KEY); localStorage.setItem(TOUR_PREF, tour ? '1' : '0'); } catch (e) { /* хранилище недоступно */ }
  if (UI.battle) closeBattle();
  if (typeof hideCoach === 'function') hideCoach(); // подсказка прошлой игры не должна остаться на экране
  newGame(name, { story: true, lanista });
  if (tour) STATE.story.tutorWanted = true; // обучение начнётся и после перезагрузки во время пролога
  STATE.settings = { mode: 'auto' };
  UI.tab = 'ludus'; UI.gladId = null; UI.eventId = null; UI.picked = [];
  $('#modal').innerHTML = '';
  save();
  if (typeof hideMenu === 'function') hideMenu();
  render();
  // сначала пролог, потом обучение
  flushScenes(() => {
    if (tour && typeof startTutorial === 'function') startTutorial();
    else toast('Начата новая игра.');
  });
}

// ------------------------------------------------------------
//  Перенос сохранения: экспорт в файл и импорт из файла
// ------------------------------------------------------------
const SAVE_FILE_TAG = 'gladiator-ludus';
const saveSummary = st => `«${esc(st.ludusName || 'Лудус')}»${st.story ? `, глава ${['I', 'II', 'III', 'IV'][st.story.chapter] || 'I'}` : ''}, день ${st.day}, бойцов ${st.gladiators.length}, денариев ${st.gold}, слава ${st.fame}`;

function showSaveDialog() {
  UI.importState = null;
  showDialog({
    title: 'Сохранение', cls: 'savebox', ok: false, cancel: 'Закрыть',
    text: 'Прогресс хранится только в этом браузере. Чтобы играть на другом устройстве или в другом браузере, скачайте файл и загрузите его там.',
    body: `<div class="savecols">
      <div class="panel"><h3>Скачать</h3>
        <p class="small muted">${STATE ? `Сейчас: ${saveSummary(STATE)}.` : 'Игра ещё не начата — скачивать пока нечего.'}</p>
        <button class="primary" data-act="saveExport" ${STATE ? '' : 'disabled'}>Скачать файл сохранения</button></div>
      <div class="panel"><h3>Загрузить</h3>
        <p class="small muted">${STATE ? 'Прогресс из файла заменит текущий прогресс в этом браузере.' : 'Продолжите игру, начатую на другом устройстве.'}</p>
        <button data-act="saveImportPick">Выбрать файл…</button>
        <input id="importFile" type="file" accept=".json,application/json" hidden></div>
    </div>
    <div id="importPreview"></div>`,
    onShow: () => $('#importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) readSaveFile(f); e.target.value = ''; }),
  });
}

// Проверка, что в файле действительно сохранение лудуса
function parseSaveFile(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return null; }
  const st = data && data.game === SAVE_FILE_TAG ? data.state : data;
  const arrays = ['gladiators', 'armory', 'smith', 'market', 'events', 'graveyard', 'journal'];
  if (!st || typeof st !== 'object' || !arrays.every(k => Array.isArray(st[k]))) return null;
  if (![st.gold, st.fame, st.day].every(Number.isFinite)) return null;
  return st;
}

function readSaveFile(file) {
  const box = $('#importPreview');
  if (file.size > 5e6) { box.innerHTML = '<p class="bad">Файл слишком большой для сохранения лудуса.</p>'; return; }
  const rd = new FileReader();
  rd.onload = () => {
    const st = parseSaveFile(String(rd.result));
    UI.importState = st;
    box.innerHTML = st
      ? `<div class="panel mt"><p>В файле: ${saveSummary(st)}.</p>
          <button class="danger" data-act="saveImport">Заменить текущий прогресс</button></div>`
      : '<p class="bad mt">Это не файл сохранения «Лудуса». Выберите файл, скачанный кнопкой «Скачать файл сохранения».</p>';
  };
  rd.onerror = () => { box.innerHTML = '<p class="bad mt">Не удалось прочитать файл.</p>'; };
  rd.readAsText(file);
}

// ============================================================
//  Бой: поле, расстановка, ручное и автоматическое управление
// ============================================================
const findEvent = id => STATE.events.find(e => e.id === id)
  || (STATE.contracts || []).find(e => e.id === id)
  || (STATE.finalEvent && STATE.finalEvent.id === id ? STATE.finalEvent : null);
const playerCount = ev => ev.playerSize ?? ev.size;
// учебный бой под обучением: только ручное управление — без автобоя, пропуска и сдачи
const tutorFight = ev => !!(ev && ev.training && typeof tutorOn === 'function' && tutorOn());
const battleMode = () => (STATE.settings && STATE.settings.mode) || 'auto';
const track = (type, data) => { if (typeof META !== 'undefined') META.track(type, data); };

// Пикер бойцов для выбранного события нужного вида (арена, заказ, финал)
function eventPicker(kind) {
  const ev = UI.eventId && findEvent(UI.eventId);
  return ev && !ev.done && (ev.kind || 'arena') === kind ? picker(ev) : '';
}

function startBattle() {
  const ev = findEvent(UI.eventId);
  if (!ev || ev.done) return;
  const glads = UI.picked.map(glad).filter(Boolean);
  if (glads.length !== playerCount(ev)) return;
  ev.enemies.forEach(ensureLook);
  const mode = ev.training ? 'manual' : battleMode(); // учебный бой — всегда с подсказками, вручную
  const b = new Battle(glads, ev.enemies, ev, { mode });
  UI.picked = []; UI.eventId = null;
  openBattle(b, ev, glads, mode);
  coach('battleStart', ev);
}

// Экран боя: поле, очередь, составы и журнал. extra — поля для UI.battle (например, bet: true)
function openBattle(b, ev, glads, mode, extra = {}) {
  const host = $('#battle');
  host.hidden = false;
  document.body.style.overflow = 'hidden';
  const T = b.tier;
  const title = ev.kind === 'contract' ? `Заказ: ${esc(ev.title)}` : ev.kind === 'final' ? 'Финал · Игры за рудис свободы' : ev.title ? esc(ev.title) : T.name;
  host.innerHTML = `<div class="bwrap">
    <div class="btop">
      <div><h2>${T.place}</h2><span class="muted">${title} · ${playerCount(ev)} на ${ev.size} · ${extra.bet ? 'вы на трибуне' : mode === 'manual' ? 'ручное управление' : 'автобой'} · <span id="bRound">выход бойцов</span></span></div>
      <div class="bctl" id="bCtl"></div>
    </div>
    <div class="turnq" id="bQueue"></div>
    <div class="stage"><canvas id="arenaCanvas"></canvas></div>
    <div class="tactbar" id="bTact"></div>
    <div id="bresults"></div>
    <div class="bbottom">
      <div class="roster" id="rosterP"></div>
      <div class="roster" id="rosterE"></div>
      <div class="blog" id="bLog"></div>
    </div>
  </div>`;
  const view = new ArenaView($('#arenaCanvas'), b);
  music('arena');
  UI.battle = { b, event: ev, glads, view, phase: mode === 'manual' ? 'deploy' : 'fight', speed: 1, results: null, verdicts: null, ...extra };
  updateBattleHud();
  if (mode === 'manual') startDeploy(UI.battle);
  else runBattle(UI.battle);
}

// ------------------------------------------------------------
//  Расстановка перед боем
// ------------------------------------------------------------
function startDeploy(B) {
  const v = B.view, b = B.b;
  v.hl.zone = DEPLOY_COLS.player;
  B.deploySel = null;
  v.onPick = hit => {
    const own = hit.uid && b.unit(hit.uid);
    if (own && own.side !== 'player') return;
    if (own && (!B.deploySel || own.uid === B.deploySel)) { B.deploySel = own.uid; v.hl.selected = own.uid; renderTact(B); return; }
    if (!B.deploySel) return;
    const u = b.unit(B.deploySel);
    const c = own ? own.c : hit.c, r = own ? own.r : hit.r;
    if (!DEPLOY_COLS.player.includes(c) || b.isBlocked(c, r)) return;
    const other = b.units.find(x => x !== u && x.side === 'player' && x.c === c && x.r === r);
    if (other) { other.c = u.c; other.r = u.r; v.placeFighter(v.F(other.uid), other.c, other.r); }
    u.c = c; u.r = r; v.placeFighter(v.F(u.uid), c, r);
    sfx('step', { vol: 0.8 });
    B.deploySel = null; v.hl.selected = null;
    renderTact(B);
    coach('deployPlace');
  };
  v.faceFoes();
  renderTact(B);
}

function deployAuto(B) {
  const b = B.b, v = B.view;
  const mine = b.units.filter(u => u.side === 'player');
  autoDeployCells(mine.map(u => u.g), 'player', b.field).forEach((cell, i) => {
    mine[i].c = cell.c; mine[i].r = cell.r; v.placeFighter(v.F(mine[i].uid), cell.c, cell.r);
  });
  B.deploySel = null; v.hl.selected = null;
  renderTact(B);
}

function deployDone(B) {
  const v = B.view;
  v.hl.zone = null; v.hl.selected = null; v.onPick = null;
  B.phase = 'fight';
  renderTact(B);
  updateBattleHud();
  coach('fightStart');
  runBattle(B, false);
}

// ------------------------------------------------------------
//  Ход под управлением игрока
// ------------------------------------------------------------
function playerTurn(B, u) {
  return new Promise(resolve => {
    const b = B.b, v = B.view;
    const T = B.turn = { u, aim: false, busy: false, o: null };
    const clear = () => { v.hl.reach = null; v.hl.targets = null; v.hl.ability = null; };
    const refresh = () => {
      T.confirmEnd = false;
      const o = T.o = b.options(u);
      v.hl.reach = u.mpLeft > 0 ? o.reach : null;
      v.hl.targets = T.aim ? null : new Set([...o.attackNow.map(f => f.uid), ...o.approach.keys()]);
      v.hl.ability = T.aim ? new Set(o.abilityNow.map(f => f.uid)) : null;
      v.hl.selected = u.uid;
      renderTact(B);
    };
    const finish = () => {
      clear(); v.hl.selected = null; v.onPick = null; v.hintFn = null;
      B.turn = null; renderTact(B); resolve();
      coach('turnEnd');
    };
    // выполнить команду(ы), проиграть события; ended — закончился ли ход
    const run = async steps => {
      if (T.busy) return;
      T.busy = true; clear(); renderTact(B);
      let ended = false;
      for (const step of steps) {
        const r = step();
        await v.play(b.events);
        updateBattleHud();
        if (r === 'end') ended = true;
        // действие сделано и шагов не осталось — ход окончен
        if (u.acted && u.mpLeft <= 0) ended = true;
        if (b.over || !u.alive || UI.battle !== B) break;
      }
      T.busy = false;
      if (ended || b.over || !u.alive || UI.battle !== B) finish(); else { T.aim = false; refresh(); }
    };
    T.run = run; T.finish = finish; T.refresh = refresh;
    const atk = f => () => { const ok = b.cmdAttack(u, f); if (ok) coach('attacked'); return ok ? 'act' : ''; };
    const step = (c, r) => () => { b.cmdMove(u, c, r); coach('moved'); return ''; };
    v.onPick = hit => {
      if (T.busy) return;
      const o = T.o, f = hit.uid && b.unit(hit.uid);
      if (f && f.side === u.side) return; // клик по своему бойцу ход не тратит
      if (T.aim) {
        if (f && o.abilityNow.includes(f)) run([() => { const ok = b.cmdAbility(u, f); if (ok) coach('ability'); return ok ? 'act' : ''; }]);
        return;
      }
      if (f && f.side !== u.side) {
        if (o.attackNow.includes(f)) return run([atk(f)]);
        const cell = o.approach.get(f.uid);
        if (cell) run([step(cell.c, cell.r), atk(f)]);
        return;
      }
      if (!f && u.mpLeft > 0) {
        const n = o.reach.get(cellKey(hit.c, hit.r));
        if (n && n.d > 0) run([step(n.c, n.r)]);
      }
    };
    // подсказка под курсором: шанс попасть или число шагов
    v.hintFn = hv => {
      if (T.busy || !T.o) return null;
      const f = hv.uid && b.unit(hv.uid);
      const fp = f && v.F(f.uid);
      if (f && f.side !== u.side && fp) {
        coach('hoverEnemy');
        const from = T.o.attackNow.includes(f) ? u : T.o.approach.get(f.uid);
        if (!from && !(T.aim && T.o.abilityNow.includes(f))) {
          // в пределах дальности, но высокое препятствие закрывает линию выстрела
          const blocked = cheb(u, f) <= u.reach && cheb(u, f) > 1 && !b.los(u, f);
          return { text: `${f.g.name}: ${blocked ? 'нет линии выстрела — мешает высокое препятствие' : 'вне досягаемости'}`, x: fp.x, y: fp.y + 26, color: '#b9a98c' };
        }
        const pb = u.s.ranged && cheb(from || u, f) <= 1 ? -20 : 0;
        const dodge = f.net > 0 || f.stun > 0 ? 0 : f.s.dodge + (f.defending ? 15 : 0);
        const p = hitChanceOf(u.s.acc + pb, dodge);
        return { text: `${f.g.name}: попадание ${p}%${from && from !== u ? (u.s.ranged ? ' (перейти и выстрелить)' : ' (подойти и ударить)') : ''}${pb ? ' · в упор' : ''}`, x: fp.x, y: fp.y + 26, color: '#f0b6a6' };
      }
      if (!f && u.mpLeft > 0 && T.o.reach) {
        const n = T.o.reach.get(cellKey(hv.c, hv.r));
        if (n && n.d > 0) { const p = cellPos(n.c, n.r); return { text: `Шагов: ${n.d}`, x: p.x, y: p.y + 24, color: '#bcd6ee' }; }
      }
      return null;
    };
    refresh();
  });
}

// Панель тактических команд под ареной
function renderTact(B) {
  const el = $('#bTact');
  if (!el) return;
  if (B.phase === 'deploy') {
    const sel = B.deploySel && B.b.unit(B.deploySel);
    el.innerHTML = `<div class="tact">
      <div><b>Расстановка.</b> ${sel ? `Выбран <b class="player">${esc(sel.g.name)}</b> — кликните клетку в подсвеченной зоне (или другого своего бойца, чтобы поменять их местами).` : 'Кликните своего бойца, затем клетку в подсвеченной зоне. Щитоносцев — вперёд, лучников — в тыл, за препятствия.'}</div>
      <div class="tbtns"><button class="small" data-act="dAuto">Авторасстановка</button><button class="primary" data-act="dStart">В бой!</button></div>
    </div>`;
    return;
  }
  const T = B.turn;
  if (!T) {
    el.innerHTML = B.b.mode === 'manual' && B.phase === 'fight' && !B.b.over ? `<div class="tact muted">${B.autoplay ? 'Автобой до конца схватки.' : 'Ходит противник…'}</div>` : '';
    return;
  }
  const u = T.u, A = clsOf(u.g).ability;
  const abReady = A && u.cd === 0;
  const hint = T.busy ? 'Выполняется…' : T.confirmEnd ? '<b class="warn">Боец ещё может атаковать.</b> Нажмите «Конец хода» ещё раз, чтобы всё равно закончить ход.' : T.aim ? `Выберите цель умения «${A.name}» (золотые кольца). Esc — отмена.`
    : u.acted ? (u.mpLeft > 0 ? `Удар нанесён. Можно остаться на месте («Конец хода», пробел) или отойти на ${u.mpLeft} кл. по синим клеткам.` : 'Действие выполнено.')
    : `Красные кольца — кого можно атаковать${u.mpLeft > 0 ? ' (если нужно, боец сам подойдёт)' : ''}.${u.mpLeft > 0 ? ` Синие клетки — куда можно шагнуть (осталось ${u.mpLeft}).` : ''} Тратить шаги не обязательно: «Оборона» или «Конец хода» оставят бойца на месте.`;
  el.innerHTML = `<div class="tact">
    <div><b>Ход: <span class="player">${esc(u.g.name)}</span></b> <span class="muted small">${clsOf(u.g).name} · шагов ${u.mpLeft}/${u.mp} · дальность ${u.reach}${u.s.ranged ? ' (лук)' : ''}</span><div class="small muted">${hint}</div></div>
    <div class="tbtns">
      ${A ? `<button class="small ${T.aim ? 'active' : ''}" data-act="tAbility" ${!abReady || T.busy || u.acted ? 'disabled' : ''} title="${esc(A.desc)}">${A.name}${abReady ? '' : ` (${u.cd})`}</button>` : ''}
      <button class="small" data-act="tDefend" ${T.busy || u.acted ? 'disabled' : ''} title="Остаться на месте и закрыться: −40% урона, +15% уклонения, +20% блока до следующего хода. Клавиша D">Оборона <kbd>D</kbd></button>
      <button class="small ${u.acted || T.confirmEnd ? 'primary' : ''}" data-act="tWait" ${T.busy ? 'disabled' : ''} title="Закончить ход, не тратя оставшиеся шаги. Пробел">${T.confirmEnd ? 'Точно закончить?' : 'Конец хода'} <kbd>␣</kbd></button>
      ${tutorFight(B.event) ? '' : `<button class="small" data-act="tAuto" ${T.busy ? 'disabled' : ''} title="Дальше бой проведёт ИИ">Автобой</button>`}
    </div>
  </div>`;
}

async function runBattle(B, walkIn = true) {
  await B.view.intro(walkIn);
  let guard = 0;
  const b = B.b;
  while (!b.over && UI.battle === B && guard++ < 3000) {
    if (B.surrenderReq) { b.surrender(); break; }
    const t = b.beginTurn();
    renderQueue(B);
    await B.view.play(b.events);
    updateBattleHud();
    if (t.act && !b.over && UI.battle === B) {
      if (b.isPlayerControlled(t.u) && !B.autoplay && !B.view.skip) await playerTurn(B, t.u);
      else { b.aiTurn(t.u); await B.view.play(b.events); }
      updateBattleHud();
    }
    // заказ «продержаться»: по истечении раундов бой останавливают
    if (B.event.kind === 'contract' && B.event.cond && B.event.cond.type === 'survive' && typeof META !== 'undefined' && !b.over
      && b.round > META.contractRoundLimit(B.event) && b.alive('player').length) {
      B.survived = true; b.over = true; b.winner = null;
      b.say('Распорядитель останавливает бой — ваши бойцы выстояли!', 'sys big');
    }
    if (b.round > 60 && !b.over) {
      // затянувшийся бой решает распорядитель: побеждает сторона с большим запасом здоровья
      const hp = side => b.alive(side).reduce((s, u) => s + u.hp / u.maxHp, 0);
      b.over = true; b.winner = hp('player') >= hp('enemy') ? 'player' : 'enemy';
      for (const u of b.alive(b.winner === 'player' ? 'enemy' : 'player')) { u.alive = false; u.hp = 0; }
    }
    if (B.view.skip) await new Promise(r => setTimeout(r, 0));
  }
  if (UI.battle !== B) return;
  B.view.sync();
  updateBattleHud();
  renderTact(B);
  B.view.skip = false;
  await B.view.wait(900);
  finishBattle();
}

function unitRow(u, B) {
  const C = clsOf(u.g);
  const tags = [];
  if (!u.alive) tags.push(`<span class="badge-s bleed">${B.b.nonLethal ? 'Выбыл' : 'Повержен'}</span>`);
  if (u.stun) tags.push('<span class="badge-s stun">Оглушён — пропустит ход</span>');
  if (u.net) tags.push('<span class="badge-s net">В сети — пропустит ход</span>');
  if (u.defending) tags.push('<span class="badge-s def">Оборона</span>');
  if (u.spearWall) tags.push('<span class="badge-s def">Заслон</span>');
  if (u.bleeds.length) tags.push(`<span class="badge-s bleed">Кровь ${u.bleeds.reduce((s, b) => s + b.dmg, 0)}/ход</span>`);
  if (u.alive && C.ability) tags.push(u.cd > 0 ? `<span class="badge-s cd">${C.ability.name}: ${u.cd}</span>` : `<span class="badge-s ok">${C.ability.name} готов</span>`);
  const active = B.b.current === u && !B.b.over;
  return `<div class="urow ${u.side} ${u.alive ? '' : 'dead'} ${active ? 'active' : ''}">
    <img class="portrait sm" src="${portrait(u.g, 44, 55, { bust: true, enemy: u.side === 'enemy' })}" alt="">
    <div class="uinfo">
      <div class="un">${esc(u.g.name)} <span class="muted tiny">${C.name}, ур. ${u.g.level} · шагов ${u.mp} · дальн. ${u.reach}</span></div>
      <div class="hp"><div style="width:${u.hp / u.maxHp * 100}%"></div><span>${u.hp} / ${u.maxHp}</span></div>
      <div class="badges">${tags.join('')}</div>
    </div>
    <div class="ustat"><b>${u.kills}</b><span>повержено</span><b>${u.dmgDealt}</b><span>урон</span></div>
  </div>`;
}

function updateBattleHud() {
  const B = UI.battle;
  if (!B) return;
  const b = B.b;
  $('#bRound').textContent = B.phase === 'deploy' ? 'расстановка' : b.round ? `раунд ${b.round}` : 'выход бойцов';
  $('#rosterP').innerHTML = `<div class="side-label">${B.bet ? 'Первый боец' : esc(STATE.ludusName)}</div>` + b.units.filter(u => u.side === 'player').map(u => unitRow(u, B)).join('');
  $('#rosterE').innerHTML = `<div class="side-label">${B.bet ? 'Второй боец' : 'Противники'}</div>` + b.units.filter(u => u.side === 'enemy').map(u => unitRow(u, B)).join('');
  const log = $('#bLog');
  const near = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  log.innerHTML = b.log.map(l => `<p class="${l.kind}">${l.text}</p>`).join('');
  if (near) log.scrollTop = log.scrollHeight;
  const fighting = B.phase === 'fight' && !b.over;
  $('#bCtl').innerHTML = [1, 2, 4].map((s, i) => `<button class="small ${B.speed === s ? 'active' : ''}" data-act="bSpeed" data-s="${s}" title="Клавиша ${i + 1}">×${s} <kbd>${i + 1}</kbd></button>`).join('')
    + soundBtn()
    + (fighting && !tutorFight(B.event) ? `<button class="small" data-act="bSkip" ${B.view.skip ? 'disabled' : ''}>Пропустить бой</button>${B.bet ? '' : `<button class="small danger" data-act="bSurrender" ${B.surrenderReq ? 'disabled' : ''}>Сдаться</button>`}` : '');
  renderQueue(B);
}

// Очередь ходов раунда: кто ходит сейчас и кто следующий
function renderQueue(B) {
  const b = B.b, fighting = B.phase === 'fight' && !b.over;
  const q = $('#bQueue');
  if (q) {
    if (!fighting || !b.round) { q.innerHTML = ''; return; }
    const order = [b.current, ...b.queue].filter(u => u && u.alive);
    q.innerHTML = `<span class="ql">Раунд ${b.round} · очередь:</span>` + order.map((u, i) => {
      const skip = u.stun > 0 || u.net > 0;
      return `<span class="qi ${u.side} ${i === 0 ? 'now' : ''} ${skip && i > 0 ? 'skip' : ''}" title="${skip && i > 0 ? 'Пропустит ход' : ''}">${esc(u.g.name)}${skip && i > 0 ? ' <i>пропуск</i>' : ''}</span>`;
    }).join('<span class="qa">›</span>') + '<span class="qa">›</span><span class="ql">новый раунд</span>';
  }
}

// ------------------------------------------------------------
//  Завершение боя
// ------------------------------------------------------------
function battleInfo(B) {
  const b = B.b, ev = B.event;
  const players = b.units.filter(u => u.side === 'player');
  return {
    kind: ev.kind || 'arena', win: b.winner === 'player', survived: !!B.survived, size: ev.size, tier: ev.tier, rounds: b.round,
    eventId: ev.id, training: !!ev.training, boss: ev.boss || null, story: ev.story || null,
    mode: b.mode, surrendered: b.surrendered, flawless: b.winner === 'player' && players.every(u => u.alive),
    playerFallen: players.filter(u => !u.alive).length,
    playerUnits: players.map(u => ({ g: u.g, alive: u.alive, kills: u.kills, crits: u.crits, dmgDealt: u.dmgDealt, abilityUses: u.abilityUses, hpLeftPct: Math.round(u.hp / u.maxHp * 100) })),
    enemyUnits: b.units.filter(u => u.side === 'enemy').map(u => ({ g: u.g, alive: u.alive })),
  };
}

// Обучение узнаёт о действиях игрока (учебный бой, вкладки)
const coach = (n, d) => { if (typeof coachEvent === 'function') coachEvent(n, d); };

// Итог боя для истории: учебный бой, хозяева арен, победы в Капуе, заказ сенатора, финал
const storyBattle = info => { if (typeof STORY !== 'undefined' && STATE.story) STORY.onBattle(info); };

async function finishBattle() {
  const B = UI.battle;
  if (!B || B.phase !== 'fight') return;
  if (B.bet) return finishBetBattle(B);
  const b = B.b, ev = B.event, T = b.tier, view = B.view;
  const win = b.winner === 'player';
  const kind = ev.kind || 'arena';
  ev.done = true;
  const players = b.units.filter(u => u.side === 'player');
  const enemies = b.units.filter(u => u.side === 'enemy');
  const R = { win, kind, rows: [], gold: 0, fame: 0, loot: [], enemyFates: [] };
  const xpK = kind === 'contract' ? (ev.xpMult ?? 0.6) : (ev.xpMult ?? 1);

  for (const u of players) {
    const g = u.g;
    g.foughtToday = true;
    g.record.fights++;
    g.record.kills += kind === 'contract' ? 0 : u.kills;
    if (win) g.record.wins++; else g.record.losses++;
    const xp = Math.round(T.xp * ((win ? 50 : 20) + u.kills * 20) * xpK);
    const ups = addXp(g, xp);
    for (const lv of ups) track('levelUp', { g, level: lv });
    const fame = kind === 'contract' ? 0 : (clamp(ev.tier, 0, 3) + 1) * ((win ? 1 : 0) + u.kills * 2);
    g.fame += fame;
    if (!u.alive && (win || kind === 'contract')) g.wounded = Math.max(g.wounded, 1);
    R.rows.push({ u, xp, ups, fame });
  }
  B.results = R;
  const info = battleInfo(B);

  // заказ: бой до сдачи, без приговора толпы
  if (kind === 'contract') {
    const res = typeof META !== 'undefined' ? META.contractResult(ev, info)
      : { success: win, gold: win ? ev.gold : 0, text: win ? 'Заказ выполнен.' : 'Заказ провален.' };
    if (typeof META === 'undefined' && win) STATE.gold += ev.gold;
    R.contract = res; R.gold = res.gold || 0;
    track('battleEnd', info);
    storyBattle(info);
    save();
    B.phase = 'scenes';
    updateBattleHud();
    if (win) await view.salute('player');
    B.phase = 'results';
    renderResults();
    return;
  }

  if (win) {
    ({ gold: R.gold, fame: R.fame } = winReward(ev));
    STATE.gold += R.gold;
    track('gold', { amount: R.gold });
    for (const u of enemies) {
      const m = mercyBreakdown(u, b);
      const spared = kind === 'final' || ev.training ? true : chance(m.total);
      if (!spared) R.fame += 1;
      R.enemyFates.push({ u, chance: m.total, spared });
      for (const it of Object.values(u.g.equip)) {
        if (it && chance(spared ? 7 : 18)) {
          const loot = { ...it, id: uid(), stats: { ...it.stats } };
          STATE.armory.push(loot);
          R.loot.push({ it: loot, from: u.g.name });
        }
      }
    }
    STATE.fame += R.fame;
    if (kind === 'final') { STATE.finalWon = true; STATE.finalDay = STATE.day; }
    journal(kind === 'final'
      ? `ФИНАЛ ВЫИГРАН! Чемпионы Рима повержены в Колизее. +${R.gold} денариев, +${R.fame} славы. Император вручает лудусу рудис свободы.`
      : `Победа: ${T.place}, ${playerCount(ev)} на ${ev.size}${ev.short ? ' — в меньшинстве, награда ×2' : ''}. +${R.gold} денариев, +${R.fame} славы.${R.loot.length ? ` Трофеи: ${R.loot.map(l => l.it.name).join(', ')}.` : ''}`);
    track('battleEnd', info);
    storyBattle(info);
    save();
    // сцена: толпа решает судьбу поверженных противников
    B.phase = 'scenes';
    updateBattleHud();
    $('#bresults').innerHTML = `<div class="panel results center"><h2 class="win">${kind === 'final' ? 'Великая победа' : 'Победа'}</h2><div class="sub">${kind === 'final' ? 'Император поднимает руку — чемпионов щадят ради славы победителей…' : 'Поверженные противники ждут решения толпы…'}</div><button class="small" data-act="bSkipScenes">Пропустить</button></div>`;
    await view.kneel(enemies.map(u => u.uid));
    for (const f of R.enemyFates) {
      if (UI.battle !== B || B.skipScenes) break;
      const execU = (f.u.killedBy && f.u.killedBy.alive && f.u.killedBy.side === 'player') ? f.u.killedBy : b.alive('player')[0];
      await view.execution(f.u.uid, execU && execU.uid, f.spared ? 'live' : 'die', `${f.u.g.name} · шанс помилования ${f.chance}%`);
      if (!f.spared) track('enemyExecuted', { g: f.u.g });
    }
    if (B.skipScenes) for (const f of R.enemyFates) if (!f.spared) track('enemyExecuted', { g: f.u.g });
    view.skip = false;
    if (UI.battle !== B) return;
    if (B.skipScenes) {
      for (const f of R.enemyFates) { const F = view.F(f.u.uid); F.state = f.spared ? 'idle' : 'dead'; F.anim = null; }
    }
    if (UI.battle === B && !B.skipScenes) await view.salute('player');
    B.phase = 'results';
  } else {
    STATE.fame = Math.max(0, STATE.fame - 1);
    track('battleEnd', info);
    storyBattle(info);
    save();
    B.verdicts = players.map(u => ({ u, bribed: false, result: null }));
    B.phase = 'verdict';
    updateBattleHud();
    $('#bresults').innerHTML = '<div class="panel results center"><h2 class="lose">Поражение</h2><div class="sub">Ваши бойцы опускаются на колени перед трибунами…</div></div>';
    await view.kneel(players.map(u => u.uid));
    if (UI.battle !== B) return;
  }
  renderResults();
}

function renderResults() {
  const B = UI.battle;
  if (!B) return;
  updateBattleHud();
  $('#bresults').innerHTML = resultsPanel(B);
  coach('results');
}

function resultsPanel(B) {
  const R = B.results;
  const rows = R.rows.map(r => `<div class="rrow"><img class="portrait sm" src="${portrait(r.u.g, 44, 55, { bust: true })}" alt=""><div>${esc(r.u.g.name)}: урон ${r.u.dmgDealt}, повержено ${r.u.kills} · +${r.xp} опыта${r.fame ? `, +${r.fame} славы` : ''}${r.ups.length ? ` · <b class="player">Новый уровень ${r.ups[r.ups.length - 1]}!</b>` : ''}${R.win && !r.u.alive ? ' · <span class="muted">ранен (1 день)</span>' : ''}</div></div>`).join('');

  if (B.phase === 'results' && R.kind === 'contract') {
    const c = R.contract || {};
    return `<div class="panel results">
      <h2 class="${c.success ? 'win' : 'lose'}">${c.success ? 'Заказ выполнен' : 'Заказ провален'}</h2>
      <div class="sub">${esc(B.event.title)} · ${c.text || ''}</div>
      <div class="rlist">${rows}</div>
      ${c.artifact ? `<h3 class="mt">Награда</h3><div class="list">${itemRow(c.artifact, '', true)}</div>` : ''}
      <div class="center mt"><button class="primary" data-act="bClose">Вернуться в лудус</button></div>
    </div>`;
  }
  if (B.phase === 'results') {
    const fates = R.enemyFates.map(f => `<div>${esc(f.u.g.name)} — ${f.spared ? '<span class="q2">помилован</span>' : '<span style="color:#e46b5c">казнён по воле толпы</span>'} <span class="muted tiny">(шанс помилования ${f.chance}%)</span></div>`).join('');
    const loot = R.loot.length ? R.loot.map(l => itemRow(l.it, `<span class="tiny muted">с ${esc(l.from)}</span>`, true)).join('') : '<p class="empty-note small">С поверженных не удалось снять ничего ценного.</p>';
    return `<div class="panel results">
      <h2 class="win">${R.kind === 'final' ? 'Рудис свободы!' : 'Победа'}</h2><div class="sub">+${R.gold} денариев · +${R.fame} славы лудуса</div>
      <div class="two-col" style="grid-template-columns:1fr 1fr">
        <div><h3>Ваши бойцы</h3><div class="rlist">${rows}</div><h3 class="mt">Судьба противников</h3><div class="rlist">${fates}</div></div>
        <div><h3>Трофеи</h3><div class="list">${loot}</div></div>
      </div>
      <div class="center mt"><button class="primary" data-act="${R.kind === 'final' ? 'bEnding' : 'bClose'}">${R.kind === 'final' ? 'Эпилог' : 'Вернуться в лудус'}</button></div>
    </div>`;
  }

  // приговор
  const cost = bribeCost(B.b);
  const decided = B.verdicts.every(v => v.result !== null);
  const started = !!B.revealing;
  const totalBribe = B.verdicts.filter(v => v.bribed).length * cost;
  const cards = B.verdicts.map((v, i) => {
    const m = mercyBreakdown(v.u, B.b, v.bribed);
    const parts = m.parts.map(p => `<span>${p.label}</span><span class="${p.v >= 0 ? 'pos' : 'neg'}">${p.v >= 0 ? '+' : ''}${p.v}%</span>`).join('');
    const st = v.shown ? ' static' : '';
    if (v.result !== null) v.shown = true;
    const fate = v.result === null ? '' : v.result === 'live'
      ? `<div class="fate live${st}">${THUMB}<div class="lat">MISSIO</div><div class="ru">Помилован. Ранен на ${v.wound} ${plural(v.wound, 'день', 'дня', 'дней')}</div><div class="roll">шанс ${v.chance}%</div></div>`
      : `<div class="fate die${st}">${THUMB}<div class="lat">IUGULA</div><div class="ru">Толпа потребовала смерти</div><div class="roll">шанс помилования был ${v.chance}%</div></div>`;
    const mNo = mercyBreakdown(v.u, B.b, false);
    const useless = mNo.raw >= mNo.cap;
    if (useless) v.bribed = false;
    const canBribe = !started && !useless && (v.bribed || STATE.gold - totalBribe >= cost);
    return `<div class="verdict ${v.result === null ? 'pending' : ''} ${B.current === i ? 'now' : ''}">
      <div class="vhead"><img class="portrait sm" src="${portrait(v.u.g, 44, 55, { bust: true })}" alt="">
      <div><h3>${esc(v.u.g.name)}</h3><span class="muted small">${clsOf(v.u.g).name}, ур. ${v.u.g.level}</span></div></div>
      <div class="small muted">${v.u.alive ? 'Остался на ногах' : `Повержен${v.u.killedBy ? ` (добил ${esc(v.u.killedBy.g.name)})` : ''}`} · урон ${v.u.dmgDealt} · повержено противников: ${v.u.kills}</div>
      <div class="parts">${parts}</div>
      <div class="chance"><span>Шанс помилования</span><b>${m.total}%</b></div>
      ${m.raw > m.cap ? `<div class="capnote">Сумма факторов ${m.raw}%, но ${v.u.kills ? 'даже лучшим бойцам толпа не даёт гарантий: не более 90%.' : 'не повергнув ни одного противника, нельзя рассчитывать больше чем на 50%.'}</div>` : (!v.u.kills ? '<div class="capnote">Без поверженного противника шанс ограничен 50%.</div>' : '')}
      ${B.event.training ? '<div class="capnote">Учебный бой: толпа пощадит бойца в любом случае, подкуп не нужен.</div>' : `<label class="bribe"><input type="checkbox" data-act="bBribe" data-i="${i}" ${v.bribed ? 'checked' : ''} ${canBribe ? '' : 'disabled'}> Подкупить распорядителя игр (${cost} ден., +15%)${useless ? ' — <span class="muted">бесполезно, шанс уже на пределе</span>' : ''}</label>`}
      ${fate}
    </div>`;
  }).join('');
  return `<div class="panel results">
    <h2 class="lose">Поражение</h2>
    <div class="sub">${B.b.surrendered ? 'Вы сдались. ' : ''}Распорядитель игр обращается к трибунам. Толпа решит судьбу каждого из ваших бойцов.</div>
    <div class="vgrid">${cards}</div>
    <div class="center mt">
      ${decided ? '<button class="primary" data-act="bClose">Вернуться в лудус</button>'
        : `<button class="primary" data-act="bVerdict" ${started ? 'disabled' : ''}>Ждать приговора толпы${totalBribe ? ` (подкуп: ${totalBribe} ден.)` : ''}</button>`}
    </div>
  </div>`;
}

async function revealVerdicts() {
  const B = UI.battle;
  if (!B || B.revealing) return;
  B.revealing = true;
  const cost = bribeCost(B.b);
  STATE.gold -= B.verdicts.filter(v => v.bribed).length * cost;
  const T = B.b.tier;
  $('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderResults();
  for (let i = 0; i < B.verdicts.length; i++) {
    if (UI.battle !== B) return;
    const v = B.verdicts[i];
    B.current = i;
    const m = mercyBreakdown(v.u, B.b, v.bribed);
    v.chance = m.total;
    const live = B.event.training || Math.random() * 100 < m.total; // в учебном бою никто не гибнет
    const g = v.u.g;
    const execU = (v.u.killedBy && v.u.killedBy.alive) ? v.u.killedBy : B.b.alive('enemy')[0];
    await B.view.execution(v.u.uid, execU && execU.uid, live ? 'live' : 'die', `${g.name} · шанс помилования ${m.total}%`);
    track('verdict', { g, result: live ? 'live' : 'die', chance: m.total });
    if (live) {
      v.result = 'live';
      v.wound = v.u.alive ? 1 : (v.u.kills ? 2 : 3);
      g.wounded = Math.max(g.wounded, v.wound);
      g.record.spared++;
    } else {
      v.result = 'die';
      STATE.gladiators = STATE.gladiators.filter(x => x.id !== g.id);
      STATE.graveyard.push({
        name: g.name, cls: g.cls, level: g.level, origin: g.origin, record: { ...g.record },
        look: g.look, attrs: { ...g.attrs }, equip: JSON.parse(JSON.stringify(g.equip)),
        day: STATE.day, place: T.place, killer: v.u.killedBy ? v.u.killedBy.g.name : null, kills: v.u.kills,
      });
    }
    save();
    renderResults();
  }
  B.current = null;
  const dead = B.verdicts.filter(v => v.result === 'die').map(v => v.u.g.name);
  const alive = B.verdicts.filter(v => v.result === 'live').map(v => v.u.g.name);
  journal(`Поражение: ${T.place}. ${alive.length ? `Помилованы: ${alive.join(', ')}. ` : ''}${dead.length ? `Погибли: ${dead.join(', ')}.` : 'Никто не погиб.'}`);
  save();
  renderResults();
  $('#bresults').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeBattle() {
  const B = UI.battle;
  if (B) B.view.destroy();
  UI.battle = null;
  music('menu');
  $('#battle').hidden = true;
  $('#battle').innerHTML = '';
  document.body.style.overflow = '';
  UI.tab = B && B.bet ? 'arena' : 'ludus';
  render();
  checkGameOver();
  coach('battleClosed');
  storyTick();
}


// Павшие в некрополе (отпущенные на волю — отдельно)
const fallenCount = () => STATE.graveyard.filter(d => !d.freed).length;

// Эпилог истории: кому достанется рудис свободы
function showEpilogueChoice() {
  const best = STATE.gladiators.slice().sort((a, b) => b.fame - a.fame)[0];
  if (!best) { STATE.story.flags.epilogue = 'none'; save(); return showEnding(); }
  $('#modal').innerHTML = `<div class="modal-bg"><div class="modal ending rudis">
    <div class="lat">RUDIS LIBERTATIS</div>
    <h2>Кому достанется рудис?</h2>
    <img class="portrait" src="${portrait(best, 96, 120)}" alt="">
    <p>Император протягивает деревянный рудис — знак свободы. По обычаю его вручают лучшему бойцу. Первым среди равных называют <b>${esc(best.name)}</b>: ${best.record.wins} ${plural(best.record.wins, 'победа', 'победы', 'побед')}, слава ${best.fame}.</p>
    <p class="muted small">Вольный боец уйдёт из лудуса навсегда, а в Некрополе появится запись о нём.</p>
    <div class="center"><button class="primary" data-act="freeBest" data-id="${best.id}">Вручить рудис: ${esc(best.name)}</button> <button data-act="keepBest" data-id="${best.id}">Оставить в лудусе</button></div>
  </div></div>`;
}

// Концовка: победа в финале
function showEnding() {
  // в истории — сначала финальная сцена и выбор, кому отдать рудис
  if (STATE.story && !STATE.story.flags.epilogue) return flushScenes(() => showEpilogueChoice());
  const all = [...STATE.gladiators];
  const kills = all.reduce((s, g) => s + g.record.kills, 0) + STATE.graveyard.reduce((s, d) => s + d.record.kills, 0);
  const ach = STATE.meta && STATE.meta.achievements ? Object.keys(STATE.meta.achievements).length : 0;
  const best = all.slice().sort((a, b) => b.fame - a.fame)[0];
  $('#modal').innerHTML = `<div class="modal-bg"><div class="modal ending">
    <div class="lat">RUDIS LIBERTATIS</div>
    <h2>${esc(STATE.ludusName)} — величайший лудус Рима</h2>
    <p>Чемпионы Императора повержены на песке Колизея. Толпа скандирует имена ваших бойцов, а Император вручает лудусу деревянный рудис — знак свободы и вечной славы.${endingLine(best)}</p>
    ${STATE.story && STATE.story.flags.debtCancelled ? `<p>Разорённый Вар больше ничего не может требовать: остаток долга, ${STATE.story.flags.debtCancelled} ден., списан.</p>` : ''}
    ${STATE.story ? `<p>Имя отца снова звучит с почтением. Лудус ${gx('сына', 'дочери')} Марка — первый в Риме.</p>` : ''}
    <div class="kv" style="justify-content:center">
      <span>Дней <b>${STATE.day}</b></span><span>Слава лудуса <b>${STATE.fame}</b></span><span>Повержено врагов <b>${kills}</b></span>
      <span>Бойцов в лудусе <b>${all.length}</b></span><span>Павших <b>${fallenCount()}</b></span>${ach ? `<span>Достижений <b>${ach}</b></span>` : ''}
    </div>
    <p class="muted small">Можно продолжить игру этим лудусом или начать новую историю.</p>
    <div class="center"><button class="primary" data-act="endingContinue">Продолжить</button> <button data-act="newGame">Новая игра</button></div>
  </div></div>`;
}

function endingLine(best) {
  const f = STATE.story && STATE.story.flags;
  if (f && f.epilogue === 'freed') return ` <b>${esc(f.freedName)}</b> принимает рудис и уходит из лудуса вольным человеком.`;
  if (f && f.epilogue === 'kept') return ` Рудис висит в казарме, а <b>${esc(f.keptName)}</b> остаётся — ради новых побед.`;
  return best ? ` Первым среди равных называют <b>${esc(best.name)}</b>.` : '';
}

function checkGameOver() {
  if (STATE.gladiators.length) return;
  if (!STATE.market.length) return;
  const cheapest = Math.min(...STATE.market.map(g => g.price));
  if (STATE.gold >= cheapest) return;
  $('#modal').innerHTML = `<div class="modal-bg"><div class="modal" style="max-width:560px;text-align:center">
    <h2 style="color:var(--blood);font-size:34px">Лудус пал</h2>
    <p>В казармах не осталось бойцов, а казна пуста. Кредиторы забирают имущество.</p>
    <p class="muted">Дней прожито: ${STATE.day}. Павших бойцов: ${fallenCount()}.</p>
    <button class="primary" data-act="newGame">Начать заново</button></div></div>`;
}

// ============================================================
//  Обработка действий
// ============================================================
const ACTIONS = {
  tab: d => { UI.tab = d.tab; render(); coach('tab:' + d.tab); if (typeof tabHint === 'function') tabHint(d.tab); },
  nextDay: () => {
    if (STATE.lost) return showDebtLost();
    const n = STATE.debt && debtNext();
    const after = STATE.gold - upkeepCost();
    // накануне платежа, если денег не хватит, — переспросить
    if (n && n.daysLeft === 1 && after < n.amount) {
      return showDialog({
        title: 'Завтра платёж', danger: true, ok: 'Завершить день',
        text: `Завтра платёж ${n.amount} ден. (${debtHolderName()}). В казне после содержания не хватит ${n.amount - after} ден. Всё равно завершить день?`,
        onOk: () => { closeDialog(); endDay(); },
      });
    }
    endDay();
  },
  debtInfo: () => showDebtDialog(),
  openGlad: d => { UI.gladId = +d.id; UI.slotSel = null; renderModal(); coach('openGlad'); },
  closeModal: () => { UI.gladId = null; renderModal(); coach('modalClosed'); },
  // листать бойцов лудуса, не закрывая окно
  gladStep: d => {
    const L = STATE.gladiators, i = L.findIndex(x => x.id === UI.gladId);
    if (i < 0 || L.length < 2) return;
    UI.gladId = L[(i + +d.d + L.length) % L.length].id; UI.slotSel = null; renderModal();
  },
  closeModalBg: (d, el, e) => { if (e.target === el) ACTIONS.closeModal(); },

  addAttr: d => {
    const g = glad(UI.gladId);
    if (!g || g.freeAttr <= 0) return;
    g.attrs[d.k]++; g.freeAttr--; save(); render(); coach('attrSpent', g.freeAttr);
  },
  learn: d => {
    const g = glad(UI.gladId);
    const p = PERKS[d.perk];
    if (!g || !canLearnPerk(g, p)) return;
    g.perks[p.id] = perkRank(g, p.id) + 1; g.freeSpec--; save(); render();
  },
  respec: () => {
    const g = glad(UI.gladId);
    const cost = respecCost(g);
    if (STATE.gold < cost) return toast('Недостаточно денариев.', true);
    askConfirm('Сбросить специализацию?', `Навыки школы ${esc(g.name)} будут сброшены, очки специализации вернутся. Цена — ${cost} денариев.`, () => {
      STATE.gold -= cost;
      g.freeSpec += Object.values(g.perks).reduce((s, r) => s + r, 0);
      g.perks = {}; save(); render();
    }, { ok: `Сбросить за ${cost}` });
  },
  equip: d => {
    const g = glad(UI.gladId);
    const idx = STATE.armory.findIndex(i => i.id === +d.item);
    if (!g || idx < 0) return;
    const it = STATE.armory[idx];
    STATE.armory.splice(idx, 1);
    const off = equipItem(g, it);
    STATE.armory.push(...off);
    const extra = off.filter(o => o.slot !== it.slot);
    if (extra.length) toast(`${isTwoHanded(it) ? 'Двуручное оружие занимает обе руки' : 'Предметы несовместимы'}: снято — ${extra.map(o => o.name).join(', ')}.`);
    save(); render(); coach('equipped', it.slot);
  },
  chooseClass: d => {
    const g = glad(UI.gladId);
    if (!g || g.cls || !CLASSES[d.cls] || g.level < SCHOOL_LEVEL) return;
    g.cls = d.cls;
    journal(`${g.name} посвящён в школу: ${CLASSES[g.cls].name}.`);
    track('chooseClass', { g, cls: g.cls });
    toast(`${g.name} теперь ${CLASSES[g.cls].name.toLowerCase()}. Снаряжение школы ищите у кузнеца.`);
    save(); render();
  },
  changeClass: () => {
    const g = glad(UI.gladId);
    const cost = changeClassCost(g);
    if (STATE.gold < cost) return toast('Недостаточно денариев.', true);
    askConfirm('Сменить школу?', `${esc(g.name)} покинет свою школу: навыки будут сброшены, очки специализации вернутся, снаряжение останется на бойце. Цена — ${cost} денариев.`, () => {
      STATE.gold -= cost;
      g.freeSpec += Object.values(g.perks).reduce((s, r) => s + r, 0);
      g.perks = {}; g.cls = null;
      if (!g.talent) { g.talent = {}; for (const k of ATTR_KEYS) g.talent[k] = 3; }
      save(); render();
    }, { ok: `Сменить за ${cost}` });
  },
  smithFilter: d => { UI.smithFilter = d.f; render(); },
  slotSel: (d, el, e) => {
    if (e && e.target.closest('.dx')) return;
    UI.slotSel = d.slot && UI.slotSel !== d.slot ? d.slot : null;
    renderModal();
  },
  guide: d => { UI.guide = d.ch; if (typeof MENU !== 'undefined' && MENU.guide) renderMenu(); else render(); },
  openGuide: (d, el, e) => { e.preventDefault(); UI.gladId = null; UI.tab = 'rules'; UI.guide = d.ch; render(); window.scrollTo(0, 0); },
  buyRare: d => {
    const shop = STATE.rareShop;
    const idx = shop ? shop.items.findIndex(i => i.id === +d.item) : -1;
    const it = idx >= 0 && shop.items[idx];
    if (!it || STATE.gold < it.price) return;
    STATE.gold -= it.price; shop.items.splice(idx, 1); STATE.armory.push(it);
    STATE.rareBought = STATE.rareBought || []; STATE.rareBought.push(it.base);
    journal(`Куплена редкость: ${it.name} за ${it.price} денариев.`);
    track('buyItem', { item: it });
    sfx('coin');
    toast(`Куплено: ${it.name}. Предмет на складе.`);
    save(); render();
  },
  menu: () => showMenu(),
  pickLanista: (d, el) => {
    document.querySelectorAll('.lanista-pick .lp').forEach(b => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', b === el ? 'true' : 'false'); });
  },
  newGameAsk: () => showNewGameDialog(),
  saveAsk: () => showSaveDialog(),
  dlgOk: () => {
    const o = UI.dlg;
    if (!o) return;
    const inp = $('#dlgInput');
    if (o.onOk && o.onOk(inp ? inp.value : undefined) === false) { if (inp) inp.focus(); return; }
    if (UI.dlg === o) closeDialog(); // onOk мог открыть следующий диалог
  },
  dlgCancel: () => { const o = UI.dlg; closeDialog(); if (o && o.onCancel) o.onCancel(); },
  dlgBg: (d, el, e) => { if (e.target === el) ACTIONS.dlgCancel(); },
  saveExport: () => {
    save();
    const data = { game: SAVE_FILE_TAG, version: 2, exported: new Date().toISOString(), state: STATE };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `ludus-day${STATE.day}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Файл сохранения скачан.');
  },
  saveImportPick: () => $('#importFile') && $('#importFile').click(),
  saveImport: () => {
    const st = UI.importState;
    if (!st) return;
    if (UI.battle) return toast('Сначала закончите бой.', true);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); }
    catch (e) { return toast('Браузер не дал записать сохранение: хранилище недоступно или переполнено.', true); }
    // перезагрузка проведёт сохранение через обычную загрузку и миграцию
    try { sessionStorage.setItem('ludus_imported', '1'); } catch (e) { /* не страшно */ }
    location.reload();
  },
  toggleMusic: () => {
    if (typeof SFX === 'undefined' || !SFX.toggleMusic) return;
    SFX.toggleMusic();
    render(); if (UI.battle) updateBattleHud();
  },
  toggleSound: () => {
    if (typeof SFX === 'undefined') return;
    SFX.toggleMute();
    render(); if (UI.battle) updateBattleHud();
  },
  unequip: d => {
    const g = glad(UI.gladId);
    if (!g || !g.equip[d.slot]) return;
    STATE.armory.push(g.equip[d.slot]); g.equip[d.slot] = null; save(); render();
  },
  train: () => {
    const g = glad(UI.gladId);
    if (!g || !canTrain(g)) return;
    STATE.gold -= trainCost(g);
    g.trainedToday = true;
    const ups = addXp(g, trainXp(g));
    for (const lv of ups) track('levelUp', { g, level: lv });
    toast(`${g.name} тренируется: +${trainXp(g)} опыта${ups.length ? `. Новый уровень ${g.level}!` : ''}`);
    save(); render();
  },
  heal: () => {
    const g = glad(UI.gladId);
    if (!g || !g.wounded || STATE.gold < healCost(g)) return;
    STATE.gold -= healCost(g); g.wounded--;
    toast(`Лекарь занялся ранами ${g.name}.`); save(); render();
  },
  rename: () => {
    const g = glad(UI.gladId);
    showDialog({
      title: 'Имя гладиатора', input: { label: 'Под этим именем его будет выкликать толпа', value: g.name, max: 24 }, ok: 'Сохранить',
      onOk: n => { if (!n || !n.trim()) return false; g.name = n.trim().slice(0, 24); save(); render(); },
    });
  },
  dismiss: () => {
    const g = glad(UI.gladId);
    const price = sellGladPrice(g);
    askConfirm('Продать бойца?', `${esc(g.name)} покинет лудус, работорговец даст за него ${price} денариев. Снаряжение бойца останется на складе.`, () => {
      for (const it of Object.values(g.equip)) if (it) STATE.armory.push(it);
      STATE.gladiators = STATE.gladiators.filter(x => x.id !== g.id);
      STATE.gold += price;
      journal(`${g.name} продан работорговцу за ${price} денариев.`);
      UI.gladId = null; save(); render();
    }, { ok: `Продать за ${price}`, danger: true });
  },

  pickEvent: d => { UI.eventId = +d.id; UI.picked = []; setShort(findEvent(UI.eventId), false); render(); coach('pick', findEvent(UI.eventId)); setTimeout(() => $('.picker')?.scrollIntoView({ behavior: 'smooth' }), 30); },
  setMode: d => {
    STATE.settings = STATE.settings || {};
    STATE.settings.mode = d.m === 'manual' ? 'manual' : 'auto';
    save(); const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  cancelPick: () => { setShort(findEvent(UI.eventId), false); UI.eventId = null; UI.picked = []; render(); },
  pickShort: (d, el) => {
    const ev = findEvent(UI.eventId);
    if (!setShort(ev, el.checked)) return;
    UI.picked = UI.picked.slice(0, playerCount(ev));
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  pickGlad: d => {
    const id = +d.id;
    const ev = findEvent(UI.eventId);
    if (!ev) return;
    if (UI.picked.includes(id)) UI.picked = UI.picked.filter(x => x !== id);
    else if (UI.picked.length < playerCount(ev)) UI.picked.push(id);
    else { UI.picked.shift(); UI.picked.push(id); }
    const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  startBattle: () => startBattle(),
  betAmt: d => { betAmount(); UI.betAmt += +d.d * BET_STEP; betAmount(); const y = window.scrollY; render(); window.scrollTo(0, y); },
  betPlace: d => {
    const { amt } = betAmount();
    if (!placeBet(+d.i, amt)) return toast('Ставку сделать нельзя.', true);
    save(); const y = window.scrollY; render(); window.scrollTo(0, y);
  },
  betInspect: d => { const bet = STATE.bet; if (bet) showFighterInfo([bet.a, bet.b][+d.i]); },
  betWatch: () => startBetBattle(),

  buyItem: d => {
    const idx = STATE.smith.findIndex(i => i.id === +d.item);
    const it = STATE.smith[idx];
    if (!it || STATE.gold < it.price) return;
    STATE.gold -= it.price; STATE.smith.splice(idx, 1); STATE.armory.push(it);
    track('buyItem', { item: it });
    sfx('coin');
    toast(`Куплено: ${it.name} (${QUALITIES[it.q].name.toLowerCase()}). Предмет на складе.`);
    save(); render();
  },
  sellItem: d => {
    const idx = STATE.armory.findIndex(i => i.id === +d.item);
    if (idx < 0) return;
    const it = STATE.armory[idx];
    STATE.armory.splice(idx, 1); STATE.gold += sellItemPrice(it);
    save(); render();
  },
  buyGlad: d => {
    const idx = STATE.market.findIndex(g => g.id === +d.id);
    const g = STATE.market[idx];
    if (!g || STATE.gold < g.price || STATE.gladiators.length >= MAX_GLADIATORS) return;
    STATE.gold -= g.price; STATE.market.splice(idx, 1);
    delete g.price;
    STATE.gladiators.push(g);
    journal(`Куплен новый боец: ${g.name}, ${clsOf(g).name}.`);
    track('recruit', { g });
    sfx('coin');
    toast(`${g.name} теперь в вашем лудусе.`); save(); render();
    storyTick();
  },

  // бой
  bSpeed: d => {
    const B = UI.battle;
    B.speed = +d.s; B.view.speed = B.speed;
    updateBattleHud();
  },
  bSkip: () => {
    const B = UI.battle;
    if (!B || tutorFight(B.event)) return;
    if (B.phase === 'deploy') deployDone(B);
    B.autoplay = true; B.view.skip = true;
    if (B.turn && !B.turn.busy) B.turn.run([() => { B.b.aiTurn(B.turn.u); return 'end'; }]);
    updateBattleHud();
  },
  bSkipScenes: () => { const B = UI.battle; B.skipScenes = true; B.view.skip = true; },
  bSurrender: () => {
    const B = UI.battle;
    if (!B || B.b.over || B.surrenderReq || tutorFight(B.event)) return;
    askConfirm('Сдаться?', 'Толпа решит судьбу всех ваших бойцов на арене. Стоящие на ногах получат небольшой бонус к помилованию.', () => {
      if (UI.battle !== B || B.b.over) return;
      B.surrenderReq = true;
      // в ручном бою сдача не ждёт, пока игрок закончит ход
      if (B.turn && !B.turn.busy) B.turn.finish();
      updateBattleHud();
    }, { ok: 'Сдаться', danger: true, cancel: 'Продолжить бой' });
  },
  bBribe: (d, el) => { UI.battle.verdicts[+d.i].bribed = el.checked; renderResults(); },
  bVerdict: () => revealVerdicts(),
  bClose: () => closeBattle(),
  bEnding: () => { closeBattle(); showEnding(); },
  endingContinue: () => { $('#modal').innerHTML = ''; render(); },
  freeBest: d => {
    const g = glad(+d.id);
    if (!g) return;
    STATE.gladiators = STATE.gladiators.filter(x => x.id !== g.id);
    STATE.graveyard.push({
      freed: true, name: g.name, cls: g.cls, level: g.level, origin: g.origin, record: { ...g.record },
      look: g.look, attrs: { ...g.attrs }, equip: JSON.parse(JSON.stringify(g.equip)), day: STATE.day, place: 'Колизей',
    });
    journal(`${g.name} получает рудис свободы и уходит из лудуса вольным человеком.`);
    Object.assign(STATE.story.flags, { epilogue: 'freed', freedName: g.name });
    save();
    showEnding();
  },
  keepBest: d => {
    const g = glad(+d.id);
    Object.assign(STATE.story.flags, { epilogue: 'kept', keptName: g ? g.name : '' });
    save();
    showEnding();
  },
  // расстановка и ручной бой
  dAuto: () => { const B = UI.battle; if (B && B.phase === 'deploy') deployAuto(B); },
  dStart: () => { const B = UI.battle; if (B && B.phase === 'deploy') deployDone(B); },
  tAbility: () => {
    const B = UI.battle, T = B && B.turn;
    if (!T || T.busy) return;
    const A = clsOf(T.u.g).ability;
    if (!A || T.u.cd > 0 || T.u.acted) return;
    if (A.id === 'whirl') {
      if (!B.b.adjacentFoes(T.u).length) return toast('Рядом нет противников для вихря клинков.', true);
      return T.run([() => (B.b.cmdAbility(T.u, null) ? 'act' : '')]);
    }
    if (!T.aim && !T.o.abilityNow.length) return toast(`Нет целей в досягаемости умения (${B.b.abilityRange(T.u)} кл.). Сначала подойдите.`, true);
    T.aim = !T.aim; T.refresh();
  },
  tDefend: () => { const T = UI.battle && UI.battle.turn; if (T && !T.busy) T.run([() => (UI.battle.b.cmdDefend(T.u) ? 'end' : '')]); },
  tWait: () => {
    const T = UI.battle && UI.battle.turn;
    if (!T || T.busy) return;
    // боец ещё может ударить — переспросить, чтобы случайно не отдать ход
    const canHit = !T.u.acted && T.o && (T.o.attackNow.length || T.o.approach.size);
    if (canHit && !T.confirmEnd) { T.confirmEnd = true; renderTact(UI.battle); return; }
    T.run([() => (UI.battle.b.cmdWait(T.u) ? 'end' : '')]);
  },
  tAuto: () => {
    const B = UI.battle, T = B && B.turn;
    if (!T || T.busy || tutorFight(B.event)) return;
    B.autoplay = true;
    T.run([() => { B.b.aiTurn(T.u); return 'end'; }]);
  },
  pvPlay: d => {
    const P = UI.preview, g = glad(UI.gladId);
    if (!P || !g) return;
    const w = g.equip.weapon && (ITEM_BASES[g.equip.weapon.base].look || g.equip.weapon.base);
    const attack = isRanged(g.equip.weapon) ? ['shoot'] : w === 'longsword' || w === 'axe' ? ['swing', 'cleave']
      : w === 'trident' || w === 'spear' ? ['thrust'] : w === 'sica' ? ['slash'] : w === 'gladius' ? ['thrust', 'swing'] : ['swing'];
    const A = clsOf(g).ability;
    const ability = A && { shieldBash: 'bash', netThrow: 'throw', onslaught: 'heavy', slash: 'slash', whirl: 'spin', spearWall: 'lunge', aimedShot: 'aimed', cleave: 'cleave' }[A.id];
    const ohb = g.equip.offhand && (ITEM_BASES[g.equip.offhand.base].look || g.equip.offhand.base);
    const shield = ohb === 'scutum' || ohb === 'parma';
    P.play({ attack, ability: ability ? [ability] : attack, block: [shield ? 'block' : 'parry'], dodge: ['dodge', 'dodgeDuck'], salute: ['salute'] }[d.clips]);
  },

  newGame: () => showNewGameDialog(),
};

// Всплывающая подсказка для элементов с data-tip
function bindTips() {
  const tip = document.createElement('div');
  tip.id = 'tip'; tip.hidden = true;
  document.body.appendChild(tip);
  let cur = null;
  const place = e => {
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 16;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 12;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el === cur) return;
    cur = el;
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false; place(e);
  });
  document.addEventListener('mousemove', e => { if (cur) place(e); });
  document.addEventListener('click', () => { tip.hidden = true; cur = null; });
}

// ------------------------------------------------------------
//  Перетаскивание снаряжения в окне бойца: со склада на бойца и обратно.
//  Мышью — после сдвига на несколько пикселей, пальцем — после короткого удержания.
// ------------------------------------------------------------
function bindDrag() {
  let D = null;
  const targetsFor = d => [...document.querySelectorAll(d.kind === 'st'
    ? `#modal .dslot[data-slot="${d.slot}"], #modal .dfig` : '#modal .panel.stash')];
  const begin = () => {
    D.on = true;
    D.ghost = document.createElement('div'); D.ghost.className = 'drag-ghost';
    const img = D.el.querySelector('img');
    if (img) D.ghost.appendChild(img.cloneNode());
    D.ghost.style.transform = `translate(${D.x - 30}px, ${D.y - 30}px)`;
    document.body.appendChild(D.ghost);
    D.el.classList.add('dragging');
    D.targets = targetsFor(D); D.targets.forEach(t => t.classList.add('drop-ok'));
    document.body.classList.add('drag-on');
    const tip = $('#tip'); if (tip) tip.hidden = true;
  };
  const targetAt = (d, x, y) => { const el = document.elementFromPoint(x, y); return el && d.targets.find(t => t.contains(el)); };
  const finish = (d, t) => {
    d.ghost.remove(); d.el.classList.remove('dragging'); document.body.classList.remove('drag-on');
    d.targets.forEach(x => x.classList.remove('drop-ok', 'drop-hover'));
    // клик, который браузер пришлёт после отпускания, не должен сработать по слоту или кнопке
    const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
    window.addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0);
    if (!t) return;
    if (d.kind === 'st') ACTIONS.equip({ item: d.item });
    else ACTIONS.unequip({ slot: d.slot });
  };
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || D) return;
    const el = e.target.closest('#modal [data-drag]');
    if (!el || e.target.closest('button')) return;
    D = { el, id: e.pointerId, x: e.clientX, y: e.clientY, kind: el.dataset.drag, slot: el.dataset.slot, item: el.dataset.item, touch: e.pointerType !== 'mouse', on: false };
    if (D.touch) D.timer = setTimeout(() => { if (D && !D.on) begin(); }, 280);
  });
  document.addEventListener('pointermove', e => {
    if (!D || e.pointerId !== D.id) return;
    if (!D.on) {
      const dist = Math.hypot(e.clientX - D.x, e.clientY - D.y);
      if (D.touch) { if (dist > 10) { clearTimeout(D.timer); D = null; } return; } // палец повёл — это прокрутка
      if (dist < 6) return;
      begin();
    }
    e.preventDefault();
    D.ghost.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 30}px)`;
    const t = targetAt(D, e.clientX, e.clientY);
    D.targets.forEach(x => x.classList.toggle('drop-hover', x === t));
  }, { passive: false });
  const end = e => {
    if (!D || e.pointerId !== D.id) return;
    clearTimeout(D.timer);
    const d = D; D = null;
    if (d.on) finish(d, e.type === 'pointerup' && targetAt(d, e.clientX, e.clientY));
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
  // пока палец тащит вещь, страница не прокручивается
  document.addEventListener('touchmove', e => { if (D && D.on) e.preventDefault(); }, { passive: false });
  document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('#modal')) e.preventDefault(); });
  document.addEventListener('contextmenu', e => { if (D || e.target.closest('#modal [data-drag]')) e.preventDefault(); });
}

function bindEvents() {
  bindTips();
  bindDrag();
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || !el.dataset.act) return;
    if (el.tagName === 'INPUT') return; // чекбоксы обрабатываются по change
    const fn = ACTIONS[el.dataset.act];
    if (fn && el.tagName === 'BUTTON') sfx('click', { vol: 0.5 });
    if (fn) fn(el.dataset, el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('input[data-act]');
    if (el && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el.dataset, el, e);
  });
  document.addEventListener('keydown', e => {
    // открытый диалог перехватывает клавиатуру: Enter — подтвердить, Esc — отмена
    if (UI.dlg) {
      if (e.key === 'Escape') { e.preventDefault(); ACTIONS.dlgCancel(); }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); ACTIONS.dlgOk(); }
      return;
    }
    if (typeof sceneKey === 'function' && sceneKey(e)) return;
    if (typeof coachKey === 'function' && coachKey(e)) return;
    if (e.key === 'Escape' && UI.gladId) ACTIONS.closeModal();
    if (UI.gladId && !UI.battle && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      e.preventDefault(); ACTIONS.gladStep({ d: e.key === 'ArrowLeft' ? -1 : 1 });
    }
    if (e.key === 'Escape' && UI.battle && UI.battle.turn && UI.battle.turn.aim) { UI.battle.turn.aim = false; UI.battle.turn.refresh(); }
    // ручной бой: пробел — конец хода, D — оборона
    if (UI.battle && UI.battle.turn && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
      if (e.code === 'Space') { e.preventDefault(); ACTIONS.tWait(); }
      else if (e.code === 'KeyD' && !UI.battle.turn.u.acted) { e.preventDefault(); ACTIONS.tDefend(); }
    }
    // скорость боя: 1 — ×1, 2 — ×2, 3 — ×4
    const speeds = { 1: 1, 2: 2, 3: 4 };
    if (UI.battle && speeds[e.key] && !e.ctrlKey && !e.altKey && !e.metaKey && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
      ACTIONS.bSpeed({ s: speeds[e.key] });
      e.preventDefault();
    }
  });
}
