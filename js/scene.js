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
    text: 'Казна и слава лудуса. Денарии уходят на бойцов, снаряжение и лекаря, слава открывает дорогу на большие арены.' },
  { id: 'debt', g: 'intro', modal: true, sel: 'header .debtres', wait: 'next',
    text: 'А это долг твоего отца. Платёж спишется сам в срок — следи, чтобы хватило денег. Нажми потом на счётчик, и увидишь расписание.' },
  { id: 'tasks', g: 'intro', modal: true, sel: '#taskbar', wait: 'next',
    text: 'Здесь — чего от тебя ждут сейчас. Нажми потом на строку, чтобы увидеть все задачи главы.' },
  { id: 'glad', g: 'intro', modal: true, tab: 'ludus', sel: 'main .gcard', one: true, wait: 'next',
    text: 'Твой единственный боец. Нажми на карточку — там очки характеристик, снаряжение, тренировка и лекарь.' },
  { id: 'toArena', g: 'intro', sel: 'nav [data-tab="arena"]', wait: 'tab:arena',
    text: 'Пора на песок. Открой «Арену».' },
  { id: 'pickTraining', g: 'intro', sel: '.event.training', wait: 'pick', accept: d => d && d.training,
    text: 'Учебный бой: слабый новобранец, никто не погибнет. Выбери его.' },
  { id: 'pickGlad', g: 'intro', sel: '.picker', wait: 'battleStart', accept: d => d && d.training,
    text: 'Отметь своего бойца и начни бой.' },
  { id: 'deploy', g: 'battle', dock: true, sel: '#bTact', wait: 'deployPlace',
    text: 'Расстановка. Нажми на своего бойца, затем на любую подсвеченную клетку слева — он встанет туда.' },
  { id: 'deployGo', g: 'battle', dock: true, sel: '[data-act="dStart"]', wait: 'fightStart',
    text: 'Хорошо стоит. Теперь — «Начать бой».' },
  { id: 'move', g: 'battle', dock: true, wait: 'moved', skip: () => coachCanAttack(),
    text: 'Твой ход. Подсвеченные клетки — куда боец может шагнуть. Нажми на клетку поближе к врагу.' },
  { id: 'aim', g: 'battle', dock: true, wait: 'hoverEnemy',
    text: 'Наведи курсор на врага — увидишь шанс попасть. На телефоне просто нажми на него.' },
  { id: 'attack', g: 'battle', dock: true, wait: 'attacked',
    text: 'Нажми на врага, чтобы ударить. Если он далеко, боец сам подойдёт и ударит.' },
  { id: 'ability', g: 'battle', dock: true, sel: '[data-act="tAbility"]', wait: 'next', skip: () => !$('[data-act="tAbility"]'),
    text: 'Это приём бойца — особый удар. Используй его, когда враг в досягаемости.' },
  { id: 'endTurn', g: 'battle', dock: true, sel: '[data-act="tWait"]', wait: 'turnEnd',
    text: 'Когда боец сделал всё, что хотел, ход кончится сам. Если шаги остались, а делать нечего — «Конец хода» или пробел.' },
  { id: 'fight', g: 'battle', dock: true, wait: 'results',
    text: 'Теперь ходит противник. Дерись так же, пока кто-то не упадёт.' },
  { id: 'mercy', g: 'battle', dock: true, sel: '#bresults', wait: 'battleClosed',
    text: 'Бой окончен. Поверженных судит толпа: шанс помилования зависит от того, как они дрались. В учебном бою никто не гибнет. Возвращайся в лудус.' },
  { id: 'toSmith', g: 'after', sel: 'nav [data-tab="smith"]', wait: 'tab:smith',
    text: 'У новобранца лишь ржавый гладиус. Загляни к кузнецу.' },
  { id: 'smith', g: 'after', modal: true, sel: 'main .screen-title', wait: 'next',
    text: 'Оружие и доспехи. Вещь своей школы даёт бойцу +25% к её характеристикам. Купленное ложится на склад — надень в окне бойца или перетащи на него.' },
  { id: 'toMarket', g: 'after', sel: 'nav [data-tab="market"]', wait: 'tab:market',
    text: 'Одного бойца мало. Загляни на невольничий рынок.' },
  { id: 'market', g: 'after', modal: true, sel: 'main .screen-title', wait: 'next',
    text: 'Смотри на склонности: от них зависит, к какой школе новобранец подойдёт лучше. Второй боец — твоя следующая задача.' },
  { id: 'endDay', g: 'after', modal: true, sel: 'header [data-act="nextDay"]', wait: 'next', last: true,
    text: 'Когда дела дня сделаны — заверши день: бойцы отдохнут, появятся новые бои и товары. И помни о платеже. Дальше — сам. Ave!' },
];

const TAB_HINTS = {
  contracts: 'Заказы: горожане платят за особые бои. Условия разные, бой не насмерть — хороший заработок между платежами.',
  armory: 'Склад: всё купленное, снятое и взятое с бою. Ненужное продай — денарии пригодятся к платежу.',
  glory: 'Достижения: за свершения лудуса дают денарии и славу.',
  necro: 'Некрополь: здесь помнят павших. И тех, кого отпустили на волю.',
  rules: 'Справочник: все правила и формулы. Загляни, если что-то непонятно.',
  bazaar: 'Лавка редкостей: дорогие вещи для бойцов, которые уже чего-то стоят.',
};

const TUTOR = { timer: null, hint: null };
const tutorState = () => (STATE && STATE.story && STATE.story.tutor) || null;
const tutorOn = () => !!(tutorState() && tutorState().on);
const coachStepIdx = () => TUTOR_STEPS.findIndex(s => s.id === (tutorState() || {}).step);
const coachCanAttack = () => { const T = UI.battle && UI.battle.turn; return !!(T && T.o && T.o.attackNow.length); };

function startTutorial() {
  if (!STATE || !STATE.story) return;
  STATE.story.tutor = { on: true, step: TUTOR_STEPS[0].id, hints: true };
  save();
  UI.gladId = null; renderModal();
  showCoach();
}

function endTutorial(done) {
  const t = tutorState();
  if (t) t.on = false;
  save();
  hideCoach();
  // с обучением игрок уже знаком: в следующей новой игре галочка снята
  try { localStorage.setItem(TOUR_PREF, '0'); } catch (e) { /* хранилище недоступно */ }
  if (!done) toast('Обучение пропущено. Правила всегда под рукой в «Справочнике».');
}

// После загрузки: шаг боя без боя не продолжить — вернуться к выбору учебного боя или к шагам после него
function resumeTutorial() {
  if (!tutorOn()) return;
  const st = TUTOR_STEPS[coachStepIdx()];
  if (!st) return endTutorial(true);
  if (st.g === 'battle' && !UI.battle) tutorState().step = STATE.story.flags.trainWon ? 'toSmith' : 'toArena';
  // выбранное событие после перезагрузки не сохраняется — снова с перехода на арену
  if (st.id === 'pickTraining' || st.id === 'pickGlad') tutorState().step = 'toArena';
  showCoach();
}

// Событие игры: продвинуть обучение, если его ждёт текущий шаг или следующий шаг той же группы
function coachEvent(name, data) {
  if (!tutorOn()) return;
  const i = coachStepIdx();
  const cur = TUTOR_STEPS[i];
  if (!cur) return;
  // шаги боя слушают только учебный бой (после него бой уже закрыт — событие battleClosed)
  if (cur.g === 'battle' && UI.battle && !(UI.battle.event && UI.battle.event.training)) return;
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
  save();
  showCoach();
}

function showCoach() {
  const s = TUTOR_STEPS[coachStepIdx()];
  if (!s) return;
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
  el.innerHTML = `${s.modal ? '<div class="tour-block"></div>' : ''}<div class="tour-hole ${s.modal ? '' : 'soft'}"></div>
    <div class="tour-card coach-card ${s.dock ? 'dock' : ''}" role="dialog" aria-labelledby="coachWho">
      <div class="coach-head"><img src="${PORTRAIT.url('doctore', 'neutral', 56)}" alt=""><b id="coachWho">Ферокс</b></div>
      <p>${s.text}</p>
      <div class="tour-btns">
        ${s.hint ? '' : '<button class="linkish" data-act="coachSkip">Пропустить обучение</button>'}
        <span class="sp"></span>${btn}
      </div>
    </div>`;
  TUTOR.step = s;
  const target = s.sel && coachTargets(s)[0];
  if (target && s.modal) {
    target.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (s.sel.startsWith('nav') || s.sel.startsWith('header') || s.sel.startsWith('#taskbar')) window.scrollTo(0, 0);
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

const coachTargets = s => (s.sel ? [...document.querySelectorAll(s.sel)].filter(e => e.offsetParent || e.getClientRects().length) : []);

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
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
  if (!els.length) { hole.className = `tour-hole none ${s.modal ? '' : 'soft'}`; hole.removeAttribute('style'); }
  let r = null;
  if (els.length) {
    const rs = els.map(x => x.getBoundingClientRect());
    r = { l: Math.min(...rs.map(x => x.left)) - pad, t: Math.min(...rs.map(x => x.top)) - pad, rt: Math.max(...rs.map(x => x.right)) + pad, b: Math.max(...rs.map(x => x.bottom)) + pad };
    r.l = Math.max(4, r.l); r.t = Math.max(4, r.t); r.rt = Math.min(vw - 4, r.rt); r.b = Math.min(vh - 4, r.b);
    hole.className = `tour-hole ${s.modal ? '' : 'soft'}`;
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
  // в бою Esc отменяет прицеливание, поэтому обучение он пропускает только на модальных шагах
  if (e.key === 'Escape' && (s.modal || s.hint)) { e.preventDefault(); s.hint ? ACTIONS.coachNext() : ACTIONS.coachSkip(); return true; }
  if (!s.modal) return false;
  if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); ACTIONS.coachNext(); }
  else if (e.key !== 'Tab') e.preventDefault();
  return true;
}

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
