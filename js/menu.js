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
    <div class="menu-foot">${soundBtn()}</div>`;
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
  menuContinue: () => { hideMenu(); render(); },
  menuLost: () => { hideMenu(); render(); showDebtLost(); },
  menuGuide: () => { MENU.guide = true; renderMenu(); $('#menu').scrollTop = 0; },
  menuBack: () => { MENU.guide = false; renderMenu(); },
});

// ------------------------------------------------------------
//  Обучение: затемнение, подсветка элемента, пояснение и кнопки
// ------------------------------------------------------------
const TOUR_STEPS = [
  { title: 'Добро пожаловать в лудус', text: 'Вы — ланиста, хозяин школы гладиаторов. Покупайте бойцов, учите их, снаряжайте и выводите на арену. Короткая экскурсия покажет, где что находится.' },
  { sel: 'header .res > div', title: 'Казна и слава', text: 'Денарии тратятся на бойцов, снаряжение, тренировки и лекаря. Слава открывает новые арены и лавку редкостей. Рядом — число бойцов в казармах и текущий день.' },
  { tab: 'ludus', sel: 'nav [data-tab="ludus"]', title: 'Лудус', text: 'Казармы: здесь живут ваши бойцы, а справа ведётся хроника лудуса — всё, что случилось за дни.' },
  { tab: 'ludus', sel: 'main .gcard', title: 'Карточка бойца', text: 'Нажмите на бойца, чтобы открыть его окно: характеристики, снаряжение (вещи можно перетаскивать со склада на бойца и обратно), тренировку, лекаря и выбор школы с 5-го уровня.' },
  { tab: 'arena', sel: 'nav [data-tab="arena"]', title: 'Арена', text: 'Бои дня. Выберите схватку, отберите бойцов и решите, как сражаться: автобоем или в ручном режиме, командуя каждым ходом. После боя проигравших судит толпа.' },
  { tab: 'contracts', sel: 'nav [data-tab="contracts"]', title: 'Заказы', text: 'Богатые горожане платят за особые бои: победить без потерь, уложиться в число раундов, выстоять против большинства. Заказные бои идут не насмерть.' },
  { tab: 'smith', sel: 'nav [data-tab="smith"]', title: 'Кузнец', text: 'Оружие и доспехи. Ассортимент обновляется каждый день, а качество растёт с открытыми аренами. Вещь своей школы даёт бойцу +25% к её характеристикам.' },
  { tab: 'market', sel: 'nav [data-tab="market"]', title: 'Невольничий рынок', text: 'Новые бойцы. Смотрите на склонности: от них зависит, к какой школе новобранец подойдёт лучше всего.' },
  { tab: 'armory', sel: 'nav [data-tab="armory"]', title: 'Склад', text: 'Всё снаряжение, которое не надето на бойцов: покупки, трофеи с арены, снятые вещи. Ненужное можно продать.' },
  { tab: 'glory', sel: 'nav [data-tab="glory"]', title: 'Достижения', text: 'Почётные свершения лудуса и награды за них.' },
  { tab: 'necro', sel: 'nav [data-tab="necro"]', title: 'Некрополь', text: 'Память о павших бойцах: кто, где и от чьей руки погиб.' },
  { tab: 'rules', sel: 'nav [data-tab="rules"]', title: 'Справочник', text: 'Все правила и формулы игры: характеристики, бой, приговор толпы, снаряжение и школы. Справочник открывается и из главного меню.' },
  { tab: 'ludus', sel: 'header [data-act="nextDay"]', title: 'Завершить день', text: 'Когда дела дня сделаны, завершите его: бойцы отдохнут и подлечатся, вы заплатите за их содержание, появятся новые бои, товары и заказы.' },
  { tab: 'ludus', sel: 'header [data-act="menu"]', title: 'Меню', text: 'Главное меню: продолжить, начать заново, скачать сохранение в файл или загрузить его на другом устройстве и открыть справочник.' },
  { title: 'Ave, ланиста!', text: 'Начните с рынка или кузнеца: у вашего новобранца лишь грубый гладиус. Удачи на песке арены.' },
];
const TOUR = { i: -1 };

function startTour() {
  hideMenu();
  UI.gladId = null; renderModal();
  TOUR.i = 0;
  $('#tour').hidden = false;
  window.addEventListener('resize', placeTour);
  showTourStep();
}
function endTour(done) {
  TOUR.i = -1;
  const el = $('#tour');
  el.hidden = true; el.innerHTML = '';
  window.removeEventListener('resize', placeTour);
  // с интерфейсом игрок уже знаком: в следующей новой игре галочка обучения снята
  try { localStorage.setItem(TOUR_PREF, '0'); } catch (e) { /* хранилище недоступно */ }
  UI.tab = 'ludus'; render(); window.scrollTo(0, 0);
  if (!done) toast('Обучение пропущено. Правила всегда под рукой в «Справочнике».');
}
function tourSteps() { return TOUR_STEPS.filter(s => !s.tab || $(`nav [data-tab="${s.tab}"]`) || s.tab === 'ludus'); }

function showTourStep() {
  const steps = tourSteps(), st = steps[TOUR.i];
  if (!st) return endTour(true);
  if (st.tab && UI.tab !== st.tab) { UI.tab = st.tab; render(); }
  const last = TOUR.i === steps.length - 1;
  $('#tour').innerHTML = `<div class="tour-block"></div><div class="tour-hole"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tourTitle">
      <div class="tour-n">${TOUR.i + 1} из ${steps.length}</div>
      <h3 id="tourTitle">${st.title}</h3>
      <p>${st.text}</p>
      <div class="tour-btns">
        ${last ? '' : '<button class="linkish" data-act="tourSkip">Пропустить обучение</button>'}
        <span class="sp"></span>
        ${TOUR.i > 0 ? '<button data-act="tourPrev">Назад</button>' : ''}
        <button class="primary" data-act="tourNext">${last ? 'Начать игру' : 'Далее'}</button>
      </div>
    </div>`;
  const target = st.sel && $(st.sel);
  if (target) {
    target.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (st.sel.startsWith('nav') || st.sel.startsWith('header')) window.scrollTo(0, 0);
  }
  placeTour();
  $('#tour [data-act="tourNext"]').focus();
}

// Подсветка: прямоугольник вокруг всех найденных элементов, карточка — рядом, в пределах экрана
function placeTour() {
  const st = tourSteps()[TOUR.i];
  if (!st) return;
  const hole = $('#tour .tour-hole'), card = $('#tour .tour-card');
  const els = st.sel ? [...document.querySelectorAll(st.sel)].filter(e => e.offsetParent) : [];
  const one = st.sel && st.sel.includes('.gcard') ? els.slice(0, 1) : els;
  const vw = window.innerWidth, vh = window.innerHeight, pad = 8;
  if (!one.length) {
    hole.className = 'tour-hole none';
    hole.removeAttribute('style');
    card.style.left = `${Math.max(12, (vw - card.offsetWidth) / 2)}px`;
    card.style.top = `${Math.max(12, (vh - card.offsetHeight) / 2)}px`;
    return;
  }
  const rs = one.map(e => e.getBoundingClientRect());
  const r = { l: Math.min(...rs.map(x => x.left)) - pad, t: Math.min(...rs.map(x => x.top)) - pad, rt: Math.max(...rs.map(x => x.right)) + pad, b: Math.max(...rs.map(x => x.bottom)) + pad };
  r.l = Math.max(4, r.l); r.t = Math.max(4, r.t); r.rt = Math.min(vw - 4, r.rt); r.b = Math.min(vh - 4, r.b);
  hole.className = 'tour-hole';
  Object.assign(hole.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${r.rt - r.l}px`, height: `${r.b - r.t}px` });
  const cw = card.offsetWidth, chh = card.offsetHeight;
  const below = r.b + 14 + chh < vh;
  const top = below ? r.b + 14 : Math.max(12, r.t - 14 - chh);
  const left = clamp((r.l + r.rt) / 2 - cw / 2, 12, vw - cw - 12);
  card.style.left = `${left}px`; card.style.top = `${top}px`;
}

// Клавиши во время обучения: Enter/→ — далее, ← — назад, Esc — пропустить
function tourKey(e) {
  if (TOUR.i < 0) return false;
  if (e.key === 'Escape') ACTIONS.tourSkip();
  else if (e.key === 'ArrowRight') ACTIONS.tourNext();
  else if (e.key === 'ArrowLeft') ACTIONS.tourPrev();
  else if (e.key !== 'Enter' && e.key !== 'Tab') e.preventDefault();
  return true;
}

Object.assign(ACTIONS, {
  tourNext: () => { TOUR.i++; showTourStep(); },
  tourPrev: () => { TOUR.i = Math.max(0, TOUR.i - 1); showTourStep(); },
  tourSkip: () => endTour(false),
});
