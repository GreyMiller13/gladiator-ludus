// ============================================================
//  Главное меню и обучение для новой игры
// ============================================================

// ------------------------------------------------------------
//  Главное меню: продолжить, новая игра, сохранение, справочник
// ------------------------------------------------------------
const MENU = { open: false, guide: false, bgDone: false };

function showMenu() {
  if (UI.battle) return toast('Меню откроется после боя.', true);
  MENU.open = true; MENU.guide = false;
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
  box.innerHTML = `
    <div class="menu-crest">${ICON.crest}</div>
    <span class="menu-pre">лудус</span>
    <h1 class="menu-title">Кровь и&nbsp;Песок</h1>
    <p class="menu-sub">Отец оставил вам лудус в Помпеях и долг в пять тысяч денариев. Выучите бойцов, расплатитесь с кредиторами и проведите школу через арены Капуи и Рима — к Играм за рудис свободы.</p>
    <div class="menu-btns">
      ${STATE && STATE.lost ? `<button class="primary" data-act="menuLost">Итог: лудус отобран<small>${saveSummary(STATE)}</small></button>` : ''}
      ${STATE && !STATE.lost ? `<button class="primary" data-act="menuContinue">Продолжить<small>${saveSummary(STATE)}</small></button>` : ''}
      <button class="${STATE ? '' : 'primary'}" data-act="newGameAsk">Новая игра</button>
      <button data-act="saveAsk">Сохранение</button>
      <button data-act="menuGuide">Справочник</button>
    </div>
    <div class="menu-foot">${soundBtn()}${zoomBtn()}</div>`;
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
});

