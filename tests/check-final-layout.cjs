const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const checks=[],errors=[],missing=[];
const check=(n,v)=>{assert.ok(v,n);checks.push(n);console.log('PASS '+n);};
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('127.0.0.1'))missing.push(r.url());});
try{
 await page.goto(new URL('index.html?v=final-20261105',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{startNewGame('Лудус Марка',false);});
 await page.locator('.scene-face').evaluate(e=>e.decode());
 check('subfolder story assets load',await page.locator('.scene-face').evaluate(e=>e.naturalWidth>0));
 if(process.env.FINAL_SHOTS)await page.screenshot({path:'output/playwright/final-story-desktop.png'});
 await page.evaluate(()=>{SCENE.ids=[];closeScene();STATE.story.queue=[];STATE.story.tutorWanted=false;endTutorial(true);showMenu();menuPage('settings');});
 const prefs=await page.evaluate(()=>({mute:SFX.muted,music:SFX.musicOn}));
 check('settings real controls present',await page.locator('#menu [data-act]').count()>5);
 await page.evaluate(()=>{hideMenu();UI.tab='arena';UI.arenaTab='bets';STATE.gold=10000;render();STATE.bet.a.name='Александр Македонский';STATE.bet.b.name='Гай Валерий Максимилиан';STATE.bet.odds=[12.55,1.05];render();});
 for(const width of [320,390,768]){await page.setViewportSize({width,height:1000});check('long bet names and odds fit '+width,await page.locator('.betpanel').evaluate(e=>e.scrollWidth<=e.clientWidth+1)&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await page.setViewportSize({width:390,height:1000});
 await page.waitForFunction(()=>{const e=document.querySelector('#sidebar');return e.getBoundingClientRect().right<=1;});
 check('mobile navigation stays offscreen until requested',true);
 await page.locator('[data-act=shellNav]').click();check('mobile navigation opens',await page.evaluate(()=>SHELL.nav));await page.locator('#nav-shade').click({position:{x:380,y:500}});check('mobile navigation closes',await page.evaluate(()=>!SHELL.nav));
 if(process.env.FINAL_SHOTS)await page.screenshot({path:'output/playwright/final-bets-mobile.png'});
 await page.evaluate(()=>{STATE.bet=null;UI.tab='ludus';save();});await page.reload();
 await page.locator('[data-act=menuContinue]').click();check('continue persisted campaign from subfolder',await page.evaluate(()=>STATE.ludusName==='Лудус Марка'&&!MENU.open));
 await page.evaluate(()=>{ACTIONS.setZoom({z:'1.25'});showDebtDialog();});
 check('scaled modal fits and focuses',await page.locator('#dialog .dlg').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&e.contains(document.activeElement);}));
 await page.locator('[data-act=dlgOk]').click();await page.evaluate(()=>ACTIONS.setZoom({z:'1'}));
 check('no local resource failures in subfolder',missing.length===0);check('no JS errors',errors.length===0);
}finally{fs.writeFileSync('output/playwright/final-layout-validation.json',JSON.stringify({checks,errors,missing},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
