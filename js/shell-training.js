// Visual arrangement from the approved mock; uses js/training.js.
const trainingCourtyard = new Image();
trainingCourtyard.onload = () => {
  TRAIN.backKey = '';
  const cv = document.querySelector('main canvas.ludus-bg');
  if (cv && STATE) paintLudusHero();
};
trainingCourtyard.src = 'assets/shell/courtyard.jpg';
// Private school courtyard; animated trainees are drawn separately.
function trainBack(tier, W, H) {
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d');
  ctx.fillStyle = '#9b885d'; ctx.fillRect(0, 0, W, H);
  if (trainingCourtyard.complete && trainingCourtyard.naturalWidth) {
    const iw = trainingCourtyard.naturalWidth, ih = trainingCourtyard.naturalHeight;
    // One proportional image; never squash the portico or baked-in decorations.
    const scale=Math.max(W/iw,H/ih),dw=iw*scale,dh=ih*scale;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(trainingCourtyard,(W-dw)/2,(H-dh)/2,dw,dh);
  }
  return off;
}
function plantTrainingFeet(pose,base){
 const p={...pose},rest=skeleton(base),hip=skeleton(p).hip;
 const anchors={n:clamp(rest.anN.x,16,40),f:clamp(rest.anF.x,-40,-25)};
 const x={n:clamp(anchors.n-hip.x,-50,50),f:clamp(anchors.f-hip.x,-50,50)};
 const L1=BODY.thigh,L2=BODY.shin,maxX=Math.max(Math.abs(x.n),Math.abs(x.f));
 const y=Math.min(68,Math.sqrt(Math.max(1,(L1+L2-.5)**2-maxX**2))),r=p.r||0;
 for(const k of ['n','f']){
  const knee=Math.acos(clamp((x[k]**2+y*y-L1*L1-L2*L2)/(2*L1*L2),-1,1));
  p[k+'U']=Math.atan2(x[k],y)+Math.atan2(L2*Math.sin(knee),L1+L2*Math.cos(knee))+r;
  p[k+'K']=knee;p[k+'F']=Math.abs(r)>.3?r:0;
 }
 return p;
}



const sourceTrainingPose=trainPose;
trainPose=function(u){const p=sourceTrainingPose(u);return u.sit?p:plantTrainingFeet(p,u.base);};

trainingPlan=function(glads){
 const shown=[...glads].sort((a,b)=>combatPower(b)-combatPower(a));
 const rest=shown.filter(g=>g.wounded>0),fit=shown.filter(g=>!g.wounded),range=fit.filter(isArcher),melee=fit.filter(g=>!isArcher(g)),pairs=[];
 for(let i=0;i+1<melee.length;i+=2)pairs.push([melee[i],melee[i+1]]);
 return {rest,pairs,dummy:melee.length%2?melee.at(-1):null,range};
};function courtyardWallHeight(W){return Math.round(Math.min(125,W*.12));}
function courtyardStations(groups,W){
 const k=W<1050?Math.min(.9,(W-24)/Math.max(1,Math.min(2,Math.floor((W-24)/160)))/280):Math.min(1.05,Math.max(.78,W/1120));
 return {k,height:400};
}
trainLayout=function(S,W,H){
 const {k}=courtyardStations(S.groups,W);S.k=k;
 const rest=S.groups.filter(g=>g.kind==='rest'),range=S.groups.filter(g=>g.kind==='range'),melee=S.groups.filter(g=>!['rest','range'].includes(g.kind));
 const set=(g,cx,y)=>{
  for(const u of [g.a,g.b].filter(Boolean))Object.assign(u,{x:cx,y,s:.95*k,facing:1});
  if(g.kind==='pair'){g.a.x=cx-76*k;g.b.x=cx+76*k;g.b.facing=-1;}
  if(g.kind==='dummy'){g.a.x=cx-65*k;g.d.x=cx+65*k;}
  if(g.kind==='range'){g.a.x=cx-84*k;Object.assign(g.tg,{x:cx+92*k,y,s:k});g.depth=y;}
 };
 // Independent rows for the infirmary, sparring area and archery lanes.
 const place=(items,left,right,width)=>{
  const cols=Math.max(1,Math.min(Math.ceil(items.length/2),Math.floor((right-left)/(width*k))));
  const rows=Math.ceil(items.length/cols);
  const back=Math.max(H*.60,195*k),front=H-16;
  items.forEach((g,i)=>{
   const row=Math.floor(i/cols),count=Math.min(cols,items.length-row*cols);
   const cell=(right-left)/cols;
   const spare=Math.max(0,cell-width*k);
   const stagger=rows>1?(row%2?1:-1)*spare*.45:0;
   const cx=left+(cols-count)*cell/2+(i%cols+.5)*cell+stagger;
   set(g,cx,rows===1?(g.kind==='rest'?H*.77:H*.84):back+(front-back)*row/(rows-1));
  });
 };
 const restRight=rest.length?Math.max(125*k,W*.17):16;
 const rangeLeft=range.length?Math.max(restRight+150*k,W-285*k):W-16;
 place(rest,12,restRight,110);
 // Sparring starts at the centre, regardless of how many side stations exist.
 const meleeCols=range.length>1?1:Math.max(1,Math.min(2,Math.floor(W*.48/(260*k))));
 const meleeRows=Math.ceil(melee.length/meleeCols);
 melee.forEach((g,i)=>{
  const row=Math.floor(i/meleeCols),count=Math.min(meleeCols,melee.length-row*meleeCols);
  const y=meleeRows===1?H*.81:Math.max(H*.60,195*k)+(H-16-Math.max(H*.60,195*k))*row/(meleeRows-1);
  const shift=count===1&&meleeRows>1?(row%2?1:-1)*Math.min(W*.06,60):0;
  set(g,W*(range.length>1?.43:.50)+(i%meleeCols-(count-1)/2)*270*k+shift,y);
 });
 // Follow the right colonnade diagonally, with a full shooting lane to each target.
 range.forEach((g,i)=>{
  const t=range.length===1?.5:i/(range.length-1);
  const back=Math.max(H*.60,195*k),front=H-16;
  const y=range.length===1?H*.84:back+(front-back)*t;
  const targetX=W-(200-165*t)*k;
  const shooterX=targetX-270*k;
  set(g,(shooterX+targetX)/2,y);
  g.a.x=shooterX;g.tg.x=targetX;
 });
};

