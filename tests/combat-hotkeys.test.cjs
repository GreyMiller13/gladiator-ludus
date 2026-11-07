// Focused keyboard routing checks against the production handler.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('js/combat-screen.js','utf8');
const handler=source.slice(source.indexOf('function combatHotkey(e){'),source.indexOf("document.addEventListener('keydown',combatHotkey)"));
const manual=source.match(/const combatManual = .*;/)[0];
const calls=[];
const ctx={COMBAT:{session:null},$:()=>({open:true}),combatAvailability:()=>({anyAttack:true}),combatCanDefend:u=>u.apLeft===u.ap,combatCommand:k=>calls.push(k),ACTIONS:{combatArm:()=>calls.push('attack'),combatAim:()=>calls.push('ability'),combatPause:()=>calls.push('pause'),combatSpeed:()=>calls.push('speed')}};
vm.createContext(ctx);vm.runInContext(manual+'\n'+handler,ctx);
function press(code,extra={}){calls.length=0;const e={code,key:code,preventDefault(){this.prevented=true;},target:{matches:()=>false},...extra};ctx.combatHotkey(e);return [...calls];}
function reset(kind){ctx.COMBAT.session={phase:'fight',awaiting:true,busy:false,paused:false,autoplay:false,b:{event:{kind},current:{side:'player',alive:true,ap:8,apLeft:8}}};}
for(const kind of ['arena','contract']){
 reset(kind);
 for(const [code,action] of [['KeyA','attack'],['KeyS','ability'],['KeyD','defend'],['Space','wait'],['KeyP','pause']]){
  assert.deepEqual(press(code),[action]);
  assert.deepEqual(press(code,{repeat:true}),[]);
  assert.deepEqual(press(code,{ctrlKey:true}),[]);
  assert.deepEqual(press(code,{target:{matches:()=>true}}),[]);
  assert.deepEqual(press(code,{target:{matches:()=>false,isContentEditable:true}}),[]);
 }
 assert.deepEqual(press('KeyA',{key:'ф'}),['attack']);
 // A focused button must not swallow the end-turn shortcut.
 assert.deepEqual(press('Space',{target:{matches:s=>s==='button,summary'}}),['wait']);
 ctx.COMBAT.session.b.current.apLeft=3;
 assert.deepEqual(press('KeyD'),[]);assert.deepEqual(press('KeyA'),[]);
 for(const flag of ['busy','paused','autoplay']){
  reset(kind);ctx.COMBAT.session[flag]=true;
  for(const code of ['KeyA','KeyS','KeyD','Space'])assert.deepEqual(press(code),[]);
  assert.deepEqual(press('KeyP'),['pause']);
 }
 reset(kind);ctx.COMBAT.session.b.current.side='enemy';
 assert.deepEqual(press('Space'),[]);
 for(const phase of ['placement','judgment','results']){
  ctx.COMBAT.session.phase=phase;
  for(const code of ['KeyA','KeyS','KeyD','Space','KeyP'])assert.deepEqual(press(code),[]);
 }
}
ctx.COMBAT.session=null;assert.deepEqual(press('KeyP'),[]);
console.log('PASS: arena/contract shortcuts, Russian layout, button focus, repeat and state guards');
