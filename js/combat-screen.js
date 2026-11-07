const combatNumber = n => Number(n).toLocaleString("ru-RU");
const FULL_FIGURES=new Map();
function fullFighter(g,w=300,h=380){
 const key=JSON.stringify([g.id,g.cls,g.look,g.attrs,Object.values(g.equip).map(it=>it?[it.base,it.q]:null),w,h]);
 if(FULL_FIGURES.has(key))return FULL_FIGURES.get(key);
 let raw,bounds;
 for(const large of [false,true]){
  raw=document.createElement('canvas');raw.width=large?2000:1200;raw.height=large?1400:800;
  const ctx=raw.getContext('2d',{willReadFrequently:true});
  const pose=stancePose(g.cls);
  // Keep polearms upright in full-body portraits so the weapon does not shrink the fighter.
  if(['retiarius','hoplomachus'].includes(g.cls))pose.grip=Math.PI-0.025-skeleton(pose).thHF;
  drawFigure(ctx,figureSpec(g),pose,large?800:480,large?1000:620,{scale:2.4,facing:1});
  const pixels=ctx.getImageData(0,0,raw.width,raw.height).data;
  let x0=raw.width,y0=raw.height,x1=-1,y1=-1;
  for(let y=0;y<raw.height;y++)for(let x=0;x<raw.width;x++)if(pixels[(y*raw.width+x)*4+3]>4){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  bounds={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
  if(x0>8&&y0>8&&x1<raw.width-9&&y1<raw.height-9)break;
 }
 const out=document.createElement('canvas'),dpr=2,pad=8;
 const scale=Math.min((w-pad*2)/bounds.w,(h-pad*2)/bounds.h),dw=bounds.w*scale,dh=bounds.h*scale;
 out.width=Math.ceil((dw+pad*2)*dpr);out.height=Math.ceil((dh+pad*2)*dpr);
 const ctx=out.getContext('2d');ctx.scale(dpr,dpr);
 ctx.drawImage(raw,bounds.x,bounds.y,bounds.w,bounds.h,pad,pad,dw,dh);
 const url=out.toDataURL('image/png');if(FULL_FIGURES.size>120)FULL_FIGURES.clear();FULL_FIGURES.set(key,url);return url;
}
// Экран боя из одобренного макета. Результаты передаются в combatCommit.
const COMBAT = { session: null, revision: 0, view: null, timer: 0 };
// Painted sand planes sit at different heights; each fit lifts its sand edge to y≈358, just above the engine grid (368),
// so the grid and the fighters' feet stay on the sand and off the walls and the imperial box. Bottom edge anchored.
const COMBAT_ART_FIT = { 1: { scale: 0.912, x: -90 }, 2: { scale: 0.970, x: -136 }, 3: { scale: 1.38, x: -464 } };
const combatDays = n => `${n} ${n===1?'день':n<5?'дня':'дней'}`;
const combatSafe = s => s.b.event.kind === 'contract' || !!s.b.event.training;
const combatManual = s => s.phase==='fight' && s.awaiting && !s.busy && !s.paused && !s.autoplay && s.b.current?.side==='player' && s.b.current.alive;
const combatBtn = (action,label,disabled=false,extra='') => `<button data-act="${action}" ${disabled?'disabled':''} ${extra}>${label}</button>`;
function combatStop(){ COMBAT.revision++; clearTimeout(COMBAT.timer); COMBAT.view?.destroy(); COMBAT.view=null; }
class PaintedArenaView extends ArenaView {
 constructor(canvas,battle){
  super(canvas,battle); this.court=false; this.waiters=[];
  this.art=new Image(); this.art.onload=()=>this.paintBackdrop(); this.art.src=ARENA_ART[battle.event.tier||0]; this.paintBackdrop();
 }
 paintBackdrop(){
  const c=this.bg.getContext('2d');c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,AW,AH);c.fillStyle='#b69a70';c.fillRect(0,0,AW,AH);
  if(this.art?.complete&&this.art.naturalWidth){const fit=COMBAT_ART_FIT[this.b?.event?.tier]||{scale:Math.max(AW/this.art.naturalWidth,AH/this.art.naturalHeight)};const w=this.art.naturalWidth*fit.scale,h=this.art.naturalHeight*fit.scale;c.drawImage(this.art,fit.x??(AW-w)/2,AH-h,w,h);}
 }
 drawCrowd(){} // Prepared painting, without procedural crowd.
 drawSplat(){} // Keep the action visible.
 drawBanner(){} // Turn and control information belongs to the HUD.
 drawBar(ctx,f){if(!this.court)super.drawBar(ctx,f);}
 drawGrid(ctx,now){if(!this.court)super.drawGrid(ctx,now);}
 drawHint(ctx){if(!this.court)super.drawHint(ctx);}
 update(dt){
  if(!this.waiters){super.update(dt);return;}
  if(COMBAT.session?.paused)return;
  for(const f of this.fighters)if(f.move)f.move.t+=dt*(this.speed-1);
  super.update(dt);
  for(const w of [...this.waiters]){w.left-=dt*1000*this.speed;if(w.left<=0){this.waiters.splice(this.waiters.indexOf(w),1);w.resolve();}}
 }
 wait(ms){if(this.skip||!this.running)return Promise.resolve();return new Promise(resolve=>this.waiters.push({left:ms,resolve}));}
 destroy(){super.destroy();for(const w of this.waiters||[])w.resolve();this.waiters=[];}
}
function combatDialog(){
 let d=$('#combat-screen');if(d)return d;
 d=document.createElement('dialog');d.id='combat-screen';d.className='combat-screen';d.setAttribute('aria-labelledby','combat-title');document.body.appendChild(d);
 d.addEventListener('cancel',e=>{e.preventDefault();const s=COMBAT.session;if(s?.aim){s.aim=null;combatUpdate();}else if(s?.phase==='fight')ACTIONS.combatPause();else if(!s?.busy&&s?.phase!=='judgment')ACTIONS.combatExit();});return d;
}
function combatOpen(event,glads,mode){
 combatStop();$('#detail')?.close();const ev=JSON.parse(JSON.stringify(event));
 const source=JSON.parse(JSON.stringify({event:ev,glads,mode:ev.training?'manual':mode}));
 COMBAT.session={source,phase:'placement',speed:1,paused:false,busy:false,awaiting:false,autoplay:source.mode==='auto',selected:'player0',aim:null,verdicts:{},courtIndex:0,paid:false,event,notice:'',redesign:true};
 combatNewBattle();UI.battle=COMBAT.session;combatRenderField();music('arena');document.body.classList.add('combat-active');const d=combatDialog();d.classList.remove('results-compact');if(!d.open)d.showModal();$('#combat-title').focus();
}
function combatNewBattle(){
 const s=COMBAT.session,src=JSON.parse(JSON.stringify(s.source));s.b=new Battle(src.glads,src.event.enemies,{...src.event,nonLethal:!!src.event.training||src.event.kind==='contract'},{mode:src.mode});
 Object.assign(s,winReward(src.event));s.reward=s.gold;delete s.gold;s.loot=[];s.rewardRows=null;s.survived=false;
}
function combatHeader(){
 const s=COMBAT.session,stage=s.phase==='placement'?0:s.phase==='fight'?1:s.phase==='judgment'?2:3;
 const title=s.phase==='placement'?'Перед выходом на песок':s.phase==='fight'?`Раунд ${s.b.round||1}`:s.phase==='judgment'?(s.b.winner==='player'?'Победа. Последнее слово за толпой':'На милость толпы'):(s.b.winner==='player'?'Победа вашего лудуса':s.b.event.kind==='contract'?'Заказ завершён':'Бой окончен');
 return `<header class="combat-header"><div><div class="eyebrow">${esc(TIERS[s.b.event.tier].place)} <span>· ${s.b.units.filter(u=>u.side==='player').length} на ${s.b.units.filter(u=>u.side==='enemy').length}</span></div><h2 id="combat-title" tabindex="-1">${title}</h2></div><ol class="combat-steps" aria-label="Этапы боя">${['Расстановка','Схватка','Суд толпы','Итоги'].map((l,i)=>`<li ${i===stage?'aria-current="step"':''}>${l}</li>`).join('')}</ol><div class="combat-header-tools">${s.phase==='fight'?combatBtn('combatPause','Пауза · P',false,'class="ghost" aria-label="Пауза боя"'):s.phase==='placement'?combatBtn('combatExit','×',false,'class="ghost combat-close" aria-label="Закрыть бой"'):''}</div></header>`;
}
function combatRenderField(){
 const s=COMBAT.session,d=combatDialog();COMBAT.view?.destroy();document.body.appendChild($('#coach'));
 d.innerHTML=`${combatHeader()}<div id="combat-queue" class="combat-queue"></div><div class="combat-workspace"><section class="combat-field-column" aria-label="Арена"><div class="combat-canvas-wrap"><canvas id="combat-canvas" tabindex="0" aria-label="Тактическое поле 10 на 5. Стрелки выбирают клетку, Enter перемещает или выбирает цель."></canvas><div id="combat-overlay" hidden></div></div><div class="combat-field-legend" id="combat-field-legend"></div><div id="combat-rosters" class="combat-rosters"></div></section><aside class="combat-sidebar"><div id="combat-unit-panel"></div><details class="combat-log-panel"><summary>Журнал боя <span id="combat-log-count"></span></summary><div id="combat-log"></div></details></aside></div><div id="combat-commandbar"></div><div class="combat-sr" id="combat-status" role="status" aria-live="polite"></div>`;
 d.appendChild($('#coach'));const painter=paintArena;try{paintArena=()=>[];COMBAT.view=new PaintedArenaView($('#combat-canvas'),s.b);}finally{paintArena=painter;}
 COMBAT.view.onPick=hit=>combatPick(hit);COMBAT.view.speed=s.speed;COMBAT.view.hintFn=hit=>combatCanvasHint(hit);$('#combat-canvas').addEventListener('keydown',combatFieldKey);combatUpdate();
}
function combatStatus(u){
 const out=[];if(!u.alive)return ['Повержен'];if(u.stun)out.push(`Оглушение · ${u.stun} ход`);if(u.net)out.push(`Сеть · ${u.net} ход`);
 if(u.bleeds.length)out.push(`Кровь −${u.bleeds.reduce((a,x)=>a+x.dmg,0)}/ход`);if(u.defending)out.push('Оборона');if(u.spearWall)out.push('Копейный заслон');if(COMBAT.session.b.holders(u).length)out.push('Окружён');if(u.evade)out.push(`Уклонение +${u.evade}%`);return out;
}
function combatRoster(side){
 const s=COMBAT.session,b=s.b;return `<section><h3>${side==='player'?'Ваш лудус':'Противники'} <small>${b.alive(side).length}/${b.units.filter(u=>u.side===side).length}</small></h3><div class="combat-team">${b.units.filter(u=>u.side===side).map(u=>`<button class="combat-unit ${u.alive?'':'is-down'} ${side}" data-act="combatSelect" data-id="${u.uid}" aria-pressed="${side==='player'&&s.selected===u.uid}"><img src="${portrait(u.g,64,80,{bust:true})}" alt=""><span><b>${esc(u.g.name)}</b><small>${u.alive?`${u.hp}/${u.maxHp} HP`:'Повержен'}</small><span class="combat-health"><i style="width:${Math.max(0,u.hp/u.maxHp*100)}%"></i></span></span>${combatStatus(u).length?`<span class="combat-status-dot" title="${esc(combatStatus(u).join(', '))}" aria-label="${esc(combatStatus(u).join(', '))}">!</span>`:''}</button>`).join('')}</div></section>`;
}
function combatTurnFlag(){
 const s=COMBAT.session;if(s.phase!=='fight')return '';const u=s.b.current;
 const text=s.paused?'Пауза':s.busy?'Боец действует':u&&u.side==='player'&&!s.autoplay?'Ваш ход':s.autoplay?'Автобой':u?'Ход противника':'';
 return text?`<strong class="combat-turn-flag ${u?.side||''}">${text}</strong>`:'';
}
function combatQueue(){
 const s=COMBAT.session,b=s.b;
 if(s.phase==='placement')return `<span class="combat-queue-label">Расстановка</span><span>Выберите бойца, затем клетку в своей зоне. Союзников можно поменять местами.</span><strong>${b.units.filter(u=>u.side==='player').length} на ${b.units.filter(u=>u.side==='enemy').length}</strong>`;
 if(s.phase==='judgment')return s.autoCourt?`<span class="combat-queue-label">Перед трибунами</span><span>Толпа сама решает судьбу побеждённых</span>`:`<span class="combat-queue-label">Перед трибунами</span>${s.court.map((u,i)=>`<button class="combat-order ${s.courtIndex===i?'current':''}" data-act="combatCourtSelect" data-id="${i}" ${s.busy?'disabled':''}><img src="${portrait(u.g,40,50,{bust:true})}" alt=""><span>${esc(u.g.name)}<small>${s.verdicts[u.uid]?.result==='live'?'Помилован':s.verdicts[u.uid]?.result==='die'?'Казнён':'Ждёт решения'}</small></span></button>`).join('')}`;
 const list=[...(b.current?.alive?[b.current]:[]),...b.queue.filter(u=>u.alive)];return `<span class="combat-queue-label">Очередь ходов</span>${list.map((u,i)=>`<button data-act="combatInspect" data-id="${u.uid}" class="combat-order ${u.side} ${i===0?'current':''}"><img src="${portrait(u.g,40,50,{bust:true})}" alt=""><span>${esc(u.g.name)}<small>${i===0?'Сейчас ходит':`${i+1}-й в очереди`}</small></span></button>`).join('')}${b.extraAction?'<strong>Дополнительный ход</strong>':''}${combatTurnFlag()}`;
}
function combatPrediction(u,t,ability=false,from=null){
 const b=COMBAT.session.b,A=clsOf(u.g).ability;if(!t)return null;const cell=from||u,dist=cheb(cell,t),helpless=t.net>0||t.stun>0;
 if(ability&&A?.id==='netThrow'){const base=85+u.s.netBonus,p=t.s.resist>=100?0:clamp(base-t.s.resist*(base>=100?.5:1),5,100);return {p:Math.round(p),label:'Шанс опутать',detail:p?'Пропуск хода, нет блока и уклонения':'Иммунитет к контролю',cost:5};}
 const bonus=ability?({onslaught:15,slash:10,aimedShot:20}[A?.id]||0):0,pb=u.s.ranged&&dist<=1?-20:0,dodge=helpless?0:t.s.dodge+t.evade,p=hitChanceOf(u.s.acc+bonus+pb,dodge),back=b.backstab(t,u,cell);
 let crit=Math.min(100,(u.s.crit+(ability&&A?.id==='aimedShot'?10:0))*(back?2:1));if(ability&&A?.id==='aimedShot'&&pv(u.g,'sag_cap'))crit=100;
 const details=[`Крит ${crit}%`,back?'в спину':null,pb?'в упор: −20 точности':null,helpless?'цель беспомощна':null,from&&from!==u?`подход ${from.d} ОД`:null].filter(Boolean);return {p,label:'Попадание',detail:details.join(' · '),cost:(ability?5:4)+(from&&from!==u?from.d:0)};
}
function combatAvailability(u,t){
 const s=COMBAT.session,b=s.b,o=b.options(u),A=clsOf(u.g).ability,path=t?o.approach.get(t.uid):null;
 const attack=!!t&&(o.attackNow.includes(t)||!!path);
 const ability=!!A&&u.apLeft>=5&&u.cd===0&&(A.id==='whirl'?b.adjacentFoes(u).length>0:!!t&&o.abilityNow.includes(t));
 const anyAttack=o.attackNow.length>0||o.approach.size>0;
 const anyAbility=!!A&&u.apLeft>=5&&u.cd===0&&(A.id==='whirl'?b.adjacentFoes(u).length>0:o.abilityNow.length>0);
 // No lasting target: hit and ability are armed by their buttons, then the target is clicked on the field.
 const reason=kind=>{
  if(kind==='ability'&&!A)return 'Школа ещё не выбрана';
  if(kind==='ability'&&u.cd)return `Перезарядка: ещё ${u.cd} собственных ходов`;
  if(u.apLeft<(kind==='ability'?5:4))return `Нужно ${kind==='ability'?5:4} ОД, осталось ${u.apLeft}`;
  if(kind==='defend')return 'Оборона: только при полных очках действия';
  if(kind==='ability')return anyAbility?(A?.id==='whirl'?'Умение заденет всех соседних противников':'Выберите умение, затем цель на поле'):'Противник вне досягаемости умения';
  return anyAttack?'Выберите удар, затем цель на поле':'Противник вне досягаемости';
 };return {o,t,A,path,attack,ability,anyAttack,anyAbility,reason};
}
function combatUpdate(){
 const s=COMBAT.session,v=COMBAT.view;if(!s||!v||s.phase==='results')return;
 const b=s.b,placement=s.phase==='placement',manual=combatManual(s),u=b.current;
 const active=document.activeElement,focusKey=active?.closest('#combat-screen')?{action:active.dataset.act,id:active.dataset.id}:null;
 $('#combat-queue').innerHTML=combatQueue();$('#combat-rosters').innerHTML=s.phase==='judgment'?(s.autoCourt?combatRoster('player'):combatCourtRoster()):combatRoster('player')+combatRoster('enemy');$('#combat-unit-panel').innerHTML=combatPanel();
 $('#combat-log').innerHTML=b.log.filter(l=>!['sys','round'].includes(l.kind)).slice(-35).map(l=>`<p>${l.text}</p>`).join('')||'<p>Здесь появятся действия бойцов.</p>';
 $('#combat-log-count').textContent=b.log.filter(l=>!['sys','round'].includes(l.kind)).length||'';
 $('#combat-field-legend').innerHTML=s.phase==='judgment'?'':placement?'<span>Золотая зона: ваш строй</span><span>Высокие преграды закрывают выстрел</span>':`<span>Синие клетки: движение · ${s.aim==='ability'?'Золото: цель умения':'Красные кольца: атака'}</span><span>${manual?`Остаток ${u.apLeft} ОД → +${u.apLeft*3}% уклонения`:'Клик по карточке: сведения'}</span>`;
 if(s.phase!=='judgment'){v.hl.zone=placement?DEPLOY_COLS.player:null;v.hl.selected=placement?s.selected:manual?u.uid:null;const o=manual?b.options(u):null;v.hl.reach=o?.reach||null;v.hl.targets=o&&s.aim!=='ability'?new Set([...o.attackNow.map(f=>f.uid),...o.approach.keys()]):null;v.hl.ability=o&&s.aim==='ability'?new Set(o.abilityNow.map(f=>f.uid)):null;v.faceFoes();}
 $('#combat-commandbar').innerHTML=combatCommandbar();if(s.phase==='fight')$('#combat-title').textContent=`Раунд ${b.round||1}`;
 if(focusKey?.action){const el=[...$('#combat-screen').querySelectorAll('[data-act]')].find(e=>e.dataset.act===focusKey.action&&e.dataset.id===focusKey.id&&!e.disabled);el?.focus({preventScroll:true});}
}
function combatCommandbar(){
 const s=COMBAT.session;
 if(s.phase==='placement')return `<footer class="combat-commandbar"><div>${combatBtn('combatArrange','Авторасстановка',false,'class="ghost"')}</div><fieldset class="arena-control-toggle combat-mode"><legend>Управление</legend>${[['manual','Вручную'],['auto','Автобой']].map(([value,label])=>`<label><input type="radio" name="combat-control" value="${value}" ${s.autoplay===(value==='auto')?'checked':''} ${s.b.event.training?'disabled':''}><span>${label}</span></label>`).join('')}</fieldset>${combatBtn('combatStart','Начать бой',false,'class="primary"')}</footer>`;
 if(s.phase==='judgment'){if(s.autoCourt)return `<footer class="combat-commandbar"><span>Толпа выносит приговор побеждённым</span></footer>`;const all=s.court.every(u=>s.verdicts[u.uid]?.result);return `<footer class="combat-commandbar"><span>${s.b.winner==='player'?'Ваши поверженные бойцы выживут · ранение 1 день':combatSafe(s)?'Все бойцы возвращаются в школу':s.paid?`Подкуп оплачен: ${s.spent||0} ден.`:`Казна: ${combatNumber(STATE.gold)} ден. · подкуп ${combatBribeTotal()} ден.`}</span><div>${combatBtn('combatVerdict',all?'К итогам':'Выслушать приговор',s.busy,'class="primary"')}</div></footer>`;}
 return `<footer class="combat-commandbar"><div>${combatBtn('combatSurrender','Сдаться',!!s.b.event.training,'class="ghost"')}${combatBtn('combatAuto',s.autoplay?'Взять управление':'Включить автобой',!!s.b.event.training,`class="ghost" aria-pressed="${s.autoplay}"`)}</div><div class="combat-speed" role="group" aria-label="Скорость боя · клавиши 1–3">${[1,2,4].map(n=>combatBtn('combatSpeed',`×${n}`,false,`data-id="${n}" aria-pressed="${s.speed===n}" title="Клавиша ${ {1:'1',2:'2',4:'3'}[n] }"`)).join('')}</div></footer>`;
}
function combatCanvasHint(hit){
 // Cell captions are gone: the hint names a fighter, and only hovering a target shows hit and crit chances.
 const s=COMBAT.session;if(!s||s.phase==='judgment')return null;const b=s.b,u=b.current,t=hit.uid&&b.unit(hit.uid),p=cellPos(hit.c,hit.r);
 if(s.phase==='placement')return t?{text:`${t.g.name} · ${clsOf(t.g).name}`,x:p.x,y:p.y+20,color:'#fff0ca'}:null;
 if(!combatManual(s))return null;
 if(t&&t.side!==u.side){coach('hoverEnemy');
  const o=b.options(u),ability=s.aim==='ability',from=o.attackNow.includes(t)?u:o.approach.get(t.uid),can=ability?o.abilityNow.includes(t):!!from,pr=combatPrediction(u,t,ability,ability?null:from||u);
  const why=ability?(u.apLeft<5||u.cd>0?'умение недоступно':'вне радиуса умения'):(cheb(u,t)>1&&!b.los(u,t)?'нет линии атаки':'вне досягаемости');
  return {text:can?`${t.g.name} · ${pr.label} ${pr.p}% · ${pr.cost} ОД · ${pr.detail}`:`${t.g.name} · ${why}`,x:p.x,y:p.y+20,color:can?'#fff0ca':'#f3c2a8'};
 }
 return null;
}
function combatPick(hit){
 const s=COMBAT.session;if(!s||s.busy||s.paused)return;const b=s.b,t=hit.uid&&b.unit(hit.uid);
 if(s.phase==='placement'){
  const u=b.unit(s.selected);if(t?.side==='enemy')return;if(t?.side==='player'&&t.uid===u.uid){s.placementArmed=true;combatUpdate();return;}
  if(t?.side==='player'&&!s.placementArmed){s.selected=t.uid;s.placementArmed=true;combatUpdate();return;}
  if(!b.inField(hit.c,hit.r)||!DEPLOY_COLS.player.includes(hit.c)||b.isBlocked(hit.c,hit.r))return;
  const other=b.unitAt(hit.c,hit.r);if(other&&other!==u){other.c=u.c;other.r=u.r;COMBAT.view.placeFighter(COMBAT.view.F(other.uid),other.c,other.r);}
  u.c=hit.c;u.r=hit.r;COMBAT.view.placeFighter(COMBAT.view.F(u.uid),u.c,u.r);s.placementArmed=false;combatUpdate();coach('deployPlace');return;
 }
 if(!combatManual(s))return;
 if(t?.side==='enemy'){if(s.aim)combatCommand(s.aim,{uid:t.uid});return;}
 if(!t){if(s.aim){s.aim=null;combatUpdate();}else combatCommand('move',hit);}
}
function combatFieldKey(e){
 const s=COMBAT.session;if(!s||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key))return;e.preventDefault();
 const u=s.b.unit(s.selected)||s.b.current,c=s.cursor||{c:u.c,r:u.r},dir={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];
 if(dir){c.c=clamp(c.c+dir[0],0,9);c.r=clamp(c.r+dir[1],0,4);s.cursor=c;COMBAT.view.hl.hover={...c};$('#combat-status').textContent=`Клетка ${c.c+1}:${c.r+1}. ${combatCanvasHint(c)?.text||''}`;}else{const t=s.b.unitAt(c.c,c.r);combatPick({...c,uid:t?.uid});}
}
async function combatPlay(events){const rev=COMBAT.revision,v=COMBAT.view;if(!v)return false;await v.play([...events]);if(rev!==COMBAT.revision)return false;v.sync();return true;}
function combatSchedule(){clearTimeout(COMBAT.timer);const rev=COMBAT.revision;COMBAT.timer=setTimeout(()=>{if(rev===COMBAT.revision)combatTurn();},220/COMBAT.session.speed);}
function combatCheckEnd(){
 const s=COMBAT.session,b=s.b;if(s.surrenderPending){s.surrenderPending=false;b.surrender();}
 if(!b.over&&b.event.kind==='contract'&&b.event.cond?.type==='survive'&&b.round>b.event.cond.rounds&&b.alive('player').length){s.survived=true;b.over=true;b.winner=null;}
 if(!b.over&&b.round>60){const hp=side=>b.alive(side).reduce((a,u)=>a+u.hp/u.maxHp,0);b.over=true;b.winner=hp('player')>=hp('enemy')?'player':'enemy';for(const u of b.alive(b.winner==='player'?'enemy':'player')){u.alive=false;u.hp=0;}COMBAT.view.sync();}
 if(b.over){combatResult();return true;}return false;
}
async function combatTurn(){
 const s=COMBAT.session;if(!s||s.phase!=='fight'||s.paused||s.busy||s.awaiting)return;
 if(combatCheckEnd())return;const b=s.b;s.busy=true;s.aim=null;s.inspect=null;s.notice='';const turn=b.beginTurn();if(turn.u)s.selected=turn.u.uid;combatUpdate();
 if(!await combatPlay(b.events))return;
 if(b.over||s.surrenderPending){s.busy=false;combatCheckEnd();return;}
 if(turn.act&&turn.u.side==='player'&&!s.autoplay){s.awaiting=true;s.busy=false;combatUpdate();return;}
 if(turn.act){b.aiTurn(turn.u);if(!await combatPlay(b.events))return;}
 s.busy=false;combatUpdate();if(!combatCheckEnd()&&!s.paused)combatSchedule();
}
async function combatCommand(kind,hit){
 const s=COMBAT.session;if(!s||!combatManual(s))return;const b=s.b,u=b.current,t=hit?.uid?b.unit(hit.uid):null,a=combatAvailability(u,t);
 if(kind==='defend'&&!combatCanDefend(u))return;
 if(kind==='wait'&&!s.confirmEnd&&(a.o.attackNow.length||a.o.approach.size)){s.confirmEnd=true;combatUpdate();return;}
 if(kind==='attack'&&!a.attack||kind==='ability'&&!a.ability)return;
 s.busy=true;s.notice='';s.confirmEnd=false;combatUpdate();let ok=false;
 if(kind==='attack'){if(a.path){b.cmdMove(u,a.path.c,a.path.r);if(!await combatPlay(b.events))return;}ok=b.cmdAttack(u,a.t);}else if(kind==='ability')ok=b.cmdAbility(u,a.A.id==='whirl'?null:a.t);else if(kind==='move')ok=b.cmdMove(u,hit.c,hit.r);else if(kind==='defend')ok=b.cmdDefend(u);else if(kind==='wait')ok=b.cmdWait(u);
 if(ok)coach(kind==='attack'?'attacked':kind==='ability'?'ability':kind==='move'?'moved':'turnEnd');if(ok&&!await combatPlay(b.events))return;s.busy=false;s.aim=null;if(!ok)s.notice='Эта клетка недоступна.';
 const end=ok&&(kind==='defend'||kind==='wait'||u.apLeft<=0||!u.alive);if(end){s.awaiting=false;coach('turnEnd');}combatUpdate();if(!combatCheckEnd()&&end&&!s.paused)combatSchedule();
}
function combatOverlay(title,body,buttons){const el=$('#combat-overlay');el.hidden=false;el.innerHTML=`<section class="combat-pause" role="dialog" aria-label="${esc(title)}"><h3>${title}</h3><p>${body}</p><div>${buttons}</div></section>`;el.querySelector('button')?.focus();}
function combatPrepareRewards(){
 const s=COMBAT.session,b=s.b,won=b.winner==='player',contract=b.event.kind==='contract',T=TIERS[b.event.tier],xpK=b.event.xpMult??(contract?.6:1);
 s.rewardRows=b.units.filter(u=>u.side==='player').map(u=>{const xp=Math.round(T.xp*((won?50:20)+u.kills*20)*xpK),fame=contract?0:(b.event.tier+1)*((won?1:0)+u.kills*2);u.g.fame+=fame;return {u,xp,fame};});
 if(contract){const cond=b.event.cond||{type:'win'};s.contractSuccess=cond.type==='survive'?won||s.survived||b.round>cond.rounds:won&&!b.surrendered&&(cond.type!=='flawless'||b.units.filter(u=>u.side==='player').every(u=>u.alive))&&(cond.type!=='rounds'||b.round<=cond.rounds);s.reward=s.contractSuccess?b.event.gold:Math.round(b.event.gold*.15);s.fame=s.contractSuccess?b.event.fame:0;}else if(!won){s.reward=0;s.fame=-1;}
}
async function combatResult(){
 const s=COMBAT.session;if(!s||!['fight','placement'].includes(s.phase))return;
 clearTimeout(COMBAT.timer);s.awaiting=false;s.aim=null;s.paused=false;s.inspect=null;s.notice='';if(!s.rewardRows)combatPrepareRewards();coach('results');
 if(s.b.event.kind==='contract'){combatFinishResults();return;}
 s.phase='judgment';s.busy=true;s.court=s.b.units.filter(u=>u.side!==(s.b.winner||'enemy'));s.courtIndex=0;s.verdicts={};s.paid=false;s.spent=0;
 s.autoCourt=s.b.winner==='player';
 const v=COMBAT.view,rev=COMBAT.revision;if(!v)return;v.court=true;v.active=null;v.obstacles=[];v.hl={grid:false,zone:null,reach:null,targets:null,ability:null,selected:null,hover:null};v.big=null;v.banner=null;v.texts=[];v.splat=null;
 const winners=s.b.units.filter(u=>u.side===s.b.winner&&u.alive);s.executioner=winners[0]?.uid;
 // Composed foreground; the original kneel / rise / execute clips remain intact.
 for(const f of v.fighters){const i=s.court.findIndex(u=>u.uid===f.uid);if(i>=0)f.home={x:640+(i-(s.court.length-1)/2)*205,y:555};else{const k=winners.findIndex(u=>u.uid===f.uid);f.home={x:s.b.winner==='player'?150+Math.max(k,0)*85:1130-Math.max(k,0)*85,y:500-Math.max(k,0)*20};}f.x=f.home.x;f.y=f.home.y;f.move=null;f.clip=null;}
 $('#combat-screen .combat-header').outerHTML=combatHeader();combatUpdate();await v.kneel(s.court.map(u=>u.uid));if(rev!==COMBAT.revision)return;s.busy=false;
 // A player victory judges the enemies by itself: full ceremony, no button, no defeated-enemy details.
 if(s.autoCourt){s.busy=true;combatUpdate();if(!await combatCeremony(rev))return;s.busy=false;return combatFinishResults();}
 combatUpdate();$('#combat-status').textContent='Бой окончен. Проигравшие ждут приговора толпы.';
}
function combatGuaranteed(u){const s=COMBAT.session;return !!s.b.event.training||(s.b.winner==='player'&&s.b.event.kind==='final');}
function combatBribeTotal(){const s=COMBAT.session;return (s.court||[]).reduce((a,u)=>a+(s.verdicts[u.uid]?.bribed?bribeCost(s.b):0),0);}
function combatCourtRoster(){
 const s=COMBAT.session;return `<section class="combat-court-roster"><h3>${s.b.winner==='player'?'Поверженные противники':'Ваши бойцы'} <small>${s.court.filter(u=>s.verdicts[u.uid]?.result).length}/${s.court.length} приговоров</small></h3><div class="combat-team">${s.court.map((u,i)=>{const v=s.verdicts[u.uid]||{},m=mercyBreakdown(u,s.b,!!v.bribed);return `<button class="combat-unit ${i===s.courtIndex?'selected':''}" data-act="combatCourtSelect" data-id="${i}" ${s.busy?'disabled':''}><img src="${portrait(u.g,64,80,{bust:true})}" alt=""><span><b>${esc(u.g.name)}</b><small>${v.result==='live'?'Помилован':v.result==='die'?'Казнён':combatGuaranteed(u)?'Пощада гарантирована':`Помилование ${m.total}%${v.bribed?' · подкуп':''}`}</small></span></button>`;}).join('')}</div></section>`;
}
function combatCourtPanel(){
 const s=COMBAT.session,u=s.court[s.courtIndex],v=s.verdicts[u.uid]||{},m=mercyBreakdown(u,s.b,!!v.bribed),plain=mercyBreakdown(u,s.b),cost=bribeCost(s.b),guaranteed=combatGuaranteed(u),done=v.result;
 const canBribe=u.side==='player'&&!s.paid&&!s.busy&&!guaranteed&&plain.raw<plain.cap&&(v.bribed||STATE.gold-combatBribeTotal()>=cost);
 return `<div class="combat-court-person"><div class="eyebrow">Приговор ${s.courtIndex+1} из ${s.court.length}</div><h3>${esc(u.g.name)}</h3><p>${clsOf(u.g).name} · ${u.kills} повержено · ${u.dmgDealt} урона</p></div><div class="combat-mercy-meter"><span>${guaranteed?'Пощада гарантирована':'Шанс помилования'}</span><strong>${guaranteed?100:m.total}<small>%</small></strong><meter min="0" max="100" value="${guaranteed?100:m.total}" aria-label="Шанс помилования"></meter></div>${done?`<div class="combat-verdict-stamp ${done}"><strong>${done==='live'?'MISSIO':'IUGULA'}</strong></div>`:`<p class="combat-court-note">${guaranteed?'Этот бой не станет последним. Боец будет отпущен.':u.kills?'Храбрость заслужила признание. Но даже лучший боец не получает гарантии.':'Без поверженного противника шанс не превышает 50%.'}</p>`}<details class="combat-factors"><summary>Из чего складывается шанс</summary><dl>${m.parts.map(p=>`<div><dt>${esc(p.label)}</dt><dd>${p.v>0?'+':''}${p.v}%</dd></div>`).join('')}</dl><p>Сумма ${m.raw}%. Предел ${m.cap}%.</p></details>${u.side==='player'&&!done&&!guaranteed?`<label class="combat-bribe ${canBribe?'':'unavailable'}"><input type="checkbox" data-act="combatBribeFighter" data-id="${u.uid}" ${v.bribed?'checked':''} ${canBribe?'':'disabled'}><span>Подкупить распорядителя<small>${cost} ден. · +${mercyBreakdown(u,s.b,true).total-plain.total} п.п. к шансу${plain.raw>=plain.cap?' · уже на пределе':s.paid?(v.bribed?' · оплачен':' · выбор закрыт'):!canBribe&&!s.busy?' · не хватает денег':''}</small></span></label>`:''}<p class="combat-action-note">${s.busy?'Выносится приговор…':done?'Приговор исполнен на арене.':s.b.winner==='player'?'Трибуны решат судьбу каждого поверженного.':'Отметьте подкуп нужным бойцам, затем выслушайте приговор.'}</p>`;
}
function combatResolveVerdict(u){
 const s=COMBAT.session,v=s.verdicts[u.uid]||(s.verdicts[u.uid]={});if(v.result)return v;const m=mercyBreakdown(u,s.b,!!v.bribed);v.chance=combatGuaranteed(u)?100:m.total;
 v.result=combatGuaranteed(u)?'live':(chance(m.total)?'live':'die');v.wound=v.result==='live'?combatWound(u):0;
 if(u.side==='enemy'){if(v.result==='die')s.fame++;for(const it of Object.values(u.g.equip))if(it&&chance(combatLootChance(v.result==='live'))){const loot={...it,id:uid(),stats:{...it.stats}};s.loot.push({it:loot,name:loot.name,q:loot.q,from:u.g.name});}}return v;
}
function combatPayBribes(){const s=COMBAT.session;if(s.paid)return true;s.spent=combatBribeTotal();if(s.spent>STATE.gold)return false;STATE.gold-=s.spent;s.paid=true;return true;}
// The restored ceremony: the winner walks to each defeated fighter, the crowd decides, then executes or pardons.
// One press judges the whole losing team in sequence; the centered MISSIO / IUGULA banner is the only verdict word.
async function combatCeremony(rev0){
 const s=COMBAT.session,v=COMBAT.view;
 for(let i=0;i<s.court.length;i++){
  if(COMBAT.revision!==rev0)return false;
  s.courtIndex=i;const u=s.court[i],verdict=combatResolveVerdict(u);
  combatUpdate();
  const exec=u.killedBy?.alive&&u.killedBy.side!==u.side?u.killedBy.uid:s.executioner;
  await v.execution(u.uid,exec,verdict.result,'');
  if(COMBAT.revision!==rev0)return false;
  const f=v.F(u.uid);if(f)f.state=verdict.result==='die'?'dead':'idle';
  $('#combat-status').textContent=`${u.g.name}: ${verdict.result==='live'?'помилован':'казнён'}`;
 }
 return true;
}
async function combatVerdict(){
 const s=COMBAT.session;if(!s||s.phase!=='judgment'||s.busy)return;
 if(s.court.every(u=>s.verdicts[u.uid]?.result))return combatFinishResults();
 if(!combatPayBribes())return;
 s.busy=true;combatUpdate();
 if(!await combatCeremony(COMBAT.revision))return;
 s.busy=false;combatCommit(s);combatUpdate();
}
function combatFinishResults(){
 const s=COMBAT.session;if(!s||s.busy&&s.phase==='judgment')return;if(s.phase==='judgment'&&!s.court.every(u=>s.verdicts[u.uid]?.result))return;if(!s.rewardRows)combatPrepareRewards();
 combatCommit(s);s.phase='results';clearTimeout(COMBAT.timer);COMBAT.view?.destroy();COMBAT.view=null;s.busy=false;s.paused=false;
 const won=s.b.winner==='player',contract=s.b.event.kind==='contract',outcome=u=>{const v=s.verdicts[u.uid];if(v?.result==='die')return 'Казнён';if(v?.result==='live')return `Помилован · ранение ${combatDays(v.wound)}`;return u.alive?'Вернулся в школу':'Выжил · ранение 1 день';};
 const title=contract?(s.contractSuccess?'Заказ выполнен':'Заказ не выполнен'):won?'Победа вашего лудуса':'Судьбы решены',returned=s.rewardRows.filter(({u})=>s.verdicts[u.uid]?.result!=='die').length;
 document.body.appendChild($('#coach'));const d=combatDialog();d.classList.toggle('results-compact',s.rewardRows.length===1);
 d.innerHTML=`${combatHeader()}<div class="combat-results"><section class="combat-result-hero" style="background-image:url('${ARENA_ART[s.b.event.tier]}')"><div><div class="eyebrow">${s.b.round||1} раундов · ${s.b.units.filter(u=>u.side==='player').length} на ${s.b.event.size}</div><h3>${title}</h3><p>${returned} из ${s.rewardRows.length} бойцов вернутся в школу${s.b.surrendered?' · вы подняли руку и остановили бой':''}</p></div><div class="combat-result-totals"><span><small>Денарии</small><strong>${s.reward>0?'+':''}${combatNumber(s.reward||0)}</strong></span><span><small>Слава лудуса</small><strong>${s.fame>0?'+':''}${s.fame||0}</strong></span>${s.spent?`<span><small>Подкуп</small><strong>−${s.spent}</strong></span>`:''}</div></section><div class="combat-results-body"><h3>Ваши бойцы</h3><div class="combat-result-team">${s.rewardRows.map(({u,xp,fame})=>`<article class="combat-result-unit"><img src="${fullFighter(u.g,160,200)}" alt=""><div><h4>${esc(u.g.name)}</h4><p>${outcome(u)}</p><dl><div><dt>Урон / повержено</dt><dd>${u.dmgDealt} / ${u.kills}</dd></div><div><dt>Опыт</dt><dd>+${xp}</dd></div>${fame?`<div><dt>Личная слава</dt><dd>+${fame}</dd></div>`:''}</dl></div></article>`).join('')}</div>${s.artifact?`<div class="combat-result-bottom single"><section><h3>Награда за заказ</h3><p><b class="q4">${esc(s.artifact.name)}</b><span>На складе лудуса</span></p></section></div>`:''}${won&&!contract?`<div class="combat-result-bottom single"><section><h3>Трофеи</h3>${s.loot.length?s.loot.map(it=>`<p><b class="q${it.q}">${esc(it.name)}</b><span>${esc(it.from)}</span></p>`).join(''):'<p>Ценных трофеев не досталось.</p>'}</section></div>`:''}</div></div><footer class="combat-commandbar"><span>Отдых до следующего дня${s.rewardRows.some(({u})=>!u.alive)?' · раненым потребуется восстановление':''}</span><div>${combatBtn('combatExit','Вернуться в лудус',false,'class="primary"')}</div></footer>`;d.appendChild($('#coach'));$('#combat-title').focus();
}
function combatPanel(){
 const s=COMBAT.session,b=s.b,placement=s.phase==='placement';if(s.phase==='judgment')return s.autoCourt?`<div class="combat-court-person"><div class="eyebrow">Суд толпы</div><h3>Победа вашего лудуса</h3><p>Толпа сама решает судьбу побеждённых.</p></div>`:combatCourtPanel();
 const u=b.unit(s.inspect)||b.unit(s.selected)||b.current||b.units[0],a=combatAvailability(u),manual=combatManual(s)&&u===b.current,tags=combatStatus(u);
 const actor=`<div class="combat-focus"><img src="${fullFighter(u.g,180,230)}" alt=""><div><div class="eyebrow">${placement?'Ваш строй':u===b.current?'Сейчас ходит':'Осмотр бойца'}</div><h3>${esc(u.g.name)}</h3><p>${clsOf(u.g).name} · ${u.g.level} ур.</p><strong>${u.hp}<small> / ${u.maxHp} HP</small></strong></div></div>`;
 const stats=`<dl class="combat-stats"><div><dt>Урон</dt><dd>${u.s.dmgMin}–${u.s.dmgMax}</dd></div><div><dt>Броня</dt><dd>${Math.max(0,u.s.armor-u.shred)}</dd></div><div><dt>Дальность</dt><dd>${u.reach} кл.</dd></div><div><dt>Инициатива</dt><dd>${u.s.init}</dd></div></dl>`;
 const ap=`<div class="combat-ap"><div><span>Очки действия</span><strong>${placement?u.ap:u.apLeft}<small> / ${u.ap}</small></strong></div><div class="combat-ap-pips">${Array.from({length:u.ap},(_,i)=>`<i class="${i<(placement?u.ap:u.apLeft)?'filled':''}"></i>`).join('')}</div></div>`;
 if(placement)return `${actor}${stats}${ap}<div class="combat-placement-note"><p>Кликните по бойцу, затем по клетке золотой зоны: так бойцы выходят на песок. Лучников оставьте в тылу. Длинное оружие достаёт через низкие преграды.</p></div>`;
 const note=s.notice||(!manual?(s.paused?'Бой приостановлен':s.busy?'Выполняется действие':s.autoplay?'Бойцы действуют самостоятельно':'Ход противника')
  :s.aim==='attack'?'Кликните по противнику на поле: это цель удара. Клик по пустой клетке отменяет удар.'
  :s.aim==='ability'?(a.A?.id==='whirl'?'Умение заденет всех соседних противников.':`Кликните по противнику на поле: это цель умения «${a.A?.name}». Клик по пустой клетке отменяет.`)
  :a.anyAttack?'Выберите удар или умение, затем кликните по противнику. Клик по пустой клетке: движение.'
  :a.reason('attack'));
 return `${actor}${stats}${ap}${tags.length?`<div class="combat-tags">${tags.map(t=>`<span>${t}</span>`).join('')}</div>`:''}${u!==b.current?combatBtn('combatInspect','К активному бойцу',false,'data-id="" class="ghost"'):''}<div class="combat-manual-actions">${combatBtn('combatArm',`${u.s.ranged?'Выстрел':'Удар'}<small>4 ОД${u.hits>=1?' · 75% урона':''} · A</small>`,!manual||!a.anyAttack||u.apLeft<4,`data-id="attack" aria-pressed="${s.aim==='attack'}" title="${esc(a.anyAttack&&u.apLeft>=4?'Выберите удар, затем кликните по противнику':a.reason('attack'))}"`)}${combatBtn('combatAim',`${esc(a.A?.name||'Нет умения')}<small>${u.cd?`CD ${u.cd}`:'5 ОД'} · S</small>`,!manual||!a.anyAbility,`aria-pressed="${s.aim==='ability'}" title="${esc(a.A?(a.anyAbility?(a.A.desc||'Выберите умение, затем цель на поле'):'Противник вне досягаемости умения'):'Выберите школу с 5-го уровня')}"`)}${combatBtn('combatCommand','Оборона<small>−40% урона · +20% блока · D</small>',!manual||!combatCanDefend(u),`data-id="defend" title="${!combatCanDefend(u)?'Оборона: только при полных очках действия':'Завершить ход в обороне, оставшиеся ОД дадут уклонение'}"`)}${combatBtn('combatCommand',`${s.confirmEnd?'Точно завершить?':'Конец хода'}<small>+${u.apLeft*3}% уклонения · Пробел</small>`,!manual,'data-id="wait" class="combat-end"')}</div><p class="combat-action-note">${esc(note)}</p>`;
}
ACTIONS.startBattle=()=>{
 const ev=findEvent(UI.eventId),glads=UI.picked.map(glad).filter(Boolean);
 if(UI.battle||!ev||ev.done||glads.length!==playerCount(ev)||glads.some(g=>!canFight(g)))return;
 ev.enemies.forEach(ensureLook);combatOpen(ev,glads,ev.training?'manual':battleMode());
 UI.picked=[];UI.eventId=null;$('main .pick-bg')?.remove();coach('battleStart',ev);
};
ACTIONS.combatExit=()=>{
 const s=COMBAT.session;if(!s||!['placement','results'].includes(s.phase))return;
 combatStop();document.body.appendChild($('#coach'));combatDialog().close();COMBAT.session=null;UI.battle=null;
 document.body.classList.remove('combat-active');music('menu');UI.tab='ludus';render();checkGameOver();
 if(s.phase==='results'){coach('battleClosed');storyTick();if(s.event.kind==='final'&&s.b.winner==='player')showEnding();}
};
ACTIONS.combatSelect=d=>{const s=COMBAT.session,u=s?.b.unit(d.id);if(!u||s.busy)return;s.notice='';s.confirmEnd=false;if(u.side==='enemy'){if(s.phase==='fight'&&s.aim)combatCommand(s.aim,{uid:u.uid});return;}if(s.phase==='placement'){s.selected=u.uid;s.placementArmed=true;}else s.inspect=u.uid===s.b.current?.uid?null:u.uid;combatUpdate();};
ACTIONS.combatInspect=d=>{COMBAT.session.inspect=d.id||null;combatUpdate();};
ACTIONS.combatArm=d=>{const s=COMBAT.session;if(!combatManual(s))return;const u=s.b.current;if(u.apLeft<4)return;s.aim=s.aim==='attack'?null:'attack';s.inspect=null;s.notice='';s.confirmEnd=false;combatUpdate();};
ACTIONS.combatArrange=()=>{const s=COMBAT.session,units=s.b.units.filter(u=>u.side==='player'),cells=autoDeployCells(units.map(u=>u.g),'player',s.b.field);units.forEach((u,i)=>{Object.assign(u,cells[i]);COMBAT.view.placeFighter(COMBAT.view.F(u.uid),u.c,u.r);});combatUpdate();};
ACTIONS.combatStart=async()=>{const s=COMBAT.session;if(!s||s.phase!=='placement')return;s.phase='fight';coach('fightStart');s.busy=true;s.awaiting=false;$('#combat-screen .combat-header').outerHTML=combatHeader();combatUpdate();const rev=COMBAT.revision;await COMBAT.view.intro(false);if(rev!==COMBAT.revision)return;s.busy=false;combatTurn();};
ACTIONS.combatSpeed=d=>{const n=+d.id;if(![1,2,4].includes(n))return;COMBAT.session.speed=n;COMBAT.view.speed=n;combatUpdate();};
ACTIONS.combatCommand=d=>combatCommand(d.id);
ACTIONS.combatAim=()=>{const s=COMBAT.session;if(!combatManual(s))return;const u=s.b.current;if(!combatAvailability(u).anyAbility)return;s.aim=s.aim==='ability'?null:'ability';s.inspect=null;s.notice='';s.confirmEnd=false;if(s.aim&&A0(u).id==='whirl'){combatCommand('ability');return;}combatUpdate();};
const A0=u=>clsOf(u.g).ability;
ACTIONS.combatPause=()=>{const s=COMBAT.session;if(!s||s.phase!=='fight')return;if(s.paused){s.paused=false;$('#combat-overlay').hidden=true;combatUpdate();if(!s.busy&&!s.awaiting)combatSchedule();return;}s.paused=true;clearTimeout(COMBAT.timer);combatUpdate();combatOverlay('Пауза','Схватка продолжится с того же действия.',combatBtn('combatPause','Продолжить',false,'class="primary"')+combatBtn('combatSurrender','Сдаться',!!s.b.event.training,'class="ghost"'));};
ACTIONS.combatSurrender=()=>{const s=COMBAT.session;if(!s||s.b.event.training||s.phase!=='fight')return;s.paused=true;clearTimeout(COMBAT.timer);combatOverlay('Поднять руку?','Это поражение. Стоящие бойцы получат +15 к шансу помилования, но решение остаётся за толпой.',combatBtn('combatPause','Продолжить бой',false,'class="ghost"')+combatBtn('combatConfirmSurrender','Сдаться',false,'class="danger"'));};
ACTIONS.combatConfirmSurrender=()=>{const s=COMBAT.session;s.paused=false;$('#combat-overlay').hidden=true;if(s.busy){s.surrenderPending=true;return;}s.b.surrender();combatResult();};
ACTIONS.combatAuto=async()=>{const s=COMBAT.session;if(!s||s.b.event.training||s.phase!=='fight')return;s.autoplay=!s.autoplay;s.inspect=null;s.aim=null;combatUpdate();if(s.autoplay&&s.awaiting&&!s.busy&&!s.paused){s.awaiting=false;s.busy=true;s.b.aiTurn(s.b.current);if(!await combatPlay(s.b.events))return;s.busy=false;if(!combatCheckEnd())combatSchedule();}else if(!s.busy&&!s.paused&&!s.awaiting)combatSchedule();};
ACTIONS.combatCourtSelect=d=>{const s=COMBAT.session;if(s.phase!=='judgment'||s.busy)return;s.courtIndex=+d.id;combatUpdate();};
ACTIONS.combatBribeFighter=d=>{const s=COMBAT.session,u=s.b.unit(d.id);if(!u||s.paid||s.busy||u.side!=='player'||combatGuaranteed(u))return;const v=s.verdicts[u.uid]||(s.verdicts[u.uid]={}),m=mercyBreakdown(u,s.b);if(m.raw>=m.cap||!v.bribed&&STATE.gold-combatBribeTotal()<bribeCost(s.b))return;v.bribed=!v.bribed;combatUpdate();};
ACTIONS.combatVerdict=combatVerdict;
ACTIONS.combatFinishResults=combatFinishResults;
document.addEventListener('change',e=>{const s=COMBAT.session;if(!s)return;if(e.target.name==='combat-control'){s.autoplay=e.target.value==='auto';s.source.mode=e.target.value;s.b.mode=e.target.value;combatUpdate();}});
function combatHotkey(e){
 const s=COMBAT.session;
 if(!s||!$('#combat-screen')?.open||e.defaultPrevented||e.target.matches('input,select,textarea')||e.target.isContentEditable||e.ctrlKey||e.altKey||e.metaKey)return;
 if(['1','2','3'].includes(e.key)&&s.phase!=='results'){e.preventDefault();if(!e.repeat)ACTIONS.combatSpeed({id:{1:'1',2:'2',3:'4'}[e.key]});return;}
 if(s.phase!=='fight'||!['KeyA','KeyS','KeyD','Space','KeyP'].includes(e.code))return;
 // Physical keys also work with the Russian layout. Ignore held-key repeats.
 e.preventDefault();
 if(e.repeat)return;
 if(e.code==='KeyP'){ACTIONS.combatPause();return;}
 if(!combatManual(s))return;
 const u=s.b.current;
 if(e.code==='KeyA'&&u.apLeft>=4&&combatAvailability(u).anyAttack)ACTIONS.combatArm();
 else if(e.code==='KeyS')ACTIONS.combatAim();
 else if(e.code==='KeyD'&&combatCanDefend(u))combatCommand('defend');
 else if(e.code==='Space')combatCommand('wait');
}
document.addEventListener('keydown',combatHotkey);
