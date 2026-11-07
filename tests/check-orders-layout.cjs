const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('index.html?v=orders-layout',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
  await page.evaluate(()=>{newGame('Проверка заказов');hideMenu();STATE.gladiators=Array.from({length:3},()=>createGladiator('murmillo',6,{forceSchool:true}));META.generateContracts();UI.tab='contracts';render();});
  assert.equal(await page.locator('.order-card').count(),4);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const layout=await page.locator('.orders-grid').evaluate(e=>({cols:getComputedStyle(e).gridTemplateColumns.split(' ').length,overflow:document.documentElement.scrollWidth>innerWidth,inside:[...e.querySelectorAll('.order-card')].every(c=>c.scrollWidth<=c.clientWidth+1)}));
   assert.equal(layout.cols,width===1440?2:1);assert(!layout.overflow&&layout.inside);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-act=orderInspect]').first().click();
  assert(await page.locator('.order-opponent-dialog').isVisible());
  await page.locator('#dialog [data-act=dlgCancel]').click();
  await page.locator('.order-card [data-act=pickEvent]').first().click();
  assert(await page.locator('.order-picker').isVisible());
  const needed=await page.evaluate(()=>playerCount(findEvent(UI.eventId)));
  for(let i=0;i<needed;i++)await page.locator('.order-pick-unit').nth(i).click();
  assert(await page.locator('.order-picker [data-act=startBattle]').isEnabled());
  await page.setViewportSize({width:390,height:1000});
  assert(await page.locator('.order-picker').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth));
  await page.locator('.order-picker [data-act=cancelPick]').click();
  const history=await page.evaluate(()=>{
   const a=STATE.contracts[0],b=STATE.contracts[1];
   const team=STATE.gladiators.slice(0,playerCount(a)).map(g=>({g,alive:true}));
   const info={win:true,rounds:1,playerFallen:0,playerUnits:team};
   META.contractResult(a,info);const gold=STATE.gold;META.contractResult(a,info);
   const once=STATE.gold===gold;
   META.contractResult(b,{win:false,rounds:1,playerUnits:team,playerFallen:1});
   STATE.day++;META.onNewDay();save();render();
   return {once,rows:STATE.meta.contractHistory.length,success:STATE.meta.contractHistory.filter(c=>c.success).length};
  });
  assert(history.once);assert.equal(history.rows,2);assert.equal(history.success,1);
  await page.locator('[data-act=ordersTab][data-id=history]').click();
  assert.equal(await page.locator('.order-history').count(),2);
  await page.selectOption('#orders-filter','failed');
  assert.equal(await page.locator('.order-history').count(),1);
  await page.reload();
  assert.equal(await page.evaluate(()=>STATE.meta.contractHistory.length),2);
  await page.evaluate(()=>{hideMenu();UI.tab='contracts';STATE.gladiators.forEach(g=>g.wounded=1);render();});
  assert.equal(await page.locator('.order-card [data-act=pickEvent]:enabled').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: orders grid 1440/390, opponent, team selection, mobile picker, results recorded once, next day, history filter, save reload, wounded roster');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
