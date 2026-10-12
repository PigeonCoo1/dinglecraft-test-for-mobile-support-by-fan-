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
  try{if(m.k==='a')spawnArrow(x,y,z,vx,vy,vz,'fx',0);else if(m.k==='b')spawnBullet(x,y,z,vx,vy,vz,0,m.g||0);}finally{NET.applying--;}
  if(entities.length>n)entities[entities.length-1].fx=1;
}
