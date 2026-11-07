// Targeted layout/teaching follow-up after the grouped campaign pass. No captures.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const checks=[],errors=[];
const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS '+n);};
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL('index.html?v=shell-layout',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await p.evaluate(()=>{newGame('Проверка компоновки',{story:true});hideMenu();STATE.gold=5000;render();});
 check('desktop sidebar and header positions',await p.evaluate(()=>{const n=document.querySelector('#sidebar').getBoundingClientRect(),h=document.querySelector('.topbar').getBoundingClientRect();return n.width===210&&h.left===n.right&&h.top<10;}));
 check('training and roster share content column',await p.evaluate(()=>{const a=document.querySelector('.training').getBoundingClientRect(),c=document.querySelector('.cards').getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();return Math.abs(a.left-c.left)<1&&c.width<a.width&&a.top>=m.top&&a.bottom<innerHeight;}));
 await p.locator('main [data-act=openGlad]').click();
 const train=await p.evaluate(()=>({gold:STATE.gold,cost:trainCost(glad(UI.gladId)),xp:glad(UI.gladId).xp}));
 await p.locator('[data-act=train]').click();
 check('training charges actual cost and becomes unavailable',await p.locator('[data-act=train]').isDisabled()&&await p.evaluate(t=>STATE.gold===t.gold-t.cost&&glad(UI.gladId).trainedToday,train));
 await p.locator('[data-act=fighterTab][data-tab=attrs]').focus();await p.keyboard.press('ArrowRight');
 check('keyboard tabs do not change fighter',await p.locator('#profile-school').isVisible());
 await p.evaluate(()=>{coachCard(TUTOR_STEPS.find(s=>s.id==='attrs'));});
 check('tutorial reveals attributes',await p.locator('#profile-attrs').isVisible());
 await p.evaluate(()=>{hideCoach();coachCard(TUTOR_STEPS.find(s=>s.id==='school'));});
 check('tutorial reveals school',await p.locator('#profile-school').isVisible());
 await p.evaluate(()=>{hideCoach();ACTIONS.closeModal();});
 await p.setViewportSize({width:390,height:844});
 await p.evaluate(()=>coachCard(TUTOR_STEPS.find(s=>s.id==='toArena')));
 check('mobile tutorial opens navigation',await p.locator('#sidebar').evaluate(e=>e.classList.contains('open')));
 await p.evaluate(()=>{hideCoach();showMenu();});
 check('390 menu fits',await p.evaluate(()=>document.querySelector('#menu').scrollWidth<=innerWidth));
 await p.locator('#menu [data-act=newGameAsk]').click();
 for(const width of [390,320]){
   await p.setViewportSize({width,height:844});
   check(width+' campaign form fits',await p.locator('#menu .new-campaign').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth));
 }
 await p.locator('#menu [data-act=menuPage]').click();
 await p.locator('#menu [data-act=saveAsk]').click();
 check('original file load/export controls retained',await p.locator('#importFile').count()===1&&await p.locator('[data-act=saveExport]').count()===1);
 await p.locator('#menu [data-act=menuPage]').click();
 check('no JS errors in targeted follow-up',!errors.length);
 }finally{fs.writeFileSync('output/playwright/shell-layout-validation.json',JSON.stringify({checks,errors},null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
