const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const checks=[],errors=[];function check(n,v){assert.ok(v,n);checks.push(n);console.log('PASS '+n);}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(new URL('index.html?v=final-endings',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
 await page.evaluate(()=>{newGame('Финал',{story:true});hideMenu();STATE.story.queue=['finale'];STATE.story.seen={};STATE.finalWon=true;render();showEnding();});
 check('final story scene opens before rudis choice',await page.evaluate(()=>SCENE.id==='finale'&&!document.querySelector('.rudis')));
 const text=await page.evaluate(()=>STORY.lines('finale').map(l=>l.text));
 for(const line of text){check('original finale line '+checks.length,await page.locator('.scene-text p').innerText()===line);await page.locator('[data-act=sceneNext]').click();}
 await page.locator('[data-act=keepBest]').click();check('keep fighter alternative preserves roster',await page.evaluate(()=>STATE.story.flags.epilogue==='kept'&&STATE.gladiators.length===1));
 await page.locator('[data-act=endingContinue]').click();
 await page.evaluate(()=>{STATE.gladiators=[];STATE.gold=0;checkGameOver();});
 check('empty roster loss opens new component',await page.locator('.narrative-loss h2').innerText()==='Лудус пал');
 await page.locator('#modal [data-act=newGame]').click();check('empty roster loss opens new campaign page',await page.locator('#page-title').innerText()==='Новая игра');
 check('no JS errors',errors.length===0);
}finally{fs.writeFileSync('output/playwright/final-endings-validation.json',JSON.stringify({checks,errors},null,2));await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
