const MENU_LANISTAS=[{"key": "m1", "sex": "m", "title": "Молодой наследник", "desc": "Отец отправил его в Рим учиться риторике, но вместо сенатской карьеры оставил в наследство лудус. На шее, отцовский перстень, в памяти, речи учителей. Теперь предстоит выяснить, чего стоит красивое слово перед человеком с мечом.", "url": "assets/portraits/m1-calm.jpg"}, {"key": "m2", "sex": "m", "title": "Бывший легионер", "desc": "Двадцать лет на Рейне научили его держать строй и считать живых после боя. Он вернулся со шрамом, наградами и привычкой не давать пустых обещаний. В школе гладиаторов он видит отряд, которому ещё можно обеспечить лучшее будущее.", "url": "assets/portraits/m2-calm.jpg"}, {"key": "m3", "sex": "m", "title": "Старый торговец", "desc": "Он торговал зерном, вином и всем, на что находился покупатель. По дороге в Помпеи приобрёл лудус: цена показалась подозрительно выгодной. Теперь старому торговцу предстоит освоить товар, который умеет спорить, побеждать и умирать.", "url": "assets/portraits/m3-calm.jpg"}, {"key": "f1", "sex": "f", "title": "Дочь ланисты", "desc": "Она выросла среди тренировочных мечей и с детства знала бойцов по именам. После смерти отца кредиторы ждали, что она продаст школу. Вместо этого она открыла ворота казарм и велела Фероксу начинать утреннюю тренировку.", "url": "assets/portraits/f1-calm.jpg"}, {"key": "f2", "sex": "f", "title": "Вдова из Карфагена", "desc": "В Карфагене она вела счета мужа, а после его смерти, всё семейное дело. В Помпеи приехала с небольшим состоянием и большим списком людей, которым больше не доверяет. Лудус для неё, новая ставка, которую она намерена просчитать сама.", "url": "assets/portraits/f2-calm.jpg"}, {"key": "f3", "sex": "f", "title": "Строгая матрона", "desc": "Она пережила двух мужей, три неурожая и не одну семейную распрю. Говорит тихо: привыкла, что её всё равно слушают. Приняв школу под свою руку, первым делом проверила кладовые, вторым, кто из бойцов действительно способен держать удар.", "url": "assets/portraits/f3-calm.jpg"}];
// Approved menu subscreens, backed by real campaign actions and save files.
const MENU_PAGES={page:'home',motion:null};
try{MENU_PAGES.motion=localStorage.getItem('ludus_menu_motion');}catch(e){}
function menuMotionEnabled(){return MENU_PAGES.motion===null?!trainStill():MENU_PAGES.motion==='1';}
const menuHomeRender=renderMenu;
const menuPageHead=(title,sub)=>`<header class="page-head"><div>${sub ? `<span class="eyebrow">${sub}</span>` : ''}<h2 id="page-title" tabindex="-1">${title}</h2></div><button class="secondary" data-act="menuPage" data-page="home">В меню</button></header>`;
function menuNewPage(){
 let tour=true;try{tour=localStorage.getItem(TOUR_PREF)!=='0';}catch(e){}
 return menuPageHead('Новая игра','')+`<div class="name-row"><label><span class="field-label">Название лудуса</span><input class="name-input" id="menu-ludus-name" value="Лудус Батиата" maxlength="28" placeholder="Как назовём школу?"></label></div><div class="create-grid"><div><div class="selection-title"><h3>Ваш ланиста</h3></div><div class="lanistas lanista-pick">${MENU_LANISTAS.map((l,i)=>`<button class="pick lp ${i?'':'on'}" data-act="pickLanista" data-k="${l.key}" aria-pressed="${!i}"><img src="${l.url}" alt=""><span>${esc(l.title)}</span></button>`).join('')}</div></div><div><div class="selection-title"><h3>Знамя школы</h3></div><div class="banner-grid banner-pick">${BANNERS.map((b,i)=>`<button class="pick bp ${i?'':'on'}" data-act="pickBanner" data-k="${b.id}" aria-label="${esc(b.name)}" aria-pressed="${!i}"><img src="${bannerUrl(b.id)}" alt=""></button>`).join('')}</div></div></div><div class="choice-descriptions"><section><h3>Биография ланисты</h3><p id="lanista-description">${esc(MENU_LANISTAS[0].desc)}</p></section><section><h3 id="menu-banner-name">${esc(BANNERS[0].name)}</h3><p id="banner-description">${esc(BANNERS[0].description)}</p></section><div id="lanista-bonus">${lanistaBonusMarkup(MENU_LANISTAS[0].key)}</div><div class="creation-footer tutorial-aside"><label class="tutorial-check"><input type="checkbox" id="menu-tutorial" ${tour?'checked':''}><span><strong>Пройти обучение с Фероксом</strong><small>Наставник поможет снарядить бойца и провести первый бой.</small></span></label><div class="actions"><button class="primary" data-act="menuStart">Начать историю</button></div></div></div>`;
}
function menuSavePage(){return menuPageHead('Сохранение','')+`<p class="page-intro">Прогресс хранится в браузере. Скачайте файл, чтобы перенести его или оставить резервную копию.</p>${STATE?`<div class="save-summary"><img src="${bannerUrl(STATE.banner)}" alt=""><div><h3>${esc(STATE.ludusName)}</h3><p>${STATE.lost ? 'Лудус отобран · ' : STATE.story ? `Глава ${['I','II','III','IV'][STATE.story.chapter] || 'I'} · ` : ''}День ${STATE.day}</p><div class="campaign-stats">${[['coin',STATE.gold,'денариев'],['laurel',STATE.fame,'славы'],['helm',STATE.gladiators.length,'бойцов']].map(([k,v,n]) => `<span>${shellIcon(k)}<b>${v}</b><small>${n}</small></span>`).join('')}</div></div></div>`:'<div class="notice">Игра ещё не начата. Вы можете загрузить файл.</div>'}<div class="split"><section class="save-action"><h3>Скачать сохранение</h3><p>Оставьте копию вашей школы на устройстве.</p><button class="primary" data-act="saveExport" ${STATE?'':'disabled'}>Скачать файл</button></section><section class="save-action"><h3>Загрузить из файла</h3><p>Загрузка заменит текущий прогресс. Сначала скачайте копию, если хотите сохранить его.</p><button class="secondary" data-act="saveImportPick">Выбрать файл</button><input type="file" id="importFile" accept=".json,application/json" hidden></section></div><div id="importPreview" role="status" aria-live="polite"></div>`;}
function menuSettingsPage(){
 const sw=(act,on,label,disabled=false)=>`<button class="switch" data-act="${act}" role="switch" aria-checked="${on}" aria-label="${label}" ${disabled?'disabled':''}></button>`;
 return menuPageHead('Настройки','Удобно именно вам')+`<div class="settings"><div class="setting-row"><div><h3>Звук</h3><p>Удары, толпа и звуки интерфейса.</p></div>${sw('toggleSound',!SFX.muted,'Звук')}</div><div class="setting-row"><div><h3>Музыка</h3><p>${SFX.muted?'Включите звук, чтобы слушать музыку.':'Фоновая музыка лудуса и арены.'}</p></div>${sw('toggleMusic',!SFX.muted&&!SFX.musicMuted,'Музыка',SFX.muted)}</div><div class="setting-row"><div><h3>Громкость</h3><p id="menu-volume-value">${Math.round(SFX.volume*100)}%</p></div><input id="menu-volume" class="volume" aria-label="Громкость" type="range" min="0" max="100" value="${Math.round(SFX.volume*100)}"></div><div class="menu-scale"><h3>Масштаб интерфейса</h3><p class="hint">Крупнее текст, кнопки и значки. По умолчанию 100%.</p><div class="segments" aria-label="Масштаб интерфейса">${ZOOM_STEPS.map(z=>`<button data-act="setZoom" data-z="${z}" aria-pressed="${zoomPref()===z}">${z==='auto'?'Авто':Math.round(+z*100)+'%'}</button>`).join('')}</div></div><div class="setting-row"><div><h3>Анимация заставки</h3><p>Движение гладиаторов на фоне меню.</p></div>${sw('menuMotion',menuMotionEnabled(),'Анимация заставки')}</div></div>`;
}
function menuGuidePage(){const ch=UI.guide||'ludus';return menuPageHead('Справочник','Правила под рукой')+`<div class="guide-layout"><nav class="guide-nav" aria-label="Разделы справочника">${GUIDE.map(([id,n])=>`<button data-act="guide" data-ch="${id}" aria-current="${ch===id?'page':'false'}">${n}</button>`).join('')}</nav><article class="guide-content" tabindex="0">${guideChapter(ch).replace(/<table\b/g,'<div class="menu-table-wrap"><table').replace(/<\/table>/g,'</table></div>')}</article></div>`;}
renderMenu=function(){
 const page=MENU_PAGES.page;
 if(page==='home'){MENU.guide=false;MENU.settings=false;menuHomeRender();return;}
 const box=$('#menu .menu-box');box.className='menu-box menu-pages';
 box.innerHTML=`<section class="subscreen ${page==='new'?'new-campaign':''} ${page==='guide'?'guide-screen':''}">${({new:menuNewPage,save:menuSavePage,settings:menuSettingsPage,guide:menuGuidePage})[page]()}</section>`;
 if(page==='save')$('#importFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)readSaveFile(f);e.target.value='';});
 if(page==='settings')$('#menu-volume').addEventListener('input',e=>{SFX.setVolume(+e.target.value/100);$('#menu-volume-value').textContent=e.target.value+'%';});
};
function menuPage(page){MENU_PAGES.page=page;MENU.guide=page==='guide';MENU.settings=page==='settings';if(page==='save')UI.importState=null;renderMenu();$('#page-title')?.focus({preventScroll:true});$('#menu').scrollTop=0;}
const menuOriginalShow=showMenu;
showMenu=function(){MENU_PAGES.page='home';menuOriginalShow();};
for(const name of ['setZoom','toggleZoom']){
 const action=ACTIONS[name];ACTIONS[name]=(...args)=>{action(...args);if(MENU.open)paintMenuBg();};
}
const menuNewDialog=showNewGameDialog,menuSaveDialog=showSaveDialog;
showNewGameDialog=function(){if(MENU.open)menuPage('new');else menuNewDialog();};
showSaveDialog=function(){if(MENU.open)menuPage('save');else menuSaveDialog();};
Object.assign(ACTIONS,{
 menuPage:d=>menuPage(d.page),menuGuide:()=>menuPage('guide'),menuBack:()=>menuPage('home'),menuSettings:d=>menuPage(d.on==='0'?'home':'settings'),
 menuMotion:()=>{MENU_PAGES.motion=menuMotionEnabled()?'0':'1';try{localStorage.setItem('ludus_menu_motion',MENU_PAGES.motion);}catch(e){}renderMenu();},
 menuStart:()=>{
  const input=$('#menu-ludus-name'),name=input.value.trim();if(!name){input.setCustomValidity('Назовите вашу школу');input.reportValidity();input.addEventListener('input',()=>input.setCustomValidity(''),{once:true});return;}
  const l=PORTRAIT.LANISTAS.find(l=>l.key===$('.lanista-pick .on').dataset.k),banner=pickedBanner(),tour=$('#menu-tutorial').checked;
  const start=()=>{startNewGame(name,tour,{portrait:l.key,sex:l.sex},banner);MENU_PAGES.page='home';};
  if(STATE)menuConfirmStart(start);else start();
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&MENU.open&&!UI.dlg&&MENU_PAGES.page!=='home'){menuPage('home');e.preventDefault();}});

for(const act of ['pickLanista','pickBanner']){
 const original=ACTIONS[act];ACTIONS[act]=(...args)=>{
  original(...args);
  if(MENU.open&&MENU_PAGES.page==='new'){
   const selected=MENU_LANISTAS.find(l=>l.key===$('#menu .lp.on')?.dataset.k);
   if(selected){
    $('#lanista-description').textContent=selected.desc;
    $('#lanista-bonus').innerHTML=lanistaBonusMarkup(selected.key);
   }
   const banner= bannerOf($('#menu .bp.on')?.dataset.k);
   $('#menu-banner-name').textContent=banner.name;
   $('#banner-description').textContent=banner.description;
  }
 };
}

function menuConfirmStart(start){
 askConfirm('Начать новую историю?',`Это заменит текущий прогресс «${esc(STATE.ludusName)}». Можно сначала скачать сохранение.`,start,{
  cls:'menu-start-confirm',ok:'Начать заново',cancel:'Отмена',danger:true,
  onShow:()=>{
   const card=$('#dialog .menu-start-confirm'),actions=card.querySelector('.dlg-btns'),cancel=actions.querySelector('[data-act="dlgCancel"]');
   card.parentElement.classList.add('menu-confirm-shade');
   actions.prepend(cancel);
   cancel.insertAdjacentHTML('afterend','<button data-act="menuConfirmSave">К сохранению</button>');
  }
 });
}
ACTIONS.menuConfirmSave=()=>{closeDialog();menuPage('save');};
