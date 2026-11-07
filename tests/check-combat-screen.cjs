// Browser acceptance for the campaign screen. Fixtures live only in this test.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const checks = [], errors = [];
const check = (name, ok) => { assert.ok(ok, name); checks.push(name); console.log('PASS ' + name); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('index.html?v=combat-20261104',process.env.SITE_URL||'http://127.0.0.1:8765/').href);
    await page.evaluate(() => {
      newGame('Проверка боя'); hideMenu();
      STATE.gladiators = ['murmillo','retiarius','sagittarius'].map(c => createGladiator(c, 8, { autoSpend: true, quality: 2 }));
      STATE.gold = 5000; STATE.fame = 100; STATE.settings = { mode: 'manual' };
      STATE.events = [{ id: uid(), tier: 0, size: 3, gold: 170, fame: 8, enemies: ['thraex','secutor','gallus'].map(c => createGladiator(c, 6, { autoSpend: true, quality: 1 })) }];
      save(); UI.tab = 'arena'; UI.eventId = STATE.events[0].id; UI.picked = STATE.gladiators.map(g => g.id); render();
    });
    await page.locator('[data-act=startBattle]').click();
    await page.waitForFunction(() => COMBAT.view?.art.naturalWidth > 0);
    check('normal campaign entry uses painted screen', await page.locator('#combat-screen').isVisible());
    check('real campaign event retained, fighters isolated until settlement', await page.evaluate(() => COMBAT.session.event === STATE.events[0] && COMBAT.session.b.units[0].g !== STATE.gladiators[0]));
    check('no demo hooks or scenarios', await page.evaluate(() => !window.__combatReview && typeof combatPreview === 'undefined') && await page.getByText('Сценарии', {exact:true}).count() === 0);
    check('painted image and no procedural crowd', await page.evaluate(() => COMBAT.view.art.naturalWidth > 0 && COMBAT.view.crowd.length === 0));
    check('placement controls are pills', await page.locator('input[name=combat-control]').count() === 2);
    check('pre-battle save remains readable and unconsumed', await page.evaluate(()=>{const st=unpackSave(JSON.parse(localStorage.getItem(SAVE_KEY)));return !st.events[0].done&&st.gladiators.every(g=>!g.foughtToday);}));
    await page.locator('[data-act=combatArrange]').click();
    check('mouse selects and swaps allies', await page.evaluate(() => {
      const [a,b] = COMBAT.session.b.units; const ac=a.c, ar=a.r, bc=b.c, br=b.r;
      combatPick({c:a.c,r:a.r,uid:a.uid}); combatPick({c:b.c,r:b.r,uid:b.uid});
      return a.c===bc && a.r===br && b.c===ac && b.r===ar;
    }));
    await page.locator('#combat-canvas').focus();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    check('keyboard field retains focus', await page.locator('#combat-canvas').evaluate(e => document.activeElement === e));
    for (const width of [320,390,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      check('placement fits '+width, await page.locator('#combat-screen').evaluate(e => {
        const r=e.getBoundingClientRect(),w=e.querySelector('.combat-workspace');
        return r.left>=-1 && r.right<=innerWidth+1 && e.scrollWidth<=e.clientWidth+1 && w.scrollWidth<=w.clientWidth+1;
      }));
    }
    await page.setViewportSize({width:1440,height:1000});
    if(process.env.COMBAT_REPORT_SHOTS) await page.screenshot({path:'output/playwright/campaign-combat-placement.png'});
    await page.locator('[data-act=combatStart]').click();
    await page.waitForFunction(() => COMBAT.session.awaiting && !COMBAT.session.busy, {timeout:60000});
    check('manual turn is ready', await page.locator('.combat-turn-flag').innerText() === 'Ваш ход');
    const idle = () => page.waitForFunction(() => !COMBAT.session.busy, null, {timeout:60000});
    const setup = () => page.evaluate(() => {
      const s=COMBAT.session,b=s.b,u=b.current,t=b.enemiesOf(u)[0];
      b.blocked.clear();b.highBlocked.clear();b.field.obstacles=[];COMBAT.view.obstacles=[];
      b.units.filter(q=>q!==u&&q!==t).forEach((q,i)=>{q.c=i%2?9:0;q.r=i;});
      u.c=3;u.r=2;t.c=4;t.r=2;u.ap=u.apLeft=9;u.hits=0;u.cd=0;u.acted=false;
      u.s.acc=1000;t.s.dodge=0;t.s.block=0;t.hp=t.maxHp=9999;
      s.aim=null;s.inspect=null;
      for(const q of b.units)COMBAT.view.placeFighter(COMBAT.view.F(q.uid),q.c,q.r);
      combatUpdate();return t.uid;
    });
    let target = await setup();
    check('defence ready at full AP',await page.locator('[data-id=defend]').isEnabled());
    check('hover shows hit and crit, empty cell silent',await page.evaluate(uid=>{
      const t=COMBAT.session.b.unit(uid),h=combatCanvasHint({c:t.c,r:t.r,uid});
      return h.text.includes('Крит')&&h.text.includes('%')&&combatCanvasHint({c:5,r:4})===null;
    },target));
    for(let n=1;n<=2;n++) {
      await page.locator('[data-act=combatArm]').click();
      check('attack '+n+' arms a fresh target',await page.locator('[data-act=combatArm]').getAttribute('aria-pressed')==='true');
      await page.locator('[data-act=combatSelect][data-id='+target+']').click();await idle();
      check('attack '+n+' consumes 4 AP',await page.evaluate(n=>COMBAT.session.b.current.apLeft===9-4*n&&COMBAT.session.aim===null,n));
    }
    check('defence locked after attacks',await page.locator('[data-id=defend]').isDisabled());
    target=await setup();
    await page.locator('[data-act=combatAim]').click();
    await page.locator('[data-act=combatSelect][data-id='+target+']').click();await idle();
    check('ability costs 5 AP and starts cooldown',await page.evaluate(()=>COMBAT.session.b.current.apLeft===4&&COMBAT.session.b.current.cd>0));
    await setup();await page.locator('[data-act=combatArm]').click();await page.keyboard.press('Escape');
    check('Escape cancels targeting without pausing',await page.evaluate(()=>!COMBAT.session.aim&&!COMBAT.session.paused));
    await page.locator('[data-act=combatArm]').click();
    await page.evaluate(()=>combatPick({c:5,r:4}));
    check('empty cell cancels targeting',await page.evaluate(()=>COMBAT.session.aim===null));
    const moved=await page.evaluate(async()=>{
      const u=COMBAT.session.b.current,cell=[...COMBAT.session.b.options(u).reach.values()].find(p=>p.d>0&&p.d<3);
      if(!cell)return false;const before=u.apLeft;await combatCommand('move',cell);return u.apLeft<before&&!u.defending;
    });
    check('movement spends AP and disables defence',moved&&await page.locator('[data-id=defend]').isDisabled());
    await page.locator('[data-act=combatPause]').click();
    const ap=await page.evaluate(()=>COMBAT.session.b.current.apLeft);
    check('pause holds the current turn',await page.evaluate(ap=>COMBAT.session.paused&&COMBAT.session.b.current.apLeft===ap,ap));
    await page.locator('#combat-overlay [data-act=combatPause]').click();
    const handover=await page.evaluate(async()=>{
      const s=COMBAT.session,u=s.b.current;u.apLeft=1;let calls=0;const begin=s.b.beginTurn.bind(s.b);
      s.b.beginTurn=(...args)=>{calls++;return begin(...args);};
      await ACTIONS.combatAuto();await ACTIONS.combatAuto();clearTimeout(COMBAT.timer);
      s.b.beginTurn=begin;s.awaiting=true;combatUpdate();return calls===0&&u.apLeft<=1&&!s.autoplay;
    });
    check('autoplay handover does not restart the turn',handover);
    for(const [key,speed] of [['1',1],['2',2],['3',4]]) {
      await page.keyboard.press(key);check('speed key '+key,await page.evaluate(speed=>COMBAT.session.speed===speed,speed));
    }
    // Deterministic injury fixtures, still resolved by the real mercy function and ceremony.
    await page.evaluate(()=>{
      const s=COMBAT.session,own=s.b.units.filter(u=>u.side==='player');
      own[0].alive=true;own[1].alive=false;own[1].hp=0;own[1].kills=1;own[2].alive=false;own[2].hp=0;
      own.forEach(u=>{u.g.fame=0;u.s.attrs.wil=0;u.dmgDealt=0;u.flair=0;u.s.mercy=0;});
    });
    await page.locator('[data-act=combatSurrender]:visible').click();
    await page.locator('[data-act=combatConfirmSurrender]').click();await idle();
    check('surrender kneels the whole team',await page.evaluate(()=>COMBAT.session.b.surrendered&&COMBAT.session.court.every(u=>COMBAT.view.F(u.uid).state==='kneel')));
    await page.getByRole('checkbox',{name:/Подкупить/}).check();
    const beforeBribe=await page.evaluate(()=>STATE.gold);
    await page.evaluate(()=>{
      const original=COMBAT.view.execution.bind(COMBAT.view);window.ceremonyCalls=[];
      COMBAT.view.execution=async(...args)=>{window.ceremonyCalls.push(args.slice(0,3));return original(...args);};
      window.savedRandom=Math.random;Math.random=()=>0;
    });
    await page.getByRole('button',{name:'Выслушать приговор',exact:true}).click();
    check('ceremony locks its button',await page.getByRole('button',{name:/Выслушать приговор|К итогам/}).isDisabled());
    await idle();await page.evaluate(()=>{Math.random=window.savedRandom;});
    check('one click runs all three original execution clips',await page.evaluate(()=>window.ceremonyCalls.length===3&&COMBAT.session.court.every(u=>COMBAT.view.F(u.uid).state==='idle')));
    check('bribe is charged to campaign exactly once',await page.evaluate(old=>{combatPayBribes();return STATE.gold===old-30&&COMBAT.session.spent===30;},beforeBribe));
    check('campaign wounds are 1/2/3, results already saved',await page.evaluate(()=>STATE.gladiators.map(g=>g.wounded).join(',')==='1,2,3'&&unpackSave(JSON.parse(localStorage.getItem(SAVE_KEY))).gladiators.map(g=>g.wounded).join(',')==='1,2,3'));
    check('no overhead verdict stamps or extra overlays',await page.evaluate(()=>!COMBAT.view.stamps?.length)&&await page.locator('#combat-scene-caption').count()===0);
    await page.getByRole('button',{name:'К итогам',exact:true}).click();
    check('results have one return action',await page.locator('#combat-screen button').count()===1);
    for(const width of [320,390,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      check('results fit '+width,await page.locator('#combat-screen').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.querySelector('.combat-results').scrollWidth<=e.querySelector('.combat-results').clientWidth+1));
    }
    await page.getByRole('button',{name:'Вернуться в лудус',exact:true}).click();
    await page.reload();await page.evaluate(()=>{hideMenu();});
    check('reload retains finished event and wounds',await page.evaluate(()=>STATE.events[0].done&&STATE.gladiators.map(g=>g.wounded).join(',')==='1,2,3'));
    // New independent campaign fixtures enter through the real start action.
    const openFixture=async({tier=0,training=false,kind='arena',count=1,tutorial=false}={})=>{
      await page.evaluate(({tier,training,kind,count,tutorial})=>{
        if(COMBAT.session)ACTIONS.combatExit();
        newGame('Приёмка',{story:tutorial});hideMenu();STATE.gold=5000;STATE.fame=100;
        STATE.gladiators=Array.from({length:count},()=>createGladiator('murmillo',8,{autoSpend:true,quality:2}));
        const e={id:uid(),tier,training,kind,size:count,gold:170,fame:8,title:'Проверка',cond:{type:'win',text:'Победить'},enemies:Array.from({length:count},()=>createGladiator('thraex',5,{autoSpend:true,quality:1}))};
        STATE.events=[e];UI.eventId=e.id;UI.picked=STATE.gladiators.map(g=>g.id);render();
        if(tutorial){STATE.story.tutor={on:true,step:'pickGlad',hints:true};showCoach();}
        ACTIONS.startBattle();
      },{tier,training,kind,count,tutorial});
      await page.waitForFunction(()=>COMBAT.view.art.naturalWidth>0);
    };
    await page.setViewportSize({width:1440,height:1000});
    for(let tier=0;tier<4;tier++) {
      await openFixture({tier});
      const sand=await page.evaluate(()=>{
        const v=COMBAT.view,c=v.bg.getContext('2d'),d=v.dpr;
        const patch=(x,y)=>{const a=c.getImageData(Math.round(x*d-10),Math.round(y*d-4),20,8).data;let r=0,b=0,n=a.length/4;for(let i=0;i<a.length;i+=4){r+=a[i];b+=a[i+2];}r/=n;b/=n;let vr=0;for(let i=0;i<a.length;i+=4)vr+=(a[i]-r)**2;return {r,b,std:Math.sqrt(vr/n)};};
        const ref=patch(640,600);let run=0;for(let y=300;y<=610;y+=4){const p=patch(640,y);run=p.std<13&&p.r-p.b>10&&Math.abs(p.r-ref.r)<55?run+1:0;if(run>=8)return y-28;}return null;
      });
      check('arena '+tier+' sand above grid',sand!==null&&sand<=360);
    }
    const endFixture=async(won)=>page.evaluate(async won=>{
      const s=COMBAT.session;s.b.over=true;s.b.winner=won?'player':'enemy';s.b.round=6;
      s.b.units.forEach(u=>{u.alive=u.side===(won?'player':'enemy');if(!u.alive)u.hp=0;});
      s.speed=4;COMBAT.view.speed=4;await combatResult();
    },won);
    await openFixture({training:true});await endFixture(false);
    check('training uses nonLethal and guarantees mercy',await page.evaluate(()=>COMBAT.session.b.nonLethal)&&await page.getByRole('checkbox',{name:/Подкупить/}).count()===0);
    await page.getByRole('button',{name:'Выслушать приговор',exact:true}).click();await idle();
    check('training returns everyone alive',await page.evaluate(()=>STATE.gladiators.length===1&&Object.values(COMBAT.session.verdicts).every(v=>v.result==='live')));
    await page.getByRole('button',{name:'К итогам',exact:true}).click();
    check('solo results centered up to 440px',await page.locator('.combat-result-unit').evaluate(e=>{const r=e.getBoundingClientRect(),d=e.closest('dialog').getBoundingClientRect();return r.width<=440&&Math.abs(r.x+r.width/2-d.x-d.width/2)<3;}));
    await openFixture({kind:'contract'});await endFixture(true);
    check('contract bypasses court, pays through META',await page.evaluate(()=>COMBAT.session.phase==='results'&&COMBAT.session.contractSuccess&&STATE.events[0].result.success&&STATE.gold>=5170));
    await openFixture();
    await page.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>.999;});
    await endFixture(false);
    await page.getByRole('button',{name:'Выслушать приговор',exact:true}).click();await idle();
    await page.evaluate(()=>{Math.random=window.savedRandom;});
    check('execution updates necropolis and removes fighter',await page.evaluate(()=>STATE.gladiators.length===0&&STATE.graveyard.length===1&&COMBAT.view.F('player0').state==='dead'));
    await page.getByRole('button',{name:'К итогам',exact:true}).click();
    await openFixture();
    await page.evaluate(()=>{window.savedRandom=Math.random;Math.random=()=>0;});
    await endFixture(true);await page.evaluate(()=>{Math.random=window.savedRandom;});
    check('victory court runs automatically and awards real items',await page.evaluate(()=>COMBAT.session.phase==='results'&&COMBAT.session.loot.length>0&&COMBAT.session.loot.every(l=>STATE.armory.some(i=>i.id===l.it.id))&&STATE.gold>=5170));
    check('victory hides enemy details',!await page.locator('.combat-results').innerText().then(t=>t.includes('Противники'))&&await page.getByRole('button',{name:'Выслушать приговор',exact:true}).count()===0);
    if(process.env.COMBAT_REPORT_SHOTS) await page.screenshot({path:'output/playwright/campaign-combat-results.png'});
    await openFixture();
    await page.locator('input[name=combat-control][value=auto]').check();
    await page.locator('[data-act=combatStart]').click();await page.keyboard.press('3');
    await page.waitForFunction(()=>['judgment','results'].includes(COMBAT.session.phase),null,{timeout:120000});await idle();
    if(await page.evaluate(()=>COMBAT.session.phase==='judgment')) {
      await page.getByRole('button',{name:'Выслушать приговор',exact:true}).click();await idle();
      await page.getByRole('button',{name:'К итогам',exact:true}).click();
    }
    check('full natural auto battle settles campaign',await page.evaluate(()=>COMBAT.session.committed&&COMBAT.session.phase==='results'&&STATE.events[0].done));
    await openFixture({training:true,tutorial:true});
    check('tutorial advances into the new dialog',await page.evaluate(()=>tutorState().step==='deploy'&&document.querySelector('#combat-screen #coach')!==null));
    await page.evaluate(()=>{const u=COMBAT.session.b.units[0];combatPick({c:u.c,r:u.r,uid:u.uid});combatPick({c:u.c===2?1:2,r:u.r});});
    check('tutorial observes placement',await page.evaluate(()=>tutorState().step==='deployGo'));
    await page.locator('[data-act=combatStart]').click();
    await page.waitForFunction(()=>COMBAT.session.awaiting&&!COMBAT.session.busy,null,{timeout:60000});
    check('tutorial advances to manual movement',await page.evaluate(()=>['move','aim'].includes(tutorState().step)));
    await endFixture(true);
    check('tutorial and story receive training result',await page.evaluate(()=>tutorState().step==='mercy'&&STATE.story.flags.trainWon&&document.querySelector('#combat-screen #coach')!==null));
    await page.getByRole('button',{name:'Вернуться в лудус',exact:true}).click();
    check('tutorial returns to campaign after battle',await page.evaluate(()=>tutorState().step==='lvlGlad'&&document.querySelector('body > #coach')!==null));
    check('no JS errors', errors.length === 0);
  } finally {
    fs.mkdirSync(path.resolve('output/playwright'), {recursive:true});
    fs.writeFileSync(path.resolve('output/playwright/campaign-combat-validation.json'), JSON.stringify({checks,errors},null,2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode=1; });
