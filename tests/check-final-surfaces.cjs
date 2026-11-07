// Complements check-campaign-tabs and check-combat-screen; no duplicate campaign battle.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const checks=[],errors=[],missing=[],requests=[];
const check=(name,ok)=>{assert.ok(ok,name);checks.push(name);console.log('PASS '+name);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('127.0.0.1'))missing.push(r.url());});
 page.on('request',r=>requests.push(r.url()));
 const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 const skip=async()=>{for(let i=0;i<12&&await page.locator('#scene').isVisible();i++)await page.locator('[data-act=sceneSkip]').click();};
 try{
 await page.goto(new URL('index.html?v=final-20261105',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 if(!process.env.FINAL_FROM_BETS){
 await page.locator('#menu [data-act=newGameAsk]').click();await page.locator('#menu-ludus-name').fill('Последняя проверка');
 await page.locator('#menu-tutorial').check();await page.locator('[data-act=menuStart]').click();
 check('real new campaign and prepared story portrait',await page.evaluate(()=>STATE.story&&sceneOpen()&&document.querySelector('.scene-face').getAttribute('src').startsWith('assets/portraits/')));
 await page.locator('[data-act=sceneNext]').focus();await page.keyboard.press('Tab');check('story focus stays inside conversation',await page.evaluate(()=>!!document.activeElement.closest('#scene')));
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});check('story fits '+width,await page.locator('.scene-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1)&&await fits());
 }
 await skip();check('prologue starts Ferox tutorial',await page.evaluate(()=>tutorOn()&&tutorState().step==='money'));
 await page.setViewportSize({width:1440,height:1000});
 for(let i=0;i<3;i++)await page.locator('[data-act=coachNext]').click();
 await page.locator('main .gcard').first().click();check('tutorial opens real fighter',await page.evaluate(()=>tutorState().step==='gift'&&!!UI.gladId));
 await page.locator('[data-act=coachNext]').click();await page.locator('#modal [data-act=equip]').first().click();
 await page.locator('#modal [data-act=closeModal]').click();
 await page.locator('nav [data-tab=arena]').click();
 check('new training card is a valid tutorial target',await page.evaluate(()=>coachTargets(TUTOR.step).length===1));
 await page.locator('main [data-act=pickEvent]').first().click();check('tutorial reaches team selection',await page.evaluate(()=>tutorState().step==='pickGlad'));
 // Combat tutorial and its result are covered by check-combat-screen.
 await page.evaluate(()=>{UI.eventId=null;UI.picked=[];UI.tab='smith';tutorState().step='smith';coachGo(TUTOR_STEPS.findIndex(s=>s.id==='smith'));});
 await page.locator('[data-act=coachNext]').click();
 check('tutorial selects actual shop item',await page.locator('main [data-act=campaignTrade]').count()===1);
 await page.locator('main [data-act=campaignTrade]').click();await page.locator('[data-act=dlgOk]').click();
 check('tutorial purchase advances',await page.evaluate(()=>tutorState().step==='toMarket'&&tutorHas('item')));
 await page.locator('nav [data-tab=market]').click();await page.locator('[data-act=coachNext]').click();
 const recruit=await page.evaluate(()=>tutorPicks().glad.id);await page.locator(`[data-act=campaignRecruit][data-id="${recruit}"]`).click();await page.locator('[data-act=dlgOk]').click();
 check('tutorial recruitment advances',await page.evaluate(()=>tutorState().step==='toLudus'&&tutorHas('glad')));
 await page.locator('nav [data-tab=ludus]').click();await page.locator(`main .gcard[data-id="${recruit}"]`).click();
 const item=await page.evaluate(()=>tutorState().item);await page.locator(`#modal [data-act=equip][data-item="${item}"]`).click();await page.locator('#modal [data-act=closeModal]').click();
 await page.locator('header [data-act=nextDay]').click();check('tutorial new day advances',await page.evaluate(()=>STATE.day===2&&tutorState().step==='day2'));
 await page.locator('[data-act=coachNext]').click();await page.locator('nav [data-tab=arena]').click();
 check('duo tutorial targets real new event',await page.evaluate(()=>coachTargets(TUTOR.step).length===1&&STATE.events.some(e=>e.duo)));
 await page.evaluate(()=>endTutorial(true));
 await page.evaluate(()=>{showDebtDialog();});check('real debt schedule',await page.locator('.debt-plan tbody tr').count()>0);
 await page.locator('[data-act=dlgOk]').click();await page.evaluate(()=>showTasksDialog());check('chapter tasks and actions',await page.locator('.tasklist li').count()>0);await page.locator('[data-act=dlgOk]').click();
 // Actual import/export using an isolated browser context and a signed file.
 await page.evaluate(()=>showMenu());await page.locator('#menu [data-act=saveAsk]').click();
 const promise=page.waitForEvent('download');await page.locator('[data-act=saveExport]').click();const file=await (await promise).path();
 const name=await page.evaluate(()=>STATE.ludusName);
 await page.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForSelector('#importPreview .bad');check('invalid save shows error',true);
 await page.evaluate(()=>{STATE.ludusName='Заменить';save();});await page.locator('#importFile').setInputFiles(file);await page.waitForFunction(()=>!!UI.importState);
 await page.locator('[data-act=saveImport]').click();await page.waitForFunction(n=>STATE?.ludusName===n,name);check('import replaces and reloads signed save',true);
 await page.evaluate(()=>{hideMenu();hideCoach();render();});
 await page.evaluate(()=>{askConfirm('Проверка','Подтверждение',()=>{}, {danger:true});});
 check('danger defaults to cancel',await page.locator('[data-act=dlgCancel]').evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Tab');check('dialog wraps focus',await page.locator('[data-act=dlgOk]').evaluate(e=>e===document.activeElement));await page.keyboard.press('Escape');
 await page.evaluate(()=>{showMenu();menuPage('settings');});
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});check('settings fits '+width,await page.locator('#menu').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await page.evaluate(()=>{hideMenu();newGame('Итоги',{story:true});STATE.story.queue=[];STATE.story.seen.prologue=1;STATE.story.flags.epilogue=undefined;STATE.finalWon=true;render();showEnding();});
 check('rudis uses narrative component',await page.locator('.narrative-rudis').isVisible());
 await page.locator('[data-act=freeBest]').click();check('rudis freedom moves fighter into memorial',await page.evaluate(()=>STATE.story.flags.epilogue==='freed'&&STATE.graveyard.some(g=>g.freed)));
 check('epilogue uses original text',await page.locator('.narrative-ending').innerText().then(t=>t.includes('вольным человеком')));
 await page.locator('[data-act=endingContinue]').click();check('epilogue returns to campaign',await page.locator('#modal .modal').count()===0);
 await page.evaluate(()=>{STATE.lost={holder:'rival',day:STATE.day,amount:100,short:50};showDebtLost();});check('loss uses narrative component',await page.locator('.narrative-loss').isVisible());
 await page.locator('#modal [data-act=newGameAsk]').click();check('loss opens new menu form',await page.locator('#page-title').innerText()==='Новая игра');
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{newGame('Ставки');hideMenu();hideCoach();$('#modal').innerHTML='';STATE.gold=10000;UI.tab='arena';UI.arenaTab='bets';render();});
 const bet=await page.evaluate(()=>({winner:runDuel(betBattle(STATE.bet))==='player'?0:1,gold:STATE.gold,roster:JSON.stringify(STATE.gladiators),events:JSON.stringify(STATE.events)}));
 await page.locator('[data-act=betInspect]').first().click();check('bet participant inspection',await page.locator('.campaign-inspect').isVisible());await page.locator('[data-act=dlgCancel]').click();
 await page.locator('[data-act=betPlace]').first().click();await page.locator('[data-act=betCancel]').click();check('cancel refunds stake',await page.evaluate(g=>STATE.gold===g,bet.gold));
 await page.locator(`[data-act=betPlace][data-i="${bet.winner}"]`).click();
 const expected=await page.evaluate(()=>({gold:STATE.gold,pay:Math.round(STATE.bet.stake*STATE.bet.odds[STATE.bet.pick]),ach:Object.keys(STATE.meta.ach)}));
 for(const width of [320,390,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});const ok=await fits()&&await page.locator('.betpanel').evaluate(e=>e.scrollWidth<=e.clientWidth+1);if(!ok)console.log(await page.locator('.betpanel *').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().right>innerWidth||e.scrollWidth>e.clientWidth+1).map(e=>({cls:e.className,tag:e.tagName,w:e.clientWidth,sw:e.scrollWidth,text:e.textContent.slice(0,100)}))));check('bet panel fits '+width,ok);}
 await page.locator('[data-act=betWatch]').click();check('spectator uses painted arena',await page.locator('#combat-screen').isVisible()&&await page.locator('#battle').isHidden());
 check('spectator cannot control or surrender',await page.evaluate(()=>{ACTIONS.combatAuto();ACTIONS.combatSurrender();return COMBAT.session.autoplay&&!combatManual(COMBAT.session);})&&await page.locator('[data-act=combatAuto],[data-act=combatSurrender],input[name=combat-control]').count()===0);
 // Remove animation delays only in test; consume the real seeded turn stream.
 await page.evaluate(()=>{COMBAT.view.skip=true;COMBAT.session.speed=100;COMBAT.view.speed=100;});
 await page.waitForFunction(()=>COMBAT.session?.phase==='results',null,{timeout:120000});
 check('seeded outcome matches simulation',await page.evaluate(w=>STATE.bet.winner===w,bet.winner));
 check('payout exactly once including real achievement reward',await page.evaluate(v=>{const g=STATE.gold;settleBet(STATE.bet.winner);const bonus=META.ACHIEVEMENTS.filter(a=>STATE.meta.ach[a.id]&&!v.ach.includes(a.id)).reduce((n,a)=>n+(a.reward?.gold||0),0);return STATE.bet.payout===v.pay&&g===v.gold+v.pay+bonus&&STATE.gold===g;},expected));
 check('spectator never commits roster or campaign event',await page.evaluate(v=>JSON.stringify(STATE.gladiators)===v.roster&&JSON.stringify(STATE.events)===v.events&&!COMBAT.session.committed,bet));
 await page.locator('[data-act=combatExit]').click();check('spectator returns to settled bet panel',await page.locator('.betpanel').innerText().then(s=>s.includes('Ставка сыграла')));
 for(const t of ['ludus','arena','contracts','smith','armory','bazaar','market','glory','necro','rules']){await page.evaluate(t=>{UI.tab=t;render();},t);check('desktop surface '+t,await fits());}
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  for(const t of ['ludus','smith','glory','rules']){await page.evaluate(t=>{UI.tab=t;render();},t);check('responsive '+t+' '+width,await fits());}
 }
 check('no prototype runtime requests',!requests.some(u=>/Arena-preview|discovery/.test(u)));
 check('no missing local resources',missing.length===0);check('no JS errors',errors.length===0);
 }finally{fs.writeFileSync('output/playwright/final-surfaces-validation.json',JSON.stringify({checks,errors,missing},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
