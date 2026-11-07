// One grouped campaign acceptance pass. All seeded states belong to this isolated context.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const checks=[], errors=[];
function check(name, value){assert.ok(value,name);checks.push(name);console.log('PASS '+name);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 try {
 await page.goto(new URL('index.html?v=shell-20261105',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 check('empty storage has no continue',await page.locator('#menu [data-act=menuContinue]').count()===0);
 await page.locator('#menu [data-act=newGameAsk]').click();
 check('new campaign retains all six lanistas, ten banners and tutorial',await page.locator('.lp').count()===6 && await page.locator('.bp').count()===10 && await page.locator('#menu-tutorial').count()===1);
 await page.locator('#menu-ludus-name').fill('Школа проверки');
 await page.locator('.lp[data-k=f2]').click();
 await page.locator('.bp').nth(3).click();
 const banner=await page.locator('.bp.on').getAttribute('data-k');
 await page.locator('#menu-tutorial').uncheck();
 await page.locator('[data-act=menuStart]').click();
 for(let i=0;i<8&&await page.locator('[data-act=sceneSkip]').isVisible();i++)await page.locator('[data-act=sceneSkip]').click();
 check('real new game choices and story retained',await page.evaluate(b=>STATE.ludusName==='Школа проверки'&&STATE.lanista.portrait==='f2'&&STATE.banner===b&&!!STATE.story&&!STATE.story.tutorWanted,banner));
 check('shell, real roster and painted training mounted',await page.evaluate(()=>!!document.querySelector('.sidebar .nav-button')&&document.querySelectorAll('main [data-act=openGlad]').length===STATE.gladiators.length&&trainingCourtyard.naturalWidth>0&&TRAIN.groups.length>0));
 const initial=await page.evaluate(()=>({name:STATE.ludusName,gold:STATE.gold,ids:STATE.gladiators.map(g=>g.id)}));
 await page.reload(); await page.locator('#menu [data-act=menuContinue]').click();
 for(let i=0;i<8&&await page.locator('[data-act=sceneSkip]').isVisible();i++)await page.locator('[data-act=sceneSkip]').click();
 check('continue retains actual campaign',JSON.stringify(await page.evaluate(()=>({name:STATE.ludusName,gold:STATE.gold,ids:STATE.gladiators.map(g=>g.id)})))===JSON.stringify(initial));
 // Eligible real domain fixtures let us reach development/equipment in one pass.
 await page.evaluate(()=>{
   hideCoach(); STATE.story=null; STATE.debt=null;
   const a=createGladiator('murmillo',6,{forceSchool:false}),b=createGladiator('sagittarius',7,{forceSchool:true});
   a.cls=null;a.freeAttr=3;a.freeSpec=3;a.wounded=0;a.trainedToday=false;a.foughtToday=false;
   b.wounded=2;
   STATE.gladiators=[a,b];STATE.armory=[makeItem('gladius',2),makeItem('galea',1)];STATE.gold=5000;STATE.fame=200;STATE.settings={mode:'manual'};
   save();UI.tab='ludus';render();
 });
 await page.locator('main [data-act=openGlad]').first().click();
 const before=await page.evaluate(()=>({attrs:{...STATE.gladiators[0].attrs},free:STATE.gladiators[0].freeAttr}));
 await page.locator('[data-act=addAttr]').first().click();
 check('attribute addition is a draft',await page.evaluate(v=>JSON.stringify(STATE.gladiators[0].attrs)===JSON.stringify(v.attrs)&&STATE.gladiators[0].freeAttr===v.free,before));
 await page.locator('[data-act=commitAttrs]').click();
 check('attribute confirmation commits once',await page.evaluate(v=>STATE.gladiators[0].freeAttr===v.free-1,before));
 await page.locator('[data-act=fighterTab][data-tab=school]').click();
 await page.locator('[data-act=chooseClass]').first().click();
 check('school choice assigned',await page.evaluate(()=>!!STATE.gladiators[0].cls));
 await page.locator('[data-act=learn]').first().click();
 check('perk learned through original action',await page.evaluate(()=>Object.values(STATE.gladiators[0].perks).reduce((a,b)=>a+b,0)===1&&STATE.gladiators[0].freeSpec===2));
 await page.locator('[data-act=fighterTab][data-tab=attrs]').click();
 check('compact stash retains two usable items',await page.locator('.stash-item[data-act=equip]').count()===2&&await page.evaluate(()=>STATE.armory.length===2));
 const item=await page.locator('.stash-item').first().getAttribute('data-item');
 await page.locator(`.stash-item[data-act=equip][data-item="${item}"]`).click();
 check('equipment uses real inventory',await page.evaluate(id=>Object.values(STATE.gladiators[0].equip).some(it=>it?.id===+id)&&!STATE.armory.some(it=>it.id===+id),item));
 const slot=await page.evaluate(id=>Object.entries(STATE.gladiators[0].equip).find(([,it])=>it?.id===+id)[0],item);
 await page.locator(`[data-act=unequip][data-slot="${slot}"]`).click();
 check('unequip returns item to inventory',await page.evaluate(id=>STATE.armory.some(it=>it.id===+id),item));
 const drag=page.locator(`.stash-item[data-item="${item}"] img`),target=page.locator(`.dslot[data-slot="${slot}"]`);
 const from=await drag.boundingBox(),to=await target.boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:12});await page.mouse.up();
 check('pointer drag equips using existing drag contract',await page.evaluate(id=>Object.values(STATE.gladiators[0].equip).some(it=>it?.id===+id),item));
 check('healthy fighter has no healer',await page.locator('#modal [data-act=heal]').count()===0);
 await page.locator('[data-act=gladStep][data-d="1"]').click();
 check('switcher opens the other fighter',await page.evaluate(()=>UI.gladId===STATE.gladiators[1].id));
 const heal=await page.evaluate(()=>({gold:STATE.gold,cost:healCost(STATE.gladiators[1])}));
 await page.locator('[data-act=heal]').click();
 check('healer removes one wound day at actual price',await page.evaluate(v=>STATE.gladiators[1].wounded===1&&STATE.gold===v.gold-v.cost,heal));
 await page.evaluate(()=>{STATE.gold=0;render();});
 check('healer unavailable without funds',await page.locator('[data-act=heal]').isDisabled());
 await page.evaluate(()=>{STATE.gold=4000;save();render();});
 await page.locator('[data-act=rename]').click();await page.locator('#dlgInput').fill('Проверенный боец');await page.locator('[data-act=dlgOk]').click();
 await page.locator('[data-act=closeModal]').click();
 const saved=await page.evaluate(()=>JSON.stringify({gold:STATE.gold,gladiators:STATE.gladiators,armory:STATE.armory}));
 await page.reload();await page.locator('#menu [data-act=menuContinue]').click();
 check('development, gear, healing and name survive reload',await page.evaluate(s=>JSON.stringify({gold:STATE.gold,gladiators:STATE.gladiators,armory:STATE.armory})===s,saved));
 for(const tab of ['arena','contracts','smith','bazaar','market','armory','glory','necro','rules','ludus']){
   await page.locator(`#sidebar [data-tab=${tab}]`).click();
   check('navigation '+tab,await page.locator('main').getAttribute('data-tab')===tab && (await page.locator('main').innerText()).length>0);
 }
 await page.locator('[data-act=shellFilter][data-filter=wounded]').click();check('wounded filter follows STATE',await page.locator('main [data-act=openGlad]').count()===1);
 await page.locator('[data-act=shellFilter][data-filter=all]').click();
 await page.evaluate(()=>{
   STATE.gladiators.forEach(g=>{g.wounded=0;g.foughtToday=false;});
   STATE.events=[{id:uid(),tier:0,size:1,gold:100,fame:5,enemies:[createGladiator('thraex',4,{forceSchool:true})]}];
   UI.tab='arena';UI.eventId=STATE.events[0].id;UI.picked=[STATE.gladiators[0].id];render();
 });
 await page.locator('[data-act=startBattle]').click();check('arena opens existing painted battle',await page.locator('#combat-screen').isVisible());
 await page.locator('[data-act=combatExit]').click();
 check('placement returns to new shell',await page.locator('#game-shell').isVisible()&&!(await page.locator('#combat-screen').isVisible()));
 await page.locator('#sidebar [data-tab=ludus]').click();
 const noOverflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 check('1440 shell no horizontal overflow',await noOverflow());
 check('1440 navigation is a sidebar and header is above the fold',await page.evaluate(()=>{const nav=document.querySelector('#sidebar').getBoundingClientRect(),head=document.querySelector('.topbar').getBoundingClientRect();return nav.width<260&&head.left>=nav.right-1&&head.top<10;}));
 await page.locator('main [data-act=openGlad]').first().click();
 check('1440 fighter dialog fits',await page.evaluate(()=>{const e=document.querySelector('.fighter-dialog');return e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth;}));
 await page.locator('[data-act=closeModal]').click();
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(180);
 check('390 shell no horizontal overflow',await noOverflow());
 await page.locator('[data-act=shellNav]').click();await page.locator('#sidebar [data-tab=armory]').click();
 check('mobile navigation opens a tab and closes',await page.locator('main').getAttribute('data-tab')==='armory' && !(await page.locator('#sidebar').evaluate(el=>el.classList.contains('open'))));
 await page.locator('[data-act=shellNav]').click();await page.locator('#sidebar [data-tab=ludus]').click();
 await page.locator('main [data-act=openGlad]').first().click();
 check('390 fighter fits',await page.evaluate(()=>{const e=document.querySelector('.fighter-dialog');return e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth;}));
 await page.setViewportSize({width:320,height:720});
 check('320 fighter fits',await page.evaluate(()=>{const e=document.querySelector('.fighter-dialog');return e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth;}));
 await page.locator('[data-act=fighterTab][data-tab=school]').click();check('320 school controls reachable',await page.locator('#profile-school').isVisible());
 check('no JavaScript errors',errors.length===0);
 } finally {
 fs.mkdirSync('output/playwright',{recursive:true});fs.writeFileSync('output/playwright/shell-validation.json',JSON.stringify({checks,errors},null,2));
 await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
