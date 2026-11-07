// Campaign presentation. Mechanics and delegated data-act handlers remain in ui.js.
const SHELL = { filter: 'all', motion: !trainStill(), nav: false };
const shellIcon = key => `<span class="ico">${SHELL_ART.tabIcons[key] || SHELL_ART.icons[key] || ''}</span>`;
const shellPending = g => g.freeAttr > 0 || (g.cls && g.freeSpec > 0) || (!g.cls && g.level >= SCHOOL_LEVEL);
const shellStatus = g => {
  const st = gladiatorStatus(g);
  return `<span class="tag ${g.wounded ? 'hurt' : !canFight(g) ? 'warn' : ''}">${st.text}</span>`;
};

renderHeader = function () {
  const res = (key, label, value) => `<div class="resource">${shellIcon(key)}<div><span class="label">${label}</span><strong>${value}</strong></div></div>`;
  $('header').innerHTML = `<button class="mobile-toggle ghost" data-act="shellNav" aria-label="Открыть навигацию" aria-expanded="${SHELL.nav}">☰</button>
    <div class="identity"><img data-banner="${STATE.banner}" src="${bannerUrl(STATE.banner)}" alt="Знамя лудуса"><div><span class="eyebrow">Школа гладиаторов</span><h1>${esc(STATE.ludusName)}</h1></div></div>
    <div class="resources res">${res('coin', 'Денарии', STATE.gold)}${debtRes()}${res('laurel', 'Слава', STATE.fame)}${res('helm', 'Бойцы', `${STATE.gladiators.length}<span class="resource-limit"> / ${MAX_GLADIATORS}</span>`)}${res('sun', 'День', STATE.day)}</div>
    <div class="header-actions"><button class="primary" data-act="nextDay" title="Содержание бойцов: ${upkeepCost()} денариев">Завершить день</button></div>`;
};

renderNav = function () {
  $('main').classList.toggle('legacy-content', UI.tab !== 'ludus');
  const counts = { ludus: STATE.gladiators.filter(shellPending).length, arena: STATE.events.filter(e => !e.done).length + (finalUnlocked() ? 1 : 0), contracts: (STATE.contracts || []).filter(e => !e.done).length, armory: STATE.armory.length };
  const names = { ludus: 'Лудус', arena: 'Арена', contracts: 'Заказы', smith: 'Кузнец', bazaar: 'Лавка редкостей', market: 'Невольничий рынок', armory: 'Склад', glory: 'Достижения', necro: 'Некрополь', rules: 'Справочник' };
  const group = (label, keys) => `<div class="nav-group"><div class="nav-label">${label}</div>${keys.map(k => `<button class="nav-button ${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" ${UI.tab === k ? 'aria-current="page"' : ''} ${k === 'bazaar' && !rareShopOpen() ? 'disabled title="Лавка откроется с ростом славы лудуса"' : ''}>${shellIcon(k)}<span>${names[k]}</span>${counts[k] ? `<span class="count badge">${counts[k]}</span>` : ''}</button>`).join('')}</div>`;
  const lanista = PORTRAIT.LANISTAS.find(l => l.key === STATE.lanista?.portrait);
  $('#sidebar nav').innerHTML = `<div class="wordmark">${shellIcon('laurel')}ЛУДУС</div><div class="side-caption">Кровь и песок</div>${group('Школа и арена', ['ludus','arena','contracts'])}${group('Торговля', ['smith','bazaar','market','armory'])}${group('Наследие', ['glory','necro','rules'])}<div class="sidebar-menu"><button class="nav-button" data-act="menu">${shellIcon('tablet')}<span>Меню игры</span></button></div>`;
  $('#sidebar .side-bottom')?.remove();
  $('#sidebar').insertAdjacentHTML('beforeend', `<div class="side-bottom">${lanista ? `<img src="${PORTRAIT.url(lanista.key, 'neutral', 64)}" alt="">` : ''}<div><strong>${lanista ? esc(lanista.title) : 'Хозяин школы'}</strong><small>Ланиста</small></div></div>`);
};
fitNav = function () {}; // Navigation wraps into a mobile drawer, never loses labels.

function shellCard(g) {
  const st = computeStats(g), xp = xpToNext(g.level);
  const flag = !g.cls && g.level >= SCHOOL_LEVEL ? 'Выбрать школу' : g.freeAttr ? `Очки: ${g.freeAttr}` : g.cls && g.freeSpec ? `Навыки: ${g.freeSpec}` : `Слава ${g.fame}`;
  return `<button class="fighter gcard" data-act="openGlad" data-id="${g.id}" aria-label="Открыть бойца ${esc(g.name)}"><div class="roster-art"><img class="roster-portrait" src="${fullFighter(g)}" alt="${esc(g.name)} в снаряжении"></div><div class="roster-body"><div class="roster-heading"><span class="fighter-name">${esc(g.name)}</span><span class="fighter-sub">${clsOf(g).name}<br>${g.level}-й уровень</span></div><div class="roster-status">${shellStatus(g)}<span class="power">Мощь <b>${combatPower(g)}</b></span><span class="roster-flag">${flag}</span></div><div class="roster-stats"><span>Здоровье<b>${st.maxHp}</b></span><span>Урон<b>${st.dmgMin}–${st.dmgMax}</b></span><span>Броня<b>${st.armor}</b></span></div><div class="roster-experience"><div><span>Опыт</span><b>${g.level >= MAX_LEVEL ? 'Высший уровень' : `${g.xp} / ${xp}`}</b></div><div class="xp" role="progressbar" aria-label="Опыт ${esc(g.name)}" aria-valuenow="${Math.min(g.xp, xp)}" aria-valuemin="0" aria-valuemax="${xp}"><span style="width:${g.level >= MAX_LEVEL ? 100 : Math.min(100, g.xp / xp * 100)}%"></span></div></div></div></button>`;
}

let shellRecruitPortraitCache;
function shellRecruitPortrait(){
 if(shellRecruitPortraitCache)return shellRecruitPortraitCache;
 const c=document.createElement('canvas');c.width=240;c.height=340;
 const ctx=c.getContext('2d');
 const spec={cls:'murmillo',look:{skin:0,hair:0,beard:false,bald:true,cloth:0,paint:0,crest:0},m:1,gth:1,weapon:{b:'gladius',q:0},offhand:{b:'scutum',q:0},helmet:{b:'galea',q:0},armor:null,arms:null,legs:null,belt:null,twoHanded:false,ranged:false};
 drawFigure(ctx,spec,stancePose('murmillo'),94,325,{scale:1.5,facing:1});
 ctx.globalCompositeOperation='source-in';
 const shade=ctx.createLinearGradient(0,25,0,340);shade.addColorStop(0,'#b6a37a99');shade.addColorStop(.6,'#83785b66');shade.addColorStop(1,'#665f4633');
 ctx.fillStyle=shade;ctx.fillRect(0,0,240,340);
 return shellRecruitPortraitCache=c.toDataURL('image/png');
}
function shellRecruitCard(){
 return `<article class="fighter recruit-card" aria-label="Новый боец"><div class="roster-art" aria-hidden="true"><img class="roster-portrait" src="${shellRecruitPortrait()}" alt=""></div><div class="roster-body"><div class="roster-heading"><span class="fighter-name">Новый боец</span><span class="fighter-sub recruit-placeholder" aria-hidden="true"><i class="skeleton-bar"></i><i class="skeleton-bar short"></i></span></div><div class="roster-status" aria-hidden="true"><span class="tag recruit-placeholder"><i class="skeleton-bar"></i></span><span class="power recruit-placeholder"><i class="skeleton-bar"></i></span><span class="roster-flag recruit-placeholder"><i class="skeleton-bar short"></i></span></div><div class="roster-stats" aria-hidden="true"><span>Здоровье<b class="skeleton-value"></b></span><span>Урон<b class="skeleton-value"></b></span><span>Броня<b class="skeleton-value"></b></span></div><div class="roster-experience recruit-action"><button data-act="tab" data-tab="market"><span aria-hidden="true">＋</span> Пополнить школу</button></div></div></article>`;
}

function shellToday() {
  const gs = STATE.gladiators, ready = gs.filter(canFight), pending = gs.filter(shellPending), train = gs.filter(canTrain), evs = STATE.events.filter(e => !e.done);
  const easy = evs.some(e => e.size <= ready.length && teamPower(bestTeam(e.size)) >= 1.25 * teamPower(e.enemies));
  const row = (n, title, desc, act, label, disabled = false) => `<div class="todo-row"><span class="num">${n}</span><div class="todo-copy"><strong>${title}</strong><small>${desc}</small></div><button class="link" ${act} ${disabled ? 'disabled' : ''}>${label}</button></div>`;
  const bet = STATE.bet?.day === STATE.day ? STATE.bet : null, dn = debtNext();
  return `<section class="panel today-panel"><div class="panel-heading"><h3>Дела дня</h3>${shellIcon('sun')}</div><div class="today-list">
    ${row(ready.length, 'Готовы к бою', ready.length ? easy ? 'Есть посильный бой' : 'Сравните силы на арене' : 'Бойцам нужен отдых или лечение', 'data-act="tab" data-tab="arena"', 'На арену')}
    ${row(pending.length, 'Ждут вашего решения', 'Очки или выбор школы', 'data-act="shellAttention"', 'Открыть', !pending.length)}
    ${row(train.length, 'Доступна тренировка', 'Опыт за денарии', 'data-act="shellTrainFirst"', 'К бойцу', !train.length)}
    ${row((STATE.contracts || []).filter(e => !e.done).length, 'Заказы горожан', 'Бои не насмерть', 'data-act="tab" data-tab="contracts"', 'К заказам')}
    </div><div class="finance-pair">${row('', 'Ставка на бой дня', bet ? bet.done ? 'Бой окончен' : bet.pick !== null ? `Поставлено ${bet.stake} ден.` : 'Сегодня вы ещё не ставили' : 'Сегодня ставок нет', 'data-act="shellBets"', 'К ставкам')}
    ${dn ? `<button class="debt-note" data-act="debtInfo"><div><strong>Долг отца: ${debtLeft()} ден.</strong><small>Платёж ${dn.amount} ден. ${dn.daysLeft <= 0 ? 'сегодня' : `через ${dn.daysLeft} дн.`}</small></div></button>` : `<div class="notice">${STATE.debt ? 'Долг отца выплачен. Школа принадлежит вам.' : 'Школа свободна от долга.'}</div>`}</div></section>`;
}

screenLudus = function () {
  const gs = STATE.gladiators, shown = gs.filter(g => SHELL.filter === 'all' || SHELL.filter === 'ready' && canFight(g) || SHELL.filter === 'wounded' && g.wounded > 0);
  const canRecruit = gs.length < MAX_GLADIATORS;
  const recent = STATE.journal.filter(j => j.day >= STATE.day - 1 && j.day <= STATE.day);
  return `<div class="section-head"><h2>Лудус</h2><div class="right"><span class="muted">${gs.filter(canFight).length} из ${gs.length} готовы к бою</span></div></div>
    <section class="training" aria-label="Тренировочный двор"><canvas class="ludus-bg" aria-hidden="true"></canvas><div class="training-copy"><h3>Тренировка во дворе школы</h3></div><button class="motion-toggle" data-act="shellMotion" aria-pressed="${SHELL.motion}" aria-label="${SHELL.motion ? 'Приостановить' : 'Продолжить'} анимацию">${SHELL.motion ? 'Ⅱ' : '▷'}</button></section>
    <div class="dashboard"><section class="barracks-section"><div class="barracks-head"><h3>Казармы</h3><span class="count">${gs.length} / ${MAX_GLADIATORS}</span><div class="filters" role="group" aria-label="Фильтр бойцов">${[['all','Все'],['ready','Готовы'],['wounded','Раненые']].map(([k,n]) => `<button data-act="shellFilter" data-filter="${k}" aria-pressed="${SHELL.filter === k}">${n}</button>`).join('')}</div></div>
    <div class="cards" data-roster-count="${shown.length + (canRecruit ? 1 : 0)}">${shown.map(shellCard).join('')}${!shown.length && gs.length ? '<div class="empty-state">Нет бойцов с таким статусом. Выберите другой фильтр.</div>' : ''}${canRecruit ? shellRecruitCard() : ''}</div></section>
    <aside class="right-rail" aria-label="Дела и события">${shellToday()}<section class="panel chronicle-panel"><div class="panel-heading"><h3>Хроника лудуса</h3></div><p class="chronicle-period">События за последние 2 дня</p><div class="journal-scroll" tabindex="0" role="region" aria-label="Хроника за последние два дня">${recent.map(j => `<div class="journal-row"><span class="journal-day">День ${j.day}</span><span>${j.text}</span></div>`).join('') || '<p>За последние два дня событий нет.</p>'}</div><div class="chronicle-footer"><button class="link" data-act="shellJournal">Показать всю хронику</button></div></section></aside></div>`;
};

paintLudusHero = function () {
  const cv = $('main canvas.ludus-bg');
  if (!cv || !STATE || !cv.clientWidth) return;
  const W = Math.max(260, Math.round(cv.clientWidth)), scene = cv.closest('.training');
  scene.style.removeProperty('height');
  ludusTraining(cv, STATE.gladiators, 0, W, Math.round(scene.clientHeight));
  if (!SHELL.motion && TRAIN.raf) { cancelAnimationFrame(TRAIN.raf); TRAIN.raf = 0; }
};

const originalMenu = renderMenu;
renderMenu = function () {
  if (MENU.guide || MENU.settings) { originalMenu(); return; }
  const box = $('#menu .menu-box'); box.className = 'menu-box shell-menu';
  box.innerHTML = `<div class="shell"><div class="top"><div class="wordmark">${shellIcon('laurel')}ЛУДУС</div></div><div class="main-home"><div class="menu-column"><div class="chapter-line"><span class="eyebrow">Кровь. Песок. Твоё наследие.</span></div><p class="tagline">Возглавь школу гладиаторов.<br>Дай ей имя, достойное арены.</p>
    ${STATE ? `<button class="continue ${STATE.lost ? 'lost' : ''}" data-act="${STATE.lost ? 'menuLost' : 'menuContinue'}"><img src="${bannerUrl(STATE.banner)}" alt=""><span class="continue-body"><strong>${STATE.lost ? 'Лудус отобран' : 'Продолжить'}</strong><span class="continue-name">${esc(STATE.ludusName)}</span><small>${STATE.story ? `Глава ${['I','II','III','IV'][STATE.story.chapter] || 'I'} · ` : ''}День ${STATE.day}</small><span class="campaign-stats">${[['coin',STATE.gold,'денариев'],['laurel',STATE.fame,'славы'],['helm',STATE.gladiators.length,'бойцов']].map(([k,v,n]) => `<span>${shellIcon(k)}<b>${v}</b><small>${n}</small></span>`).join('')}</span></span></button>` : ''}
    <div class="menu-nav" role="navigation" aria-label="Главное меню">${[['newGameAsk','helm','Новая игра'],['saveAsk','armory','Сохранение'],['menuGuide','rules','Справочник'],['menuSettings','sun','Настройки']].map(([act,k,n]) => `<button class="nav-button" data-act="${act}" data-on="1">${shellIcon(k)}${n}</button>`).join('')}</div></div><div class="arena-caption"><strong>Мурмиллон против ретиария</strong><span>Сталь и щит. Сеть и трезубец.</span></div></div></div>`;
};
const originalNewGame = showNewGameDialog;
showNewGameDialog = function () {
  originalNewGame();
  const form = $('#dialog .newgame');
  form.classList.add('campaign-form');
  form.querySelector('.ng-cols').insertAdjacentHTML('afterend', '<div class="choice-descriptions"><p id="lanista-description"></p><p id="banner-description"></p></div>');
  shellChoiceDescription();
};
function shellChoiceDescription() {
  const el = $('#lanista-description');
  if (!el) return;
  const key = $('.lanista-pick .lp.on')?.dataset.k, l = PORTRAIT.LANISTAS.find(l => l.key === key);
  el.textContent = l?.desc || '';
  const banner = bannerOf(pickedBanner());
  $('#banner-description').textContent = banner.desc || banner.name || '';
}
for (const name of ['pickLanista','pickBanner']) {
  const action = ACTIONS[name];
  ACTIONS[name] = (...args) => { action(...args); shellChoiceDescription(); };
}
function shellNav(open) {
  SHELL.nav = open;
  $('#sidebar').classList.toggle('open', open); $('#nav-shade').hidden = !open;
  $('#nav-shade').classList.toggle('open', open);
  $('.mobile-toggle')?.setAttribute('aria-expanded', String(open));
}
const originalTab = ACTIONS.tab;
ACTIONS.tab = (...args) => { shellNav(false); originalTab(...args); $('main').scrollTop = 0; };
Object.assign(ACTIONS, {
  shellNav: () => shellNav(!SHELL.nav), shellNavClose: () => shellNav(false),
  shellFilter: d => { SHELL.filter = d.filter; render(); },
  shellAttention: () => { const g = STATE.gladiators.find(shellPending); if (g) ACTIONS.openGlad({id:g.id}); },
  shellTrainFirst: () => { const g = STATE.gladiators.find(canTrain); if (g) ACTIONS.openGlad({id:g.id}); },
  shellBets: () => { UI.arenaTab = 'bets'; ACTIONS.tab({tab:'arena'}); },
  shellJournal: () => showDialog({title:'Хроника лудуса', body: `<div class="shell-journal">${STATE.journal.map(j => `<p><small>День ${j.day}</small> ${j.text}</p>`).join('') || 'Событий пока нет.'}</div>`, ok:'К школе', cancel:false}),
  shellMotion: () => { SHELL.motion = !SHELL.motion; render(); },
});
const originalShowMenu = showMenu;
showMenu = function () { shellNav(false); originalShowMenu(); };
let shellResize;
addEventListener('resize', () => { clearTimeout(shellResize); shellResize = setTimeout(() => { if (STATE && UI.tab === 'ludus') paintLudusHero(); if (innerWidth > 650) shellNav(false); }, 100); });
