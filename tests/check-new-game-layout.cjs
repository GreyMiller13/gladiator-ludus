const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const checks=[],errors=[];
function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('index.html?v=new-game-refine-20261105',process.env.SITE_URL||'http://127.0.0.1:8765/').href);await page.locator('#menu [data-act=newGameAsk]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.new-campaign img')].every(e=>e.complete&&e.naturalWidth>0));
 check('six supplied portraits loaded',await page.locator('.new-campaign .lp img').evaluateAll(es=>es.length===6&&es.every(e=>e.src.includes('/assets/portraits/'))));
 check('approved labels',JSON.stringify(await page.locator('.new-campaign .lp span').allTextContents())===JSON.stringify(['Молодой наследник','Бывший легионер','Старый торговец','Дочь ланисты','Вдова из Карфагена','Строгая матрона']));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const result=await page.evaluate(width=>{
   const root=document.querySelector('.new-campaign'),head=root.querySelector('.page-head'),rect=e=>e.getBoundingClientRect();
   const cards=[...root.querySelectorAll('.lp,.bp')];
   const contained=cards.every(e=>[...e.children].every(c=>rect(c).bottom<=rect(e).bottom+1));
   const l=rect(root.querySelector('.lanistas')),b=rect(root.querySelector('.banner-grid')),desc=rect(root.querySelector('.choice-descriptions')),footer=rect(root.querySelector('.creation-footer'));
   return {header:getComputedStyle(head).backgroundImage==='none'&&getComputedStyle(head,'::after').content==='none',equal:cards.every(e=>Math.abs(rect(e).height-rect(cards[0]).height)<1),contained,descriptions:desc.top>=Math.max(l.bottom,b.bottom),footer:width<=720?footer.top>=rect(root.querySelector('.lanista-bonus')).bottom:Math.abs(rect(root.querySelector('.tutorial-check')).top-rect(root.querySelector('.lanista-bonus h3')).top)<2&&footer.left>=rect(root.querySelector('#lanista-bonus')).right,startButton:rect(root.querySelector('[data-act=menuStart]')).top>=rect(root.querySelector('.tutorial-check')).bottom,overflow:root.scrollWidth<=root.clientWidth+1,gridHeight:Math.abs(l.height-b.height)<1};
  },width);
  for(const [key,val]of Object.entries(result))check(width+' '+key,val);
 }
 for(let i=0;i<6;i++){await page.locator('#menu .lp').nth(i).click();check('biography follows selection '+i,await page.evaluate(i=>document.querySelector('#lanista-description').textContent===MENU_LANISTAS[i].desc&&document.querySelector('#lanista-bonus strong').textContent===lanistaBonus(MENU_LANISTAS[i].key).name&&document.querySelector('#lanista-bonus span').textContent===lanistaBonus(MENU_LANISTAS[i].key).desc,i));}
 await page.locator('#menu .bp').nth(4).click();check('banner caption follows selection',await page.evaluate(()=>document.querySelector('#menu-banner-name').textContent===bannerOf(pickedBanner()).name));
 await page.locator('#menu-ludus-name').fill('Проверка формы');await page.locator('#menu-tutorial').uncheck();await page.locator('[data-act=menuStart]').click();check('selected character and banner reach campaign',await page.evaluate(()=>STATE.lanista.portrait==='f3'&&STATE.banner===BANNERS[4].id&&STATE.ludusName==='Проверка формы'));
 await page.setViewportSize({width:1440,height:1000});
 for(let i=0;i<10&&await page.locator('[data-act=sceneSkip]').isVisible();i++)await page.locator('[data-act=sceneSkip]').click();
 await page.locator('[data-act=lanistaInfo]').click();
 check('lanista profile shows portrait, biography and bonus',await page.locator('.lanista-dialog').evaluate(el=>!!el.querySelector('.lanista-details>img')&&el.textContent.includes('Строгая матрона')&&el.textContent.includes('Держать удар')&&el.scrollWidth<=el.clientWidth+1));
 await page.locator('.lanista-dialog [data-act=dlgOk]').click();
 check('lanista profile closes',await page.locator('.lanista-dialog').count()===0);
 check('no JS errors',!errors.length);
}finally{fs.writeFileSync('output/playwright/new-game-layout-validation.json',JSON.stringify({checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
