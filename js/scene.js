// ============================================================
//  Сцены разговора: портрет говорящего, имя, реплика
// ============================================================
const SCENE = { ids: [], id: null, lines: null, i: 0, onDone: null };

const sceneOpen = () => !!SCENE.lines;

// Показать сцены по очереди; уже открытая сцена дополняет очередь
function playScenes(ids, onDone) {
  const list = (ids || []).filter(id => STORY.SCENES[id]);
  if (sceneOpen()) {
    SCENE.ids.push(...list.filter(id => id !== SCENE.id && !SCENE.ids.includes(id)));
    const prev = SCENE.onDone;
    SCENE.onDone = () => { if (prev) prev(); if (onDone) onDone(); };
    return;
  }
  if (!list.length) { if (onDone) onDone(); return; }
  SCENE.ids = list;
  SCENE.onDone = onDone || null;
  nextScene();
}

// Сцены, накопившиеся в очереди истории
function flushScenes(onDone) {
  if (!STATE || !STATE.story) { if (onDone) onDone(); return; }
  playScenes(STORY.takeScenes(), onDone);
}

function nextScene() {
  let id = SCENE.ids.shift();
  while (id && STORY.isSeen(id)) id = SCENE.ids.shift();
  if (!id) return closeScene();
  STORY.markSeen(id);
  save();
  SCENE.id = id; SCENE.lines = STORY.lines(id); SCENE.i = 0;
  $('#scene').hidden = false;
  showSceneLine();
}

function closeScene() {
  SCENE.lines = null; SCENE.id = null;
  const el = $('#scene');
  el.hidden = true; el.innerHTML = '';
  const f = SCENE.onDone;
  SCENE.onDone = null;
  if (f) f();
}

function showSceneLine() {
  const l = SCENE.lines[SCENE.i];
  if (!l) return nextScene();
  const last = SCENE.i === SCENE.lines.length - 1 && !SCENE.ids.length;
  $('#scene').innerHTML = `<div class="scene-bg"></div>
    <div class="scene-box ${l.me ? 'me' : ''} ${SCENE.i === 0 ? 'enter' : ''}" role="dialog" aria-modal="true" aria-labelledby="sceneWho">
      <img class="scene-face" src="${PORTRAIT.url(l.key, l.expr, 120, l.me)}" alt="">
      <div class="scene-text">
        <div class="scene-who" id="sceneWho">${esc(l.name)}</div>
        <p>${esc(l.text)}</p>
        <div class="scene-btns">
          <button class="linkish" data-act="sceneSkip">Пропустить сцену</button>
          <span class="sp"></span>
          <button class="primary" data-act="sceneNext">${last ? 'Продолжить' : 'Далее'}</button>
        </div>
      </div>
    </div>`;
  $('#scene [data-act="sceneNext"]').focus();
}

// Клавиши сцены: Enter и пробел — дальше, Esc — пропустить сцену целиком
function sceneKey(e) {
  if (!sceneOpen()) return false;
  if (e.key === 'Escape') { e.preventDefault(); ACTIONS.sceneSkip(); }
  else if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); ACTIONS.sceneNext(); }
  else if (e.key !== 'Tab') e.preventDefault();
  return true;
}

// ============================================================
//  Задачи: строка под шапкой и список задач главы
// ============================================================
function renderTaskBar() {
  const el = $('#taskbar');
  if (!el) return;
  if (!STATE || !STATE.story) { el.hidden = true; el.innerHTML = ''; return; }
  const ch = STORY.CHAPTERS[STATE.story.chapter], t = STORY.current();
  el.hidden = false;
  el.innerHTML = `<button class="taskline" data-act="tasksOpen" title="Задачи главы">
    <span class="tl-ch">${t ? ch.title : 'История завершена'}</span>
    <span class="tl-t">${t ? `${esc(t.text)}${t.progress ? ` <i>(${esc(t.progress)})</i>` : ''}` : 'свободная игра'}</span>
    <span class="tl-more">все задачи</span></button>`;
}

function showTasksDialog() {
  if (!STATE || !STATE.story) return;
  const ch = STORY.CHAPTERS[STATE.story.chapter];
  const mark = { done: '✓', current: '▸', todo: '·' };
  const rows = STORY.tasks().map(t => `<li class="${t.state}"><span class="mk">${mark[t.state]}</span>
    <span class="tx">${esc(t.text)}${t.progress && t.state !== 'done' ? ` <i>(${esc(t.progress)})</i>` : ''}</span>
    ${t.state === 'current' && t.tab ? `<button class="small" data-act="taskGo" data-tab="${t.tab}">Перейти</button>` : ''}</li>`).join('');
  const n = typeof debtNext === 'function' ? debtNext() : null;
  showDialog({
    title: ch.title, cls: 'tasksdlg',
    body: `<ul class="tasklist">${rows}</ul>${n ? `<p class="small muted">Ближайший платёж: ${n.amount} ден. на ${n.day}-й день (${debtHolderName()}).</p>` : ''}`,
    ok: 'Закрыть', cancel: false,
  });
}

// ============================================================
//  Обучение: наставник Ферокс ведёт через лудус и учебный бой.
//  Шаг ждёт либо «Далее» (wait: 'next'), либо событие игры (coachEvent).
//  modal — затемнение и клики только по карточке; иначе игрок действует сам.
//  dock — карточка прижата к углу экрана (в бою, чтобы не закрывать поле)
// ============================================================
const TUTOR_STEPS = [
  { id: 'money', g: 'intro', modal: true, tab: 'ludus', sel: 'header .res > div:first-child, header .res > div:nth-of-type(2)', wait: 'next',
    text: 'Это казна и слава лудуса. Денарии нужны на бойцов, снаряжение и лекаря. Слава открывает большие арены.' },
  { id: 'debt', g: 'intro', modal: true, sel: 'header .debtres', wait: 'next',
    text: 'А это долг твоего отца. Платёж заберут в срок сами, держи деньги наготове. Нажми на долг, и увидишь, когда и сколько платить.' },
  { id: 'tasks', g: 'intro', modal: true, sel: '#taskbar', wait: 'next',
    text: 'Здесь твоя задача на сегодня. Нажми на строку, и увидишь все задачи главы.' },
  { id: 'glad', g: 'intro', lock: true, tab: 'ludus', sel: 'main .gcard', one: true, wait: 'openGlad',
    text: 'Это твой единственный боец. Открой его карточку.' },
  { id: 'gift', g: 'intro', modal: true, back: 'glad', sel: '#modal .doll', wait: 'next',
    text: () => (tutorGlad() && tutorGlad().equip.weapon
      ? 'Это снаряжение бойца. У каждой вещи своё место: шлем, доспех, оружие, щит. Старый гладиус отца уже у него в руке.'
      : 'Это снаряжение бойца. У каждой вещи своё место: шлем, доспех, оружие, щит. Безоружным на песок не выходят. Держи старый гладиус отца, он лежит на складе.') },
  { id: 'equip', g: 'intro', lock: true, back: 'glad', sel: '#modal .dslot[data-slot="weapon"], #modal .panel.stash', wait: 'equipped', accept: d => d === 'weapon', skip: () => !!(tutorGlad() && tutorGlad().equip.weapon),
    text: 'Надень меч. Нажми «Надеть» на складе или перетащи меч на бойца.' },
  { id: 'closeGlad', g: 'intro', lock: true, back: 'glad', sel: '#modal [data-act="closeModal"]', wait: 'modalClosed',
    text: 'Теперь он похож на гладиатора. Закрой окно.' },
  { id: 'toArena', g: 'intro', lock: true, sel: 'nav [data-tab="arena"]', wait: 'tab:arena',
    text: 'Пора на песок. Открой «Арену».' },
  { id: 'pickTraining', g: 'intro', lock: true, sel: '.event.training', wait: 'pick', accept: d => d && d.training,
    text: 'Учебный бой. Противник слабый, никто не погибнет. Выбери этот бой.' },
  { id: 'pickGlad', g: 'intro', lock: true, sel: '.picker', deny: '[data-act="cancelPick"]', wait: 'battleStart', accept: d => d && d.training,
    text: 'Отметь своего бойца и выходи на арену.' },
  { id: 'deploy', g: 'battle', dock: true, sel: '#bTact', wait: 'deployPlace',
    text: 'Расстановка. Нажми на своего бойца, потом на подсвеченную клетку слева.' },
  { id: 'deployGo', g: 'battle', dock: true, sel: '[data-act="dStart"]', wait: 'fightStart',
    text: 'Хорошо стоит. Жми «В бой!».' },
  { id: 'move', g: 'battle', dock: true, wait: 'moved', skip: () => coachCanAttack(),
    text: 'Твой ход. У бойца есть очки действия, ОД: шаг стоит 1, удар 4. Нажми на подсвеченную клетку поближе к врагу.' },
  { id: 'aim', g: 'battle', dock: true, wait: 'hoverEnemy',
    text: 'Наведи курсор на врага, и увидишь шанс попасть. На телефоне просто нажми на него.' },
  { id: 'attack', g: 'battle', dock: true, wait: 'attacked',
    text: 'Нажми на врага, чтобы ударить. Если он далеко, боец подойдёт сам, лишь бы хватило ОД. Хватает ещё на удар? Бей снова.' },
  { id: 'ability', g: 'battle', dock: true, sel: '[data-act="tAbility"]', wait: 'next', skip: () => !$('[data-act="tAbility"]'),
    text: 'Это особый приём бойца. Применяй его, когда враг рядом.' },
  { id: 'endTurn', g: 'battle', dock: true, sel: '[data-act="tWait"]', wait: 'turnEnd',
    text: 'Оставшиеся ОД не пропадают: каждое даёт +3% уклонения до твоего следующего хода. Заверши ход кнопкой «Конец хода» или пробелом.' },
  { id: 'fight', g: 'battle', dock: true, wait: 'results',
    text: 'Теперь ходит противник. Дерись так же, пока кто-то не упадёт.' },
  { id: 'mercy', g: 'battle', dock: true, sel: '#bresults', wait: 'battleClosed',
    text: 'Бой окончен. Судьбу побеждённых решает толпа, но в учебном бою никто не гибнет. Возвращайся в лудус.' },
  { id: 'lvlGlad', g: 'after', lock: true, tab: 'ludus', sel: 'main .gcard', one: true, wait: 'openGlad',
    enter: () => tutorWound(),
    text: () => (tutorGlad() && tutorGlad().wounded ? 'Сур всё же ранил его. Открой карточку бойца.' : 'Открой карточку бойца.') },
  { id: 'heal', g: 'after', lock: true, back: 'lvlGlad', sel: '#modal [data-act="heal"]', wait: 'healed', skip: () => !(tutorGlad() && tutorGlad().wounded),
    text: () => `Раненый не выходит на песок, пока не заживёт. Лекарь поставит его на ноги сразу. Нажми «Лекарь», это стоит ${tutorGlad() ? healCost(tutorGlad()) : ''} денариев.` },
  { id: 'attrs', g: 'after', lock: true, back: 'lvlGlad', sel: '#modal .attrs-panel', wait: 'attrSpent', accept: d => d === 0, skip: () => !(tutorGlad() && tutorGlad().freeAttr),
    text: 'За победу боец получил 2-й уровень и 3 очка характеристик. Раздай их кнопками «+». Знаком ◆ отмечено главное для его будущей школы. Наведи на название, и узнаешь, что даёт характеристика.' },
  { id: 'school', g: 'after', modal: true, back: 'lvlGlad', sel: '#modal .school-panel', wait: 'next',
    text: () => `На ${SCHOOL_LEVEL}-м уровне бойца посвящают в школу. Здесь видно, к какой школе он годится лучше и что ей нужно. После посвящения каждый уровень даёт очко на умения школы.` },
  { id: 'closeGlad2', g: 'after', lock: true, back: 'lvlGlad', sel: '#modal [data-act="closeModal"]', wait: 'modalClosed',
    text: 'Закрой окно бойца.' },
  { id: 'toSmith', g: 'after', lock: true, sel: 'nav [data-tab="smith"]', wait: 'tab:smith',
    text: 'Одного бойца мало. Рабов продают без оружия, так что сначала зайдём к кузнецу.' },
  { id: 'smith', g: 'after', modal: true, tab: 'smith', sel: 'main .screen-title', wait: 'next', enter: () => tutorFund(),
    text: 'Здесь оружие и доспехи. Вещь своей школы служит бойцу на четверть лучше. Купленное ложится на склад.' },
  { id: 'buyItem', g: 'after', lock: true, scroll: true, tab: 'smith', wait: 'boughtItem', skip: () => tutorHas('item') || !tutorPicks().item,
    sel: () => `main [data-act="buyItem"][data-item="${(tutorPicks().item || {}).id}"]`,
    accept: d => { tutorState().item = d.id; return true; },
    text: () => { const it = tutorPicks().item; return it ? `Купи вот это: «${it.name}», ${it.price} ${plural(it.price, 'денарий', 'денария', 'денариев')}. Этим вооружим нового бойца.` : 'Купи что-нибудь.'; } },
  { id: 'toMarket', g: 'after', lock: true, sel: 'nav [data-tab="market"]', wait: 'tab:market',
    text: 'Теперь сам боец. Иди на невольничий рынок.' },
  { id: 'market', g: 'after', modal: true, tab: 'market', sel: 'main .screen-title', wait: 'next',
    text: 'Под каждым рабом видно, к какой школе он годится. Наведи на школу, и узнаешь, что ей нужно.' },
  { id: 'buyGlad', g: 'after', lock: true, scroll: true, tab: 'market', wait: 'boughtGlad', skip: () => tutorHas('glad') || !tutorPicks().glad,
    sel: () => `main [data-act="buyGlad"][data-id="${(tutorPicks().glad || {}).id}"]`,
    accept: d => { tutorState().glad = d.id; return true; },
    text: () => { const g = tutorPicks().glad; return g ? `Для начала хватит самого дешёвого. Это ${g.name}, ${g.price} ${plural(g.price, 'денарий', 'денария', 'денариев')}. Купи его.` : 'Купи бойца.'; } },
  { id: 'toLudus', g: 'after', lock: true, sel: 'nav [data-tab="ludus"]', wait: 'tab:ludus', skip: () => !tutorHas('glad'),
    text: 'Новичок уже в казарме. Вернись в лудус.' },
  { id: 'newGlad', g: 'after', lock: true, tab: 'ludus', wait: 'openGlad', skip: () => !tutorHas('glad'),
    sel: () => `main .gcard[data-id="${tutorState().glad}"]`,
    text: 'Открой карточку новичка.' },
  { id: 'equipNew', g: 'after', lock: true, back: 'newGlad', wait: 'equipped', skip: () => !tutorHas('glad') || !tutorNewItem() || tutorNewItemOn(),
    sel: () => { const it = tutorNewItem(); return it ? `#modal .stash [data-item="${it.id}"], #modal .dslot[data-slot="${it.slot}"]` : '#modal .doll'; },
    text: () => { const it = tutorNewItem(); return 'Перетащи покупку со склада на бойца или нажми «Надеть» рядом с ней.'; } },
  { id: 'closeGlad3', g: 'after', lock: true, back: 'newGlad', sel: '#modal [data-act="closeModal"]', wait: 'modalClosed', skip: () => !tutorHas('glad'),
    text: 'Теперь у тебя двое, оба вооружены. Закрой окно.' },
  { id: 'endDay1', g: 'after', lock: true, sel: 'header [data-act="nextDay"]', wait: 'dayEnded',
    text: 'На сегодня всё. Заверши день: бойцы отдохнут, появятся новые бои и товары, а из казны уйдёт плата за их содержание.' },
  { id: 'day2', g: 'duo', modal: true, wait: 'next', enter: () => tutorDuo(),
    text: 'Новый день. Сегодня у тебя двое, выведем их на схватку двое на двое.' },
  { id: 'toArena2', g: 'duo', lock: true, sel: 'nav [data-tab="arena"]', wait: 'tab:arena', enter: () => tutorDuo(),
    text: 'Открой «Арену».' },
  { id: 'pickDuo', g: 'duo', lock: true, arenaTab: 0, sel: '.event.duo', wait: 'pick', accept: d => d && d.duo,
    text: 'Учебная схватка, никто не погибнет. Под портретами мощь противников, сравни её со своей. Выбери схватку.' },
  { id: 'pickDuo2', g: 'duo', lock: true, sel: '.picker', deny: '[data-act="cancelPick"]', wait: 'battleStart', accept: d => d && d.duo,
    text: 'Отметь обоих бойцов и выходи на арену.' },
  { id: 'duoDeploy', g: 'duo', dock: true, sel: '[data-act="dStart"]', wait: 'fightStart',
    text: 'Поставь бойцов рядом, чтобы прикрывали друг друга, или сразу жми «В бой!».' },
  { id: 'duoFight', g: 'duo', dock: true, wait: 'results',
    text: 'Боец смотрит на того, с кем дерётся. Пока враг занят одним твоим бойцом, второй бьёт его <b>в спину</b>, и крит выпадает вдвое чаще. А враг, зажатый с двух сторон, <b>окружён</b> и не может отступить.' },
  { id: 'duoMercy', g: 'duo', dock: true, sel: '#bresults', wait: 'battleClosed',
    text: 'Схватка окончена. Возвращайся, осталось показать трибуны.' },
  { id: 'toBets', g: 'duo', lock: true, sel: 'nav [data-tab="arena"]', wait: 'tab:arena',
    text: 'Напоследок трибуны. Открой «Арену», там вкладка «Бой дня: ставки».' },
  { id: 'bets', g: 'duo', modal: true, tab: 'arena', arenaTab: 'bets', sel: 'main .betpanel', wait: 'next',
    text: 'Здесь ставят на поединок дня. Нажми на портрет, чтобы рассмотреть бойца, выбери сумму и нажми «Поставить». Выигрыш равен ставке, умноженной на коэффициент. Ставка играет, только если смотреть бой. До боя её можно забрать, а если бой пропустить, деньги вернут.' },
  { id: 'done', g: 'duo', modal: true, wait: 'next', last: true,
    text: 'Дальше сам: заказы горожан, кузнец, школы, Келад, хозяин арены Помпей. Правила есть в «Справочнике». И помни о платеже ростовщику. Ave!' },
];

const TAB_HINTS = {
  contracts: 'Заказы. Горожане платят за особые бои не насмерть. Хороший заработок между платежами.',
  armory: 'Склад. Здесь всё купленное и взятое в бою. Ненужное можно продать.',
  glory: 'Достижения. За подвиги лудуса дают денарии и славу.',
  necro: 'Некрополь. Здесь помнят павших и отпущенных на волю.',
  rules: 'Справочник. Все правила игры, если что-то непонятно.',
  bazaar: 'Лавка редкостей. Дорогие вещи для бойцов, которые уже чего-то стоят.',
};

const TUTOR = { timer: null, hint: null };
const tutorState = () => (STATE && STATE.story && STATE.story.tutor) || null;
const tutorOn = () => !!(tutorState() && tutorState().on);
const coachStepIdx = () => TUTOR_STEPS.findIndex(s => s.id === (tutorState() || {}).step);
const tutorGlad = () => (STATE && STATE.gladiators[0]) || null;
// модальный шаг и шаг «нажми сюда» затемняют всё вокруг цели, остальные — только мерцающая рамка
const holeCls = s => (s.modal || s.lock ? '' : 'soft');
const coachText = s => (typeof s.text === 'function' ? s.text() : s.text);
const coachSel = s => (typeof s.sel === 'function' ? s.sel() : s.sel);

// Покупки в обучении: самое дешёвое одноручное оружие у кузнеца и самый дешёвый раб на рынке
function tutorPicks() {
  const cheap = (a, b) => a.price - b.price;
  const weapons = STATE.smith.filter(i => i.slot === 'weapon' && !isRanged(i) && !isTwoHanded(i)).sort(cheap);
  return { item: weapons[0] || STATE.smith.slice().sort(cheap)[0] || null, glad: STATE.market.slice().sort(cheap)[0] || null };
}
const tutorHas = k => !!(tutorState() && tutorState()[k]);
const tutorNewItem = () => STATE.armory.find(i => i.id === (tutorState() || {}).item) || null;
const tutorNewItemOn = () => { const g = glad((tutorState() || {}).glad); return !!(g && Object.values(g.equip).some(i => i && i.id === (tutorState() || {}).item)); };
// После учебного боя боец ранен — чтобы показать лекаря
function tutorWound() {
  const g = tutorGlad(), t = tutorState();
  if (!g || t.woundShown) return;
  t.woundShown = true;
  if (!g.wounded && STATE.gold >= healCost(g)) g.wounded = 1;
  save(); render();
}
// Схватка двое на двое на второй день обучения: учебная (без смертей, вручную), противники послабее
function tutorDuo() {
  if (STATE.gladiators.length < 2 || STATE.events.some(e => e.duo && !e.done)) return;
  const T = TIERS[0];
  const ev = { id: uid(), kind: 'arena', tier: 0, size: 2, training: true, duo: true, title: 'Учебная схватка', xpMult: 1.3,
    enemies: generateEnemyTeam(0, 2, { lvlDrop: 1, plain: true }), gold: Math.round(T.gold * FORMAT_MULT[2]), fame: Math.round(T.fame * FORMAT_MULT[2]), done: false };
  ensureEasyEvent([ev]);
  ev.enemies.forEach(ensureLook);
  STATE.events.unshift(ev);
  save(); render();
}

// Денег на обе покупки может не хватить — наставник добавляет из отцовских сбережений
function tutorFund() {
  UI.smithFilter = 'all';
  const { item, glad: g } = tutorPicks();
  const need = (tutorHas('item') || !item ? 0 : item.price) + (tutorHas('glad') || !g ? 0 : g.price) + 30;
  if (STATE.gold >= need) return;
  const add = need - STATE.gold;
  STATE.gold += add;
  journal(`Ферокс отдал ${add} денариев из отцовских сбережений на оружие и второго бойца.`);
  toast(`Ферокс: «Отец откладывал на чёрный день. Держи ${add} денариев».`);
  save(); render();
}
const coachCanAttack = () => { const T = UI.battle && UI.battle.turn; return !!(T && T.o && T.o.attackNow.length); };

function startTutorial() {
  if (!STATE || !STATE.story) return;
  STATE.story.tutor = { on: true, step: TUTOR_STEPS[0].id, hints: true };
  delete STATE.story.tutorWanted;
  const g = tutorGlad();
  if (g && g.equip.weapon && !g.record.fights) {
    STATE.armory.push(g.equip.weapon);
    STATE.story.tutor.gift = g.equip.weapon.id;
    g.equip.weapon = null;
  }
  save();
  UI.gladId = null; renderModal();
  showCoach();
}

function endTutorial(done) {
  const t = tutorState();
  if (t) t.on = false;
  const g = tutorGlad(), gi = t ? STATE.armory.findIndex(i => i.id === t.gift) : -1;
  if (g && !g.equip.weapon && gi >= 0) g.equip.weapon = STATE.armory.splice(gi, 1)[0];
  save();
  if (typeof render === 'function' && !UI.battle) render();
  hideCoach();
  // с обучением игрок уже знаком: в следующей новой игре галочка снята
  try { localStorage.setItem(TOUR_PREF, '0'); } catch (e) { /* хранилище недоступно */ }
  if (!done) toast('Обучение пропущено. Правила всегда под рукой в «Справочнике».');
}

// После загрузки: шаг боя без боя не продолжить — вернуться к выбору учебного боя или к шагам после него
function resumeTutorial() {
  if (!tutorState() && STATE && STATE.story && STATE.story.tutorWanted) return startTutorial();
  if (!tutorOn()) return;
  const st = TUTOR_STEPS[coachStepIdx()];
  if (!st) return endTutorial(true);
  if (st.g === 'battle' && !UI.battle) tutorState().step = 'toArena';
  // выбранное событие после перезагрузки не сохраняется — снова с перехода на арену
  if (st.id === 'pickTraining' || st.id === 'pickGlad') tutorState().step = 'toArena';
  // учебный бой уже позади — выигран или проигран — дальше шаги после боя
  if (tutorState().step === 'toArena' && (STATE.story.flags.trainWon || !STATE.events.some(e => e.training && !e.done))) tutorState().step = 'lvlGlad';
  // схватка двое на двое: без боя — снова к арене, а если она уже позади — к ставкам
  if (['pickDuo', 'pickDuo2', 'duoDeploy', 'duoFight', 'duoMercy'].includes(st.id) && !UI.battle)
    tutorState().step = STATE.events.some(e => e.duo && e.done) ? 'toBets' : 'toArena2';
  // шаги в окне бойца — с открытия карточки
  if (st.back && !UI.gladId) tutorState().step = st.back;
  // шаги, которые уже не нужны (например, покупать некого), пропускаем
  let j = coachStepIdx();
  while (TUTOR_STEPS[j] && TUTOR_STEPS[j].skip && TUTOR_STEPS[j].skip()) j++;
  if (!TUTOR_STEPS[j]) return endTutorial(true);
  tutorState().step = TUTOR_STEPS[j].id;
  showCoach();
}

// Продолжение сохранённой игры: незаконченный эпилог или обучение
function resumeStory() {
  if (STATE && STATE.story && STATE.finalWon && !STATE.story.flags.epilogue) return showEnding();
  resumeTutorial();
}

// Событие игры: продвинуть обучение, если его ждёт текущий шаг или следующий шаг той же группы
function coachEvent(name, data) {
  if (!tutorOn()) return;
  const i = coachStepIdx();
  const cur = TUTOR_STEPS[i];
  if (!cur) return;
  // шаги боя слушают только учебный бой (после него бой уже закрыт — событие battleClosed)
  if ((cur.g === 'battle' || cur.g === 'duo') && UI.battle && !(UI.battle.event && UI.battle.event.training)) return;
  for (let j = i; j < TUTOR_STEPS.length; j++) {
    const s = TUTOR_STEPS[j];
    if (s.g !== cur.g && j > i + 1) break;
    if (s.g !== cur.g && s.wait !== name) break;
    if (s.wait === name && (!s.accept || s.accept(data))) return coachGo(j + 1);
  }
}

function coachGo(j) {
  while (TUTOR_STEPS[j] && TUTOR_STEPS[j].skip && TUTOR_STEPS[j].skip()) j++;
  const s = TUTOR_STEPS[j];
  if (!s) return endTutorial(true);
  tutorState().step = s.id;
  if (s.enter) s.enter();
  save();
  showCoach();
}

function showCoach() {
  const s = TUTOR_STEPS[coachStepIdx()];
  if (!s) return;
  if (s.arenaTab !== undefined && UI.arenaTab !== s.arenaTab) { UI.arenaTab = s.arenaTab; if (UI.tab === 'arena' && !UI.battle) render(); }
  if (s.tab && UI.tab !== s.tab && !UI.battle) { UI.tab = s.tab; render(); }
  coachCard(s);
}

// Подсказка при первом заходе на вкладку (если в этой игре включено обучение)
function tabHint(tab) {
  const t = tutorState();
  if (!t || !t.hints || t.on || !TAB_HINTS[tab] || STATE.story.hints[tab]) return;
  STATE.story.hints[tab] = STATE.day;
  save();
  TUTOR.hint = { id: 'hint', dock: true, wait: 'next', text: TAB_HINTS[tab], hint: true };
  coachCard(TUTOR.hint);
}

function coachCard(s) {
  const el = $('#coach');
  el.hidden = false;
  el.className = s.modal ? 'blocking' : '';
  const btn = s.wait === 'next' ? `<button class="primary" data-act="coachNext">${s.last ? 'Начать игру' : s.hint ? 'Понятно' : 'Далее'}</button>` : '';
  el.innerHTML = `${s.modal ? '<div class="tour-block"></div>' : ''}<div class="tour-hole ${holeCls(s)}"></div>
    <div class="tour-card coach-card ${s.dock ? 'dock' : ''}" role="dialog" aria-labelledby="coachWho">
      <div class="coach-head"><img src="${PORTRAIT.url('doctore', 'neutral', 56)}" alt=""><b id="coachWho">Ферокс</b></div>
      <p>${coachText(s)}</p>
      <div class="tour-btns">
        ${s.hint ? '' : '<button class="linkish" data-act="coachSkip">Пропустить обучение</button>'}
        <span class="sp"></span>${btn}
      </div>
    </div>`;
  TUTOR.step = s;
  const target = s.sel && coachTargets(s)[0];
  if (target && (s.modal || s.scroll)) {
    target.scrollIntoView({ block: s.scroll ? 'center' : 'nearest', inline: 'center' });
    const sel = coachSel(s);
    if (sel.startsWith('nav') || sel.startsWith('header') || sel.startsWith('#taskbar')) window.scrollTo(0, 0);
  }
  coachPlace();
  window.removeEventListener('resize', coachPlace);
  window.addEventListener('resize', coachPlace);
  clearInterval(TUTOR.timer);
  // разметка под подсказкой перерисовывается (бой, вкладки) — держим рамку на месте
  TUTOR.timer = setInterval(coachPlace, 400);
  const nb = $('#coach [data-act="coachNext"]');
  if (nb && s.modal) nb.focus();
}

const coachTargets = s => (s.sel ? [...document.querySelectorAll(coachSel(s))].filter(e => e.offsetParent || e.getClientRects().length) : []);

function hideCoach() {
  clearInterval(TUTOR.timer);
  window.removeEventListener('resize', coachPlace);
  TUTOR.step = null; TUTOR.hint = null;
  const el = $('#coach');
  el.hidden = true; el.innerHTML = ''; el.className = '';
}

// Рамка вокруг цели, карточка рядом с ней (или в углу экрана) — в пределах видимой области
function coachPlace() {
  const s = TUTOR.step;
  const hole = $('#coach .tour-hole'), card = $('#coach .tour-card');
  if (!s || !hole || !card) return;
  const found = coachTargets(s), els = s.one ? found.slice(0, 1) : found;
  const z = typeof uiZoom === 'function' ? uiZoom() : 1;
  const vw = window.innerWidth / z, vh = window.innerHeight / z, pad = 8;
  if (!els.length) { hole.className = `tour-hole none ${holeCls(s)}`; hole.removeAttribute('style'); }
  let r = null;
  if (els.length) {
    const rs = els.map(x => { const b = x.getBoundingClientRect(); return { left: b.left / z, top: b.top / z, right: b.right / z, bottom: b.bottom / z }; });
    r = { l: Math.min(...rs.map(x => x.left)) - pad, t: Math.min(...rs.map(x => x.top)) - pad, rt: Math.max(...rs.map(x => x.right)) + pad, b: Math.max(...rs.map(x => x.bottom)) + pad };
    r.l = Math.max(4, r.l); r.t = Math.max(4, r.t); r.rt = Math.min(vw - 4, r.rt); r.b = Math.min(vh - 4, r.b);
    hole.className = `tour-hole ${holeCls(s)}${hole.classList.contains('nudge') ? ' nudge' : ''}`;
    Object.assign(hole.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${Math.max(0, r.rt - r.l)}px`, height: `${Math.max(0, r.b - r.t)}px` });
  }
  if (s.dock) { card.style.left = ''; card.style.top = ''; return; }
  const cw = card.offsetWidth, ch = card.offsetHeight;
  if (!r) {
    card.style.left = `${Math.max(12, (vw - cw) / 2)}px`;
    card.style.top = `${Math.max(12, (vh - ch) / 2)}px`;
    return;
  }
  const below = r.b + 14 + ch < vh;
  card.style.left = `${clamp((r.l + r.rt) / 2 - cw / 2, 12, vw - cw - 12)}px`;
  card.style.top = `${below ? r.b + 14 : Math.max(12, r.t - 14 - ch)}px`;
}

// Клавиши: Esc — пропустить обучение, Enter — «Далее» на модальном шаге
function coachKey(e) {
  const s = TUTOR.step;
  if (!s) return false;
  // шаг «нажми сюда»: Esc и стрелки не закрывают и не листают окна, Enter работает только на нужной кнопке
  if (s.lock && !s.modal) {
    if (e.key === 'Escape' || e.key.startsWith('Arrow') || ((e.key === 'Enter' || e.key === ' ') && !coachAllows(e.target))) { e.preventDefault(); return true; }
    return false;
  }
  // в бою Esc отменяет прицеливание, поэтому обучение он пропускает только на модальных шагах
  if (e.key === 'Escape' && (s.modal || s.hint)) { e.preventDefault(); s.hint ? ACTIONS.coachNext() : ACTIONS.coachSkip(); return true; }
  if (!s.modal) return false;
  if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); ACTIONS.coachNext(); }
  else if (e.key !== 'Tab') e.preventDefault();
  return true;
}

// Шаг «нажми сюда»: пока он не выполнен, работает только подсвеченное (и окна поверх страницы)
function coachAllows(el) {
  const s = TUTOR.step;
  if (!s || !s.lock || s.modal || !tutorOn() || !el || !el.closest) return true;
  if (el.closest('#coach, #scene, #dialog, #toasts, #menu')) return true;
  if (s.deny && el.closest(s.deny)) return false;
  const found = coachTargets(s);
  return (s.one ? found.slice(0, 1) : found).some(t => t.contains(el));
}
function coachGuard(e) {
  if (coachAllows(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  const hole = $('#coach .tour-hole');
  if (!hole) return;
  hole.classList.remove('nudge');
  requestAnimationFrame(() => hole.classList.add('nudge'));
}
for (const t of ['click', 'pointerdown']) document.addEventListener(t, coachGuard, true);

Object.assign(ACTIONS, {
  coachNext: () => {
    const s = TUTOR.step;
    if (!s) return;
    if (s.hint) return hideCoach();
    coachGo(coachStepIdx() + 1);
  },
  coachSkip: () => endTutorial(false),
});

Object.assign(ACTIONS, {
  tasksOpen: () => showTasksDialog(),
  taskGo: d => { closeDialog(); ACTIONS.tab(d); },
  sceneNext: () => { if (!sceneOpen()) return; SCENE.i++; if (SCENE.i >= SCENE.lines.length) nextScene(); else showSceneLine(); },
  sceneSkip: () => { if (sceneOpen()) nextScene(); },
});
