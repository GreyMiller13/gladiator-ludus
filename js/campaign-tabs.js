// Presentation adapters. STATE, META, prices and all mutations belong to the game.
const CAMPAIGN = {slot:'all', school:'all', selected:null, necro:'fallen'};
const campaignHead = (title, text='') => `<header class="legacy-heading"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}</div></header>`;
const campaignWrap = html => `<section class="campaign-tabs">${html}</section>`;
const campaignEmpty = text => `<div class="legacy-empty"><p>${text}</p></div>`;
function campaignStats(it) { return itemStatsText(it).split(', ').map(s=>`<span>${esc(s)}</span>`).join(''); }
function campaignItem(it, select=true) {
  const b=ITEM_BASES[it.base];
  return `<${select?'button':'div'} class="smith-item qb${b.artifact?4:it.q} ${CAMPAIGN.selected===it.id?'sel':''}" ${select?`data-act="campaignItem" data-id="${it.id}"`:''}>
    <div class="smith-item-figure"><img src="${itemIcon(it,150)}" alt=""></div><div class="smith-item-info"><h3>${esc(it.name)}</h3><div class="stats">${campaignStats(it)}</div><div class="bottom"><span class="who">${SLOTS[it.slot]}</span><span class="price">${it.price} ден.</span></div></div></${select?'button':'div'}>`;
}
function campaignGoods() { return UI.tab==='smith'?STATE.smith:UI.tab==='bazaar'?(STATE.rareShop?.items||[]):STATE.armory; }
function campaignDetails(it) {
  const b=ITEM_BASES[it.base], selling=UI.tab==='armory', action=selling?'sellItem':UI.tab==='bazaar'?'buyRare':'buyItem', price=selling?sellItemPrice(it):it.price;
  return `<h3>${esc(it.name)}</h3>${campaignItem(it,false)}<p>${esc(b.desc||'')}</p><p>Для школ: ${b.classes.map(c=>CLASSES[c].name).join(', ')}</p>${b.twoHanded?'<p>Двуручное оружие</p>':''}${b.needsBow?'<p>Только с луком</p>':''}
  <button class="primary" data-act="campaignTrade" data-action="${action}" data-item="${it.id}" ${!selling&&STATE.gold<price?'disabled':''}>${selling?'Продать':'Купить'} за ${price}</button>
  ${!selling&&STATE.gold<price?'<p>Недостаточно денариев.</p>':''}${selling?`<h4>Экипировать бойца</h4>${STATE.gladiators.map(g=>`<button class="ghost" data-act="campaignEquip" data-id="${g.id}">${esc(g.name)}</button>`).join('')||'<p>В лудусе нет бойцов.</p>'}`:''}`;
}
function campaignShop(kind) {
  if(kind==='bazaar'&&!rareShopOpen()) return campaignWrap(campaignHead('Лавка редкостей')+campaignEmpty(`Лавка откроется при славе ${RARE_SHOP_FAME}. Сейчас ${STATE.fame}.`));
  if(kind==='bazaar') refreshRareShop();
  const all=campaignGoods(), shown=all.filter(it=>(CAMPAIGN.slot==='all'||it.slot===CAMPAIGN.slot)&&(CAMPAIGN.school==='all'||ITEM_BASES[it.base].classes.includes(CAMPAIGN.school)));
  const selected=shown.find(it=>it.id===CAMPAIGN.selected);
  const chips=(key,entries)=>entries.map(([id,name])=>`<button class="ghost" aria-pressed="${CAMPAIGN[key]===id}" data-act="campaignFilter" data-key="${key}" data-id="${id}">${name}</button>`).join('');
  const text=kind==='smith'?'Товар обновляется каждый день. Вещь своей школы даёт +25% к характеристикам.':kind==='armory'?'Снаряжение школы. Ненужные вещи можно продать за 40% цены.':`Каждое именное изделие единственное в своём роде. Новый завоз через ${rareShopDaysLeft()} дн.`;
  return campaignWrap(campaignHead({smith:'Кузнец',armory:'Склад',bazaar:'Лавка редкостей'}[kind],text)+`<div class="smith-layout"><aside class="smith-filters"><h3>Экипировка</h3><div class="smith-filter-chips">${chips('slot',[['all','Всё'],...Object.entries(SLOTS)])}</div><h3>Школа</h3><div class="smith-filter-chips">${chips('school',[['all','Все'],...CLASS_KEYS.map(c=>[c,CLASSES[c].name])])}</div></aside><div class="smith-catalog"><div class="campaign-goods">${shown.map(it=>campaignItem(it)).join('')||campaignEmpty(all.length?'Для этих фильтров вещей нет.':'Пока здесь пусто.')}</div></div><aside class="smith-panel">${selected?campaignDetails(selected):'<h3>Выберите вещь</h3><p>Свойства и доступные действия появятся здесь.</p>'}</aside></div>`);
}
screenSmith=()=>campaignShop('smith');
screenArmory=()=>campaignShop('armory');
screenBazaar=()=>campaignShop('bazaar');

showFighterInfo=function(g) {
 const s=computeStats(g), items=Object.values(g.equip||{}).filter(Boolean);
 showDialog({title:esc(g.name),cls:'campaign-inspect',ok:false,cancel:'Закрыть',body:campaignWrap(`<div class="arena-inspect-intro"><img src="${fullFighter(g)}" alt=""><div><h3>${clsOf(g).name}</h3><p>${g.level} ур. · ${esc(g.origin||'')}</p><strong>Мощь ${combatPower(g)}</strong></div></div><div class="campaign-attributes">${ATTR_KEYS.map(k=>`<span>${ATTRS[k].name}<b>${g.attrs[k]}</b></span>`).join('')}<span>Здоровье<b>${s.maxHp}</b></span><span>Урон<b>${s.dmgMin}–${s.dmgMax}</b></span><span>Броня<b>${s.armor}</b></span></div>${g.cls?`<h4>${clsOf(g).ability.name}</h4><p>${clsOf(g).ability.desc}</p>${buildHtml(g.cls)}`:''}<h4>Снаряжение</h4><div class="campaign-goods">${items.map(it=>campaignItem(it,false)).join('')||'<p>Без снаряжения.</p>'}</div>`)});
};
screenMarket=function(){

 return `<section class="campaign-tabs market-screen">` + `<div class="section-head"><h2 tabindex="-1">Невольничий рынок</h2><div class="right"><span class="count">${STATE.market.length} в продаже</span></div></div>
 <div class="market-intro"><p>Будущие гладиаторы вашей школы. Выберите бойца по его сильным сторонам, боевую школу он освоит в лудусе.</p><span class="market-capacity">Казармы · ${STATE.gladiators.length} / ${MAX_GLADIATORS}</span></div>
 <section class="market-grid" aria-label="Бойцы в продаже">${STATE.market.map(g=>{
 const st=computeStats(g),full=STATE.gladiators.length>=MAX_GLADIATORS,poor=STATE.gold<g.price;
 return `<article class="market-card" aria-labelledby="market-name-${g.id}"><header class="market-card-head"><div><h3 id="market-name-${g.id}">${esc(g.name)}</h3><p class="market-origin">${esc(g.origin)} · ${g.cls?clsOf(g).name:'Без школы'}</p></div><span class="market-level">${g.level} ур.</span></header><div class="market-body"><div class="market-art"><img src="${fullFighter(g)}" alt="${esc(g.name)}"></div><div class="market-attrs"><dl>${[['str','Сила'],['agi','Ловкость'],['end','Выносливость'],['skl','Мастерство'],['wil','Воля']].map(([key,label])=>`<div><dt>${label}</dt><dd>${g.attrs[key]}</dd></div>`).join('')}</dl><div class="market-health"><span>Здоровье</span><b>${st.maxHp}</b></div></div></div><footer class="market-foot"><span class="market-price">${shellIcon('coin')}<strong>${g.price.toLocaleString('ru-RU')}</strong><small>ден.</small></span><button class="primary" data-act="campaignRecruit" data-id="${g.id}" aria-label="Купить: ${esc(g.name)}, ${g.price} денариев" ${full||poor?'disabled':''}>${full?'Нет мест':poor?'Не хватает денег':'Купить'}</button></footer></article>`;
 }).join('')||'<div class="empty-state">Все бойцы проданы. Новые кандидаты прибудут завтра.</div>'}</section><p class="market-note">Новые бойцы прибывают каждый день. Покупка сразу переводит бойца в казармы.</p>` + `</section>`;
};

const campaignOldArena=screenArena, campaignOldPicker=picker;
eventCard=function(ev) {
 return `<article class="arena-fight ${ev.done?'finished':''} ${ev.boss?'boss-fight':''}" data-format="${ev.size}"><div class="arena-fight-body"><div class="arena-fight-head"><h3>${ev.training?'Учебный бой':esc(ev.title||'Поединок')}</h3><span>${ev.size} на ${ev.size}</span></div><div class="arena-foes">${ev.enemies.map((g,i)=>`<button class="arena-opponent" data-act="foeInfo" data-ev="${ev.id}" data-i="${i}"><img src="${portrait(g,112,140,{bust:true,enemy:true})}" alt=""><span><b title="${esc(g.name)}">${esc(g.name)}</b><small>${clsOf(g).name}</small><small>${g.level}-й уровень</small></span></button>`).join('')}</div><div class="arena-strength"><span>Мощь противника</span><b>${teamPower(ev.enemies)}</b></div>${ev.boss?'<p class="arena-boss-note">Победа откроет следующую арену.</p>':''}<div class="arena-reward"><span><b>${ev.gold}</b> ден.</span><span><b>+${ev.fame}</b> славы</span></div></div><button class="primary arena-select" data-act="pickEvent" data-id="${ev.id}" ${ev.done?'disabled':''}>${ev.done?'Бой окончен':'Выбрать бойцов'}</button></article>`;
};
screenArena=function() {
 const cur=arenaTab(); let html=campaignOldArena();
 html=html.replace('class="arena-head"','class="arena-heading"').replace('class="atabs"','class="arena-tabs"').replace('class="evgrid"','class="arena-fights"');
 if(cur!=='bets') html=html.replace('<p class="arena-sub',`<div class="arena-scene"><img src="assets/arenas/arena-${cur+1}.jpg" alt=""><h3>${TIERS[cur].name}</h3></div><p class="arena-sub`);
 return campaignWrap(html);
};
picker=function(ev) {
 if(ev.kind==='contract')return campaignOrderPicker(ev);
 const doc=document.createElement('div');doc.innerHTML=campaignOldPicker(ev);
 doc.querySelector('.picker').classList.add('campaign-picker');
 const versus=doc.querySelector('.vs'),slots=[...versus.querySelectorAll('.vslot')],power=[...versus.querySelectorAll('.tp')];
 const foes=slots.filter(e=>e.classList.contains('foe')),mine=slots.filter(e=>!e.classList.contains('foe'));
 versus.className='arena-versus campaign-versus';
 versus.innerHTML=`<section><h3>Противники</h3><div class="arena-lineup">${foes.map(e=>e.outerHTML).join('')}</div>${power[0]?.outerHTML||''}</section><span>VS</span><section><h3>Ваши бойцы</h3><div class="arena-lineup">${mine.map(e=>e.outerHTML).join('')}</div>${power[1]?.outerHTML||''}</section>`;
 return doc.innerHTML;
};

// META retains its private progress/award calculations. Recompose their live output.
const campaignContracts=META.screenContracts, campaignAchievements=META.screenAchievements;
// Live orders presentation. Installed by fix-orders-tab.py.
function campaignOrderPicker(c){
 const n=playerCount(c),full=UI.picked.length===n;
 return `<div class="pick-bg" data-act="cancelPickBg"><div class="picker order-picker" role="dialog" aria-modal="true" aria-labelledby="pickTitle"><div class="dialog-head"><div><span class="eyebrow">Выбор команды</span><h2 id="pickTitle">${esc(c.title)}</h2></div><button class="close" data-act="cancelPick" aria-label="Закрыть">×</button></div><div class="dialog-body"><div class="order-pick-info"><span>${n} ваших бойцов против ${c.size}</span><span>Выбрано ${UI.picked.length} / ${n}</span></div><div class="order-condition"><span>Условие успеха</span>${esc(c.cond?.text||'Победить')}</div><p class="order-pick-note">Противники: ${c.enemies.map(g=>`${esc(g.name)} · ${g.level} ур.`).join(', ')}</p><div class="order-pick-grid">${STATE.gladiators.map(g=>{const selected=UI.picked.includes(g.id),ready=canFight(g);return `<button class="order-pick-unit" data-act="pickGlad" data-id="${g.id}" aria-pressed="${selected}" ${!ready||full&&!selected?'disabled':''}><img src="${portrait(g,96,120,{bust:true})}" alt=""><span>${esc(g.name)}<small>${clsOf(g).name} · ${g.level} ур.</small><small>${!ready?gladiatorStatus(g).text:selected?'В команде':`Мощь ${combatPower(g)}`}</small></span></button>`;}).join('')}</div>${campaignOrderRewards(c)}<p class="order-pick-note">Бой до сдачи. При неудаче получите ${Math.round(c.gold*META.FAIL_FEE)} ден. за выход. Выбранные бойцы не смогут сражаться повторно сегодня.</p><div class="pfoot"><span class="pick-mode"><button data-act="setMode" data-m="auto" class="${battleMode()==='auto'?'on':''}">Автобой</button><button data-act="setMode" data-m="manual" class="${battleMode()==='manual'?'on':''}">Ручное управление</button></span></div><div class="pact"><button class="primary go" data-act="startBattle" ${full?'':'disabled'}>Выйти на арену</button></div></div></div></div>`;
}
const ORDERS_VIEW = {tab:'today',filter:'all'};
function campaignOrderRewards(c){
 return `<div class="order-rewards"><span>${shellIcon('coin')}<strong>${c.gold}</strong> ден.</span><span>${shellIcon('laurel')}<strong>+${c.fame||0}</strong> славы</span><span>Опыт <strong>×${c.xpMult}</strong></span></div>`;
}
function campaignOrderCard(c){
 const ready=STATE.gladiators.filter(canFight).length,needed=playerCount(c),art=c.artifact&&ITEM_BASES[c.artifact],result=c.result;
 return `<article class="order-card ${c.done?'completed':''} ${art?'legendary':''}" aria-labelledby="order-${c.id}"><div class="order-content"><div class="order-labels"><span class="tag ${c.difficulty>=2?'warn':''}">${c.story?'Сюжетный заказ':META.DIFFICULTY[c.difficulty]?.name||META.DIFFICULTY[0].name}</span>${art?'<span class="tag warn">Легендарный</span>':''}<span class="order-format">${needed} на ${c.size}</span></div><h3 id="order-${c.id}">${esc(c.title)}</h3><p class="order-client">${esc(c.client||'')}</p><p class="order-desc">${esc(c.desc||'')}</p><div class="order-condition"><span>Условие успеха</span>${esc(c.cond?.text||'Победить')}</div><div class="order-foes" data-count="${c.size}">${(c.enemies||[]).map((g,i)=>`<button class="order-foe" data-act="orderInspect" data-id="${c.id}" data-i="${i}" ${c.done?'disabled':''} aria-label="Осмотреть противника: ${esc(g.name)}"><img src="${portrait(g,96,120,{bust:true})}" alt=""><span><b>${esc(g.name)}</b><small>${clsOf(g).name} · ${g.level} ур.</small></span></button>`).join('')}</div>${campaignOrderRewards(c)}${art?`<p class="order-artifact">Реликвия за успех · ${esc(art.name)}</p>`:''}</div>${c.done?`<div class="order-outcome ${c.success?'':'failed'}"><strong>${c.success?'Выполнен сегодня':'Провален сегодня'}</strong>${result?`<span>Получено ${result.gold} ден.${result.fame?` · +${result.fame} славы`:''}</span>`:''}</div>`:`<div class="order-bottom"><p>При неудаче ${Math.round(c.gold*META.FAIL_FEE)} ден. за выход</p><button class="primary" data-act="pickEvent" data-id="${c.id}" ${ready<needed?'disabled':''}>${ready<needed?'Не хватает бойцов':'Выбрать бойцов'}</button></div>`}</article>`;
}
function campaignOrderHistory(history){
 let last=null;
 return history.filter(c=>ORDERS_VIEW.filter==='all'||(ORDERS_VIEW.filter==='success'?c.success:!c.success)).map(c=>{
  const heading=c.day!==last?`<h3 class="orders-day">${c.day===STATE.day?'Сегодня · ':c.day===STATE.day-1?'Вчера · ':''}День ${c.day}</h3>`:'';last=c.day;
  return heading+`<article class="order-history"><div><h3>${esc(c.title)}</h3><p>${esc(c.client||'')} · ${c.playerSize??c.size} на ${c.size}</p></div><div class="result"><span class="tag ${c.success?'':'hurt'}">${c.success?'Выполнен':'Провален'}</span><b>${c.gold} ден.${c.fame?` · +${c.fame} славы`:''}</b></div><details><summary>Подробности заказа</summary><p>Условие: ${esc(c.condition)}.<br>${c.team?.length?`Состав: ${c.team.map(esc).join(', ')}.<br>`:''}${c.rounds!=null?`Раундов: ${c.rounds}. `:''}Опыт ×${c.xpMult}.${!c.success?' Условие не выполнено. Получена только плата за выход.':''}${c.artifactName?`<br>Награда: ${esc(c.artifactName)}.`:''}</p></details></article>`;
 }).join('')||'<div class="orders-empty">Здесь появятся результаты завершённых заказов.</div>';
}
META.screenContracts=function() {
 const today=STATE.contracts||[],history=[...(STATE.meta.contractHistory||[])].sort((a,b)=>b.day-a.day),pending=today.filter(c=>!c.done).length,isToday=ORDERS_VIEW.tab==='today';
 const tabs=[['today','Сегодня',today.length],['history','История',history.length]].map(([id,name,n])=>`<button role="tab" id="orders-tab-${id}" aria-controls="orders-panel" aria-selected="${ORDERS_VIEW.tab===id}" tabindex="${ORDERS_VIEW.tab===id?0:-1}" data-act="ordersTab" data-id="${id}">${name}<span class="count">${n}</span></button>`).join('');
 const summary=isToday?`<span><strong>Доступно: ${pending}</strong> · Завершено сегодня: ${today.length-pending}</span><span>Новые заказы завтра</span>`:`<span><strong>Выполнено: ${history.filter(c=>c.success).length}</strong> · Провалено: ${history.filter(c=>!c.success).length}</span><select id="orders-filter" aria-label="Результат заказа">${[['all','Все результаты'],['success','Выполненные'],['failed','Проваленные']].map(([id,name])=>`<option value="${id}" ${ORDERS_VIEW.filter===id?'selected':''}>${name}</option>`).join('')}</select>`;
 return campaignWrap(campaignHead('Заказы','Показательные бои по найму. Чем опаснее заказ, тем щедрее плата.').replace('class="legacy-heading"','class="legacy-heading orders-heading"')+'<p class="orders-rule">Бои не насмерть: без добивания и приговора толпы. Раны и усталость настоящие, выбывший боец отдыхает день.</p>'+`<div class="orders-tabs" role="tablist" aria-label="Список заказов">${tabs}</div><section id="orders-panel" role="tabpanel" aria-labelledby="orders-tab-${ORDERS_VIEW.tab}"><div class="orders-summary">${summary}</div>${isToday?`<div class="orders-grid">${today.map(campaignOrderCard).join('')||'<div class="orders-empty">Сегодня заказчиков нет. Загляните завтра.</div>'}</div>`:`<div class="orders-archive">${campaignOrderHistory(history)}</div>`}</section>${eventPicker('contract')}`);
};
ACTIONS.ordersTab=d=>{ORDERS_VIEW.tab=d.id;render();$('#orders-tab-'+d.id)?.focus({preventScroll:true});};
ACTIONS.orderInspect=d=>{
 const c=META.findContract(d.id),g=c?.enemies[+d.i];if(!g||c.done)return;
 const s=computeStats(g);
 showDialog({title:esc(g.name),cls:'order-opponent-dialog',ok:false,cancel:'Закрыть',body:`<div class="order-opponent-intro"><img src="${portrait(g,96,120,{bust:true})}" alt=""><div><h3>${clsOf(g).name} · ${g.level} ур.</h3><p>Здоровье ${s.maxHp} · Урон ${s.dmgMin}–${s.dmgMax} · Броня ${s.armor}</p><p>Мощь ${combatPower(g)}</p></div></div>`});
};
document.addEventListener('change',e=>{if(e.target.id==='orders-filter'){ORDERS_VIEW.filter=e.target.value;render();$('#orders-filter')?.focus();}});
document.addEventListener('keydown',e=>{
 const tab=e.target.closest('[data-act="ordersTab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();ACTIONS.ordersTab({id:e.key==='Home'?'today':e.key==='End'?'history':tab.dataset.id==='today'?'history':'today'});
});

META.screenAchievements=function() {
 const doc=document.createElement('div');doc.innerHTML=campaignAchievements();
 const got=META.ACHIEVEMENTS.filter(a=>STATE.meta.ach[a.id]).length,total=META.ACHIEVEMENTS.length,arts=Object.keys(META.ARTIFACTS),owned=arts.filter(id=>STATE.meta.artifacts[id]).length;
 const ring=(r,n,t,cls)=>`<circle class="track" cx="60" cy="60" r="${r}"/><circle class="${cls}" cx="60" cy="60" r="${r}" stroke-dasharray="${n/t*2*Math.PI*r} ${2*Math.PI*r}"/>`;
 doc.querySelector('.m-head').outerHTML=`<header class="legacy-heading glory-heading"><div><h2>Достижения</h2><p>Слава школы, заработанная на песке.</p></div><div class="glory-summary"><div class="glory-donut" role="img" aria-label="Открыто ${got} из ${total}, реликвий ${owned} из ${arts.length}"><svg viewBox="0 0 120 120">${ring(52,got,total,'ring-ach')}${ring(38,owned,arts.length,'ring-art')}</svg><div class="glory-donut-center"><b>${Math.round(got/total*100)}%</b><span>открыто</span></div></div><div class="glory-legend"><p>Достижения <b>${got} / ${total}</b></p><p>Реликвии <b>${owned} / ${arts.length}</b></p></div></div></header>`;
 doc.querySelector('.m-tabs').classList.add('legacy-tabs');
 doc.querySelectorAll('.m-ach').forEach(e=>e.classList.add('glory-ach'));
 doc.querySelectorAll('.m-art').forEach((e,i)=>{const id=Object.keys(META.ARTIFACTS)[i],b=ITEM_BASES[id];e.classList.add('campaign-relic');e.insertAdjacentHTML('afterbegin',`<img src="${itemIcon({base:id,q:4,slot:b.slot},80)}" alt="">`);e.insertAdjacentHTML('beforeend',`<details><summary>Свойства</summary><p>${esc(statsText(b.stats))}</p><p>${esc(b.desc)}</p></details>`);});
 return campaignWrap(doc.innerHTML);
};
screenRules=function() {
 const ch=UI.guide||'ludus';
 return campaignWrap(campaignHead('Справочник','Правила под рукой: от первой тренировки до последней арены.')+`<div class="manual-layout"><nav class="manual-nav" role="tablist" aria-orientation="${innerWidth<=760?'horizontal':'vertical'}" aria-label="Главы справочника">${GUIDE.map(([id,n])=>`<button role="tab" id="manual-tab-${id}" aria-selected="${id===ch}" aria-controls="manual-panel" data-act="guide" data-ch="${id}">${n}</button>`).join('')}</nav><article id="manual-panel" class="manual-content" role="tabpanel" aria-labelledby="manual-tab-${ch}" tabindex="0"><div class="manual-reading">${guideChapter(ch).replace(/<table\b/g,'<div class="manual-table-wrap"><table').replace(/<\/table>/g,'</table></div>')}</div></article></div>`).replace('<section class="campaign-tabs">','<section class="campaign-tabs heritage-screen rules-screen">');
};
screenNecro=function() {
 const records=STATE.graveyard.filter(g=>!!g.freed===(CAMPAIGN.necro==='freed')).slice().reverse();
 return campaignWrap(campaignHead('Некрополь','Имена, которые останутся с вашей школой.')+`<div class="legacy-tabs">${[['fallen','Погибшие'],['freed','Отпущенные']].map(([id,n])=>`<button aria-pressed="${CAMPAIGN.necro===id}" data-act="campaignNecro" data-id="${id}">${n} <span class="count">${STATE.graveyard.filter(g=>!!g.freed===(id==='freed')).length}</span></button>`).join('')}</div><div class="legacy-toolbar toolbar-centered"><p>${CAMPAIGN.necro==='freed'?'Они заслужили рудис. Эти стелы поставлены в честь их свободы.':'Они вышли на песок и не вернулись. Здесь хранится память о каждом.'}</p></div><div class="memorial-grid">${records.map(g=>`<article class="memorial ${g.freed?'freed':'fallen'}"><img class="memorial-stone" src="assets/shell/memorial.png" alt=""><div class="memorial-inscription"><div class="memorial-kicker">${g.freed?'Вольный человек':'Памяти бойца'}</div><div class="memorial-identity"><img class="memorial-portrait" src="${portrait({...g,id:'grave'+g.day+g.name,attrs:g.attrs||clsOf(g).base,equip:g.equip||{}},80,100,{gray:!g.freed,bust:true})}" alt=""><div><h3>${esc(g.name)}</h3><p>${clsOf(g).name} · ${g.level} ур.</p></div></div><dl class="memorial-stats">${[['Бои',g.record.fights],['Победы',g.record.wins],['Убийства',g.record.kills]].map(([n,v])=>`<div><dt>${n}</dt><dd>${v}</dd></div>`).join('')}</dl><div class="memorial-event">${g.freed?'Отпущен на волю':'Пал на арене'} в день ${g.day}<p>${esc(g.place||'')}</p>${g.killer?`<p>Пал от руки: ${esc(g.killer)}</p>`:''}</div><details><summary>Снаряжение</summary>${Object.values(g.equip||{}).filter(Boolean).map(it=>`<p><img width="30" src="${itemIcon(it,40)}" alt=""> ${esc(it.name)}</p>`).join('')||'<p>Сведений нет.</p>'}</details></div></article>`).join('')||campaignEmpty(CAMPAIGN.necro==='freed'?'Первая свобода ещё впереди.':'Все бойцы живы. Пусть так и останется.')}</div>`);
};
Object.assign(ACTIONS,{
 campaignFilter:d=>{CAMPAIGN[d.key]=d.id;render();},
 campaignItem:d=>{CAMPAIGN.selected=+d.id;render();},
 campaignNecro:d=>{CAMPAIGN.necro=d.id;render();},
 campaignInspect:d=>{const g=STATE.market.find(g=>g.id===+d.id);if(g)showFighterInfo(g);},
 campaignEquip:d=>{ACTIONS.openGlad(d);},
 campaignTrade:d=>{
  const it=campaignGoods().find(it=>it.id===+d.item);if(!it)return;
  const sell=d.action==='sellItem',price=sell?sellItemPrice(it):it.price;
  showDialog({title:sell?'Продать вещь?':'Купить вещь?',body:campaignWrap(campaignItem(it,false)+`<p>${sell?'Кузнец заплатит':'Цена'}: ${price} денариев.</p>`),ok:sell?'Продать':'Купить',cancel:'Отмена',onOk:()=>{ACTIONS[d.action]({item:it.id});}});
 },
 campaignRecruit:d=>{const g=STATE.market.find(g=>g.id===+d.id);if(!g)return;showDialog({title:'Принять бойца в школу?',body:`${esc(g.name)}. Цена ${g.price} денариев.`,ok:'Купить',cancel:'Отмена',onOk:()=>ACTIONS.buyGlad(d)});}
});

// Compact arena opponent inspection, matching the approved mock.
function showArenaOpponent(g) {
 const items=Object.values(g.equip||{}).filter(Boolean);
 showDialog({title:esc(g.name),cls:'arena-opponent-dialog',ok:false,cancel:false,
  body:`<div class="campaign-tabs"><div class="arena-inspect"><div class="dialog-body"><div class="arena-inspect-intro"><img src="${portrait(g,96,120,{bust:true})}" alt="${esc(g.name)}"><div><h3>${clsOf(g).name}</h3><p>${g.level}-й уровень · ${esc(g.origin||'')}</p><p>Мощь <strong>${combatPower(g)}</strong></p></div></div><h4>Снаряжение</h4>${items.length?`<ul class="arena-inspect-items">${items.map(it=>`<li><img src="${itemIcon(it,40)}" alt=""><span><small>${SLOTS[it.slot]}</small>${esc(it.name)}</span></li>`).join('')}</ul>`:'<p>Без снаряжения</p>'}</div></div></div>`,
  onShow:()=>{
   const card=$('#dialog .dlg'),title=card.querySelector('#dlgTitle');
   const head=document.createElement('div');head.className='dialog-head';
   const name=document.createElement('div');name.innerHTML='<span class="eyebrow">Противник</span>';name.append(title);head.append(name);
   head.insertAdjacentHTML('beforeend','<button class="close" data-act="dlgCancel" aria-label="Закрыть">×</button>');
   card.prepend(head);card.querySelector('.dlg-btns').remove();head.querySelector('button').focus();
  }
 });
}
ACTIONS.foeInfo=d=>{
 const ev=findEvent(+d.ev)||STATE.events.find(e=>e.id===+d.ev),g=ev?.enemies[+d.i];
 if(g){ensureLook(g);showArenaOpponent(g);}
};

// Smith presentation from the approved mock.
const SMITH_VIEW={cmp:null};
function liveSmithRows(stats){
 const rows=[];
 if(stats.dmgMin!==undefined)rows.push(['dmgMin','Урон',`${stats.dmgMin}–${stats.dmgMax}`]);
 for(const [k,v] of Object.entries(stats))if(k!=='dmgMin'&&k!=='dmgMax'&&v)rows.push([k,STAT_NAMES[k]||k,`${v>0?'+':''}${v}${PCT_STATS.has(k)?'%':''}`]);
 return rows;
}
function liveSmithSchools(it){
 const classes=ITEM_BASES[it.base].classes;
 if(classes.length>=CLASS_KEYS.length)return 'любой школе';
 const names=classes.map(k=>CLASSES[k].name.toLowerCase());
 return names.length>3?names.slice(0,3).join(', ')+` и ещё ${names.length-3}`:names.join(', ');
}
function liveSmithCard(it){
 return `<button class="smith-item qb${it.q}${CAMPAIGN.selected===it.id?' sel':''}" data-act="campaignItem" data-id="${it.id}" aria-pressed="${CAMPAIGN.selected===it.id}"><div class="smith-item-figure"><img src="${itemIcon(it,150)}" alt=""></div><div class="smith-item-info"><h3>${esc(it.name)}</h3><div class="stats">${liveSmithRows(it.stats).slice(0,3).map(r=>`<span>${r[1]} ${r[2]}</span>`).join('')}</div><div class="bottom"><span class="who">${liveSmithSchools(it)}</span><span class="price">${shellIcon('coin')}${it.price}</span></div></div></button>`;
}
function liveSmithCompare(it,g){
 const cur=g.equip[it.slot],old=cur?.stats||{};
 const lines=liveSmithRows(it.stats).map(([k,name,now])=>{
  const damage=k==='dmgMin',delta=damage?(it.stats.dmgMin+it.stats.dmgMax)-(old.dmgMin||0)-(old.dmgMax||0):it.stats[k]-(old[k]||0);
  const was=old[k]===undefined?null:damage?`${old.dmgMin}–${old.dmgMax}`:`${old[k]>0?'+':''}${old[k]}${PCT_STATS.has(k)?'%':''}`;
  return `<div class="cmp-line"><span>${name}</span><span class="vals">${was!==null?`${was}<i>→</i>`:''}<span class="new">${now}</span></span>${cur?`<b class="${delta>0?'up':delta<0?'down':'zero'}">${delta>0?'+':''}${delta}${PCT_STATS.has(k)?'%':''}</b>`:'<b class="zero">—</b>'}</div>`;
 }).join('');
 return `<label class="smith-cmp-select"><span>Боец</span><select id="smith-cmp-fighter" aria-label="Боец для сравнения">${STATE.gladiators.map(f=>`<option value="${f.id}" ${f.id===g.id?'selected':''}>${esc(f.name)} · ${f.cls?CLASSES[f.cls].name:'без школы'}</option>`).join('')}</select></label><div class="smith-cmp-row"><div class="smith-cmp-head"><small>Надето в слоте</small></div><div class="smith-cmp-cur">${cur?`<span class="q${cur.q}">${esc(cur.name)}</span> · ${QUALITIES[cur.q].name.toLowerCase()}`:'слот пуст'}</div>${itemFits(it,g.cls)?'':'<p class="smith-cmp-note">Бонус школы не будет получен.</p>'}<div class="smith-cmp-stats">${lines}</div></div>`;
}
function liveSmithPanel(it){
 const base=ITEM_BASES[it.base],g=STATE.gladiators.find(g=>g.id===SMITH_VIEW.cmp)||STATE.gladiators.find(g=>itemFits(it,g.cls))||STATE.gladiators[0],afford=STATE.gold>=it.price;
 return `<div class="smith-panel-head"><img src="${itemIcon(it,64)}" alt=""><div><span class="q q${it.q}">${QUALITIES[it.q].name}</span><h3 class="q${it.q}">${esc(it.name)}</h3></div></div><p class="meta">${SLOTS[it.slot]}${base.twoHanded?' · двуручное':''}${base.ranged?' · стрелковое':''} · для школ: ${liveSmithSchools(it)}</p><div class="stats">${liveSmithRows(it.stats).map(r=>`<div class="stat"><span>${r[1]}</span><b>${r[2]}</b></div>`).join('')}</div>${base.classes.length<CLASS_KEYS.length?'<p class="fit-note">Вещь своей школы даёт бойцу +25% к её характеристикам.</p>':''}<button class="primary" data-act="campaignTrade" data-action="buyItem" data-item="${it.id}" ${afford?'':'disabled'}>${afford?`Купить за ${it.price} ден.`:'Не хватает денариев'}</button>${g?`<div class="smith-cmp"><h4>Сравнение с надетым</h4>${liveSmithCompare(it,g)}</div>`:''}`;
}
screenSmith=function(){
 const goods=STATE.smith,shown=goods.filter(it=>(CAMPAIGN.slot==='all'||it.slot===CAMPAIGN.slot)&&(CAMPAIGN.school==='all'||ITEM_BASES[it.base].classes.includes(CAMPAIGN.school)));
 if(!shown.some(it=>it.id===CAMPAIGN.selected))CAMPAIGN.selected=null;
 const selected=shown.find(it=>it.id===CAMPAIGN.selected);
 const chips=(key,entries)=>entries.map(([id,label])=>`<button class="smith-chip" aria-pressed="${CAMPAIGN[key]===id}" data-act="campaignFilter" data-key="${key}" data-id="${id}">${label}<span class="n">${id==='all'?goods.length:goods.filter(it=>key==='slot'?it.slot===id:ITEM_BASES[it.base].classes.includes(id)).length}</span></button>`).join('');
 return `<section class="campaign-tabs smith-screen">${campaignHead('Кузнец','Железо для арены: товар обновляется каждый день. Вещь своей школы даёт бойцу +25% к её характеристикам.')}<section class="smith-layout"><aside class="smith-filters" aria-label="Фильтры товаров"><div class="smith-filter-group"><span class="smith-filter-label">Экипировка</span><div class="smith-filter-chips">${chips('slot',[['all','Все'],...Object.entries(SLOTS)])}</div></div><div class="smith-filter-group"><span class="smith-filter-label">Школа</span><div class="smith-filter-chips">${chips('school',[['all','Все школы'],...CLASS_KEYS.map(c=>[c,CLASSES[c].name])])}</div></div></aside><div class="smith-catalog">${shown.length?`<div class="smith-grid">${shown.map(liveSmithCard).join('')}</div>`:`<div class="legacy-empty">${shellIcon('smith')}<h3>${goods.length?'Ничего не найдено':'Товар распродан'}</h3><p>${goods.length?'Для выбранных фильтров сегодня ничего нет. Смените фильтр или приходите завтра.':'Кузнец распродал всё. Ассортимент обновится завтра.'}</p></div>`}</div><aside class="smith-panel" aria-label="Описание вещи">${selected?liveSmithPanel(selected):`<div class="smith-placeholder">${shellIcon('smith')}<h3>Выберите вещь</h3><p>Нажмите на товар кузнеца: покажу характеристики, цену и сравнение с тем, что надето на бойцах школы.</p></div>`}</aside></section></section>`;
};
document.addEventListener('change',e=>{if(e.target.id==='smith-cmp-fighter'){SMITH_VIEW.cmp=+e.target.value;render();$('#smith-cmp-fighter')?.focus();}});
// End smith presentation.

// Armory presentation from the approved mock.
screenArmory=function(){
 const items=STATE.armory,sum=items.reduce((n,it)=>n+sellItemPrice(it),0);
 return `<section class="campaign-tabs smith-screen armory-screen">${campaignHead('Склад','Снаряжение школы: наденьте его на бойца в его окне или продайте кузнецу за 40% цены.')}<div class="arm-toolbar"><p class="arm-summary">${items.length?`На складе <b>${items.length}</b> ${plural(items.length,'предмет','предмета','предметов')}. Кузнец заплатит <b>${sum}</b> ден. за всё.`:'Ненужное снаряжение можно продать кузнецу за 40% цены.'}</p>${items.length?'<button class="danger" data-act="armorySellAll">Продать всё</button>':''}</div>${items.length?`<div class="smith-grid">${items.map(it=>{const relic=!!ITEM_BASES[it.base].artifact;return `<div class="smith-item arm-item qb${relic?4:it.q}"><div class="arm-left"><img src="${itemIcon(it,150)}" alt=""><button class="small arm-sell-button" data-act="armorySell" data-item="${it.id}" title="Продать кузнецу за ${sellItemPrice(it)} ден.">${shellIcon('coin')}Продать · ${sellItemPrice(it)}</button></div><div class="smith-item-info"><h3>${esc(it.name)}</h3><div class="stats">${liveSmithRows(it.stats).slice(0,3).map(r=>`<span>${r[1]} ${r[2]}</span>`).join('')}</div><div class="bottom"><span class="who">${relic?'одна на свете':liveSmithSchools(it)}</span></div></div></div>`;}).join('')}</div>`:`<div class="legacy-empty">${shellIcon('armory')}<h3>Склад пуст</h3><p>Снаряжение можно купить у кузнеца, снять с бойца или взять с побеждённых на арене.</p><button class="ghost" data-act="tab" data-tab="smith">К кузнецу</button></div>`}</section>`;
};
ACTIONS.armorySell=d=>{
 const it=STATE.armory.find(it=>it.id===+d.item);if(!it)return;
 if(!ITEM_BASES[it.base].artifact){ACTIONS.sellItem(d);return;}
 askConfirm('Продажа реликвии',`«${esc(it.name)}» одна на свете: если продать, вернуть её будет нельзя. Кузнец заплатит ${sellItemPrice(it)} денариев.`,()=>ACTIONS.sellItem(d),{danger:true,ok:`Продать за ${sellItemPrice(it)} ден.`});
};
ACTIONS.armorySellAll=()=>{
 const stock=STATE.armory.slice();if(!stock.length)return;
 const sum=stock.reduce((n,it)=>n+sellItemPrice(it),0),relics=stock.some(it=>ITEM_BASES[it.base].artifact);
 askConfirm('Продажа снаряжения',`Кузнец выкупит ${stock.length} ${plural(stock.length,'предмет','предмета','предметов')} за ${sum} денариев.${relics?' В том числе реликвии: вернуть их будет нельзя.':''}`,()=>{
  const ids=new Set(stock.map(it=>it.id)),sold=STATE.armory.filter(it=>ids.has(it.id));
  STATE.gold+=sold.reduce((n,it)=>n+sellItemPrice(it),0);STATE.armory=STATE.armory.filter(it=>!ids.has(it.id));save();render();
 },{danger:true,ok:`Продать за ${sum} ден.`});
};

// Heritage layouts from the approved mock.
const heritageGloryHeader=META.screenAchievements;
META.screenAchievements=function(){
 const previous=document.createElement('div');previous.innerHTML=heritageGloryHeader();
 const raw=document.createElement('div');raw.innerHTML=campaignAchievements();
 const header=previous.querySelector('.glory-heading');
 header.querySelector('h2+p').textContent='Слава школы, заработанная на песке: от первой победы до игр в Колизее.';
 const total=META.ACHIEVEMENTS.length,got=META.ACHIEVEMENTS.filter(a=>STATE.meta.ach[a.id]).length,arts=Object.keys(META.ARTIFACTS),owned=arts.filter(id=>STATE.meta.artifacts[id]).length;
 header.querySelector('.glory-legend').innerHTML=[['ach','Достижения',got,total],['art','Реликвии',owned,arts.length]].map(([k,n,v,t])=>`<div class="glory-legend-row"><span class="dot dot-${k}" aria-hidden="true"></span><span>${n}</span><b>${v} / ${t}</b></div>`).join('');
 const tab=UI.gloryTab in META.GROUPS||UI.gloryTab==='relics'?UI.gloryTab:'arena';
 const tabs=[...raw.querySelectorAll('.m-tabs button')].map(b=>{const id=b.dataset.g;return `<button role="tab" id="glory-tab-${id}" aria-selected="${id===tab}" aria-controls="glory-panel" data-act="gloryTab" data-g="${id}">${b.innerHTML.replaceAll('m-gcount','legacy-count')}</button>`;}).join('');
 const cards=[...raw.querySelectorAll('.m-ach')].map(card=>{
  const medal=card.querySelector('svg').cloneNode(true);medal.setAttribute('class','glory-medal');
  const progress=card.querySelector('.m-prog,.m-when');
  return `<article class="glory-ach ${card.classList.contains('done')?'done':''}">${medal.outerHTML}<div class="glory-ach-body"><h3>${card.querySelector('.m-an').innerHTML}</h3><p>${card.querySelector('.m-an').nextElementSibling.innerHTML}</p>${progress?progress.outerHTML.replace('m-prog','glory-prog').replace('tiny m-when','glory-when'):''}</div><div class="glory-rew">${card.querySelector('.m-rew').innerHTML}</div></article>`;
 }).join('');
 const relics=arts.map((id,i)=>{const b=ITEM_BASES[id],own=STATE.meta.artifacts[id],src=raw.querySelectorAll('.m-art .m-src')[i]?.innerHTML||esc(b.source||'');return `<article class="glory-art ${own?'own':'locked'}"><div class="glory-art-head"><b>${esc(b.name)}</b><span class="glory-slot">${SLOTS[b.slot]}${b.twoHanded?' · двуручное':''}${b.ranged?' · стрелковое':''}</span></div><p class="glory-stats">${esc(statsText(b.stats))}</p><p class="glory-desc">${esc(b.desc||'')}</p><div class="glory-src">${src}</div></article>`;}).join('');
 const intro={arena:'Победы на аренах, чистые триумфы и приговоры толпы.',fighters:'Рекорды ваших гладиаторов: повергнутые враги, уровни и милость толпы.',ludus:'Слава и хозяйство школы: состав, имя в Риме и казна.',contracts:'Показательные бои для горожан: от первого заказа до поставщика двора.',bets:'Ставки у ворот амфитеатра: глаз знатока и вера в слабого.',special:'Редкие свершения: работа мастера, прощённый долг и рудис свободы.'};
 return `<section class="campaign-tabs heritage-screen">${header.outerHTML}<div class="legacy-tabs" role="tablist" aria-label="Слава школы">${tabs}</div><section class="glory-panel" id="glory-panel" role="tabpanel" aria-labelledby="glory-tab-${tab}"><div class="legacy-toolbar toolbar-centered"><p>${tab==='relics'?'Вещи легендарных бойцов. Каждая одна на свете: если боец погибнет с ней или вы её продадите, вернуть её нельзя.':intro[tab]}</p></div><div class="${tab==='relics'?'glory-arts':'glory-grid'}">${tab==='relics'?relics:cards}</div></section></section>`;
};
screenNecro=function(){
 const records=STATE.graveyard.filter(g=>!!g.freed===(CAMPAIGN.necro==='freed')).slice().reverse();
 const tabs=[['fallen','Погибшие'],['freed','Отпущенные']].map(([id,n])=>`<button role="tab" id="necro-tab-${id}" aria-selected="${CAMPAIGN.necro===id}" aria-controls="necro-panel" data-act="campaignNecro" data-id="${id}">${n}<span class="legacy-count">${STATE.graveyard.filter(g=>!!g.freed===(id==='freed')).length}</span></button>`).join('');
 const cards=records.map((g,i)=>{
  const record=g.record||{},model={...g,id:'grave'+g.day+g.name,attrs:g.attrs||clsOf(g).base,equip:g.equip||{}};
  return `<article class="memorial ${g.freed?'freed':'fallen'}" aria-labelledby="memorial-name-${i}"><img class="memorial-stone" src="assets/shell/memorial.png" alt="" aria-hidden="true"><div class="memorial-inscription"><div class="memorial-kicker">${g.freed?'Вольный человек':'Памяти бойца'}</div><div class="memorial-identity"><img class="memorial-portrait" src="${portrait(model,80,100,{gray:!g.freed,bust:true})}" alt=""><div><h3 id="memorial-name-${i}">${esc(g.name)}</h3><p class="memorial-school">${clsOf(g).name} · ${g.level} ур.</p></div></div><dl class="memorial-stats">${[['Слава',g.fame],['Бои',record.fights],['Убийства',record.kills],['Победы',record.wins],['Поражения',record.losses]].map(([n,v])=>`<div><dt>${n}</dt><dd>${v??'—'}</dd></div>`).join('')}</dl><div class="memorial-event"><div class="memorial-fate"><strong>${g.freed?'Отпущен на свободу':'Пал на арене'}</strong><span>День ${g.day}</span><span class="memorial-place">${esc(g.place||'')}</span></div><div class="memorial-cause">${g.freed?'<strong>Вручён рудис</strong><span>Из рук ланисты</span>':`<strong>Пал от руки</strong><span>${esc(g.killer||'Неизвестный противник')}</span>`}</div></div>${g.epitaph?`<blockquote>«${esc(g.epitaph)}»</blockquote>`:''}</div></article>`;
 }).join('');
 return `<section class="campaign-tabs heritage-screen">${campaignHead('Некрополь','Имена, которые останутся с вашей школой.')}<div class="legacy-tabs" role="tablist" aria-label="Память школы">${tabs}</div><section class="necro-panel" id="necro-panel" role="tabpanel" aria-labelledby="necro-tab-${CAMPAIGN.necro}"><div class="legacy-toolbar toolbar-centered"><p>${CAMPAIGN.necro==='freed'?'Они заслужили рудис. Эти стелы поставлены в честь их свободы.':'Они вышли на песок и не вернулись. Здесь хранится память о каждом.'}</p></div>${records.length?`<div class="memorial-grid" style="--memorial-columns:${Math.min(records.length,3)}">${cards}</div>`:`<div class="legacy-empty">${shellIcon('necro')}<h3>${CAMPAIGN.necro==='freed'?'Первая свобода ещё впереди':'Все бойцы живы'}</h3><p>${CAMPAIGN.necro==='freed'?'Здесь останутся имена тех, кто заслужит рудис и покинет школу вольным человеком.':'Пусть так и останется.'}</p><button class="ghost" data-act="tab" data-tab="ludus">Вернуться в лудус</button></div>`}</section></section>`;
};

// Battle pickers matching the final mock.
function battlePickerFrame(kind,title,body){
 return `<div class="battle-picker-scope pick-bg" data-act="cancelPickBg"><section class="battle-picker ${kind}" role="dialog" aria-modal="true" aria-labelledby="pickTitle"><div class="dialog-head"><div><span class="eyebrow">Выбор команды</span><h2 id="pickTitle">${esc(title)}</h2></div><button class="close" data-act="cancelPick" aria-label="Закрыть">×</button></div><div class="dialog-body">${body}</div></section></div>`;
}
function battlePickerControls(ev){
 return ev.training?'<span>Учебный бой · Ручное управление</span>':`<fieldset class="arena-control-toggle"><legend>Управление</legend>${[['auto','Автобой'],['manual','Вручную']].map(([value,label])=>`<label><input type="radio" name="battle-picker-mode" data-act="setMode" data-m="${value}" ${battleMode()===value?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>`;
}
function battlePickerRoster(ev){
 const full=UI.picked.length===playerCount(ev);
 return `<div class="order-pick-grid">${STATE.gladiators.map(g=>{const selected=UI.picked.includes(g.id),ready=canFight(g);return `<button class="order-pick-unit" data-act="pickGlad" data-id="${g.id}" aria-pressed="${selected}" aria-label="${selected?'Убрать из команды':'Добавить в команду'}: ${esc(g.name)}" ${!ready||full&&!selected?'disabled':''}><img src="${portrait(g,96,120,{bust:true})}" alt=""><span>${esc(g.name)}<small>${clsOf(g).name} · ${g.level} ур.</small><small>${!ready?gladiatorStatus(g).text:selected?'✓ В команде':`Мощь ${combatPower(g)}`}</small></span></button>`;}).join('')}</div>`;
}
picker=function(ev){
 const n=playerCount(ev),mine=UI.picked.map(glad).filter(Boolean),full=mine.length===n;
 const go=`<button class="primary" data-act="startBattle" ${!full?'disabled':''}>Выйти на арену</button>`;
 if(ev.kind==='contract')return battlePickerFrame('order-picker',ev.title,`<div class="order-pick-info"><span>${n} ваших бойцов против ${ev.size}</span><span>Выбрано ${mine.length} / ${n}</span></div><div class="order-condition"><span>Условие успеха</span>${esc(ev.cond?.text||'Победить')}</div><p class="order-pick-note">Противники: ${ev.enemies.map(g=>`${esc(g.name)} · ${g.level} ур.`).join(', ')}</p>${battlePickerRoster(ev)}${campaignOrderRewards(ev)}<p class="order-pick-note">Бой до сдачи. При неудаче получите ${Math.round(ev.gold*META.FAIL_FEE)} ден. за выход. Выбранные бойцы не смогут сражаться повторно сегодня.</p><div class="arena-picker-controls">${battlePickerControls(ev)}</div><div class="arena-picker-bottom">${go}</div>`);
 const slot=(g,remove=false)=>`<div class="arena-lineup-slot"><img src="${portrait(g,96,120,{bust:true})}" alt=""><span>${esc(g.name)}<small>${clsOf(g).name} · ${g.level} ур.</small></span>${remove?`<button class="arena-remove" data-act="pickGlad" data-id="${g.id}" aria-label="Убрать ${esc(g.name)} из команды" title="Убрать из команды">${ICO_X}</button>`:''}</div>`;
 const reward=winReward(ev),title=ev.kind==='final'?'Финал':ev.training?'Учебный бой':ev.boss?ev.title:`${n} на ${ev.size}`;
 return battlePickerFrame('arena-picker',title,`<div class="arena-versus"><div><div class="arena-team-heading"><h3>Противники</h3><p class="arena-team-power">Мощь <b>${teamPower(ev.enemies)}</b></p></div><div class="arena-lineup">${ev.enemies.map(g=>slot(g)).join('')}</div></div><span>VS</span><div><div class="arena-team-heading"><h3>Ваша команда · ${mine.length}/${n}</h3><p class="arena-team-power">Мощь <b>${mine.length?teamPower(mine):'—'}</b></p></div><div class="arena-lineup">${Array.from({length:n},(_,i)=>mine[i]?slot(mine[i],true):'<div class="arena-lineup-slot empty">＋ Выберите бойца ниже</div>').join('')}</div></div></div><section class="arena-picker-roster"><h3>Бойцы школы</h3><p class="arena-pick-help" role="status">${full?'Состав заполнен. Чтобы заменить бойца, уберите его крестиком.':'Нажмите на бойца, чтобы добавить его в команду.'}</p>${battlePickerRoster(ev)}</section><div class="arena-picker-controls">${battlePickerControls(ev)}${canGoShort(ev)?`<label><input type="checkbox" data-act="pickShort" ${ev.short?'checked':''}>В меньшинстве · Награда ×2</label>`:''}</div><p class="arena-risk">${ev.training?'Учебный бой без смертей.':'При поражении судьбу бойцов решит толпа.'}</p><div class="arena-picker-bottom"><div class="arena-reward"><span>${shellIcon('coin')}<b>${reward.gold}</b> ден.</span><span>${shellIcon('laurel')}<b>+${reward.fame}</b> славы</span></div>${go}</div>`);
};
// End battle pickers.
