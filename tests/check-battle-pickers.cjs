const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('index.html?v=battle-pickers-check',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{newGame('Проверка');hideMenu();STATE.gladiators=Array.from({length:6},()=>createGladiator('murmillo',6,{forceSchool:true}));STATE.gladiators[5].wounded=1;generateEvents();META.generateContracts();});
 for(const kind of ['arena','contracts']){
  await page.evaluate(kind=>{UI.tab=kind;UI.arenaTab=0;UI.eventId=null;render();},kind);
  if(kind==='arena')await page.evaluate(()=>{const ev=STATE.events.find(e=>!e.training&&!e.boss&&e.size>=2&&!e.done);if(!ev)throw Error('no duo fixture');UI.arenaTab=ev.tier;render();ACTIONS.pickEvent({id:ev.id});});
  else await page.locator('.order-card [data-act=pickEvent]').first().click();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const r=await page.locator('.battle-picker').evaluate(e=>({width:e.getBoundingClientRect().width,overflow:e.scrollWidth>e.clientWidth+1,right:e.getBoundingClientRect().right,bg:getComputedStyle(e).backgroundImage,cols:getComputedStyle(e.querySelector('.order-pick-grid')).gridTemplateColumns.split(' ').length}));
   assert(!r.overflow&&r.right<=width);assert.equal(r.bg,'none');assert.equal(r.width,width===1440?(kind==='arena'?760:900):kind==='arena'?366:360);
   assert.equal(r.cols,width===1440?3:kind==='arena'?2:1);
   console.log('PASS layout '+kind+' '+width,JSON.stringify(r));
  }
  await page.setViewportSize({width:1440,height:1000});
  const wounded=await page.evaluate(()=>STATE.gladiators[5].id);
  assert(await page.locator(`.order-pick-unit[data-id="${wounded}"]`).isDisabled());
  await page.locator('.battle-picker .arena-control-toggle label').filter({hasText:'Вручную'}).click();
  assert.equal(await page.evaluate(()=>battleMode()),'manual');
  if(kind==='arena'){
   const n=await page.evaluate(()=>playerCount(findEvent(UI.eventId)));
   await page.locator('[data-act=pickShort]').check();assert.equal(await page.evaluate(()=>playerCount(findEvent(UI.eventId))),n-1);
   await page.locator('[data-act=pickShort]').uncheck();
  }
  const n=await page.evaluate(()=>playerCount(findEvent(UI.eventId)));
  for(let i=0;i<n;i++)await page.locator('.order-pick-unit').nth(i).click();
  assert(await page.locator('.battle-picker [data-act=startBattle]').isEnabled());
  if(kind==='arena')await page.locator('.arena-remove').first().click();else await page.locator('.order-pick-unit[aria-pressed=true]').first().click();
  assert(await page.locator('.battle-picker [data-act=startBattle]').isDisabled());
  await page.locator('.order-pick-unit:not([aria-pressed=true]):enabled').first().click();
  await page.locator('.battle-picker [data-act=startBattle]').click();
  assert(await page.locator('#combat-screen').isVisible());
  await page.locator('[data-act=combatExit]').click();
 }
 assert.deepEqual(errors,[]);console.log('PASS modes, minority, wounded, selection/removal and real combat entry for arena and orders');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
