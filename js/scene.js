// ============================================================
//  Сцены разговора: портрет говорящего, имя, реплика
// ============================================================
const SCENE = { ids: [], id: null, lines: null, i: 0, onDone: null };

const sceneOpen = () => !!SCENE.lines;

// Показать сцены по очереди; уже открытая сцена дополняет очередь
function playScenes(ids, onDone) {
  const list = (ids || []).filter(id => STORY.SCENES[id]);
  if (sceneOpen()) {
    SCENE.ids.push(...list);
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
  const id = SCENE.ids.shift();
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

Object.assign(ACTIONS, {
  tasksOpen: () => showTasksDialog(),
  taskGo: d => { closeDialog(); ACTIONS.tab(d); },
  sceneNext: () => { if (!sceneOpen()) return; SCENE.i++; if (SCENE.i >= SCENE.lines.length) nextScene(); else showSceneLine(); },
  sceneSkip: () => { if (sceneOpen()) nextScene(); },
});
