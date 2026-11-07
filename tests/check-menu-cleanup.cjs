const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
try{await p.goto(new URL('index.html?v=menu-clean-20261105',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
for(const section of ['new','save','settings','guide']){
 await p.evaluate(s=>menuPage(s),section);
 const styles=await p.locator('.subscreen').evaluate(e=>{const h=e.querySelector('.page-head'),btn=h.querySelector('button');return {text:btn.textContent,background:getComputedStyle(h).backgroundImage,after:getComputedStyle(h,'::after').content,button:getComputedStyle(btn).backgroundColor,shadows:[...e.querySelectorAll('button:not(.pick)')].every(x=>getComputedStyle(x).boxShadow==='none')};});
 assert.equal(styles.text,'В меню');assert.equal(styles.background,'none');assert.equal(styles.after,'none');assert.equal(styles.button,'rgba(0, 0, 0, 0)');assert.ok(styles.shadows);checks.push(section+' header, button and shadows');
 await p.locator('.page-head button').click();assert.ok(await p.locator('.shell-menu').isVisible());
}
await p.evaluate(()=>menuPage('save'));await p.locator('#importFile').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await p.waitForSelector('#importPreview .bad');assert.equal(await p.locator('#importPreview .bad').evaluate(e=>getComputedStyle(e).borderTopStyle),'solid');checks.push('import error uses new notice');
await p.evaluate(()=>{newGame('Проверка оформления');menuPage('save');});const file=await p.evaluate(()=>saveFileText(STATE));await p.locator('#importFile').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(file)});await p.waitForSelector('#importPreview .panel');assert.equal(await p.locator('#importPreview .panel').evaluate(e=>getComputedStyle(e).backgroundImage),'none');checks.push('real import preview has no old texture');
await p.setViewportSize({width:390,height:844});for(const s of ['save','settings','guide']){await p.evaluate(s=>menuPage(s),s);assert.ok(await p.locator('.subscreen').evaluate(e=>e.scrollWidth<=e.clientWidth+1));checks.push('390 '+s);}
assert.equal(errors.length,0);console.log('PASS '+checks.length+' targeted checks; no JS errors');
}finally{fs.writeFileSync('output/playwright/menu-cleanup-validation.json',JSON.stringify({checks,errors},null,2));await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
