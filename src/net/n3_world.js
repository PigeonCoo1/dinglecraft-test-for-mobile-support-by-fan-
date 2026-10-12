/* ---- PART 58: n3_world.js ---- */
/* the shared world: blocks, containers, bodies, the host's mobs and drops, explosions, and the per-frame tick */

/* ----- blocks: setBlock (p03c) calls netEditOut for every change that did not come off the wire ----- */
function netEditOut(x,y,z,id){if(NET.on)NET.edits.push([dimPfx(),x,y,z,id]);}
function netApplyEdit(pf,x,y,z,id){
  pf=pf||'';x|=0;y|=0;z|=0;id|=0;
  if(y<0||y>=WH||(id!==0&&!DEFS[id]))return;
  const cx=Math.floor(x/CH),cz=Math.floor(z/CH),k=pf+cx+','+cz;
  if(pf===dimPfx()&&chunks.has(k)){NET.applying++;try{setBlock(x,y,z,id);}finally{NET.applying--;}return;}
  /* a chunk this screen has not built (or another dimension): straight into its saved edits, so it is right when it loads */
  let m=chunkEdits.get(k);if(!m){m=new Map();chunkEdits.set(k,m);}
  m.set((x-cx*CH)+','+y+','+(z-cz*CH),id);
  const bk=pf+x+','+y+','+z;if(isTorch(id))torches.add(bk);else torches.delete(bk);
}
function netEditsIn(list){if(!Array.isArray(list))return;for(const e of list)if(Array.isArray(e)&&e.length===5)netApplyEdit(e[0],e[1],e[2],e[3],e[4]);}
function netEditsFlush(){
  if(!NET.edits.length)return;
  const L=NET.edits.splice(0,NET.edits.length);
  for(let i=0;i<L.length;i+=4000)netShout({t:'ed',e:L.slice(i,i+4000)});
}
/* ----- containers and other block entities: what changed since the last look, every half second ----- */
function netBeInit(){NET.beLast.clear();for(const [k,b] of blockEnts){try{NET.beLast.set(k,JSON.stringify(b));}catch(e){}}NET.beT=0;}
function netBeScan(){
  const out=[];
  for(const [k,b] of blockEnts){let s;try{s=JSON.stringify(b);}catch(e){continue;}if(NET.beLast.get(k)!==s){NET.beLast.set(k,s);out.push([k,s]);}}
  for(const k of [...NET.beLast.keys()])if(!blockEnts.has(k)){NET.beLast.delete(k);out.push([k,null]);}
  return out;
}
function netBeIn(list){
  if(!Array.isArray(list))return;
  let touched=false;
  for(const [k,s] of list){
    if(typeof k!=='string')continue;
    NET.beLast.set(k,s);
    if(s==null){NET.beLast.delete(k);blockEnts.delete(k);touched=true;continue;}
    let v;try{v=JSON.parse(s);}catch(e){continue;}
    const cur=blockEnts.get(k);
    if(cur&&typeof cur==='object'){for(const kk of Object.keys(cur))delete cur[kk];Object.assign(cur,v);}   /* same object: an open chest keeps showing it */
    else blockEnts.set(k,v);
    touched=true;
  }
  if(touched&&MODAL.kind&&MODAL.be&&typeof redrawModal==='function')redrawModal();
}

/* ----- poses and bodies ----- */
function netMyPose(){
  if(!P)return null;
  const st=P.inv&&P.inv[P.sel];
  return {x:+P.x.toFixed(2),y:+P.y.toFixed(2),z:+P.z.toFixed(2),yaw:+P.yaw.toFixed(3),pitch:+P.pitch.toFixed(3),d:DIM,
    sn:P.sneak?1:0,sw:P.swing>0.3?1:0,h:st?st.id:0,hp:Math.round(P.hp),dead:P.dead?1:0,
    rd:P.ride?(P.ride.t==='mob'?P.ride.mt:P.ride.t):0,ro:P.ride&&netClient()?1:0,ry:P.ride?+(P.ride.yaw||0).toFixed(3):0,   /* ro: a ride only this screen has (n4) */
    ac:netDoing(),ht:P.cos&&P.cos.hat||0,tg:terrOpen&&TG.bek?[TG.bek,+TG.px.toFixed(2),+TG.py.toFixed(2),TG.dir]:0};
}
function netPosesOut(){
  const me=netMyPose();if(!me)return;
  if(netClient()){if(NET.me)netSend('H',{t:'po',p:me});return;}
  const all=[{id:'H',...me}];
  for(const p of NET.peers.values())if(p.ready&&p.pose)all.push({id:p.id,...p.pose});
  for(const p of NET.peers.values())if(p.ready)netSendTr(p.tr,{t:'ps',p:all.filter(r=>r.id!==p.id)});
}
/* a remote player's body: built like an AI player's, hit like a mob, hurt like a player */
function netBodyMake(p){
  const q=p.pose,L=p.look||netLook(p.name);
  const M=agHumanoid({skin:L.skin,shirt:L.shirt,pants:L.pants,shoe:L.shoe,hat:L.hat||null});
  M.tag=agTag(p.name);M.G.add(M.tag);shadowify(M.G);scene.add(M.G);
  const e={t:'mob',mob:true,netp:true,mt:'netp',NP:p,name:p.name,hp:q.hp||20,hw:0.3,h:1.8,hostile:false,
    x:q.x,y:q.y,z:q.z,vx:0,vy:0,vz:0,onGround:true,yaw:q.yaw,pitch:q.pitch||0,mode:'net',tT:0,dir:0,atkT:0,hurtT:0,burnAcc:0,fuse:0,
    mesh:M.G,legs:[],mats:M.mats,M,anim:0,av:{ctl:{sneak:false},swing:0,inv:[null],sel:0}};
  entities.push(e);p.body=e;
  return e;
}
function netBodyDrop(p){if(p&&p.body){removeEnt(p.body);p.body=null;}if(p&&p.rideE){if(!p.rideE.dead)removeEnt(p.rideE);p.rideE=null;p.rideKind=null;}}
function netBodiesSync(){
  for(const p of NET.peers.values()){
    if(p.id===NET.me)continue;
    const q=p.pose,want=!!(p.ready&&q&&q.d===DIM&&!q.dead);
    if(p.body&&(p.body.dead||!want))netBodyDrop(p);
    if(want&&!p.body)netBodyMake(p);
    netRidePupSync(p);netRidePupMove(p);
    if(p.body)netBodyDress(p.body,q);
  }
}
function netBodyTick(e,dt){
  const p=e.NP,q=p&&p.pose;
  if(!q){removeEnt(e);return;}
  const k=Math.min(1,dt*12),ox=e.x,oz=e.z;
  if(Math.hypot(q.x-e.x,q.z-e.z)>8){e.x=q.x;e.y=q.y;e.z=q.z;}
  else{e.x+=(q.x-e.x)*k;e.y+=(q.y-e.y)*k;e.z+=(q.z-e.z)*k;}
  e.vx=dt>0?(e.x-ox)/dt:0;e.vz=dt>0?(e.z-oz)/dt:0;
  e.yaw+=(((q.yaw-e.yaw+Math.PI*3)%(Math.PI*2))-Math.PI)*k;e.pitch=q.pitch||0;e.hp=q.hp;
  e.hurtT=Math.max(0,e.hurtT-dt);
  const A=e.av;A.ctl.sneak=!!q.sn;if(q.sw&&A.swing<=0)A.swing=1;A.inv[0]=q.h?{id:q.h,count:1}:null;
  agAnimate(A,e,dt);
  if(e.M&&e.M.G&&q.rd)e.M.G.position.y=e.y-0.45;     /* in a vehicle: sitting (the vehicle itself is theirs alone) */
}

/* ----- the host's mobs, drops and AI players, streamed to each guest in the host's dimension ----- */
function netNid(e){if(!e.nid)e.nid=NET.nid++;NET.byNid.set(e.nid,e);return e.nid;}
function netEntsOut(){
  NET.byNid.clear();
  for(const p of NET.peers.values()){
    if(!p.ready||!p.pose||p.pose.d!==DIM)continue;
    const px=p.pose.x,pz=p.pose.z,m=[],dr=[],b=[],v=[];
    for(const e of entities){
      if(e.dead||e.np||Math.abs(e.x-px)>NET_RANGE||Math.abs(e.z-pz)>NET_RANGE)continue;
      if(e.t==='mob'){
        if(e.netp)continue;
        if(e.bot){if(e.A&&e.A.online&&!e.A.dead){const st=e.A.inv&&e.A.inv[e.A.sel];
          b.push([netNid(e),e.A.name,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+e.yaw.toFixed(2),+(e.pitch||0).toFixed(2),st?st.id:0,e.A.ctl&&e.A.ctl.sneak?1:0,e.A.swing>0.3?1:0]);}continue;}
        const T=MOBT[e.mt];if(!T||T.mg)continue;
        m.push([netNid(e),e.mt,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+e.yaw.toFixed(2),Math.round(e.hp),e.hurtT>0.3?1:0,e.name||0,e.tame?1:0]);
      }
      else if(NET_VEH[e.t])v.push([netNid(e),e.t,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+(e.yaw||0).toFixed(3),Math.round(e.hp||0),P.ride===e?1:0]);
      else if(e.t==='drop'&&e.st)dr.push([netNid(e),e.st.id,e.st.count,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),e.st.dur!=null?e.st.dur:-1]);
    }
    netSendTr(p.tr,{t:'en',m,dr,b,v});
  }
}
function netPupClear(){for(const e of NET.pup.values())if(!e.dead)removeEnt(e);NET.pup.clear();}
function netPupAdopt(key,e,nid){e.np=1;e.nid=nid;e.pk=key;e.tx=e.x;e.ty=e.y;e.tz=e.z;e.tyaw=e.yaw||0;NET.pup.set(key,e);return e;}
/* a guest: the stream in; puppets made, moved and dropped to match */
function netEntsIn(msg){
  if(!netPuppetMobs()){if(NET.pup.size)netPupClear();return;}
  const seen=new Set();
  for(const r of (msg.m||[])){
    const [nid,mt,x,y,z,yaw,hp,hurt,name,tame]=r,key='m'+nid;seen.add(key);
    let e=NET.pup.get(key);
    if(e&&(e.dead||e.mt!==mt)){if(!e.dead)removeEnt(e);NET.pup.delete(key);e=null;}
    if(!e){
      if(!MOBT[mt]||MOBT[mt].mg)continue;
      const n=entities.length;NET.applying++;try{spawnMob(mt,x,y,z);}finally{NET.applying--;}
      const c=entities[entities.length-1];if(entities.length<=n||!c||c.t!=='mob'||c.mt!==mt)continue;
      e=netPupAdopt(key,c,nid);e.yaw=yaw;
    }
    e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;e.hp=hp;if(name)e.name=name;e.tame=!!tame;
    if(hurt&&e.hurtT<=0.2){e.hurtT=0.4;for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0.45,0,0);}
  }
  for(const r of (msg.dr||[])){
    const [nid,id,count,x,y,z,dur]=r,key='d'+nid;seen.add(key);
    if(NET.taken.has(nid)||!DEFS[id])continue;
    let e=NET.pup.get(key);
    if(e&&!e.dead){e.tx=x;e.ty=y;e.tz=z;e.st.count=count;continue;}
    const n=entities.length;spawnDrop(x,y,z,{id,count,...(dur>=0?{dur}:{})},0,0,0);
    const c=entities[entities.length-1];if(entities.length<=n||!c||c.t!=='drop')continue;
    netPupAdopt(key,c,nid);
  }
  for(const r of (msg.v||[])){
    const [nid,t,x,y,z,yaw,hp]=r,key='v'+nid;seen.add(key);
    let e=NET.pup.get(key);
    if(e&&(e.dead||e.t!==t)){if(!e.dead)removeEnt(e);NET.pup.delete(key);e=null;}
    if(!e){const c=netVehSpawn(t,x,y,z,yaw);if(!c)continue;e=netPupAdopt(key,c,nid);}
    e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;e.hp=hp;
  }
  for(const r of (msg.b||[])){
    const [nid,name,x,y,z,yaw,pitch,held,sn,sw]=r,key='b'+nid;seen.add(key);
    let e=NET.pup.get(key);
    if(!e||e.dead){
      const D=AG_DEF[name];if(!D)continue;
      const M=agHumanoid(D);M.tag=agTag(name);M.G.add(M.tag);shadowify(M.G);scene.add(M.G);
      e={t:'mob',mob:true,mt:'netp',name,hp:20,hw:0.3,h:1.8,hostile:false,x,y,z,vx:0,vy:0,vz:0,onGround:true,yaw,pitch:0,mode:'net',
        tT:0,dir:0,atkT:0,hurtT:0,burnAcc:0,fuse:0,mesh:M.G,legs:[],mats:M.mats,M,anim:0,nbot:1,av:{ctl:{sneak:false},swing:0,inv:[null],sel:0}};
      entities.push(e);netPupAdopt(key,e,nid);
    }
    e.tx=x;e.ty=y;e.tz=z;e.tyaw=yaw;e.pitch=pitch;e.av.ctl.sneak=!!sn;if(sw&&e.av.swing<=0)e.av.swing=1;e.av.inv[0]=held?{id:held,count:1}:null;
  }
  for(const [key,e] of NET.pup)if(!seen.has(key)){if(!e.dead)removeEnt(e);NET.pup.delete(key);}
}
function netPupTick(e,dt){
  const k=Math.min(1,dt*10),ox=e.x,oz=e.z;
  if(Math.hypot(e.tx-e.x,e.tz-e.z)>10){e.x=e.tx;e.y=e.ty;e.z=e.tz;}
  else{e.x+=(e.tx-e.x)*k;e.y+=(e.ty-e.y)*k;e.z+=(e.tz-e.z)*k;}
  if(e.t==='drop'){
    e.age=(e.age||0)+dt;
    e.mesh.position.set(e.x,e.y+0.22+Math.sin(e.age*2.5+(e.bob||0))*0.045,e.z);if(e.m3d)e.mesh.rotation.y=e.age*1.5;
    if(!P.dead&&!e.tk&&e.age>0.4&&Math.hypot(P.x-e.x,(P.y+0.6)-e.y,P.z-e.z)<1.4){
      e.tk=1;NET.taken.add(e.nid);netSend('H',{t:'tk',n:e.nid});removeEnt(e);NET.pup.delete(e.pk);
    }
    return;
  }
  e.vx=dt>0?(e.x-ox)/dt:0;e.vz=dt>0?(e.z-oz)/dt:0;
  e.yaw+=(((e.tyaw-e.yaw+Math.PI*3)%(Math.PI*2))-Math.PI)*k;
  e.hurtT=Math.max(0,(e.hurtT||0)-dt);
  if(e.av){agAnimate(e.av,e,dt);return;}
  if(e.hurtT<0.2)for(const m of e.mats)m.emissive&&m.emissive.setRGB(0,0,0);
  e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.y=e.yaw;
  if(e.hrM)return;
  const hv=Math.hypot(e.vx,e.vz);e.anim=(e.anim||0)+dt*hv*3.2;
  for(const L of (e.legs||[])){const sw=Math.sin(e.anim+L.ph)*L.amp*Math.min(1,hv);if(L.ax==='x')L.g.rotation.x=sw;else L.g.rotation.z=L.base+sw*0.6;}
}
/* updateEntities (p05e) hands remote bodies and puppets here */
function netEntTick(e,dt){if(e.netp)netBodyTick(e,dt);else netPupTick(e,dt);}
/* a guest hit one of the host's mobs (or an AI player): the host's hurtMob decides */
function netHitOut(e,dmg,kx,kz){
  if(!(dmg>0)||e.hurtT>0.25)return;
  e.hurtT=0.5;for(const m of e.mats)m.emissive&&m.emissive.setRGB(0.45,0,0);playS('hit');
  netSend('H',{t:'hit',n:e.nid,d:+dmg.toFixed(2),kx:+(kx||0).toFixed(2),kz:+(kz||0).toFixed(2),how:typeof HIT_HOW!=='undefined'&&HIT_HOW?HIT_HOW:'melee'});
}
function netHitIn(p,m){
  const e=NET.byNid.get(m.n)||entities.find(q=>q.nid===m.n);
  if(!e||e.dead)return;
  if(NET_VEH[e.t]){hitCar(e,Math.min(+m.d||1,200));return;}
  if(e.t!=='mob')return;
  const pb=HIT_BY,ph=HIT_HOW;HIT_BY=p.name;HIT_HOW=m.how||'melee';NET.hitFrom=p;
  try{hurtMob(e,Math.min(+m.d||1,200),+m.kx||0,+m.kz||0);}finally{HIT_BY=pb;HIT_HOW=ph;NET.hitFrom=null;}
}
/* killMob (p05d) asks: a guest's kill sends its XP to that guest instead of dropping orbs for the host */
function netKillXP(amt){if(!netHost()||!NET.hitFrom)return false;netSendTr(NET.hitFrom.tr,{t:'xp',n:Math.round(amt)});return true;}
/* a guest walked over one of the host's drops: first come, first served */
function netTakeIn(p,nid){
  const e=NET.byNid.get(nid)||entities.find(q=>q.nid===nid);
  if(!e||e.dead||e.t!=='drop'||!e.st)return;
  const st={...e.st};removeEnt(e);
  netSendTr(p.tr,{t:'gv',st});
}
/* explosions: the blocks come as edits, the bang and the smoke come as this */
function netFxOut(k,x,y,z,r){if(NET.on&&!NET.applying)netShout({t:'fx',k,x:+x.toFixed(1),y:+y.toFixed(1),z:+z.toFixed(1),r:+r||3,d:DIM});}
function netFxIn(m){
  if(m.d!==DIM||!P)return;
  if(m.k==='boom'){burstParticles(m.x,m.y,m.z,B.TNT,24,1.2);playSAt('boom',m.x,m.y,m.z);
    const d=Math.hypot(P.x-m.x,P.y-m.y,P.z-m.z);if(d<16&&typeof SHAKE!=='undefined')SHAKE.t=Math.max(SHAKE.t||0,0.25*(1-d/16));}
}

/* ----- the frame (p07h calls this every frame a world is open, paused or not) ----- */
function netTick(dt){
  if(!NET.on)return;
  const now=NET.clock();
  netEditsFlush();
  NET.beT+=dt;if(NET.beT>0.5){NET.beT=0;const b=netBeScan();if(b.length)netShout({t:'be',b});}
  if(now-NET.poseT>=100){NET.poseT=now;netPosesOut();}
  netBodiesSync();
  if(P&&P.dead&&!NET.wasDead)netDeathOut();
  NET.wasDead=!!(P&&P.dead);
  if(netHost()){
    if(now-NET.entT>=125){NET.entT=now;netEntsOut();}
    if(now-NET.timeT>=1000){NET.timeT=now;const g=JSON.stringify(GR),msg={t:'tm',v:+timeOfDay.toFixed(5),d:DIM,pvp:NET.pvp};
      if(g!==NET.grLast){NET.grLast=g;msg.gr=GR;}msg.mk=netMarketOut();netBcast(msg);}
  }else{
    if(now-NET.stT>=15000){NET.stT=now;netStateOut();}
    netParkTick();
    /* the host's mobs are the only mobs here: anything this screen spawned on its own (a village's aliens...) goes */
    if(netPuppetMobs()){for(const e of entities)if(e.t==='mob'&&!e.dead&&!e.np&&!e.netp&&!e.bot&&!e.netOwn&&!MOBT[e.mt].mg)removeEnt(e);}   /* Malgorath's own stay */
    else if(NET.pup.size)netPupClear();
  }
}
/* the mobs' side (p05d / a7 / mob_helpers): remote players' bodies in this dimension, for targets, anchors and spacing */
function netBodies(){const out=[];if(!NET.on)return out;for(const p of NET.peers.values())if(p.body&&!p.body.dead)out.push(p.body);return out;}
