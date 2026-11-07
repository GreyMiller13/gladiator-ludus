const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const checks=[],errors=[];function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:2560,height:1440}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.clock.install();await page.goto(new URL('index.html?v=menu-fix-check',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 check('default scale 100 percent on large monitor',await page.evaluate(()=>zoomPref()==='1'&&uiZoom()===1));
 check('home has no scrolling overflow',await page.locator('#menu').evaluate(e=>e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1));
 if(!process.env.SKIP_ANIMATION){await page.clock.runFor(34000);check('full duel cycle including shield and net has no error',errors.length===0);}
 for(const [act,title] of [['newGameAsk','Новая игра'],['saveAsk','Сохранение'],['menuSettings','Настройки'],['menuGuide','Справочник']]){
  await page.locator(`#menu [data-act=${act}]`).click();check('new menu subscreen '+title,await page.locator('#page-title').innerText()===title);await page.locator('[data-act=menuPage]').click();
 }
 await page.locator('#menu [data-act=menuSettings]').click();
 await page.locator('[data-act=setZoom][data-z=auto]').click();check('explicit auto remains available',await page.evaluate(()=>zoomPref()==='auto'&&uiZoom()>1));
 await page.locator('[data-act=setZoom][data-z="1"]').click();
 await page.locator('#menu-volume').fill('35');check('volume updates real audio engine',await page.evaluate(()=>Math.abs(SFX.volume-.35)<.001));
 await page.locator('[data-act=menuMotion]').click();check('motion setting stops animation',await page.evaluate(()=>!menuMotionEnabled()));
 await page.locator('[data-act=menuPage]').click();await page.locator('#menu [data-act=newGameAsk]').click();
 check('six lanistas ten banners',await page.locator('#menu .lp').count()===6&&await page.locator('#menu .bp').count()===10);
 await page.locator('#menu-ludus-name').fill('Школа меню');await page.locator('#menu .lp[data-k=f2]').click();await page.locator('#menu .bp').nth(3).click();const banner=await page.locator('#menu .bp.on').getAttribute('data-k');await page.locator('#menu-tutorial').uncheck();await page.locator('[data-act=menuStart]').click();
 check('new campaign uses real selections',await page.evaluate(b=>STATE.ludusName==='Школа меню'&&STATE.lanista.portrait==='f2'&&STATE.banner===b&&!STATE.story.tutorWanted,banner));
 for(let i=0;i<10&&await page.locator('[data-act=sceneSkip]').isVisible();i++)await page.locator('[data-act=sceneSkip]').click();
 await page.evaluate(()=>showMenu());await page.locator('#menu [data-act=saveAsk]').click();
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-act=saveExport]').click();const download=await downloadPromise;const path=await download.path();check('real signed export file',JSON.parse(fs.readFileSync(path,'utf8')).format!=='ludus-menu-prototype');
 await page.locator('#importFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#importPreview').textContent.length>0);check('invalid save rejected',await page.locator('#importPreview .bad').count()===1);
 await page.locator('#importFile').setInputFiles(path);await page.waitForFunction(()=>!!UI.importState);check('signed save preview accepted',await page.locator('#importPreview [data-act=saveImport]').count()===1);
 await page.locator('[data-act=menuPage]').click();await page.locator('#menu [data-act=newGameAsk]').click();await page.locator('[data-act=menuStart]').click();check('existing campaign requires replacement confirmation',await page.locator('#dialog').innerText().then(t=>t.includes('Начать новую историю')));await page.locator('[data-act=dlgCancel]').click();
 await page.setViewportSize({width:390,height:844});
 for(const name of ['home','new','save','settings','guide']){await page.evaluate(n=>menuPage(n),name);check('390 bounded '+name,await page.locator('#menu').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
 await page.setViewportSize({width:320,height:720});await page.evaluate(()=>menuPage('new'));check('320 new form fits',await page.locator('#menu .subscreen').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.evaluate(()=>menuPage('home'));check('320 home without scroll',await page.locator('#menu').evaluate(e=>e.scrollHeight<=e.clientHeight+1));
 await page.reload();check('scale and motion settings persist',await page.evaluate(()=>zoomPref()==='1'&&!menuMotionEnabled()));check('no JS errors',errors.length===0);
}finally{fs.writeFileSync('output/playwright/menu-pages-validation.json',JSON.stringify({checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
