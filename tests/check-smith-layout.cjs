const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('index.html?v=smith-layout-check',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{newGame('Кузнец');hideMenu();STATE.gold=10000;STATE.gladiators.push(createGladiator('retiarius',5,{forceSchool:true}));UI.tab='smith';render();});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const layout=await page.locator('.smith-screen').evaluate(e=>{
   const heading=e.querySelector('.legacy-heading'),h=heading.getBoundingClientRect(),title=heading.querySelector('h2').getBoundingClientRect(),p=heading.querySelector('p').getBoundingClientRect(),grid=e.querySelector('.smith-layout'),cards=[...e.querySelectorAll('.smith-grid .smith-item')];
   return {background:getComputedStyle(heading).backgroundColor,image:getComputedStyle(heading).backgroundImage,titleGap:p.top-title.bottom,contentGap:grid.getBoundingClientRect().top-h.bottom,columns:getComputedStyle(grid).gridTemplateColumns,display:getComputedStyle(grid).display,iconWidth:e.querySelector('.smith-item-figure').getBoundingClientRect().width,heights:cards.map(c=>Math.round(c.getBoundingClientRect().height)),bounded:document.documentElement.scrollWidth<=innerWidth&&cards.every(c=>c.scrollWidth<=c.clientWidth+1)};
  });
  assert.equal(layout.background,'rgba(0, 0, 0, 0)');assert.equal(layout.image,'none');assert.equal(layout.titleGap,8);assert.equal(layout.contentGap,width===1440?22:20);assert(layout.bounded);assert.equal(new Set(layout.heights).size,1);assert.equal(layout.iconWidth,width===1440?94:64);
  assert.equal(layout.display,width===1440?'grid':'flex');
  console.log('PASS layout '+width,JSON.stringify(layout));
 }
 await page.setViewportSize({width:1440,height:1000});
 const first=await page.evaluate(()=>({id:STATE.smith[0].id,slot:STATE.smith[0].slot,price:STATE.smith[0].price,gold:STATE.gold}));
 await page.locator(`.smith-chip[data-key=slot][data-id=${first.slot}]`).click();
 assert(await page.evaluate(()=>[...document.querySelectorAll('.smith-grid .smith-item')].every(e=>STATE.smith.find(it=>it.id===+e.dataset.id).slot===CAMPAIGN.slot)));
 await page.locator(`.smith-grid [data-id="${first.id}"]`).click();
 assert(await page.locator('#smith-cmp-fighter').isVisible());
 const other=await page.evaluate(()=>String(STATE.gladiators.at(-1).id));
 await page.selectOption('#smith-cmp-fighter',other);
 assert.equal(await page.locator('#smith-cmp-fighter').inputValue(),other);
 await page.setViewportSize({width:390,height:1000});
 assert(await page.locator('.smith-panel').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth));
 await page.locator('.smith-panel [data-act=campaignTrade]').click();
 await page.locator('#dialog [data-act=dlgOk]').click();
 assert(await page.evaluate(({id,price,gold})=>STATE.gold===gold-price&&STATE.armory.some(it=>it.id===id)&&!STATE.smith.some(it=>it.id===id),first));
 await page.evaluate(()=>{STATE.gold=0;CAMPAIGN.slot='all';render();});
 await page.locator('.smith-grid .smith-item').first().click();
 assert(await page.locator('.smith-panel [data-act=campaignTrade]').isDisabled());
 assert.deepEqual(errors,[]);
 console.log('PASS filters, comparison, mobile detail panel, purchase, insufficient gold; no JS errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
