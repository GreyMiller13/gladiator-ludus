// Approved menu choreography. No STATE reads or writes.
(function () {
const canvas = document.querySelector('#menu canvas'), ctx = canvas.getContext('2d');
let cw=0,ch=0,dpr=1,time=0,last=0,lastImpact=-1,blood=[],bloodMarks=[],lastBloodTime=0,raf=0,resizePending=false;
function resize(){cw=innerWidth / uiZoom();ch=innerHeight / uiZoom();dpr=Math.min(devicePixelRatio||1,1.7);canvas.width=Math.round(cw*dpr);canvas.height=Math.round(ch*dpr);}
function drawArenaDaze(ctx, f, now) {
    if (!f.stunned || f.state !== 'idle') return;
    const s = f.scale, cy = f.topY + 4 * s;
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const a = now / 260 + i * Math.PI / 2;
      const x = f.x + Math.cos(a) * 20 * s, y = cy + Math.sin(a) * 6 * s;
      ctx.globalAlpha = 0.55 + Math.sin(a) * 0.35;
      ctx.fillStyle = '#f3e3a0';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 1.6 : 4.2; const b = k / 10 * Math.PI * 2; ctx.lineTo(x + Math.cos(b) * r * s, y + Math.sin(b) * r * s); }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
function drawArenaNet(ctx, n, now) {
    let x, y, r, alpha = 1;
    if (n.flying) {
      const p = clamp((now - n.t0) / n.dur, 0, 1);
      x = n.x0 + (n.x1 - n.x0) * p; y = n.y0 + (n.y1 - n.y0) * p - Math.sin(p * Math.PI) * 90;
      r = 10 + p * 26;
      if (p >= 1) { n.flying = false; n.t1 = now; n.resolve(); if (n.ok) { n.dead = true; return; } }
    } else {
      const p = (now - n.t1) / (n.miss ? 900 : 2200);
      if (p >= 1) { n.dead = true; return; }
      x = n.x1; y = n.gy; r = 30; alpha = 1 - p;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (!n.flying) ctx.scale(1, 0.3);
    else ctx.rotate(now / 120);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,100,70,.18)'; ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(220,200,155,.8)'; ctx.lineWidth = 1;
    for (let i = -r; i < r; i += 6) {
      ctx.beginPath(); ctx.moveTo(-r, i); ctx.lineTo(r, i + r * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r, i); ctx.lineTo(-r, i + r * 0.6); ctx.stroke();
    }
    ctx.restore();
  }
function plantFeet(p){
const original=skeleton(p);
for(const [k,x]of [['n',clamp(original.anN.x-original.hip.x,16,40)],['f',clamp(original.anF.x-original.hip.x,-40,-25)]]){
 const y=68,L1=BODY.thigh,L2=BODY.shin;
 const knee=Math.acos(clamp((x*x+y*y-L1*L1-L2*L2)/(2*L1*L2),-1,1));
 p[k+'U']=Math.atan2(x,y)+Math.atan2(L2*Math.sin(knee),L1+L2*Math.cos(knee))+(p.r||0);
 p[k+'K']=knee;p[k+'F']=0;
}return p;}
function pose(name,f,cls){return plantFeet(sampleClip(name,f,{...stancePose(cls),...GUARD}));}
function drawFrame(t){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
 const sc=clamp(cw/550,1.5,3.4),ground=ch*.77,cycle=t%8,special=t%32,roundStart=t-special;
 // Two exchanges of ground between attacks. Special moves keep both fighters stationary.
 const round=Math.floor(special/8),direction=round%2===0?1:-1;
 const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const travel=round<2?ease((cycle-2.1)/1.2)-ease((cycle-4.65)/1.05):0;
 const center=cw*.72+direction*Math.min(48,cw*.035)*travel;
 const walking=round<2&&((cycle>2.1&&cycle<3.3)||(cycle>4.65&&cycle<5.7));
 const caption=drawFrame.caption||(drawFrame.caption=document.querySelector('.arena-caption'));
 if(caption)caption.style.left=center+'px';
 let x1=center-sc*66,x2=center+sc*66;
 let p1=pose('guard',t*22%40,'murmillo'),p2=pose('guard',(t*22+10)%40,'retiarius');
 if(walking){
  const forward=(cycle<3.3?direction:-direction)>0;
  const step=(cls,advancing)=>{
   const guard={...stancePose(cls),...GUARD};
   const gait=sampleClip('run',(advancing?t*22:-t*22+10000)%20,guard);
   const p=plantFeet(lerpPose(guard,gait,.38));
   p.dx=0;return p;
  };
  p1=step('murmillo',forward);p2=step('retiarius',!forward);
 }
 let hit=false,victim=0,netted=false,stunned=false,noNet=false;
 const shieldScene=special>=17&&special<20.3,netScene=special>=25.5&&special<30;
 if(!shieldScene&&!netScene){
  if(cycle>1&&cycle<2){p1=pose('swing',(cycle-1)*18,'murmillo');p2=pose('parry',Math.max(0,(cycle-1-.2)*20),'retiarius');x1+=Math.sin((cycle-1)*Math.PI)*sc*14;hit=cycle>1.46&&cycle<1.6;}
  if(cycle>3.5&&cycle<4.5){p2=pose('thrust',(cycle-3.5)*16,'retiarius');const wound=Math.floor(t/8)%2===0;p1=pose(wound?'hit':'dodgeDuck',Math.min((cycle-3.5)*18,wound?CLIPS.hit.len:CLIPS.dodgeDuck.len),'murmillo');x2-=Math.sin((cycle-3.5)*Math.PI)*sc*10;hit=wound&&cycle>3.94&&cycle<4.08;victim=-1;}
  if(cycle>5.7&&cycle<6.7){p1=pose('thrust',(cycle-5.7)*16,'murmillo');p2=pose('hit',Math.min((cycle-5.7)*18,CLIPS.hit.len),'retiarius');hit=cycle>6.14&&cycle<6.28;victim=1;}
 }
 if(shieldScene){
  const dt=special-17;
  if(dt<1)p1=pose('bash',dt*16,'murmillo');
  x1+=Math.sin(Math.min(dt,1)*Math.PI)*sc*16;
  if(dt>.45&&dt<1.05)p2=plantFeet(lerpPose(pose('guard',t*22%40,'retiarius'),pose('hitHard',Math.min((dt-.45)*30,CLIPS.hitHard.len),'retiarius'),.65));
  if(dt>=1.05&&dt<2.7)p2=pose('stagger',((dt-1.05)*30)%32,'retiarius');
  stunned=dt>.52&&dt<2.7;hit=dt>.48&&dt<.64;
 }
 if(netScene){
  const dt=special-25.5;
  noNet=dt>.32;
  if(dt<1)p2=pose('throw',Math.min(dt*20,CLIPS.throw.len),'retiarius');
  if(dt>1.05&&dt<1.4)p1=pose('hit',Math.min((dt-1.05)*30,CLIPS.hit.len),'murmillo');
  netted=dt>=1.1&&dt<3.7;
  if(netted)p1=pose('struggle',((dt-1.1)*25)%24,'murmillo');
  if(dt>=3.7){const free=pose('guard',t*22%40,'murmillo');p1=plantFeet(lerpPose(pose('struggle',23,'murmillo'),free,clamp((dt-3.7)/.6,0,1)));}
 }
 for(const x of [x1,x2]){ctx.fillStyle='#21160b55';ctx.beginPath();ctx.ellipse(x,ground,sc*42,sc*8,0,0,Math.PI*2);ctx.fill();}
 const right=drawFigure(ctx,SHELL_ART.fighters[1],p2,x2,ground,{scale:sc,facing:-1,noNet,sway:{plume:Math.sin(t*2)*.09,cloth:Math.sin(t*2)*.1}});
 drawFigure(ctx,SHELL_ART.fighters[0],p1,x1,ground,{scale:sc,facing:1,netted,sway:{plume:Math.sin(t*2)*.09,cloth:Math.sin(t*2)*.1}});
 if(stunned)drawArenaDaze(ctx,{stunned:true,state:'idle',scale:sc,topY:right.topY,x:x2},t*1000);
 if(special>=26&&special<26.6){ctx.save();ctx.scale(sc,sc);drawArenaNet(ctx,{flying:true,x0:x2/sc-25,y0:ground/sc-116,x1:x1/sc,y1:ground/sc-103,t0:(roundStart+26)*1000,dur:600,resolve:()=>{},ok:true},t*1000);ctx.restore();}
 if(special>=29.2&&special<31.4){ctx.save();ctx.scale(sc,sc);drawArenaNet(ctx,{flying:false,x1:x1/sc-25,gy:ground/sc+2,t1:(roundStart+29.2)*1000},t*1000);ctx.restore();}
 if(hit){
  const x=(x1+x2)/2,y=ground-sc*110;ctx.strokeStyle='#ffe1a1';ctx.lineWidth=2;
  for(let i=0;i<9;i++){const a=i*.73+t*2;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*5,y+Math.sin(a)*5);ctx.lineTo(x+Math.cos(a)*sc*14,y+Math.sin(a)*sc*14);ctx.stroke();}
  const impact=Math.floor(t*2);if(impact!==lastImpact){lastImpact=impact;sfx('hit', {vol: .12});if(victim&&t-lastBloodTime>1.5){lastBloodTime=t;spawnBlood(center+victim*sc*29,ground-sc*112,sc,t);}}
 }
 paintBlood(t,ground);
}

function spawnBlood(x,y,sc,t){
 for(let i=0;i<22;i++){const angle=-2.5+Math.random()*3.3,speed=sc*(30+Math.random()*70);blood.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,t,r:sc*(.8+Math.random()*1.5)});}
}
function paintBlood(t,ground){
 for(const p of blood){const dt=t-p.t,x=p.x+p.vx*dt,y=p.y+p.vy*dt+185*dt*dt;if(y>=ground){bloodMarks.push({x,y:ground+Math.random()*6,t,r:p.r});p.landed=true;continue;}ctx.fillStyle=dt<.15?'#bc3028':'#871b18';ctx.beginPath();ctx.ellipse(x,y,p.r,p.r*.65,.5,0,Math.PI*2);ctx.fill();}
 blood=blood.filter(p=>!p.landed&&t-p.t<2);bloodMarks=bloodMarks.filter(p=>t-p.t<12).slice(-90);
 for(const p of bloodMarks){ctx.fillStyle=`rgba(110,18,14,${Math.max(0,.6*(1-(t-p.t)/12))})`;ctx.beginPath();ctx.ellipse(p.x,p.y,p.r*2,p.r*.45,0,0,Math.PI*2);ctx.fill();}
}

function stop(){
 if(raf)cancelAnimationFrame(raf);
 raf=0;last=0;
}
function frame(now){
 raf=0;
 if(!MENU.open||document.hidden){last=0;return;}
 // Размер читается после обработчиков resize, когда масштаб уже обновлён.
 if(resizePending){resize();resizePending=false;}
 const motion=menuMotionEnabled();
 if(motion)time+=Math.min((now-(last||now))/1000,.05);
 drawFrame(time);
 last=motion?now:0;
 // Статичному меню достаточно одного кадра по запросу.
 if(motion)raf=requestAnimationFrame(frame);
}
paintMenuBg=function(){
 stop();
 if(!MENU.open||document.hidden)return;
 resizePending=true;raf=requestAnimationFrame(frame);
};
MENU.stopScene=stop;
addEventListener('resize',()=>{if(MENU.open)paintMenuBg();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)stop();
 else if(MENU.open)paintMenuBg();
});
})();
