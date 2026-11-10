const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ev } = require('./harness');

function fixture(key) {
  const ctx = loadGame(['data','core','debt','story','combat','meta']);
  // Проверяем настоящую формулу интерфейса без загрузки DOM в vm.
  const ui = fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
  ev(ctx, ui.match(/^const trainXp =[^\r\n]+/m)[0]);
  ev(ctx, `newGame('Проверка');STATE.lanista={portrait:'${key}'};
    const own=[createGladiator(null,1),createGladiator(null,1)];
    const foes=[createGladiator(null,1),createGladiator(null,1)];
    const b=new Battle(own,foes,{tier:0,size:2,kind:'arena'});
    const p=b.units[0],ally=b.units[1],enemy=b.units[2];
    Math.random=()=>0;
    function hit(target,crit=false){
      const attacker=target.side==='player'?enemy:p;
      target.hp=target.maxHp=1000;target.s.armor=target.s.dodge=target.s.block=0;
      attacker.s.dmgMin=attacker.s.dmgMax=20;attacker.s.dmgMult=1;
      attacker.s.acc=200;attacker.s.crit=0;attacker.s.critMult=1.5;
      return b.strike(attacker,target,{forceCrit:crit,noCounter:true}).dmg;
    }`);
  return ctx;
}

module.exports = [
  {name:'ланиста: наследник прибавляет 5 п.п. после пределов только своим бойцам',fn(){
    const ctx=fixture('m1');
    assert.equal(ev(ctx, 'p.s.attrs.wil=999;mercyBreakdown(p,b,true).total'),55);
    assert.equal(ev(ctx, 'p.kills=1;mercyBreakdown(p,b,true).total'),95);
    assert.equal(ev(ctx, 'enemy.s.attrs.wil=999;mercyBreakdown(enemy,b,true).total'),50);
    assert.equal(ev(ctx, "b.event.kind='bet';mercyBreakdown(p,b,true).total"),90);
  }},
  {name:'ланиста: строй снижает урон только пока остаются двое своих',fn(){
    const ctx=fixture('m2');
    assert.equal(ev(ctx, 'hit(p)'),19);
    assert.equal(ev(ctx, 'hit(enemy)'),20);
    assert.equal(ev(ctx, 'ally.alive=false;hit(p)'),20);
    assert.equal(ev(ctx, "ally.alive=true;b.event.kind='bet';hit(p)"),20);
  }},
  {name:'ланиста: скидка на покупку сохраняется без изменения базовой цены',fn(){
    const ctx=fixture('m3');
    assert.equal(ev(ctx, 'const offer=STATE.market[0];offer.price=100;marketBuyPrice(offer)'),90);
    assert.equal(ev(ctx, 'offer.price'),100);
    assert.equal(ev(ctx, 'save();STATE=null;load();marketBuyPrice(STATE.market[0])'),90);
    assert.equal(ev(ctx, "STATE.lanista.portrait='m1';marketBuyPrice(STATE.market[0])"),100);
  }},
  {name:'ланиста: дочь увеличивает опыт платной тренировки с округлением',fn(){
    const ctx=fixture('f1');
    assert.equal(ev(ctx, 'trainXp(own[0])'),37);
    assert.equal(ev(ctx, "STATE.lanista.portrait='m1';trainXp(own[0])"),31);
  }},
  {name:'ланиста: вдова получает надбавку только за успешный заказ, один раз',fn(){
    const ctx=fixture('f2');
    const reward=ev(ctx, `const c={id:uid(),kind:'contract',title:'Проверка',gold:100,fame:3,
      artifact:'art_hector',cond:{type:'win',text:'Победить'}};
      META.contractResult(c,{win:true})`);
    assert.equal(reward.gold,115);assert.equal(reward.fame,3);
    assert.equal(ev(ctx, `const before=STATE.gold;META.contractResult(c,{win:true});
      STATE.gold===before&&STATE.armory.filter(it=>it.base==='art_hector').length===1`),true);
    const failed=ev(ctx, `META.contractResult({...c,id:uid(),done:false,result:null},{win:false})`);
    assert.equal(failed.gold,15);assert.equal(failed.fame,0);
  }},
  {name:'ланиста: матрона уменьшает прибавку крита, сохраняя обычный урон',fn(){
    const ctx=fixture('f3');
    assert.equal(ev(ctx, 'hit(p)'),20);
    assert.equal(ev(ctx, 'hit(p,true)'),25);
    assert.equal(ev(ctx, 'hit(enemy,true)'),30);
    assert.equal(ev(ctx, "b.event.kind='bet';hit(p,true)"),30);
  }},
];
