// Final live surfaces. Mechanics remain in story/debt/bets and existing ACTIONS.
(() => {
 // The same subscreens are used from campaign endings and the main menu.
 showNewGameDialog=()=>{if(UI.battle)return;closeDialog();if(!MENU.open)showMenu();menuPage('new');};
 showSaveDialog=()=>{if(UI.battle)return;closeDialog();if(!MENU.open)showMenu();menuPage('save');};
 // Session 2 replaced event cards and shop controls. Keep Ferox's target and
 // click guard on the real controls, including the purchase confirmation.
 const step=id=>TUTOR_STEPS.find(s=>s.id===id);
 for(const id of ['smith','market'])step(id).sel='main .legacy-heading';
 step('pickTraining').sel=()=>{const ev=STATE.events.find(e=>e.training&&!e.duo&&!e.done);return `main [data-act="pickEvent"][data-id="${ev?.id}"]`;};
 step('pickDuo').sel=()=>{const ev=STATE.events.find(e=>e.duo&&!e.done);return `main [data-act="pickEvent"][data-id="${ev?.id}"]`;};
 step('buyItem').sel=()=>{const id=tutorPicks().item?.id;return `main [data-act="campaignItem"][data-id="${id}"],main [data-act="campaignTrade"][data-item="${id}"]`;};
 step('buyItem').enter=()=>{CAMPAIGN.slot='all';CAMPAIGN.school='all';CAMPAIGN.selected=tutorPicks().item?.id;render();};
 step('buyGlad').sel=()=>`main [data-act="campaignRecruit"][data-id="${tutorPicks().glad?.id}"]`;
 const originalPortrait=PORTRAIT.url;
 PORTRAIT.url=(key,expr,size,me)=>['doctore','lender','rival','senator','m1','m2','m3','f1','f2','f3'].includes(key)
  ? `assets/portraits/${key}-${['angry','pleased'].includes(expr)?expr:'calm'}.jpg`
  : originalPortrait(key,expr,size,me);

 const line=showSceneLine;
 showSceneLine=()=>{line();const box=$('#scene .scene-box');if(!box)return;
  box.classList.add('story-conversation');
  const text=box.querySelector('.scene-text'), head=document.createElement('div');
  head.className='eyebrow';head.textContent=STORY.CHAPTERS[STATE.story.chapter].title;
  text.prepend(head);
  const count=document.createElement('span');count.className='scene-progress';count.textContent=`${SCENE.i+1} / ${SCENE.lines.length}`;
  box.querySelector('.scene-btns').prepend(count);
 };
 // A shared narrative card keeps original text and actions, adding a proper
 // heading/body/footer structure for states with no approved standalone mockup.
 function narrative(kind){
  const card=$('#modal .modal');if(!card)return;
  card.classList.add('narrative-card',kind);card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  const title=card.querySelector('h2');card.removeAttribute('style');title.removeAttribute('style');title.id='narrative-title';title.tabIndex=-1;card.setAttribute('aria-labelledby',title.id);
  const header=document.createElement('header');header.className='narrative-heading';
  const label=card.querySelector('.lat');if(label)header.append(label);header.append(title);card.prepend(header);
  const footer=card.querySelector('.center');if(footer){footer.classList.add('narrative-actions');card.append(footer);}
  title.focus();
 }
 for(const [get,set,kind] of [
  [()=>showDebtLost,f=>showDebtLost=f,'narrative-loss'],
  [()=>showEpilogueChoice,f=>showEpilogueChoice=f,'narrative-rudis'],
  [()=>showEnding,f=>showEnding=f,'narrative-ending'],
  [()=>checkGameOver,f=>checkGameOver=f,'narrative-loss']]){
  const old=get();set((...args)=>{const before=$('#modal .modal');old(...args);const after=$('#modal .modal');if(after&&after!==before&&!after.classList.contains('narrative-card'))narrative(kind);});
 }
 // Return focus through stacked confirmations, even when the initiating view
 // was re-rendered by an action. Capture Tab before legacy scene key handling.
 let dialogReturn=null,sceneReturn=null;
 const dialog=showDialog,close=closeDialog,scenes=playScenes,endScene=closeScene;
 showDialog=o=>{if(!UI.dlg)dialogReturn=document.activeElement;dialog(o);};
 closeDialog=()=>{close();if(dialogReturn?.isConnected)dialogReturn.focus({preventScroll:true});dialogReturn=null;};
 playScenes=(...args)=>{if(!sceneOpen())sceneReturn=document.activeElement;return scenes(...args);};
 closeScene=()=>{endScene();if(!sceneOpen()&&sceneReturn?.isConnected)sceneReturn.focus({preventScroll:true});};
 document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const root=UI.dlg?$('#dialog .dlg'):sceneOpen()?$('#scene .scene-box'):$('#modal .narrative-card');
  if(!root)return;
  const all=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
  if(!all.length)return;
  const first=all[0],last=all[all.length-1];
  if(!root.contains(document.activeElement)||e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last){e.preventDefault();(e.shiftKey?last:first).focus();}
 },true);
 $('#toasts').setAttribute('role','status');$('#toasts').setAttribute('aria-live','polite');

 // Spectator battles reuse the painted arena and HUD, but the seeded Battle
 // and settlement belong exclusively to bets.js. No deployment or commands.
 startBetBattle=()=>{
  const bet=STATE.bet;if(!bet||bet.done||UI.battle)return;
  watchBet();save();combatStop();
  const b=betBattle(bet);b.units.forEach(u=>ensureLook(u.g));
  COMBAT.session={b,event:b.event,bet:true,phase:'fight',speed:1,paused:false,busy:false,awaiting:false,autoplay:true,selected:'player0',aim:null,verdicts:{},notice:'',redesign:true};
  UI.battle=COMBAT.session;combatRenderField();music('arena');document.body.classList.add('combat-active');
  const d=combatDialog();d.classList.remove('results-compact');d.showModal();$('#combat-title').focus();combatSchedule();
 };
 const header=combatHeader,roster=combatRoster,panel=combatPanel,bar=combatCommandbar,result=combatResult;
 combatHeader=()=>COMBAT.session?.bet?`<header class="combat-header"><div><div class="eyebrow">${esc(TIERS[COMBAT.session.b.event.tier].place)} · Бой дня</div><h2 id="combat-title" tabindex="-1">${COMBAT.session.phase==='results'?'Итоги поединка':'Поединок с трибун'}</h2></div>${COMBAT.session.phase==='fight'?combatBtn('combatPause','Пауза'):''}</header>`:header();
 combatRoster=side=>COMBAT.session?.bet?roster(side).replace(side==='player'?'Ваш лудус':'Противники',side==='player'?'Первый участник':'Второй участник'):roster(side);
 combatPanel=()=>{const html=panel();if(!COMBAT.session?.bet)return html;const wrap=document.createElement('div');wrap.innerHTML=html;wrap.querySelector('.combat-manual-actions')?.remove();return wrap.innerHTML;};
 combatCommandbar=()=>COMBAT.session?.bet?`<footer class="combat-commandbar"><span>Вы наблюдаете с трибун. Бойцы действуют самостоятельно.</span><div class="combat-speed">${[1,2,4].map(n=>combatBtn('combatSpeed',`×${n}`,false,`data-id="${n}" aria-pressed="${COMBAT.session.speed===n}"`)).join('')}</div></footer>`:bar();
 combatResult=async()=>{
  const s=COMBAT.session;if(!s?.bet)return result();if(s.phase!=='fight'||!s.b.over)return;
  s.phase='results';clearTimeout(COMBAT.timer);s.busy=false;s.paused=false;
  const bet=STATE.bet,w=s.b.winner==='player'?0:1,pay=settleBet(w),winner=[bet.a,bet.b][w];
  journal(`Бой дня: победил ${winner.name}.${bet.pick===null?'':pay?` Ставка сыграла: +${pay} денариев.`:` Ставка в ${bet.stake} денариев проиграна.`}`);save();
  COMBAT.view?.destroy();COMBAT.view=null;
  document.body.appendChild($('#coach'));const d=combatDialog();
  d.innerHTML=`${combatHeader()}<div class="combat-results"><section class="combat-result-hero" style="background-image:url('${ARENA_ART[bet.tier]}')"><div><div class="eyebrow">${s.b.round} раундов</div><h3>Победил ${esc(winner.name)}</h3><p>${bet.pick===null?'Вы смотрели без ставки.':pay?`Ставка сыграла: +${pay} денариев.`:`Ставка в ${bet.stake} денариев проиграна.`}</p></div></section><div class="combat-results-body"><div class="combat-result-team">${[bet.a,bet.b].map((g,i)=>`<article class="combat-result-unit"><img src="${fullFighter(g,160,200)}" alt=""><div><h4>${esc(g.name)}</h4><p>${i===w?'Победитель':'Повержен'}</p></div></article>`).join('')}</div></div></div><footer class="combat-commandbar"><span>Новый бой завтра</span>${combatBtn('combatExit','Вернуться на арену',false,'class="primary"')}</footer>`;
  $('#combat-title').focus();
 };
 const exit=ACTIONS.combatExit,pause=ACTIONS.combatPause;
 ACTIONS.combatExit=()=>{if(!COMBAT.session?.bet)return exit();if(COMBAT.session.phase!=='results')return;
  combatStop();combatDialog().close();COMBAT.session=null;UI.battle=null;document.body.classList.remove('combat-active');music('menu');UI.tab='arena';UI.arenaTab='bets';render();$('main [data-act="arenaTab"][data-t="bets"]')?.focus();
 };
 ACTIONS.combatPause=()=>{pause();if(COMBAT.session?.bet)$('#combat-overlay [data-act="combatSurrender"]')?.remove();};
 for(const key of ['combatAuto','combatSurrender','combatConfirmSurrender','combatArrange','combatStart']){const old=ACTIONS[key];ACTIONS[key]=(...args)=>{if(!COMBAT.session?.bet)return old(...args);};}
 const select=ACTIONS.combatSelect;
 ACTIONS.combatSelect=d=>{if(COMBAT.session?.bet){COMBAT.session.inspect=d.id;combatUpdate();}else select(d);};
})();
