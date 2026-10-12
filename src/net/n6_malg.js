/* ---- PART 58: n6_malg.js ---- */
/* Malgorath, together. The host's screen runs the fight (one boss, one RNG, one rulebook); every guest near the Bite gets a live
   mirror of him (his body and rig state, his drawings, his adds, his eye, his sounds, his bar) and a seat at the table: guests
   are targets he picks, chomps, throws, pulls and spits like anyone else, and their hits on him count like the host's.
   PART 57 is frozen, so nothing in it changes: the hooks below wrap a few of its top-level functions from the outside (this
   file loads before it; function declarations are hoisted, so the wrappers are in place before PART 57's top level captures
   them), and every wrapper is a straight pass-through unless a link is open. A build without PART 57 skips them all. */

function netMgHas(){return typeof MGREG!=='undefined'&&typeof mgSpawnBoss==='function'&&typeof MGF!=='undefined';}

/* ----- the host: guests as targets. One stable adapter per guest, shaped like an AI player ({name, e, hp, dead, online}) ----- */
function netMgAdapter(p){
  let a=NET.mgA.get(p.id);
  if(!a){a={netg:p.id,name:p.name,online:true,dim:'over',hp:20,dead:false,e:null,inv:[null],sel:0};NET.mgA.set(p.id,a);}
  a.name=p.name;a.e=p.body;a.hp=p.pose&&p.pose.hp!=null?+p.pose.hp:20;a.dead=!!(p.pose&&p.pose.dead)||!p.body||!!p.body.dead;
  if(a.e){a.x=a.e.x;a.y=a.e.y;a.z=a.e.z;}
  return a;
}
function netMgGuests(){
  const out=[];if(!netHost()||DIM!=='over')return out;
  for(const p of NET.peers.values()){if(!p.ready||!p.body||p.body.dead||!p.pose||p.pose.d!=='over')continue;out.push(netMgAdapter(p));}
  return out;
}
function netMgWho(name){
  if(!name||!netHost())return null;
  for(const p of NET.peers.values())if(p.ready&&p.name===name&&p.body&&!p.body.dead&&p.pose&&p.pose.d==='over')return netMgAdapter(p);
  return null;
}
function netMgPeer(a){return a&&a.netg?NET.peers.get(a.netg)||null:null;}
function netMgSend(a,msg){const p=netMgPeer(a);if(p&&p.tr)netSendTr(p.tr,msg);}
/* his hits, his true damage, his chomps (a guest is chomped and spat out, like the host), his throws, his bone pile, his heal */
function netMgHit(t,n,p,how,opt){
  opt=opt||{};if(!mg2Alive(t)||(CUT.on&&CUT.script))return 0;
  const id=mg2TId(t),now=mg2Now();
  if(opt.atk){const g=MG2.grace[id];if(g!=null&&g>now)return 0;
    const li=MG2.imp[id];if(li&&(now-li.t<0.5||(li.big&&now-li.t<0.8)))return 0;}
  const pp=p==null?MG_K.PIERCE:p;n=+n||0;if(!(n>0))return 0;
  netMgSend(t,{t:'mgd',n:+n.toFixed(2),p:+(+pp).toFixed(2),how:how||'hit',kx:opt.kx!=null?+(+opt.kx).toFixed(2):null,kz:opt.kz!=null?+(+opt.kz).toFixed(2):null,
    f:(opt.tick||opt.atk)?1:0,tk:opt.tick?1:0});
  if(opt.atk&&!opt.tick)MG2.imp[id]={t:now,big:n>=12};
  MGT.events.push('hit:'+id+':'+(how||'hit')+':'+n.toFixed(1));if(MGT.events.length>64)MGT.events.shift();
  return n;
}
function netMgTrue(t,n,how){if(!mg2Alive(t)||(CUT.on&&CUT.script))return 0;netMgSend(t,{t:'mgd',n:+(+n).toFixed(2),how:how||'hit',tr:1});return n;}
function netMgEat(a,why){
  if(!mg2Alive(a)||(CUT.on&&CUT.script))return;
  const sup=why==='supper',land=mg2Land(MGC.X+mg2Rng(-16,16),MGC.Z+mg2Rng(-16,16),{});
  netMgSend(a,{t:'mge',why:why||'chomp',n:sup?999:MG_K.CHOMP,to:[+land.x.toFixed(2),+(land.y+0.3).toFixed(2),+land.z.toFixed(2)]});
  MGT.chomps++;mg2Grace(a,2);mg2S('mg_gulp');
}
function netMgThrowOut(t,x1,z1,dur,apex,o){
  o=o||{};if(!mg2Alive(t))return;
  netMgSend(t,{t:'mgk',x1:+x1.toFixed(2),z1:+z1.toFixed(2),y1:+(o.y1==null?mgF():o.y1).toFixed(2),d:+Math.max(0.15,dur).toFixed(3),a:+(apex||1).toFixed(2),nf:o.noFall?1:0});
}
function netMgTp(a,x,y,z){netMgSend(a,{t:'mgt',p:[+x.toFixed(2),+y.toFixed(2),+z.toFixed(2)]});}

/* ----- the host: what the guests see, ten times a second, to every guest within his 220 m ----- */
function netMgFx(r){if(!NET.on||!netHost()||!netMgHas()||!MGF.near)return;NET.mgFx.push(r);if(NET.mgFx.length>48)NET.mgFx.shift();}
function netMgNum(v){return typeof v==='number'&&isFinite(v)?+v.toFixed(3):v;}
function netMgTelOut(t){const o={};for(const k in t){const v=t[k];if(typeof v==='number'&&isFinite(v))o[k]=+v.toFixed(3);else if(typeof v==='string')o[k]=v;}return o;}
function netMgOut(){
  if(!netMgHas()||DIM!=='over'||!MGF.near){NET.mgFx.length=0;return;}
  const R2=MGC.R_ARM*MGC.R_ARM,to=[];
  for(const p of NET.peers.values()){if(!p.ready||!p.pose||p.pose.d!=='over')continue;const dx=p.pose.x-MGC.X,dz=p.pose.z-MGC.Z;if(dx*dx+dz*dz<=R2)to.push(p);}
  if(!to.length){NET.mgFx.length=0;return;}
  const b=MGF.boss&&!MGF.boss.dead?MGF.boss:null,r2=v=>+(+v||0).toFixed(2);
  const pl=NET.mgPull&&MGF.clock-NET.mgPull[4]<0.25?NET.mgPull.slice(0,4):0;
  const msg={t:'mg',c:+MGF.clock.toFixed(3),lv:MGF.live?1:0,r:MALG.round|0,fr:MGF.round|0,ph:MGF.phase||'',met:MALG.met?1:0,dd:DEMON.dead?1:0,
    hat:MALG.hat||null,hd:MALG.heads|0,
    b:b?[netNid(b),r2(b.x),r2(b.y),r2(b.z),+(b.yaw||0).toFixed(3),Math.round(b.hp*10)/10,r2(b.hw),r2(b.h)]:0,
    A:MGA,L:{live:MGL.live,round:MGL.round,phase:MGL.phase,flash:netMgNum(MGL.flash),pulse:netMgNum(MGL.pulse),eclipse:netMgNum(MGL.eclipse),
      dawn:netMgNum(MGL.dawn),dark:netMgNum(MGL.dark),edge:netMgNum(MGL.edge),heart:netMgNum(MGL.heart),light:MGL.light},
    tl:MGT.tel.map(netMgTelOut),fx:NET.mgFx.splice(0),pl};
  for(const p of to)netSendTr(p.tr,msg);
}
/* his parts, his eye and his adds ride the ordinary entity stream (n3 netEntsOut): one row each */
function netMgRow(e){
  const r=[netNid(e),e.mt,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+(e.yaw||0).toFixed(2),Math.round(e.hp>1e6?999:e.hp),+(e.hw||0).toFixed(2),+(e.h||0).toFixed(2),e.hurtT>0.3?1:0,0];
  if(e.mt==='mgeye')r[10]=[e.mgShut?1:0,e.mgBlood?1:0,+(e.mgPupil||0).toFixed(2),e.mgBlink?1:0,e.poked==null?-1:+(+e.poked).toFixed(3)];
  else if(e.mt==='mgpart')r[10]=e.kind||'';
  else r[10]=+(e.fuse||0).toFixed(2);
  return r;
}

/* ----- a guest: the mirror ----- */
function netMgIn(m){
  m.at=NET.clock();NET.mg=m;
  if(!netMgHas()||DIM!=='over'||!P||!NET.mgOn)return;
  for(const f of (m.fx||[]))try{netMgFxPlay(f);}catch(err){}
}
function netMgFxPlay(f){
  const near=MGF.d<MGC.R_GRADE;
  if(f[0]==='s'){if(typeof f[2]==='number')playSAt(f[1],f[2],f[3],f[4]);else if(MGF.d<MGC.R_BAR)playS(f[1]);}
  else if(f[0]==='k'){if(near)nukeShake(+f[1]*(MGF.d<MGC.R_BAR?1:0.5),+f[2]);}
  else if(f[0]==='b'){if(near)mg2Burst(f[1],+f[2],+f[3],+f[4],f[5]||{});}
  else if(f[0]==='y'){if(MGF.d<MGC.R_GRADE&&typeof cutSay==='function')cutSay('MALGORATH',''+f[1],+f[2]||2.6);}
}
/* replaces tickMalg on a guest: his fight is never run here, only shown */
function netMgMirror(dt){
  if(!netMgHas()||!P)return;
  const S=NET.mg,dx=P.x-MGC.X,dz=P.z-MGC.Z;
  const live=!!S&&NET.clock()-S.at<2500&&netPuppetMobs()&&DIM==='over'&&dx*dx+dz*dz<=MGC.R_ARM*MGC.R_ARM;
  if(!live){netMgDrop();return;}
  NET.mgOn=1;
  if(!MGF.near){MGF.near=1;mgEmit('onNear');}
  MGF.d=Math.hypot(dx,dz);MGF.band=mgBand(P.y)?1:0;MGL.near=1;MGP_ON=false;
  MGF.clock=S.c+(NET.clock()-S.at)/1000;MGT.clock=MGF.clock;
  if(NET.mgSeen!==S){NET.mgSeen=S;netMgState(S);}
  MGL.w=Math.max(0,Math.min(1,(MGC.R_GRADE-MGF.d)/100));
  const e=MGF.boss;
  if(e&&!e.dead){const rig=e.mgRig;if(rig&&rig.update)try{rig.update(dt,MGA);}catch(err){mgFail('net-rig',err);}}
  netMgThrowStep(dt);netMgPull(dt,S);
  mgEmit('tick',dt);
  if(typeof mg2Hud==='function')try{mg2Hud(dt);}catch(err){}
}
function netMgState(S){
  const relay=MALG.round!==(S.r|0)||!!MALG.met!==!!S.met||!!DEMON.dead!==!!S.dd;
  MALG.round=Math.max(1,S.r|0);MALG.met=S.met?1:0;MALG.dead=S.dd?1:0;MALG.hat=S.hat||null;MALG.heads=S.hd|0;DEMON.dead=!!S.dd;
  if(relay&&typeof MG1!=='undefined'&&typeof mg1Want==='function'){MG1.geo=null;MG1.L=mg1Want();}   /* new chunks stamp the layout he is in */
  MGF.live=S.lv?1:0;MGF.round=S.fr|0;MGF.phase=S.ph||'';
  if(S.A&&typeof S.A==='object')for(const k in S.A)MGA[k]=S.A[k];
  if(S.L&&typeof S.L==='object')Object.assign(MGL,S.L);
  /* his body: made the one way he is ever made (mgSpawnBoss, from tickMalg's seat), then a puppet the stream moves */
  let e=MGF.boss&&!MGF.boss.dead?MGF.boss:null;
  if(S.b){
    const [nid,x,y,z,yaw,hp,hw,h]=S.b;
    if(e&&(e.nid!==nid||(e.round|0)!==(S.fr||S.r))){removeEnt(e);MGF.boss=null;e=null;}
    if(!e){e=mgSpawnBoss(S.fr||S.r);e.np=1;e.nid=nid;e.x=x;e.y=y;e.z=z;e.yaw=yaw;e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;if(e.mesh)e.mesh.position.set(x,y,z);}
    e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;e.hp=hp;e.hw=hw;e.h=h;e.mgBar=1;
  }else if(e){removeEnt(e);MGF.boss=null;}
  /* his drawings: the host's ids map to ours */
  const seen=new Set();
  for(const o of (S.tl||[])){if(o==null||o.id==null)continue;seen.add(o.id);
    const p=Object.assign({},o);delete p.id;let hd=NET.mgTel.get(o.id);
    if(!hd){hd=mgDraw(o.kind,p);NET.mgTel.set(o.id,hd);}
    else{if(o.locked&&!hd.t.locked)hd.lock();hd.set(p);}}
  for(const [id,hd] of NET.mgTel)if(!seen.has(id)){try{hd.free();}catch(err){}NET.mgTel.delete(id);}
}
function netMgDrop(){
  NET.mgThrow=null;
  if(!NET.mgOn)return;NET.mgOn=0;NET.mgSeen=null;
  if(!netMgHas())return;
  for(const hd of NET.mgTel.values())try{hd.free();}catch(err){}NET.mgTel.clear();
  if(MGF.boss&&!MGF.boss.dead)removeEnt(MGF.boss);MGF.boss=null;
  MGF.live=0;MGL.live=0;MGL.flash=0;MGL.eclipse=0;MGL.dark=0;MGL.dawn=0;MGL.w=0;
  if(MGF.near)mgFar();
  if(typeof mg2HudHide==='function')try{mg2HudHide();}catch(err){}
}
/* a throw, a knock, a spit: the host picks the landing, this screen flies the arc (mg2StepThrows' maths) */
function netMgThrowStep(dt){
  const q=NET.mgThrow;if(!q)return;if(P.dead){NET.mgThrow=null;return;}
  q.k=Math.min(1,q.k+dt/q.dur);const k=q.k;
  P.x=q.x0+(q.x1-q.x0)*k;P.z=q.z0+(q.z1-q.z0)*k;P.y=q.y0+(q.y1-q.y0)*k+4*q.apex*k*(1-k);
  P.vx=0;P.vy=0;P.vz=0;P.fallD=0;P.onGround=false;
  if(k>=1){P.y=q.y1+0.02;P.vy=-2;NET.mgThrow=null;}
}
/* the inhale and the last supper: the pull is felt here, the swallow is decided there */
function netMgPull(dt,S){
  const pl=S.pl;if(!pl||NET.clock()-S.at>300||P.dead||P.mode==='c'||NET.mgThrow)return;
  const z=mgZone(P.x,P.y,P.z);if(z!=='arena'&&z!=='gut'&&z!=='void')return;
  const K=typeof MG2K!=='undefined'?MG2K.R3:{AIR:1.6,SNEAK:0.5,COVER:0.25};
  const [v,sup,mx,mz]=pl,dx=mx-P.x,dz=mz-P.z,d=Math.hypot(dx,dz)||1;let s=+v||0;
  if(!sup){if(!P.onGround)s*=K.AIR;if(P.sneak)s*=K.SNEAK;if(typeof mg2Covered==='function'&&mg2Covered(P))s*=K.COVER;}else if(!P.onGround)s*=K.AIR;
  moveBody(P,dx/d*s*dt,0,dz/d*s*dt,false);
}
/* what the host sends this guest */
function netMgDmgIn(m){
  if(!P||P.dead||P.mode==='c'||GR.god)return;
  const n=Math.min(+m.n||0,999);if(!(n>0))return;
  LASTDMG={by:'Malgorath',how:'mg:'+(m.how||'hit'),t:AG_T};
  if(m.tr){const s=P.hurtT;P.hurtT=0;P.hp-=n;hurtFlash=Math.max(hurtFlash,0.25);playS('hurt');if(P.hp<=0){P.hp=0;die();}else P.hurtT=s;drawStats();return;}
  const A=Math.min(0.8,armorPts()*0.04),pp=m.p==null?0.4:+m.p,eff=n*(1-A*(1-pp)),pre=A<1?eff/(1-A):eff;
  const s=P.hurtT;if(m.f)P.hurtT=0;
  if(m.kx!=null)damagePlayer(pre,+m.kx,+m.kz);else damagePlayer(pre);
  if(m.tk&&!P.dead)P.hurtT=s;
}
function netMgEatIn(m){
  if(!P||P.dead)return;
  NET.mgThrow=null;
  showToast(m.why==='supper'?'MALGORATH ATE YOU. All of you. Clean plate.':'MALGORATH ATE YOU. You tasted wrong, so he spat you back out.');
  playS('mg_chomp');hurtFlash=0.6;
  if(P.mode!=='c'&&!GR.god){LASTDMG={by:'Malgorath',how:'mg:'+(m.why==='supper'?'supper':'chomp'),t:AG_T};
    const s=P.hurtT;P.hurtT=0;P.hp-=Math.min(+m.n||10,999);if(P.hp<=0){P.hp=0;die();drawStats();return;}P.hurtT=Math.max(s,1.0);drawStats();}
  const to=m.to;if(Array.isArray(to)&&to.length===3){P.x=+to[0];P.y=+to[1];P.z=+to[2];P.vx=P.vy=P.vz=0;P.fallD=0;}
  if(typeof nukeShake==='function')nukeShake(0.6,0.4);
}
function netMgThrowIn(m){
  if(!P||P.dead)return;
  NET.mgThrow={x0:P.x,y0:P.y,z0:P.z,x1:+m.x1,y1:+m.y1,z1:+m.z1,dur:Math.max(0.15,+m.d||0.3),apex:+m.a||1,k:0};
}
function netMgTpIn(m){if(!P||P.dead||!Array.isArray(m.p))return;NET.mgThrow=null;P.x=+m.p[0];P.y=+m.p[1];P.z=+m.p[2];P.vx=P.vy=P.vz=0;P.fallD=0;}
function netMgWinIn(m){
  if(!P)return;
  if(P.own&&!P.own.includes('hat_horns'))P.own.push('hat_horns');
  showToast('MALGORATH IS DEAD. You were there. The DEMON HORNS are yours too (DINGLE STORE).');
}
/* a guest: his parts, eye and adds from the stream (n3 netEntsIn hands the g rows here) */
function netMgEntsIn(rows,seen){
  if(!netMgHas())return;
  for(const r of rows){
    if(!Array.isArray(r)||r.length<11)continue;
    const [nid,mt,x,y,z,yaw,hp,hw,h,hurt,ex]=r,key='g'+nid;seen.add(key);
    let e=NET.pup.get(key);
    if(e&&(e.dead||e.mt!==mt)){if(!e.dead)removeEnt(e);NET.pup.delete(key);e=null;}
    if(!e){
      if(!MOBT[mt]||!MOBT[mt].mg||mt==='demon')continue;
      const G=new THREE.Group(),mats=[];let body=null;
      if(mt!=='mgpart')try{body=mgMobMesh(mt,G,mats,mt==='mgeye'?{hr:1}:{});}catch(err){mgFail('net-body',err);}
      const c=mgEnt(mt,x,y,z,(body&&body.G)||G,{mats:(body&&body.mats)||mats,legs:(body&&body.legs)||[],mgBody:body,mgNoBot:1,hp});
      c.mesh.position.set(x,y,z);scene.add(c.mesh);entities.push(c);e=netPupAdopt(key,c,nid);e.yaw=yaw;
    }
    e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;e.hp=hp;e.hw=hw;e.h=h;
    if(hurt&&e.hurtT<=0.2){e.hurtT=0.4;for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0.45,0,0);}
    if(mt==='mgeye'&&Array.isArray(ex)){e.mgShut=ex[0];e.mgBlood=ex[1];e.mgPupil=ex[2];e.mgBlink=ex[3];e.poked=ex[4]<0?null:ex[4];e.mgLook=[P.x,P.y+P.eyeY,P.z];}
    else if(mt==='mgpart')e.kind=ex;
    else e.fuse=+ex||0;
  }
}

/* ----- the wrappers. Each is the original unless a link is open (and, for the guest-side ones, unless this screen is a guest) ----- */
if(typeof mg2Bots==='function'){const o=mg2Bots;mg2Bots=function(){const out=o();if(NET.on&&netHost())for(const a of netMgGuests())out.push(a);return out;};}
if(typeof mg2Who==='function'){const o=mg2Who;mg2Who=function(){const w=o();if(w||!NET.on)return w;const a=netMgWho(HIT_BY);
  return a&&a.e?{k:'dan',id:a.name,x:a.e.x,y:a.e.y,z:a.e.z,t:a}:null;};}           /* a friend's hit counts like the host's */
if(typeof mg2Hit==='function'){const o=mg2Hit;mg2Hit=function(t,n,p,how,opt){if(t&&t.netg)return netMgHit(t,n,p,how,opt);return o(t,n,p,how,opt);};}
if(typeof mg2True==='function'){const o=mg2True;mg2True=function(t,n,how){if(t&&t.netg)return netMgTrue(t,n,how);return o(t,n,how);};}
if(typeof mg2Swallow==='function'){const o=mg2Swallow;mg2Swallow=function(a,why){if(a&&a.netg)return netMgEat(a,why);return o(a,why);};}
if(typeof mg2Throw==='function'){const o=mg2Throw;mg2Throw=function(t,x1,z1,dur,apex,opt){if(t&&t.netg)return netMgThrowOut(t,x1,z1,dur,apex,opt);return o(t,x1,z1,dur,apex,opt);};}
if(typeof mg2BotToPile==='function'){const o=mg2BotToPile;mg2BotToPile=function(a){if(a&&a.netg){const b=mgBonePile();netMgTp(a,b.x,b.y+0.4,b.z);return;}return o(a);};}
if(typeof mg2HealAll==='function'){const o=mg2HealAll;mg2HealAll=function(){o();if(NET.on&&netHost())for(const a of netMgGuests())netMgSend(a,{t:'mgh'});};}
if(typeof mg2Away==='function'){const o=mg2Away;mg2Away=function(dt){                 /* a friend on his plate keeps him awake */
  if(NET.on&&netHost()&&netMgGuests().some(a=>mg2InPlay(a))){MG2.away=0;return;}return o(dt);};}
if(typeof mg2PayKeys==='function'){const o=mg2PayKeys;mg2PayKeys=function(){const first=!MALG.jaw;o();if(!NET.on||!netHost())return;
  for(const a of netMgGuests()){if(!a.e||!mgSite(a.e.x,a.e.y,a.e.z))continue;const p=netMgPeer(a);if(!p)continue;
    if(first)netSendTr(p.tr,{t:'gv',st:{id:MGC.JAW,count:1}});netSendTr(p.tr,{t:'mgw'});}};}
if(typeof mg2R3Pull==='function'){const o=mg2R3Pull;mg2R3Pull=function(v,dt,sup){
  if(NET.on&&netHost())try{const m=mg2R3Mouth();NET.mgPull=[+(+v).toFixed(2),sup?1:0,+m.x.toFixed(2),+m.z.toFixed(2),MGF.clock];}catch(err){}
  return o(v,dt,sup);};}
if(typeof mg2S==='function'){const o=mg2S;mg2S=function(n,x,y,z){if(NET.on)netMgFx(typeof x==='number'?['s',n,+x.toFixed(1),+y.toFixed(1),+z.toFixed(1)]:['s',n]);return o(n,x,y,z);};}
if(typeof mg2Shake==='function'){const o=mg2Shake;mg2Shake=function(m,d){if(NET.on)netMgFx(['k',+m||0,+d||0]);return o(m,d);};}
if(typeof mg2Burst==='function'){const o=mg2Burst;mg2Burst=function(kind,x,y,z,opt){
  if(NET.on){const q=opt||{};netMgFx(['b',kind,+(+x).toFixed(1),+(+y).toFixed(1),+(+z).toFixed(1),{id:q.id,n:q.n,pw:q.pw}]);}return o(kind,x,y,z,opt);};}
if(typeof mg2Say==='function'){const o=mg2Say;mg2Say=function(t,dur){if(NET.on)netMgFx(['y',''+t,+dur||2.6]);return o(t,dur);};}
if(typeof mg1Poke==='function'){const o=mg1Poke;mg1Poke=function(e,dmg,by,how){          /* a friend can poke the eye awake too */
  const g=by!=='Dan'&&NET.on?netMgWho(by):null;if(!g)return o(e,dmg,by,how);
  const E=MG1.eye,now=MGF.clock,b=g.e;
  if(!(dmg>0)||!b||g.dead||DIM!=='over'||DEMON.dead||MALG.met||MGF.live||!mgArena(b.x,b.y,b.z))return false;
  if(E.shut>0)return false;
  if(E.n>=1&&now-E.p1<=MG_K.M1_POKE_WIN){E.n=0;E.p1=-99;MG1.pokes=(MG1.pokes||0)+1;return mg1Wake('poke');}
  E.n=1;E.p1=now;E.shut=MG_K.M1_SHUT;E.blood=60;E.clack=now;E.ring=2;MG1.pokes=(MG1.pokes||0)+1;e.poked=now;
  nukeShake(0.3,0.4);playSAt('thud',MGC.X,mgF(),MGC.Z);if(typeof cutSay==='function')cutSay('MALGORATH','...Don\'t.',2.5);
  return true;};}
if(typeof tickMalg==='function'){const o=tickMalg;tickMalg=function(dt){if(NET.on&&netClient()){netMgMirror(dt);return;}return o(dt);};}
if(typeof mgAbandon==='function'){const o=mgAbandon;mgAbandon=function(why){if(NET.on&&netClient())return;return o(why);};}
if(typeof mgOnDie==='function'){const o=mgOnDie;mgOnDie=function(){if(NET.on&&netClient())return false;return o();};}
if(typeof mgOnRespawn==='function'){const o=mgOnRespawn;mgOnRespawn=function(){if(NET.on&&netClient())return;return o();};}
Object.assign(NTEX,{netMgGuests,netMgWho,netMgOut,netMgIn,netMgMirror,netMgDrop,netMgRow,netMgEntsIn,netMgDmgIn,netMgEatIn,netMgThrowIn,netMgHas});
