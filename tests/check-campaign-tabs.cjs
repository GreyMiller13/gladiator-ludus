const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const checks=[],errors=[];
function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>errors.push(e.message));
 const tab=async t=>page.evaluate(t=>{UI.eventId=null;UI.tab=t;render();},t);
 const fits=()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
 try{
 await page.goto(new URL('index.html?v=tabs-check',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{newGame('Проверка вкладок');hideMenu();STATE.gold=50000;STATE.fame=300;STATE.settings={mode:'manual'};STATE.gladiators=Array.from({length:3},()=>createGladiator('murmillo',6,{forceSchool:true}));generateEvents();META.generateContracts();META.check();save();render();});
 if(process.env.LAYOUT_ONLY){
  await tab('glory');check('real achievement summary',await page.locator('.glory-donut').getAttribute('aria-label').then(s=>s.includes('Открыто')));
  await page.evaluate(()=>{STATE.meta.c.arenaWins=5;UI.gloryTab='arena';render();});check('real achievement progress',await page.locator('main').innerText().then(s=>s.includes('5 / 10')));
  for(const t of ['smith','market','contracts','glory','necro','rules']){await tab(t);check('desktop bounded '+t,await fits());}
  await tab('smith');check('desktop catalogue composition',await page.locator('.smith-layout').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===3));
  check('equal catalogue row heights',await page.locator('.campaign-goods>.smith-item').evaluateAll(es=>es.length<2||Math.abs(es[0].getBoundingClientRect().height-es[1].getBoundingClientRect().height)<2));
  for(const t of ['arena','contracts']){
   await tab(t);await page.evaluate(()=>{UI.arenaTab=0;render();});await page.locator('main button[data-act=pickEvent]').first().click();
   check('two team columns '+t,await page.locator('.campaign-versus>section').count()===2);
   const n=await page.evaluate(()=>playerCount(findEvent(UI.eventId)));for(let i=0;i<n;i++)await page.locator('.order-pick-unit').nth(i).click();
   await page.locator('[data-act=startBattle]').click();check('recomposed picker starts '+t,await page.locator('#combat-screen').isVisible());await page.locator('[data-act=combatExit]').click();
  }
  await tab('arena');await page.evaluate(()=>{UI.arenaTab=0;render();});await page.locator('main button[data-act=pickEvent]').first().click();
  for(const width of [390,320]){await page.setViewportSize({width,height:844});check('recomposed picker fits '+width,await page.locator('.battle-picker').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
  check('no JS errors',errors.length===0);return;
 }
 if(!process.env.SKIP_TABS)for(const t of ['arena','contracts','smith','armory','bazaar','market','glory','necro','rules']){await tab(t);check('live screen '+t,await page.locator('main .campaign-tabs').isVisible()&&(await page.locator('main').innerText()).length>40);}
 if(!process.env.FROM_RARE){
 await tab('smith');
 const item=await page.evaluate(()=>({id:STATE.smith[0].id,price:STATE.smith[0].price,gold:STATE.gold,count:STATE.armory.length}));
 await page.locator(`[data-act=campaignItem][data-id="${item.id}"]`).click();
 await page.locator('[data-act=campaignTrade]').click();await page.locator('[data-act=dlgOk]').click();
 check('purchase deducts real price and adds stock',await page.evaluate(v=>STATE.gold===v.gold-v.price&&STATE.armory.length===v.count+1,item));
 await tab('armory');await page.evaluate(()=>ACTIONS.openGlad({id:STATE.gladiators[0].id}));
 await page.locator(`#modal [data-act=equip][data-item="${item.id}"]`).click();
 const slot=await page.evaluate(id=>Object.keys(STATE.gladiators[0].equip).find(k=>STATE.gladiators[0].equip[k]?.id===id),item.id);
 check('equipped through fighter action',!!slot);
 await page.locator(`#modal [data-act=unequip][data-slot="${slot}"]`).click();await page.locator('[data-act=closeModal]').click();
 check('unequipped to stock',await page.evaluate(id=>STATE.armory.some(i=>i.id===id),item.id));
 const sale=await page.evaluate(id=>({price:sellItemPrice(STATE.armory.find(i=>i.id===id)),gold:STATE.gold}),item.id);
 await page.locator(`[data-act=armorySell][data-item="${item.id}"]`).click();
 check('sale uses current 40 percent price',await page.evaluate(v=>STATE.gold===v.gold+v.price,sale));
 await tab('smith');await page.evaluate(()=>{STATE.gold=0;CAMPAIGN.selected=STATE.smith[0].id;render();});
 check('no money disables purchase',await page.locator('[data-act=campaignTrade]').isDisabled());
 check('stale action cannot purchase',await page.evaluate(()=>{const n=STATE.armory.length;ACTIONS.buyItem({item:STATE.smith[0].id});ACTIONS.sellItem({item:-1});return STATE.armory.length===n&&STATE.gold===0;}));
 await page.evaluate(()=>{STATE.gold=50000;render();});await tab('market');
 const recruit=await page.evaluate(()=>({id:STATE.market[0].id,price:STATE.market[0].price,gold:STATE.gold,n:STATE.gladiators.length}));
 check('market exposes fighter attributes on cards',await page.locator('.market-card .market-attrs').count()>0);
 await page.locator('[data-act=campaignRecruit]').first().click();await page.locator('[data-act=dlgOk]').click();
 check('recruit changes roster and gold',await page.evaluate(v=>STATE.gladiators.length===v.n+1&&STATE.gold===v.gold-v.price&&STATE.gladiators.some(g=>g.id===v.id),recruit));
 check('capacity blocks recruitment',await page.evaluate(()=>{const roster=STATE.gladiators;STATE.gladiators=Array.from({length:MAX_GLADIATORS},()=>roster[0]);const gold=STATE.gold,n=STATE.market.length;render();const disabled=[...document.querySelectorAll('[data-act=campaignRecruit]')].every(b=>b.disabled);ACTIONS.buyGlad({id:STATE.market[0].id});const ok=disabled&&STATE.gold===gold&&STATE.market.length===n;STATE.gladiators=roster;return ok;}));
 await page.evaluate(()=>{STATE.fame=0;});await tab('bazaar');check('rare shop locked',await page.locator('main').innerText().then(s=>s.includes('откроется')));
 }
 await tab('bazaar');await page.evaluate(()=>{STATE.fame=300;refreshRareShop(true);render();});
 const rare=await page.evaluate(()=>({id:STATE.rareShop.items[0].id,price:STATE.rareShop.items[0].price,gold:STATE.gold,ach:Object.keys(STATE.meta.ach)}));
 await page.locator(`[data-act=campaignItem][data-id="${rare.id}"]`).click();await page.locator('[data-act=campaignTrade]').click();await page.locator('[data-act=dlgOk]').click();
 check('rare item purchased once including META reward',await page.evaluate(v=>{const gold=STATE.gold;ACTIONS.buyRare({item:v.id});const bonus=META.ACHIEVEMENTS.filter(a=>STATE.meta.ach[a.id]&&!v.ach.includes(a.id)).reduce((n,a)=>n+(a.reward?.gold||0),0);return STATE.gold===gold&&gold===v.gold-v.price+bonus&&STATE.armory.filter(i=>i.id===v.id).length===1&&!STATE.rareShop.items.some(i=>i.id===v.id);},rare));
 await page.evaluate(()=>{const id=Object.keys(META.ARTIFACTS)[0];META.giveArtifact(id,'Проверка',true);const it=STATE.armory.find(i=>i.base===id);STATE.gladiators[0].equip[it.slot]=it;STATE.armory=STATE.armory.filter(i=>i.id!==it.id);UI.gloryTab='relics';});
 await tab('glory');check('relic location names real owner',await page.locator('main').innerText().then(s=>s.includes('Носит')));
 check('award cannot be issued twice',await page.evaluate(()=>{const n=STATE.armory.length;return META.giveArtifact(Object.keys(META.ARTIFACTS)[0],'again',true)===null&&STATE.armory.length===n;}));
 await page.evaluate(()=>{const g=STATE.gladiators[0];STATE.graveyard=[{...structuredClone(g),day:STATE.day,place:'Арена Помпей',killer:'Противник'}];});await tab('necro');check('actual memorial inscription',await page.locator('.memorial').count()===1&&await page.locator('.memorial-inscription').count()===1);
 await page.evaluate(()=>{STATE.graveyard.push({...structuredClone(STATE.graveyard[0]),freed:true});CAMPAIGN.necro='freed';render();});check('freed memorial tab',await page.locator('.memorial.freed').count()===1);
 for(const t of ['arena','contracts']){
  await page.evaluate(t=>{STATE.gladiators.forEach(g=>{g.wounded=0;g.foughtToday=false;});UI.tab=t;UI.arenaTab=0;UI.eventId=null;render();},t);
  await page.locator('main button[data-act=pickEvent]').first().click();
  const n=await page.evaluate(()=>playerCount(findEvent(UI.eventId)));
  for(let i=0;i<n;i++)await page.locator('.order-pick-unit').nth(i).click();
  await page.locator('[data-act=startBattle]').click();check(t+' enters existing battle placement',await page.locator('#combat-screen').isVisible());await page.locator('[data-act=combatExit]').click();
 }
 await page.evaluate(()=>{save();});const saved=await page.evaluate(()=>({gold:STATE.gold,roster:STATE.gladiators.map(g=>g.id),stock:STATE.armory.map(i=>i.id)}));
 await page.reload();await page.locator('[data-act=menuContinue]').click();check('campaign reload retains economy',JSON.stringify(await page.evaluate(()=>({gold:STATE.gold,roster:STATE.gladiators.map(g=>g.id),stock:STATE.armory.map(i=>i.id)})))===JSON.stringify(saved));
 await page.setViewportSize({width:390,height:844});
 for(const t of ['smith','rules']){await tab(t);check('390 '+t+' fits',await fits());}
 for(const [ch] of await page.evaluate(()=>GUIDE)){await page.evaluate(ch=>{UI.guide=ch;render();},ch);check('complete guide '+ch,await page.evaluate(()=>document.querySelector('.manual-reading').textContent===(()=>{const d=document.createElement('div');d.innerHTML=guideChapter(UI.guide);return d.textContent;})()));}
 await tab('arena');await page.evaluate(()=>{UI.arenaTab=0;render();});await page.locator('main button[data-act=pickEvent]').first().click();check('390 picker fits',await page.locator('.battle-picker').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.setViewportSize({width:320,height:720});check('320 picker fits',await page.locator('.battle-picker').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 check('no JS errors',errors.length===0);
 }finally{fs.mkdirSync('output/playwright',{recursive:true});fs.writeFileSync('output/playwright/campaign-tabs-'+(process.env.LAYOUT_ONLY?'layout':process.env.FROM_RARE?'continuation':'validation')+'.json',JSON.stringify({checks,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
