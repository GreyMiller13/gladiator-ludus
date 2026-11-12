// Approved fighter layout, backed by the existing campaign actions and calculations.
const FIGHTER_VIEW = { tab: 'attrs', id: null, returnFocus: null };
function fighterSchool(g) {
  if (!g.cls) return `<p class="school-intro">${g.level >= SCHOOL_LEVEL ? 'Боец готов к посвящению. Выберите школу по его склонностям.' : `Посвящение в школу доступно с ${SCHOOL_LEVEL}-го уровня.`}</p>${bestClasses(g, CLASS_KEYS.length).map(({c,a},i) => `<div class="school-choice" data-tip="${tipAttrHtml(buildTip(c))}"><div><strong>${CLASSES[c].name}</strong><small>${i === 0 ? 'Лучше всего подходит · ' : ''}${Math.round(a * 100)}% склонность</small></div><button class="${i === 0 ? 'primary' : 'ghost'}" data-act="chooseClass" data-cls="${c}" ${g.level < SCHOOL_LEVEL ? 'disabled' : ''}>Выбрать</button></div>`).join('')}<p class="small muted">Школа не даёт снаряжение. Подходящие вещи можно купить у кузнеца.</p>`;
  const C = clsOf(g), next = [1,2,3,4].find(t => g.level < TIER_LEVEL[t]);
  return `<div class="school-tools"><button class="small ghost" data-act="respec" ${!Object.keys(g.perks).length || STATE.gold < respecCost(g) ? 'disabled' : ''}>Сбросить навыки<small>${respecCost(g)} ден.</small></button><button class="small ghost" data-act="changeClass" ${STATE.gold < changeClassCost(g) ? 'disabled' : ''}>Сменить школу<small>${changeClassCost(g)} ден.</small></button></div>
    <div class="school-access"><strong>Открыты ступени: ${[1,2,3,4].filter(t => g.level >= TIER_LEVEL[t]).map(t => ['I','II','III','IV'][t-1]).join(', ')}</strong><span>${next ? `Следующая с ${TIER_LEVEL[next]}-го уровня.` : 'Все ступени открыты.'}</span></div>
    <div class="school-ability"><strong>${C.ability.name}</strong><p>${C.ability.desc}</p><small>Перезарядка: ${C.ability.cd} ${plural(C.ability.cd,'ход','хода','ходов')}.</small></div><div class="spec-points">Очков специализации: <b>${g.freeSpec}</b></div>
    <div class="skill-tiers">${[1,2,3,4].map(t => `<section class="skill-tier ${g.level < TIER_LEVEL[t] ? 'level-locked' : 'level-open'}"><div class="skill-tier-head"><strong>${['I','II','III','IV'][t-1]} ступень · ${TIER_LEVEL[t]}-й уровень</strong><span>${g.level < TIER_LEVEL[t] ? 'Закрыто' : 'Доступно'}</span></div><div class="skill-pair">${C.perks.filter(p => p.tier === t).map(p => {
      const r = perkRank(g,p.id), at = n => ({v:p.v[n],v2:p.v2 ? p.v2[n] : 0});
      return `<div class="skill"><div class="skill-name"><strong>${p.name}</strong><span class="skill-rank">${r} / ${p.max}</span>${canLearnPerk(g,{...p,cls:g.cls}) ? `<button class="learn-skill" data-act="learn" data-perk="${p.id}" aria-label="Изучить: ${esc(p.name)}">+</button>` : ''}</div><p>${p.desc(at(Math.max(0,r-1)))}</p>${r && r < p.max ? `<small>Следующий ранг: ${p.desc(at(r))}</small>` : ''}</div>`;
    }).join('')}</div></section>`).join('')}</div>`;
}
function fighterCompare(g, it) {
  const copy = {...g, equip:{...g.equip}};
  equipItem(copy, it);
  const before = computeStats(g), after = computeStats(copy);
  const rows = [['Здоровье','maxHp'],['Броня','armor'],['Урон от','dmgMin'],['Урон до','dmgMax'],['Точность','acc'],['Уклонение','dodge'],['Крит','crit'],['Блок','block'],['Инициатива','init'],['ОД','ap'],['Дальность','reach'],['Сопротивление','resist'],['Милость','mercy']];
  const changed = rows.filter(([,key]) => (before[key] || 0) !== (after[key] || 0));
  return `<div class="gear-compare">${changed.map(([label,key]) => {const a=before[key]||0,b=after[key]||0; return `<span>${label}</span><b class="${b > a ? 'better' : 'worse'}">${a} → ${b}</b>`;}).join('') || '<span>Боевые показатели не изменятся</span>'}</div><small>${itemFits(it,g.cls) ? 'Школьная выучка учтена' : 'Бонус школы не будет получен'}</small>`;
}
renderModal = function () {
  const host = $('#modal'), g = UI.gladId && glad(UI.gladId);
  if (UI.attrDraft && UI.attrDraft.id !== UI.gladId) UI.attrDraft = null;
  if (!g) {
    UI.preview = null; host.innerHTML = ''; UI.gladId = null;
    if (FIGHTER_VIEW.id && FIGHTER_VIEW.returnFocus?.isConnected) FIGHTER_VIEW.returnFocus.focus({preventScroll:true});
    FIGHTER_VIEW.id = null; return;
  }
  const fresh = FIGHTER_VIEW.id !== g.id;
  if (!FIGHTER_VIEW.id) FIGHTER_VIEW.returnFocus = document.activeElement;
  if (fresh) FIGHTER_VIEW.tab = 'attrs';
  FIGHTER_VIEW.id = g.id;
  const focus = host.contains(document.activeElement) ? {act:document.activeElement.dataset.act, k:document.activeElement.dataset.k, slot:document.activeElement.dataset.slot, item:document.activeElement.dataset.item, perk:document.activeElement.dataset.perk} : null;
  const scrolls = [...host.querySelectorAll('[data-scroll]')].map(el => [el.dataset.scroll,el.scrollTop]);
  const draft = UI.attrDraft?.add, view = attrDraftView(g,draft), s = computeStats(view), C = clsOf(g);
  const recommended = new Set(classBuild(g.cls || bestClasses(view,1)[0].c).main);
  const attrs = ATTR_KEYS.map(k => `<div class="attr-row ${recommended.has(k) ? 'attr-recommended' : ''}"><span data-tip="${tipAttrHtml(tipAttr[k]())}">${ATTRS[k].name}</span>${draft?.[k] ? `<button class="small ghost" data-act="subAttr" data-k="${k}" aria-label="Уменьшить ${ATTRS[k].name}">−</button>` : ''}<b>${view.attrs[k]}${s.attrs[k] !== view.attrs[k] ? `<small>+${s.attrs[k]-view.attrs[k]}</small>` : ''}</b>${view.freeAttr > 0 ? `<button class="small ghost" data-act="addAttr" data-k="${k}" aria-label="Увеличить ${ATTRS[k].name}">+</button>` : ''}</div>`).join('');
  const derived = [['Здоровье',s.maxHp,'hp'],['Урон',`${s.dmgMin}–${s.dmgMax}${s.dmgMult !== 1 ? ` ×${s.dmgMult.toFixed(2)}` : ''}`,'dmg'],['Точность',`${s.acc}%`,'acc'],['Уклонение',`${s.dodge}%`,'dodge'],['Броня',s.armor,'armor'],['Крит',`${s.crit}%, ×${s.critMult.toFixed(2)}`,'crit'],['Блок',`${s.block}%`,'block'],['Инициатива',s.init,'init'],['Очки действия',s.ap,'init'],['Удар / умение',`${s.atkAp} / ${abilityAp(s)} ОД`,'apcost'],['Дальность',s.reach,'reach'],['Сопротивление',`${Math.min(100,s.resist)}%`,'resist'],['Милость толпы',`${s.mercy||0}%`,'mercy']];
  if(s.stun) derived.push(['Оглушение',`${s.stun}%`,'stun']);
  if(g.cls) derived.push(['Школьная выучка',s.fits,'fits']);
  const sel = UI.slotSel && SLOTS[UI.slotSel] ? UI.slotSel : null;
  const placeholders = {helmet:'galea',armor:'leather',arms:'manica',belt:'balteus',weapon:'gladius',offhand:'parma',legs:'ocrea'};
  const slot = k => {
    const it = g.equip[k], locked = k === 'offhand' && !it && s.twoHanded && !s.ranged;
    return `<div class="equip-slot dslot ${it ? 'occupied qb'+it.q : 'empty-slot'} ${sel === k ? 'on' : ''}" data-act="slotSel" data-slot="${k}" data-drop="slot" ${it ? 'data-drag="eq"' : ''} role="button" tabindex="0" aria-label="${SLOTS[k]}: ${it ? esc(it.name) : 'пусто'}" data-tip="${tipAttrHtml(it ? `${it.name}\n${itemStatsText(it,g.cls)}\nПеретащите на склад, чтобы снять` : locked ? 'Обе руки заняты двуручным оружием' : 'Выбрать вещи для этого слота')}"><img draggable="false" src="${itemIcon(it || {base:placeholders[k],q:0},64)}" alt=""><div><span class="equip-slot-label">${SLOTS[k]}</span><strong>${it ? esc(it.name) : locked ? 'Обе руки заняты' : 'Пусто'}</strong></div>${it ? `<button class="dx" data-act="unequip" data-slot="${k}" aria-label="Снять: ${esc(it.name)}">×</button>` : ''}</div>`;
  };
  const stash = STATE.armory.filter(it => !sel || it.slot === sel).slice().sort((a,b) => SLOT_KEYS.indexOf(a.slot)-SLOT_KEYS.indexOf(b.slot) || itemFits(b,g.cls)-itemFits(a,g.cls) || b.q-a.q);
  const record = [['Бои',g.record.fights],['Победы',g.record.wins],['Поражения',g.record.losses],['Убийства',g.record.kills],['Слава',g.fame],['Опыт',`${g.xp} / ${xpToNext(g.level)}`]];
  host.innerHTML = `<div class="modal-bg" data-act="closeModalBg"><div class="fighter-dialog glad" role="dialog" aria-modal="true" aria-labelledby="fighter-title" open data-scroll="dialog">
    <div class="dialog-head"><div><div class="eyebrow">Боец лудуса · ${STATE.gladiators.indexOf(g)+1} из ${STATE.gladiators.length}</div><h2 id="fighter-title">${esc(g.name)}</h2></div><button class="close" data-act="closeModal" aria-label="Закрыть окно">×</button></div>
    <div class="dialog-body"><div class="profile-head"><img src="${portrait(g,64,80,{bust:true})}" alt=""><div class="profile-identity"><h3>${C.name}</h3><p>${g.level}-й уровень · ${esc(g.origin)}</p><p class="profile-power">Мощь <b>${combatPower(g)}</b></p>${shellStatus(g)}</div><div class="profile-record" aria-label="Статистика бойца">${record.map(([n,v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div><div class="actions"><button class="small primary train-action" data-act="train" ${!canTrain(g) ? 'disabled' : ''} title="Один раз в день, +${trainXp(g)} опыта">${g.trainedToday ? 'Тренировка завершена' : `Тренировать · ${trainCost(g)} ден.`}</button>${g.wounded ? `<button class="small heal-action" data-act="heal" ${STATE.gold < healCost(g) ? 'disabled' : ''}>Лекарь<small>${healCost(g)} ден.</small></button>` : ''}<button class="small ghost rename-action" data-act="rename">Имя</button><button class="small ghost sell-action" data-act="dismiss">Продать</button></div></div>
    <div class="profile-layout"><div class="equipment-column"><section class="profile-block equipment-panel"><h3>Снаряжение</h3><div class="equipment-doll doll"><div class="equipment-side equipment-left">${['helmet','armor','arms','belt'].map(slot).join('')}</div><div class="equipment-figure dfig" data-drop="fig"><img src="${fullFighter(g,360,380)}" alt="Боец в текущем снаряжении"></div><div class="equipment-side equipment-right">${['weapon','offhand','legs'].map(slot).join('')}</div></div><p class="equipment-hint">Выберите слот для отбора вещей. Перетащите надетую вещь на склад или нажмите ×, чтобы снять.</p></section>
    <section class="profile-block panel stash stash-panel" data-drop="stash"><h3>Склад снаряжения${sel ? `<button class="small ghost" data-act="slotSel" data-slot="">Все слоты</button>` : ''}</h3><p class="stash-hint">Перетащите вещь на бойца или нажмите на неё.</p><div class="stash-list" data-scroll="stash">${stash.map(it => `<button class="stash-item qb${it.q}" data-act="equip" data-drag="st" data-item="${it.id}" data-slot="${it.slot}" title="Надеть: ${esc(it.name)}. ${esc(itemStatsText(it,g.cls))}"><img draggable="false" src="${itemIcon(it,40)}" alt=""><span>${esc(it.name)}</span></button>`).join('') || `<p class="stash-hint">${sel ? 'Нет вещей для выбранного слота.' : 'Нет свободного снаряжения.'}</p>`}</div></section></div>
    <div class="profile-details"><div class="profile-tablist" role="tablist" aria-label="Разделы бойца">${[['attrs','Характеристики'],['school','Школа и навыки']].map(([k,n]) => `<button role="tab" id="profile-tab-${k}" aria-controls="profile-${k}" aria-selected="${FIGHTER_VIEW.tab === k}" tabindex="${FIGHTER_VIEW.tab === k ? 0 : -1}" data-act="fighterTab" data-tab="${k}">${n}</button>`).join('')}</div>
    <section class="profile-view attrs-panel" id="profile-attrs" role="tabpanel" aria-labelledby="profile-tab-attrs" data-scroll="attrs" ${FIGHTER_VIEW.tab === 'attrs' ? '' : 'hidden'}><div class="attributes-layout"><div class="base-attributes"><h4>Основные</h4>${attrs}<div class="attr-summary"><p class="attr-points">Свободных очков: ${view.freeAttr}</p><p class="attr-hint">Золотым выделены главные характеристики ${g.cls ? 'школы' : 'самой подходящей школы'}.</p></div>${draftSum(draft || {}) ? '<button class="primary small attr-commit-button" data-act="commitAttrs">Подтвердить</button>' : ''}</div><div class="battle-attributes"><h4>Боевые показатели</h4><div class="derived">${derived.map(([n,v,k]) => `<span data-tip="${tipAttrHtml(tipStat[k](s))}">${n}</span><b>${v}</b>`).join('')}</div><p class="small"><a href="#" data-act="openGuide" data-ch="stats">Все формулы в справочнике</a></p></div></div></section>
    <section class="profile-view school-panel" id="profile-school" role="tabpanel" aria-labelledby="profile-tab-school" data-scroll="school" ${FIGHTER_VIEW.tab === 'school' ? '' : 'hidden'}><div class="skill-scroll">${fighterSchool(view)}</div></section></div></div>
    <div class="profile-foot"><div class="switcher"><button class="small ghost" data-act="gladStep" data-d="-1" ${STATE.gladiators.length < 2 ? 'disabled' : ''}>Предыдущий</button><span>${STATE.gladiators.indexOf(g)+1} / ${STATE.gladiators.length}</span><button class="small ghost" data-act="gladStep" data-d="1" ${STATE.gladiators.length < 2 ? 'disabled' : ''}>Следующий</button></div></div></div></div></div>`;
  UI.preview = null;
  if(!fresh) for(const [key,value] of scrolls) host.querySelector(`[data-scroll="${key}"]`).scrollTop=value;
  if(fresh) host.querySelector('[data-act="closeModal"]').focus({preventScroll:true});
  else if(focus?.act) {
    const match = [...host.querySelectorAll('[data-act]')].find(el => Object.entries(focus).every(([k,v]) => v === undefined || el.dataset[k] === v));
    (match || host.querySelector('[data-act="fighterTab"][aria-selected="true"]')).focus({preventScroll:true});
  }
};
function fighterTab(key) {
  FIGHTER_VIEW.tab = key === 'school' ? 'school' : 'attrs';
  for(const k of ['attrs','school']) {
    const tab = $('#profile-tab-'+k); if(!tab) return;
    const on = FIGHTER_VIEW.tab === k;
    tab.setAttribute('aria-selected',String(on)); tab.tabIndex=on?0:-1;
    $('#profile-'+k).hidden=!on;
  }
}
ACTIONS.fighterTab = d => fighterTab(d.tab);
ACTIONS.fighterStill = () => { $('#glPreview').hidden=true; $('#glPreview').previousElementSibling.hidden=false; };
const originalPreview = ACTIONS.pvPlay;
ACTIONS.pvPlay = (...args) => { $('#glPreview').hidden=false; $('#glPreview').previousElementSibling.hidden=true; originalPreview(...args); };
// Capture before ui.js: arrow keys inside the tablist change tabs, not fighters.
document.addEventListener('keydown', e => {
  if(UI.dlg || UI.battle || !UI.gladId) return;
  if(e.target.closest('.profile-tablist') && ['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
    e.preventDefault();e.stopImmediatePropagation();
    fighterTab(e.key==='Home'?'attrs':e.key==='End'?'school':FIGHTER_VIEW.tab==='attrs'?'school':'attrs');
    $('#profile-tab-'+FIGHTER_VIEW.tab).focus(); return;
  }
  if(e.target.matches('.dslot[role="button"]') && ['Enter',' '].includes(e.key)) { e.preventDefault();e.stopImmediatePropagation();e.target.click(); }
  if(e.key==='Tab') {
    const els=[...$('#modal').querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
    if(e.shiftKey && e.target===els[0]) {e.preventDefault();els.at(-1).focus();}
    else if(!e.shiftKey && e.target===els.at(-1)){e.preventDefault();els[0].focus();}
  }
},true);
// Teaching a hidden detail tab must reveal it before coach targets are measured.
const originalCoachCard = coachCard;
coachCard = function (step) {
  if (UI.gladId && step.sel === '#modal .school-panel') fighterTab('school');
  if (UI.gladId && step.sel === '#modal .attrs-panel') fighterTab('attrs');
  if (innerWidth <= 650 && typeof step.sel === 'string' && step.sel.startsWith('nav ')) shellNav(true);
  return originalCoachCard(step);
};

// Sale confirmation follows the approved profile dialog.
const fighterDismissOriginal=ACTIONS.dismiss;
ACTIONS.dismiss=()=>{
 const g=glad(UI.gladId);if(!g)return;
 fighterDismissOriginal();
 const card=$('#dialog .dlg');card.classList.add('fighter-sale');
 card.querySelector('p').textContent=`${g.name} покинет лудус. Вы получите ${sellGladPrice(g)} денариев, снаряжение останется на складе.`;
 const title=card.querySelector('h2'),head=document.createElement('div');head.className='dialog-head';head.append(title);
 head.insertAdjacentHTML('beforeend','<button class="close" data-act="dlgCancel" aria-label="Закрыть">×</button>');card.prepend(head);
 const actions=card.querySelector('.dlg-btns'),cancel=actions.querySelector('[data-act="dlgCancel"]');actions.prepend(cancel);
 actions.querySelector('[data-act="dlgOk"]').textContent=`Продать за ${sellGladPrice(g)} ден.`;
 cancel.focus();
};
