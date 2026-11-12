const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const checks=[],errors=[];function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}

// Проверяем целые экраны на двух размерах окна, а не отдельные подписи карточек.
async function checkZoomLayouts(page){
 const originalRoster=await page.evaluate(()=>JSON.stringify(STATE.gladiators));
 const fits=async selector=>page.locator(selector).evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width===0||r.left>=-1&&r.right<=innerWidth+1;}));
 for(const [width,height]of [[1440,900],[1920,1080]])for(const z of ['1','1.25','1.5','1.75']){
  const label=`${width} ${z}`;
  await page.setViewportSize({width,height});
  await page.evaluate(z=>{ACTIONS.setZoom({z});showMenu();},z);
  check(label+' home starts above the fold',await page.locator('#menu .chapter-line').evaluate(e=>e.getBoundingClientRect().top>=0));
  check(label+' home fits width',await fits('#menu .chapter-line,#menu .tagline,#menu .continue,#menu .menu-nav,#menu .arena-caption'));
  check(label+' duel caption is removed',await page.locator('#menu .arena-caption').count()===0);
  check(label+' home phrases do not overlap',await page.evaluate(()=>{
   const rect=s=>document.querySelector(s).getBoundingClientRect(),a=rect('.chapter-line'),b=rect('.tagline');
   const separated=(a,b)=>a.bottom<=b.top+1||b.bottom<=a.top+1||a.right<=b.left+1||b.right<=a.left+1;
   return separated(a,b);
  }));
  await page.locator('#menu [data-act=menuSettings]').click();
  check(label+' settings header is reachable',await page.locator('#menu [data-act=menuPage]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  check(label+' settings fit width',await fits('#menu .subscreen,#menu .setting-row,#menu .segments'));
  const scrollable=await page.locator('#menu .menu-box').evaluate(e=>e.scrollHeight>e.clientHeight+1);
  if(scrollable){
   await page.mouse.move(width/2,height-80);await page.mouse.wheel(0,500);
   await page.waitForFunction(()=>document.querySelector('#menu .menu-box').scrollTop>0);
   check(label+' settings wheel scrolls',true);
  }
  await page.locator('#menu [data-act=menuMotion]').scrollIntoViewIfNeeded();
  check(label+' last setting is visible',await page.locator('#menu [data-act=menuMotion]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}));
  await page.locator('#menu [data-act=menuPage]').click();
  await page.locator('#menu [data-act=newGameAsk]').click();
  check(label+' new campaign starts at top',await page.locator('#menu .menu-box').evaluate(e=>e.scrollTop===0));
  check(label+' back button remains on screen',await page.locator('#menu [data-act=menuPage]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
  check(label+' new campaign fits width',await fits('#menu .subscreen,#menu .create-grid,#menu .choice-descriptions'));
  await page.locator('#menu [data-act=menuStart]').scrollIntoViewIfNeeded();
  check(label+' start button is reachable',await page.locator('#menu [data-act=menuStart]').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}));
  await page.locator('#menu [data-act=menuPage]').click();
  await page.evaluate(()=>{
   hideMenu();STATE.gladiators=Array.from({length:9},()=>createGladiator('secutor',8,{name:'Тиберий Клавдий Максимилиан'}));UI.tab='ludus';render();
  });
  check(label+' roster wraps with readable proportions',await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.cards>.gcard')],z=uiZoom(),row=cards[0].getBoundingClientRect().top;
   const area=document.querySelector('.barracks-section').clientWidth,expected=area>=1092?4:area>=816?3:area>=540?2:1;
   return cards.filter(e=>Math.abs(e.getBoundingClientRect().top-row)<1).length===expected&&cards.every(e=>{
    const r=e.getBoundingClientRect(),name=e.querySelector('.fighter-name').getBoundingClientRect(),sub=e.querySelector('.fighter-sub').getBoundingClientRect();
    const stats=[...e.querySelectorAll('.roster-stats>span')];
    const valuesFit=stats.every(span=>{const box=span.getBoundingClientRect(),value=span.querySelector('b'),range=document.createRange();range.selectNodeContents(value);return range.getBoundingClientRect().right<=box.right+1;});
    return r.width/z>=264&&r.height/z<=241&&e.scrollWidth<=e.clientWidth+1&&sub.left>=name.right-1&&Math.abs(sub.top-name.top)<1&&valuesFit;
   });
  }));
 }
 await page.evaluate(roster=>{STATE.gladiators=JSON.parse(roster);ACTIONS.setZoom({z:'1'});showMenu();},originalRoster);
}

async function checkMenuAnimation(page){
 const activity=()=>page.evaluate(()=>({...window.__menuActivity}));
 const unchanged=async(label,before)=>check(label,JSON.stringify(await activity())===JSON.stringify(before));
 const resize=async size=>{
  // Событие браузера приходит независимо от виртуальных часов Playwright.
  await page.evaluate(()=>{window.__menuResize=new Promise(resolve=>addEventListener('resize',()=>resolve(),{once:true}));});
  await page.setViewportSize(size);await page.evaluate(()=>window.__menuResize);await page.clock.runFor(100);
 };
 await page.clock.runFor(100);let before=await activity();
 await page.clock.runFor(1000);await unchanged('disabled menu neither draws nor requests frames',before);
 await page.locator('[data-act=menuMotion]').click();await page.clock.runFor(250);
 check('enabling motion resumes drawing',(await activity()).draws>before.draws+2);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 before=await activity();await page.clock.runFor(500);await unchanged('hidden tab neither draws nor requests frames',before);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(200);check('visible tab resumes drawing',(await activity()).draws>before.draws+2);
 await page.evaluate(()=>hideMenu());before=await activity();
 await page.clock.runFor(500);await unchanged('closed menu cancels its frame loop',before);
 await page.evaluate(()=>showMenu());await page.clock.runFor(200);
 check('returning to menu resumes motion',(await activity()).draws>before.draws+2);
 await page.locator('#menu [data-act=menuSettings]').click();await page.locator('[data-act=menuMotion]').click();
 await page.clock.runFor(100);before=await activity();
 await page.evaluate(()=>ACTIONS.setZoom({z:'1.75'}));await page.clock.runFor(100);
 check('static menu redraws after zoom',(await activity()).draws===before.draws+1);
 before=await activity();await page.clock.runFor(500);await unchanged('zoom does not restart static loop',before);
 await resize({width:1920,height:1080});
 check('static menu redraws after resize',(await activity()).draws>before.draws);
 check('canvas follows zoom and viewport',await page.evaluate(()=>{const c=document.querySelector('#menu canvas'),dpr=Math.min(devicePixelRatio||1,1.7);return c.width===Math.round(innerWidth/uiZoom()*dpr)&&c.height===Math.round(innerHeight/uiZoom()*dpr);}));
 before=await activity();await page.clock.runFor(500);await unchanged('resize does not restart static loop',before);
 await page.evaluate(()=>ACTIONS.setZoom({z:'auto'}));await page.clock.runFor(100);
 await resize({width:1600,height:900});
 check('automatic zoom is applied before canvas resize',await page.evaluate(()=>{const c=document.querySelector('#menu canvas'),dpr=Math.min(devicePixelRatio||1,1.7);return c.width===Math.round(innerWidth/uiZoom()*dpr)&&c.height===Math.round(innerHeight/uiZoom()*dpr);}));
 await page.setViewportSize({width:2560,height:1440});await page.evaluate(()=>ACTIONS.setZoom({z:'1'}));await page.clock.runFor(100);
}

(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:2560,height:1440}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.clock.install();await page.goto(new URL('index.html?v=menu-fix-check',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{
  const activity=window.__menuActivity={draws:0,requests:0},clear=CanvasRenderingContext2D.prototype.clearRect,raf=window.requestAnimationFrame;
  CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas===document.querySelector('#menu canvas'))activity.draws++;return clear.apply(this,args);};
  window.requestAnimationFrame=callback=>{activity.requests++;return raf.call(window,callback);};
 });
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
 await checkMenuAnimation(page);
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
 await checkZoomLayouts(page);
 await page.reload();check('scale and motion settings persist',await page.evaluate(()=>zoomPref()==='1'&&!menuMotionEnabled()));check('no JS errors',errors.length===0);
}finally{fs.writeFileSync('output/playwright/menu-pages-validation.json',JSON.stringify({checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
