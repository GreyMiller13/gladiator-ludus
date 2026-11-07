const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadGame, ev} = require('./harness');

function fixture() {
  const c = loadGame(['data','core','debt','story','combat','meta','combat-campaign']);
  // Reuse the legacy campaign event payload, rather than a test approximation.
  const ui = fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
  ev(c, ui.slice(ui.indexOf('function battleInfo(B)'),ui.indexOf('// Обучение узнаёт')));
  ev(c, `const track=(t,d)=>META.track(t,d); const storyBattle=()=>{};
    newGame('Тест'); STATE.gold=1000; STATE.fame=100;
    STATE.gladiators=['murmillo','retiarius','gallus'].map(c=>createGladiator(c,5,{autoSpend:true,quality:1}));
    const event={id:uid(),tier:0,size:3,gold:170,fame:8,enemies:[createGladiator('thraex',5)]};
    STATE.events=[event];
    const b=new Battle(JSON.parse(JSON.stringify(STATE.gladiators)),event.enemies,event,{mode:'manual'});
    b.over=true; b.winner='enemy'; b.round=4;
    const own=b.units.filter(u=>u.side==='player');
    const s={b,event,reward:0,fame:-1,loot:[],court:own,verdicts:{},rewardRows:own.map(u=>({u,xp:20,fame:0}))};
  `);
  return c;
}
module.exports = [
  {name:'combat port: mercy caps remain 50/90 despite fame and bribe',fn(){
    const c=fixture();
    assert.equal(ev(c, `own[0].g.fame=9999; own[0].s.attrs.wil=999; mercyBreakdown(own[0],b,true).total`),50);
    assert.equal(ev(c, `own[0].kills=1; mercyBreakdown(own[0],b,true).total`),90);
  }},
  {name:'combat port: wounds 1/2/3 persist with records, once only',fn(){
    const c=fixture();
    assert.equal(ev(c, `own[1].alive=false;own[1].kills=1;own[2].alive=false;
      for(const u of own)s.verdicts[u.uid]={result:'live',wound:combatWound(u),chance:50};
      combatCommit(s);combatCommit(s);
      STATE.gladiators.map(g=>g.wounded).join(',')`),'1,2,3');
    assert.equal(ev(c, `STATE.gladiators.every(g=>g.record.fights===1&&g.record.losses===1&&g.record.spared===1&&g.foughtToday)`),true);
    assert.equal(ev(c, `load()&&STATE.gladiators.map(g=>g.wounded).join(',')`),'1,2,3');
    assert.equal(ev(c, 'STATE.day'),1);
  }},
  {name:'combat port: death removes fighter and preserves equipment in necropolis',fn(){
    const c=fixture();
    assert.equal(ev(c, `for(const u of own)s.verdicts[u.uid]={result:'die',chance:5};
      combatCommit(s);STATE.gladiators.length`),0);
    assert.equal(ev(c, 'STATE.graveyard.length'),3);
    assert.equal(ev(c, `STATE.graveyard.every(g=>g.equip.weapon&&g.record.fights===1&&g.day===1)`),true);
  }},
  {name:'combat port: victory rewards, loot and fallen allies survive save/load',fn(){
    const c=fixture();
    assert.equal(ev(c, `b.winner='player';s.court=[];s.reward=340;s.fame=17;own[0].alive=false;
      const item=makeItem('sica',2);s.loot=[{it:item}];combatCommit(s);
      load()&&STATE.gold>=1340&&STATE.fame>=117&&STATE.armory.some(i=>i.id===item.id)&&STATE.events[0].done`),true);
    assert.equal(ev(c, 'STATE.gladiators[0].wounded'),1);
    assert.equal(ev(c, 'combatLootChance(true)'),7);
    assert.equal(ev(c, 'combatLootChance(false)'),18);
  }},
  {name:'combat port: contract settlement uses META including artifact and no personal kills',fn(){
    const c=fixture();
    assert.equal(ev(c, `event.kind='contract';event.title='Проверка';event.cond={type:'win',text:'Победить'};event.artifact='art_hector';
      b.winner='player';own[0].kills=2;own[1].alive=false;s.court=[];combatCommit(s);
      s.contractSuccess&&STATE.gold>=1170&&STATE.fame>=108&&STATE.gladiators[0].record.kills===0&&STATE.gladiators[1].wounded===1`),true);
    assert.equal(ev(c, `STATE.armory.some(i=>i.base==='art_hector')`),true);
  }},
  {name:'combat port: failed contract pays 15 percent without arena fame penalty',fn(){
    const c=fixture();
    assert.equal(ev(c, `event.kind='contract';event.title='Проверка';event.cond={type:'win',text:'Победить'};
      s.court=[];own.forEach(u=>u.alive=false);combatCommit(s);
      !s.contractSuccess&&STATE.gold===1026&&STATE.fame===100&&STATE.gladiators.every(g=>g.wounded===1)`),true);
  }},
  {name:'combat port: no settlement before all verdicts and defence requires full AP',fn(){
    const c=fixture();
    assert.equal(ev(c, `combatCommit(s);!s.committed&&!event.done&&STATE.gladiators.every(g=>g.record.fights===0)`),true);
    assert.equal(ev(c, `combatCanDefend(own[0])`),true);
    assert.equal(ev(c, `own[0].apLeft--;combatCanDefend(own[0])`),false);
  }},
  {name:'combat port: actual Battle attack/ability consume 4/5 AP',fn(){
    const c=fixture();
    assert.equal(ev(c, `b.over=false;const u=own[0],t=b.units.find(u=>u.side==='enemy');
      b.blocked.clear();b.highBlocked.clear();u.c=3;u.r=2;t.c=4;t.r=2;t.hp=t.maxHp=9999;
      u.apLeft=9;b.current=u;b.cmdAttack(u,t);u.apLeft`),5);
    assert.equal(ev(c, `u.cd=0;b.cmdAbility(u,t);u.apLeft`),0);
  }},
];
