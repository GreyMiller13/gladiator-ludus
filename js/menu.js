// ============================================================
//  Главное меню и обучение для новой игры
// ============================================================

// ------------------------------------------------------------
//  Главное меню: продолжить, новая игра, сохранение, справочник
// ------------------------------------------------------------
const MENU = { open: false, guide: false, settings: false, bgDone: false };

function showMenu() {
  if (UI.battle) return toast('Меню откроется после боя.', true);
  MENU.open = true; MENU.guide = false; MENU.settings = false;
  UI.gladId = null; renderModal();
  if (typeof hideCoach === 'function') hideCoach(); // обучение продолжится после «Продолжить»
  const el = $('#menu');
  el.hidden = false;
  document.body.classList.add('menu-on');
  renderMenu();
  paintMenuBg();
}
function hideMenu() {
  MENU.open = false; MENU.guide = false;
  $('#menu').hidden = true;
  document.body.classList.remove('menu-on');
}

function renderMenu() {
  const box = $('#menu .menu-box');
  if (MENU.guide) {
    box.className = 'menu-box guide-mode';
    box.innerHTML = `<div class="menu-guide-top"><button data-act="menuBack">← В меню</button></div>${screenRules()}`;
    return;
  }
  box.className = 'menu-box';
  // знамя лудуса — только когда есть игра, которую можно продолжить
  const ban = STATE && !STATE.lost ? `<div class="menu-crest"><img data-banner="${STATE.banner}" src="${bannerUrl(STATE.banner)}" alt=""></div>` : '';
  const head = `<div class="menu-head ${ban ? '' : 'no-crest'}">
      ${ban}
      <span class="menu-pre">лудус</span>
      <h1 class="menu-title">Кровь и&nbsp;Песок</h1>
    </div>`;
  if (MENU.settings) {
    box.innerHTML = `${head}<div class="menu-panel"><h2 class="menu-h">Настройки</h2>${settingsHtml()}
      <button class="menu-back" data-act="menuSettings" data-on="0">← Назад</button></div>`;
    return;
  }
  box.innerHTML = `${head}
    <p class="menu-sub">Отец оставил вам лудус в Помпеях и долг в пять тысяч денариев. Выучите бойцов, расплатитесь и проведите школу через Капую и Рим к Играм за рудис свободы.</p>
    ${STATE ? saveCard(STATE) : ''}
    <div class="menu-list" role="navigation" aria-label="Главное меню">
      <button data-act="newGameAsk">Новая игра</button>
      <button data-act="saveAsk">Сохранение</button>
      <button data-act="menuGuide">Справочник</button>
      <button data-act="menuSettings" data-on="1">Настройки</button>
    </div>`;
}

// Карточка сохранённой игры: ланиста, лудус, где остановились — нажатие продолжает игру
function saveCard(st) {
  const lost = !!st.lost;
  const ch = st.story ? ['I', 'II', 'III', 'IV'][st.story.chapter] || 'I' : '';
  const face = typeof PORTRAIT !== 'undefined' && st.lanista ? `<img class="sc-face" src="${PORTRAIT.url(st.lanista.portrait, lost ? 'angry' : 'neutral', 72)}" alt="">` : '';
  return `<button class="save-card ${lost ? 'lost' : ''}" data-act="${lost ? 'menuLost' : 'menuContinue'}">
    ${face}
    <span class="sc-body">
      <span class="sc-act">${lost ? 'Итог: лудус отобран' : 'Продолжить'}</span>
      <span class="sc-name">«${esc(st.ludusName || 'Лудус')}»</span>
      <span class="sc-meta">${ch ? `Глава ${ch}, ` : ''}день ${st.day}</span>
      <span class="sc-stats"><span>${ICON.coin}${st.gold}</span><span>${ICON.laurel}${st.fame}</span><span>${ICON.helm}${st.gladiators.length}</span></span>
    </span>
  </button>`;
}

// Настройки: звук, музыка, масштаб
function settingsHtml() {
  const has = typeof SFX !== 'undefined';
  const snd = has && !SFX.muted, mus = has && !SFX.musicMuted && snd;
  const sw = (act, on, label, hint, dis) => `<button class="set-row" data-act="${act}" role="switch" aria-checked="${on}" ${dis ? 'disabled' : ''}>
      <span class="set-l"><b>${label}</b><small>${hint}</small></span><i class="switch ${on ? 'on' : ''}"></i></button>`;
  const z = zoomPref();
  const seg = ZOOM_STEPS.map(s => `<button class="seg ${z === s ? 'on' : ''}" data-act="setZoom" data-z="${s}">${s === 'auto' ? `Авто (${Math.round(autoZoom() * 100)}%)` : `${Math.round(+s * 100)}%`}</button>`).join('');
  return `<div class="settings">
    ${sw('toggleSound', snd, 'Звук', 'Все звуки игры: удары, толпа, интерфейс', !has)}
    ${sw('toggleMusic', mus, 'Музыка', 'Фоновая музыка лудуса и арены', !has || !snd)}
    <div class="set-row static"><span class="set-l"><b>Масштаб</b><small>«Авто» увеличивает игру на больших мониторах по размеру окна</small></span></div>
    <div class="segs">${seg}</div>
  </div>`;
}

// Фон меню: Колизей и двое бойцов друг против друга
function paintMenuBg() {
  if (MENU.bgDone) return;
  const cv = $('#menu canvas');
  if (!cv || typeof paintArena !== 'function') return;
  MENU.bgDone = true;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = AW * dpr; cv.height = AH * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const crowd = paintArena(ctx, 3);
  for (const p of crowd) {
    ctx.fillStyle = CROWD_CLOTH[p.c]; ctx.fillRect(p.x - 2.1 * p.s, p.y - 6.5 * p.s, 4.2 * p.s, 6.5 * p.s);
    ctx.fillStyle = CROWD_SKIN[p.k]; ctx.fillRect(p.x - 1.5 * p.s, p.y - 9.6 * p.s, 3 * p.s, 3 * p.s);
  }
  // временные бойцы не должны тратить номера из сохранения
  const keep = STATE; STATE = null;
  const a = createGladiator('murmillo', 12, { forceSchool: true, quality: 3 });
  const b = createGladiator('retiarius', 12, { forceSchool: true, quality: 3 });
  STATE = keep;
  const duel = [[a, 'murmillo', 735, 1], [b, 'retiarius', 1035, -1]];
  for (const [g, cls, x, facing] of duel) {
    ctx.fillStyle = 'rgba(40,22,8,.35)';
    ctx.beginPath(); ctx.ellipse(x, 546, 58, 11, 0, 0, Math.PI * 2); ctx.fill();
    drawFigure(ctx, figureSpec(g), { ...stancePose(cls), ...GUARD }, x, 546, { scale: 1.45, facing });
  }
}

Object.assign(ACTIONS, {
  // непоказанные сцены из очереди (например, после перезагрузки), затем обучение с того же шага
  menuContinue: () => { hideMenu(); render(); flushScenes(() => resumeStory()); },
  menuLost: () => { hideMenu(); render(); showDebtLost(); },
  menuGuide: () => { MENU.guide = true; renderMenu(); $('#menu').scrollTop = 0; },
  menuBack: () => { MENU.guide = false; renderMenu(); },
  menuSettings: d => { MENU.settings = d.on === '1'; renderMenu(); },
});

