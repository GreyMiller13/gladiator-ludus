const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const checks=[],errors=[];function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('index.html?v=final-services',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{newGame('Старое сохранение');const old=JSON.stringify(STATE);localStorage.removeItem(SAVE_SIGNED_KEY);localStorage.setItem(SAVE_KEY,old);});await page.reload();
 check('legacy unsigned campaign migrates without losing name',await page.evaluate(()=>STATE.ludusName==='Старое сохранение'&&JSON.parse(localStorage.getItem(SAVE_KEY)).v===2));
 await page.evaluate(()=>menuPage('settings'));
 const muted=await page.evaluate(()=>SFX.muted);await page.locator('[data-act=toggleSound]').click();check('sound setting updates engine',await page.evaluate(m=>SFX.muted!==m,muted));
 if(await page.evaluate(()=>SFX.muted))await page.locator('[data-act=toggleSound]').click();
 const music=await page.evaluate(()=>SFX.musicMuted);await page.locator('[data-act=toggleMusic]').click();check('music setting updates engine',await page.evaluate(m=>SFX.musicMuted!==m,music));
 await page.locator('#menu-volume').fill('37');check('volume reaches audio engine',await page.evaluate(()=>SFX.volume===.37));
 await page.evaluate(()=>{localStorage.setItem(SAVE_KEY,'broken');});await page.reload();check('corrupt startup opens themed error',await page.locator('#dlgTitle').innerText()==='Сохранение не загружено');
 await page.locator('[data-act=dlgCancel]').click();check('corrupt save leaves working new game action',await page.locator('#menu [data-act=newGameAsk]').isVisible());
 check('no JS errors',errors.length===0);
}finally{fs.writeFileSync('output/playwright/final-services-validation.json',JSON.stringify({checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
