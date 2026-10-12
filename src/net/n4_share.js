/* ---- PART 58: n4_share.js ---- */
/* everything else everybody shares:
   vehicles and dragons   the host's world owns every parked car, skateboard, coaster cart, boat, plane and tame dragon and
                          streams them to guests as puppets. A guest who climbs in asks the host (rq); the host hands it over
                          (own: the real one leaves the host's world and appears in the guest's); the guest drives it, and
                          everybody else sees it under them (a ride puppet built from the guest's pose); climbing out parks it
                          back in the host's world (pk). A vehicle a guest places goes to the host the same way. A guest who
                          vanishes mid-ride leaves the vehicle where they were. Hits on a host vehicle go to the host.
                          Feeding a host dragon steak tames the real one.
   looks and doings       every body wears its player's store hat; its name tag says what they are up to (🎰 the casino,
                          💎 the store, 🎮 DEEP DIRT 2D, 🎬 the cinema, 🎒 the inventory, 💬 typing...)
   the market             one stock market for the room: the host's prices, live on every screen
   the casino             jackpots and blackjacks are announced to the room */
const NET_VEH={car:1,skate:1,cart:1,boat:1,plane:1};
function netVehSpawn(t,x,y,z,yaw){
  const f={car:spawnCar,skate:spawnSkate,cart:spawnCart,boat:spawnBoat,plane:spawnPlane}[t];if(!f)return null;
  const n=entities.length;NET.applying++;try{f(x,y,z,yaw||0);}finally{NET.applying--;}
  return entities.length>n?entities[entities.length-1]:null;
}
/* a vehicle (or a tame dragon) as data, and back */
function netRideState(e){
  if(!e)return null;
  if(e.t==='mob')return {k:'mob',mt:e.mt,x:+e.x.toFixed(2),y:+e.y.toFixed(2),z:+e.z.toFixed(2),yaw:+(e.yaw||0).toFixed(3),hp:e.hp,tame:e.tame?1:0,fed:e.fed||0};
  return {k:'veh',t:e.t,x:+e.x.toFixed(2),y:+e.y.toFixed(2),z:+e.z.toFixed(2),yaw:+(e.yaw||0).toFixed(3),hp:e.hp};
}
function netRideMake(s){
  if(!s)return null;
  let e=null;
  if(s.k==='mob'){if(!MOBT[s.mt])return null;const n=entities.length;NET.applying++;try{spawnMob(s.mt,s.x,s.y,s.z);}finally{NET.applying--;}
    e=entities.length>n?entities[entities.length-1]:null;if(e){e.tame=!!s.tame;e.fed=s.fed||0;e.angry=false;e.yaw=s.yaw||0;e.hx=s.x;e.hy=s.y+10;e.hz=s.z;}}
  else if(NET_VEH[s.t])e=netVehSpawn(s.t,s.x,s.y,s.z,s.yaw);
  if(e&&s.hp!=null)e.hp=s.hp;
  return e;
}
function netRideable(e){return !!e&&!e.dead&&(NET_VEH[e.t]||(e.t==='mob'&&e.mt==='dragon'&&e.tame));}
/* ----- a guest ----- */
/* doUse (p04d) calls this instead of climbing onto one of the host's puppets */
function netRideReq(e){
  if(!netClient()||!e||!e.nid||NET.rideWait)return;
  NET.rideWait=e.nid;setTimeout(()=>{if(NET.rideWait===e.nid)NET.rideWait=0;},3000);
  netSend('H',{t:'rq',n:e.nid});
}
function netOwnIn(m){
  NET.rideWait=0;
  if(!m.v){showToast(m.why||'Someone else got there first');return;}
  for(const [k,p] of NET.pup)if(p.nid===m.n){if(!p.dead)removeEnt(p);NET.pup.delete(k);}
  const e=netRideMake(m.v);if(!e)return;
  e.netOwn=1;NET.myRide=e;NET.myRideDim=DIM;
  P.ride=e;P.ride.spd=P.ride.spd||0;P.yaw=e.yaw;P.pitch*=0.3;playS('place');
  if(e.t==='mob')showToast('Hold W to fly where you look. Space climbs. Shift dismounts.');
}
/* feeding the host's dragon: the steak is eaten here, the dragon is fed there */
function netDragonUse(dr,st){
  if(st&&st.id===IT.STEAK&&!dr.angry){
    if(P.mode!=='c'){st.count--;if(st.count<=0)P.inv[P.sel]=null;redrawHotbar();}
    burstParticles(dr.x,dr.y+1.6,dr.z,B.WOOL,5,0.5);playS('eat');
    netSend('H',{t:'fd',n:dr.nid});
  }else if(!st&&dr.tame&&!P.ride)netRideReq(dr);
}
/* the guest's own vehicles go home to the host when nobody is in them */
function netParkTick(){
  if(!netClient()||!NET.me)return;
  const R=NET.myRide;
  if(R&&(R.dead||P.ride!==R)){
    if(!R.dead&&NET.myRideDim===DIM){netSend('H',{t:'pk',v:netRideState(R),d:DIM});removeEnt(R);}
    NET.myRide=null;
  }
  if(!netPuppetMobs())return;
  for(const e of entities)if(!e.dead&&NET_VEH[e.t]&&!e.np&&!e.netOwn&&P.ride!==e){netSend('H',{t:'pk',v:netRideState(e),d:DIM});removeEnt(e);}
}
/* ----- the host ----- */
function netRideRq(p,nid){
  const e=NET.byNid.get(nid)||entities.find(q=>q.nid===nid);
  if(!netRideable(e)||P.ride===e){netSendTr(p.tr,{t:'own',n:nid,v:null,why:e&&P.ride===e?NET.name+' is in it':'Someone else got there first'});return;}
  const v=netRideState(e);removeEnt(e);
  netSendTr(p.tr,{t:'own',n:nid,v});
}
function netParkIn(p,m){if(m.v&&(m.d||'over')===DIM)netRideMake(m.v);}
function netFeedIn(p,nid){
  const dr=NET.byNid.get(nid)||entities.find(q=>q.nid===nid);
  if(!dr||dr.dead||dr.mt!=='dragon'||dr.angry)return;
  dr.fed=(dr.fed||0)+1;burstParticles(dr.x,dr.y+1.6,dr.z,B.WOOL,5,0.5);
  if(dr.fed>=5&&!dr.tame){dr.tame=true;dr.angry=false;netSendTr(p.tr,{t:'tst',txt:'The dragon bows to you! Right-click bare-handed to ride.'});}
  else if(!dr.tame)netSendTr(p.tr,{t:'tst',txt:'The dragon eyes you... ('+dr.fed+'/5)'});
}
/* a guest gone in the middle of a ride: the vehicle stays where they were */
function netRideOrphan(p){
  const q=p.pose;if(!netHost()||!q||!q.rd||!q.ro||q.d!==DIM)return;
  if(q.rd==='dragon')netRideMake({k:'mob',mt:'dragon',x:q.x,y:q.y-1.05,z:q.z,yaw:q.ry||q.yaw,tame:1,fed:5});
  else if(NET_VEH[q.rd])netRideMake({k:'veh',t:q.rd,x:q.x,y:q.y-0.45,z:q.z,yaw:q.ry||q.yaw});
}
/* ----- what everybody else sees of a rider: a ride puppet under them ----- */
function netRidePupSync(p){
  const q=p.pose,want=q&&q.ro&&q.rd&&q.d===DIM&&!q.dead?q.rd:null;
  if(p.rideE&&(p.rideE.dead||p.rideKind!==want)){if(!p.rideE.dead)removeEnt(p.rideE);p.rideE=null;p.rideKind=null;}
  if(!want||p.rideE)return;
  const e=want==='dragon'?netRideMake({k:'mob',mt:'dragon',x:q.x,y:q.y-1.05,z:q.z,yaw:q.ry||0,tame:1}):netVehSpawn(want,q.x,q.y-0.45,q.z,q.ry||0);
  if(!e)return;
  e.np=1;e.rp=1;e.tx=e.x;e.ty=e.y;e.tz=e.z;e.tyaw=e.yaw;p.rideE=e;p.rideKind=want;
}
function netRidePupMove(p){
  const e=p.rideE,q=p.pose;if(!e||!q)return;
  e.tx=q.x;e.tz=q.z;e.ty=q.y-(e.seatY!=null?e.seatY:0.45);e.tyaw=q.ry!=null?q.ry:q.yaw;
}
/* ----- looks and doings ----- */
function netDoing(){
  if(!playing||!P)return '';
  if(P.dead)return '';
  if(typeof casOpen!=='undefined'&&casOpen)return '\u{1F3B0}';
  if(storeOpen)return '\u{1F48E}';
  if(terrOpen)return '\u{1F3AE}';
  if(cineOpen)return '\u{1F3AC}';
  if(chatOpen)return '\u{1F4AC}';
  if(dlgOpen)return '\u{1F47D}';
  if(MODAL.kind)return '\u{1F392}';
  if(powOpen)return '⚡';
  if(paused)return '⏸';
  return '';
}
function netBodyDress(e,q){
  const M=e.M;if(!M)return;
  const name=e.NP?e.NP.name:e.name,tag=name+(q&&q.ac?' '+q.ac:'');
  if(M._tagTxt!==tag){M._tagTxt=tag;if(M.tag)M.G.remove(M.tag);M.tag=agTag(tag);M.G.add(M.tag);}
  const hat=q&&q.ht||null;
  if(M._hat!==hat){M._hat=hat;const old=M.head.getObjectByName('hat');if(old)M.head.remove(old);
    if(hat&&typeof buildHat==='function'){try{const g=buildHat(hat);g.position.y=0.27;M.head.add(g);}catch(err){}}}
  const sp=M.head.getObjectByName('hatspin');if(sp)sp.rotation.y+=0.2;
}
/* ----- the market and the casino ----- */
function netMarketOut(){const o={};for(const s of STOX)o[s]=+MKT.p[s].toFixed(3);return o;}
function netMarketIn(o){
  if(!o||typeof o!=='object')return;
  for(const s of STOX)if(o[s]>0){MKT.p[s]=+o[s];const h=MKT.h[s];if(h){h.push(MKT.p[s]);if(h.length>64)h.shift();}}
  if(typeof pcOpen!=='undefined'&&pcOpen&&typeof renderPC==='function')renderPC();
}
function netBrag(txt){if(!NET.on||!NET.name)return;const t=NET.name+' '+txt;sysMsg(t);netShout({t:'dd',txt:t});}
/* DEEP DIRT 2D together: two players on the same Gaming Rig dig one 2D world (every tile they mine or place goes to the other)
   and see each other's little digger, name and all. The rig's save is still the rig's (whoever powers off last writes it) */
function netTerrEdit(x,y,v){if(NET.on&&TG.bek&&!NET.applying)netShout({t:'tg',k:TG.bek,x,y,v});}
function netTerrIn(m){
  if(!terrOpen||!TG.t||TG.bek!==m.k)return;
  const x=m.x|0,y=m.y|0;if(x<0||y<0||x>=TG.w||y>=TG.h)return;
  const was=TG.t[tIdx(x,y)];TG.t[tIdx(x,y)]=m.v|0;
  if(was&&!m.v)terrBurst(x,y,TCOL[was]||'#888',4);
}
function netTerrOthers(){
  if(!NET.on||!terrOpen)return [];
  const out=[];for(const p of NET.peers.values()){const q=p.pose;if(p.id!==NET.me&&q&&q.tg&&q.tg[0]===TG.bek)out.push({name:p.name,px:q.tg[1],py:q.tg[2],dir:q.tg[3]});}
  return out;
}
/* the cinema together: picking a film starts it for everyone else sitting in the same cinema's menu */
function netCineOut(i){if(NET.on&&!NET.applying&&P)netShout({t:'cn',m:i,x:+P.x.toFixed(1),z:+P.z.toFixed(1),d:DIM,from:NET.name});}
function netCineIn(m){
  if(!P||m.d!==DIM||Math.hypot(P.x-m.x,P.z-m.z)>18||!CINFILMS[m.m])return;
  if(cineOpen&&CIN.mode==='menu'){NET.applying++;try{cineSelect(m.m);}finally{NET.applying--;}showToast(m.from+' started '+CINFILMS[m.m].t+' for everyone');}
  else if(!cineOpen)showToast(m.from+' is watching '+CINFILMS[m.m].t+' at the cinema');
}
/* shots everybody sees: a player's arrow or bullet is sent as it leaves; other screens fly a copy that hits nothing (the real
   hit happens on the shooter's screen and arrives as damage) */
function netShotOut(k,x,y,z,vx,vy,vz,g){if(NET.on&&!NET.applying)netShout({t:'sh',k,p:[x,y,z,vx,vy,vz].map(v=>+(+v).toFixed(2)),g:+(g||0),d:DIM});}
function netShotIn(m){
  if(m.d!==DIM||!Array.isArray(m.p)||m.p.length!==6)return;
  const [x,y,z,vx,vy,vz]=m.p,n=entities.length;
  NET.applying++;
  try{if(m.k==='a')spawnArrow(x,y,z,vx,vy,vz,'fx',0);else if(m.k==='b')spawnBullet(x,y,z,vx,vy,vz,0,m.g||0);else netShotMore(m.k,x,y,z,vx,vy,vz);}finally{NET.applying--;}
  if(entities.length>n)entities[entities.length-1].fx=1;
}
/* grenades, the Big Dingle's bomb and the Titan's boulders: copies (fx) that fly here. A grenade copy never goes off (the real bang
   comes as 'fx'); a boulder copy can still land on this screen's player (that is the point of being near a Titan) */
function netShotMore(k,x,y,z,vx,vy,vz){
  if(k==='n'){
    if(!nadeG){nadeG=new THREE.BoxGeometry(0.2,0.24,0.2);nadeM=new THREE.MeshLambertMaterial({color:0x3b5634});}
    const m=new THREE.Mesh(nadeG,nadeM),fl=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.3,0.26),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.7}));
    fl.visible=false;m.add(fl);scene.add(m);
    entities.push({t:'nade',x,y,z,vx,vy,vz,hw:0.12,h:0.22,onGround:false,fuse:2.4,mesh:m,flash:fl,fx:1});
  }else if(k==='ab'){
    spawnABomb(x,y,z,vx,vz);const e=entities[entities.length-1];e.fx=1;e.nt=20;e.sir=0;NET.abx.push(e);
    showToast('A friend dropped the Big Dingle. 20 seconds. Run.');
  }else if(k==='r'){
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),new THREE.MeshLambertMaterial({color:0x77777f}));scene.add(m);
    entities.push({t:'rock',x,y,z,vx,vy,vz,age:0,mesh:m,fx:1});
  }
}
/* laser eyes: the beam, drawn on every screen nearby */
function netFxBeam(e0,ex,ey,ez,len){if(NET.on&&!NET.applying)netShout({t:'fx',k:'beam',x:+e0[0].toFixed(2),y:+e0[1].toFixed(2),z:+e0[2].toFixed(2),r:+len.toFixed(2),
  e:[+ex.toFixed(2),+ey.toFixed(2),+ez.toFixed(2)],d:DIM});}

/* ----- disasters: whoever has one tells everyone four times a second; everyone else runs a copy (no world writes) ----- */
function netDisOut(){
  if(!DIS.kind)return;
  const tw=DIS.data&&DIS.data.te&&!DIS.data.te.dead?[+DIS.data.te.x.toFixed(2),+DIS.data.te.z.toFixed(2)]:0;
  netShout({t:'ds',k:DIS.kind,cx:DIS.cx,cz:DIS.cz,gy:DIS.gy,tt:+DIS.t.toFixed(2),dur:DIS.dur,tw,d:DIM,from:NET.name});
}
function netDisIn(m){if(!m||!DISNAME[m.k])return;NET.rdis=Object.assign({},m,{at:NET.clock()});}
function netDisEnd(){
  const R=NET.rdis;NET.rdis=null;
  if(NET.rtw){if(!NET.rtw.dead)removeEnt(NET.rtw);NET.rtw=null;}
  if(NET.rdHud&&!DIS.kind)disHud('');NET.rdHud=0;
  if(R&&R.k==='tornado')for(const e of entities)if(e.t==='debris'&&e.fx&&!e.dead)removeEnt(e);
}
function netTwisterMake(x,y,z){
  const G=new THREE.Group(),mats=[];
  for(let i=0;i<12;i++){const r=0.5+i*0.34,m=new THREE.Mesh(new THREE.BoxGeometry(r*2,0.8,r*2),new THREE.MeshLambertMaterial({color:0x4a4650,transparent:true,opacity:0.55}));
    m.position.y=i*0.85+0.4;m.rotation.y=i*0.7;G.add(m);mats.push(m);}
  scene.add(G);G.position.set(x,y,z);
  const e={t:'twister',x,y,z,vx:0,vz:0,tx:x,tz:z,mesh:G,parts:mats,deb:0,dT:0,fx:1};entities.push(e);return e;
}
/* updateTwister (p11) hands a friend's twister here: it goes where theirs goes and pulls this screen's player like theirs would */
function netTwisterTick(e,dt){
  const dx=e.tx-e.x,dz=e.tz-e.z;
  if(Math.hypot(dx,dz)>14){e.x=e.tx;e.z=e.tz;}else{const k=Math.min(1,dt*4);e.x+=dx*k;e.z+=dz*k;}
  if(((e.x*7)|0)!==e._lx||((e.z*7)|0)!==e._lz){e._lx=(e.x*7)|0;e._lz=(e.z*7)|0;e.y=heightAt(Math.floor(e.x),Math.floor(e.z));}
  e.mesh.position.set(e.x,e.y,e.z);e.mesh.rotation.y+=dt*7;
  if(P&&!P.dead&&!P.ride){const pdx=e.x-P.x,pdz=e.z-P.z,pd=Math.hypot(pdx,pdz);
    if(pd<9&&pd>0.01){P.x+=pdx/pd*5.5*dt;P.z+=pdz/pd*5.5*dt;if(pd<4)P.vy=Math.max(P.vy,13);}}
  e.dT-=dt;
  if(e.dT<=0&&e.deb<30){e.dT=0.25;e.deb++;
    const m=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.45,0.45),new THREE.MeshLambertMaterial({color:Math.random()<0.5?0x6b4a2c:0x3f8f3a}));scene.add(m);
    entities.push({t:'debris',x:e.x+(Math.random()-0.5)*10,y:e.y+Math.random()*3,z:e.z+(Math.random()-0.5)*10,vx:0,vy:2,vz:0,age:0,mesh:m,tw:e,fx:1});}
  if(Math.random()<0.5)burstParticles(e.x+(Math.random()-0.5)*4,e.y+Math.random()*8,e.z+(Math.random()-0.5)*4,B.DIRT,2,0.6);
}
/* every frame: the friend's disaster (its twister, its lava bombs, its fire rain, its clock on the HUD) and the Big Dingle countdown */
function netFxTick(dt){
  const R=NET.rdis;
  if(R){
    if(NET.clock()-R.at>1500||R.d!==DIM||!P||!playing)netDisEnd();
    else{
      const far=Math.hypot(P.x-R.cx,P.z-R.cz);
      if(R.k==='tornado'&&Array.isArray(R.tw)){
        if(!NET.rtw||NET.rtw.dead)NET.rtw=netTwisterMake(R.tw[0],heightAt(Math.floor(R.tw[0]),Math.floor(R.tw[1])),R.tw[1]);
        NET.rtw.tx=R.tw[0];NET.rtw.tz=R.tw[1];
      }else if(NET.rtw){if(!NET.rtw.dead)removeEnt(NET.rtw);NET.rtw=null;}
      NET.rdT-=dt;
      if(R.k==='volcano'&&far<140&&NET.rdT<=0){NET.rdT=0.22;
        for(let i=0;i<2;i++){const a=Math.random()*6.28,sp=3+Math.random()*8;
          const m=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.3,0.3),new THREE.MeshLambertMaterial({color:0xff8a2f,emissive:new THREE.Color(0.6,0.2,0)}));scene.add(m);
          entities.push({t:'lavab',x:R.cx+0.5,y:R.gy+18,z:R.cz+0.5,vx:Math.sin(a)*sp,vy:9+Math.random()*4.5,vz:Math.cos(a)*sp,age:0,mesh:m,trailT:0,fx:1});}
        if(far<60)playS('rumble');}
      else if(R.k==='fire'&&far<120&&NET.rdT<=0){NET.rdT=0.08;
        for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.5,0.18),new THREE.MeshLambertMaterial({color:0xff9a3f,emissive:new THREE.Color(0.7,0.3,0)}));scene.add(m);
          entities.push({t:'fireb',x:R.cx+(Math.random()-0.5)*60,y:R.gy+30+Math.random()*8,z:R.cz+(Math.random()-0.5)*60,vx:(Math.random()-0.5)*2,vy:-13,vz:(Math.random()-0.5)*2,age:0,mesh:m,trailT:0,fx:1});}}
      if(!DIS.kind){NET.rdHud=1;disHud((DISNAME[R.k]||R.k)+' — '+fmtT(R.dur-R.tt-(NET.clock()-R.at)/1000)+' ('+R.from+')');}
    }
  }
  for(let i=NET.abx.length-1;i>=0;i--){const e=NET.abx[i];
    if(e.dead){NET.abx.splice(i,1);if(!NARM.e)nukeHud(-1);continue;}
    const prev=Math.ceil(e.nt);e.nt-=dt;
    if(!NARM.e){nukeHud(e.nt);const now=Math.ceil(e.nt);if(now!==prev&&now>0)playS(now<=5?'ntickf':'ntick');e.sir-=dt;if(e.sir<=0&&e.nt>0){e.sir=2.4;playS('siren');}}
    if(e.nt<-3){removeEnt(e);NET.abx.splice(i,1);if(!NARM.e)nukeHud(-1);}}
}

/* ----- the Eternal Snail: one each. Every screen's own snail hunts its own player (PART 47, untouched); everybody else sees it as
   a copy with its owner's name on it. A copy never touches anyone: only your own snail can get you. ----- */
function netSnailPose(){return GR.snail&&SNL&&!SNL.dead?[+SNL.x.toFixed(2),+SNL.y.toFixed(2),+SNL.z.toFixed(2),+(SNL.mesh?SNL.mesh.rotation.y:0).toFixed(2)]:0;}
function netSnailDrop(p){if(p&&p.snail){if(!p.snail.dead)removeEnt(p.snail);p.snail=null;}}
function netSnailSync(p){
  const q=p.pose,sl=q&&q.sl,want=!!(p.ready&&q&&q.d===DIM&&GR.snail&&Array.isArray(sl)&&sl.length===4);
  if(p.snail&&(p.snail.dead||!want))netSnailDrop(p);
  if(!want)return;
  let e=p.snail;
  if(!e){
    const g=new THREE.Group(),m=new THREE.Mesh(wpnGeo('snail',-1),new THREE.MeshLambertMaterial({vertexColors:true}));
    m.scale.set(1.6,1.6,1.6);g.add(m);
    const tag=agTag(p.name+'\u2019s snail');tag.position.y=1.7;g.add(tag);
    scene.add(g);g.position.set(sl[0],sl[1],sl[2]);
    e={t:'netsnail',x:sl[0],y:sl[1],z:sl[2],mesh:g,NP:p,bob:0};entities.push(e);p.snail=e;
  }
  if(Math.hypot(sl[0]-e.x,sl[2]-e.z)>6){e.x=sl[0];e.y=sl[1];e.z=sl[2];}
  else{e.x+=(sl[0]-e.x)*0.2;e.y+=(sl[1]-e.y)*0.2;e.z+=(sl[2]-e.z)*0.2;}
  e.bob+=0.016;e.mesh.position.set(e.x,e.y+Math.sin(e.bob*2.2)*0.03,e.z);e.mesh.rotation.y=sl[3];
}
