/* ---- PART 58: n2_sync.js ---- */
/* the room: opening it, joining it, who is in it, and every message but the world stream (n3).
   Ids: the host is 'H'; guests are 'g1', 'g2'... (given by the host). A peer record:
   {id,tr,name,look,pose,body,ready} (pose: {x,y,z,yaw,pitch,d,sn,sw,h,hp,dead,rd}) */
let NET_GSEQ=0;
function netPeerList(){return [...NET.peers.values()];}
function netSend(id,msg){
  if(netHost()){const p=NET.peers.get(id);if(p)netSendTr(p.tr,msg);}
  else if(netClient()&&id==='H')netSendTr(NET.hostTr,msg);
}
/* host: to every ready guest (but one) */
function netBcast(msg,except){if(!netHost())return;for(const p of NET.peers.values())if(p.ready&&p.id!==except)netSendTr(p.tr,msg);}
/* to everyone else in the room, whoever we are */
function netShout(msg){if(netHost())netBcast(msg);else if(netClient())netSend('H',msg);}

/* ----- host ----- */
async function netHostStart(o){
  o=o||{};
  if(NET.on)return NET.code;
  if(!playing||!P)throw new Error('Open a world first');
  const T=o.tr||((o.kind||NET.kind)==='bc'?netBcTransport():netPeerTransport());
  netWire(T);
  let code=o.code||netCode();
  for(let i=0;;i++){
    try{await T.host(code);break;}
    catch(e){if(e&&e.type==='unavailable-id'&&!o.code&&i<4){code=netCode();continue;}NET.err=netErrText(e);throw e;}
  }
  Object.assign(NET,{on:true,role:'host',code,tr:T,me:'H',hostTr:null,name:netNameFix(PNAME,[]),hostDim:DIM,err:'',status:'',
    wasDead:!!P.dead,grLast:JSON.stringify(GR)});
  NET.peers.clear();NET.byTr.clear();NET.byNid.clear();NET.chunks.clear();NET_GSEQ=0;
  netBeInit();netBeatStart();
  sysMsg('[LINK] Your world is open to friends. Room code: '+code);
  if(typeof netUiSync==='function')netUiSync();
  return code;
}
/* the world a guest gets: the host's save without the host's own player, AI players or mobs (the host streams those), and the
   guest's own player: the one saved from last time, or a fresh one next to the host */
function netWorldFor(p){
  const w=snapshot(WORLD.name);
  delete w.net;w.bots=[];w.ents=[];w.gr={...w.gr,bots:false};
  const g=NET.guests[p.name];
  if(g&&g.player){w.player=g.player;w.dim=g.dim||'over';}
  else{
    const sp=findSpawn(),a=Math.random()*6.28;
    w.player={x:+(P.x+Math.sin(a)*1.5).toFixed(2),y:+(P.y+0.2).toFixed(2),z:+(P.z+Math.cos(a)*1.5).toFixed(2),yaw:+P.yaw.toFixed(3),pitch:0,
      hp:20,hunger:20,sel:0,spawn:sp,inv:[]};
    w.dim=DIM;
  }
  return w;
}
function netHello(trId,m){
  if(NET.byTr.get(trId))return;
  const no=r=>{netSendTr(trId,{t:'no',why:r});setTimeout(()=>{if(NET.tr)NET.tr.drop(trId);},400);};
  if(m.v!==NET_V||m.gv!==GAME_VERSION)return no('Different game versions: the host has DINGLECRAFT '+RELEASE_LABEL+' (v'+GAME_VERSION+'). Download the same one.');
  if(NET.peers.size+1>=NET_MAX)return no('This world is full ('+NET_MAX+' players).');
  const name=netNameFix(m.name,[NET.name,...netPeerList().map(p=>p.name)]);
  const p={id:'g'+(++NET_GSEQ),tr:trId,name,look:netLook(name),pose:null,body:null,ready:false,seen:NET.clock()};
  NET.peers.set(p.id,p);NET.byTr.set(trId,p);
  const players=[{id:'H',name:NET.name,look:netLook(NET.name),pose:netMyPose()},
    ...netPeerList().filter(q=>q.ready).map(q=>({id:q.id,name:q.name,look:q.look,pose:q.pose}))];
  netSendTr(trId,{t:'wel',id:p.id,name,code:NET.code,pvp:NET.pvp,hostDim:DIM,time:timeOfDay,players,w:netWorldFor(p)});
  p.ready=true;
  netBcast({t:'pj',id:p.id,name,look:p.look},p.id);
  sysMsg('[LINK] '+name+' joined the world');
  if(typeof netUiSync==='function')netUiSync();
}
function netPeerGone(p,why){
  if(!NET.peers.has(p.id))return;
  netRideOrphan(p);
  NET.peers.delete(p.id);
  netBodyDrop(p);
  if(netHost()){netBcast({t:'pl',id:p.id});if(p.tr!=null)NET.byTr.delete(p.tr);}
  sysMsg('[LINK] '+p.name+(why==='kick'?' was removed from the world':' left the world'));
  if(typeof netUiSync==='function')netUiSync();
}
function netKick(id){
  const p=NET.peers.get(id);if(!p||!netHost())return;
  netSendTr(p.tr,{t:'bye',why:'The host removed you from the world'});
  setTimeout(()=>{if(NET.tr)NET.tr.drop(p.tr);},300);
  netPeerGone(p,'kick');
}
function netSetPvp(v){if(!netHost())return;NET.pvp=!!v;netBcast({t:'tm',v:timeOfDay,d:DIM,pvp:NET.pvp});if(typeof netUiSync==='function')netUiSync();}

/* ----- guest ----- */
async function netJoin(code,o){
  o=o||{};
  code=netCodeNorm(code);
  if(code.length<4)throw new Error('Type the room code your friend gave you');
  if(NET.on)netStop('switch');
  const T=o.tr||((o.kind||NET.kind)==='bc'?netBcTransport():netPeerTransport());
  netWire(T);
  NET.err='';NET.status='Looking for the world '+code+'…';if(typeof netUiSync==='function')netUiSync();
  let hostTr;
  try{hostTr=await T.join(code);}
  catch(e){NET.err=netErrText(e);NET.status='';try{T.close();}catch(x){}if(typeof netUiSync==='function')netUiSync();throw new Error(NET.err);}
  Object.assign(NET,{on:true,role:'client',code,tr:T,hostTr,me:null,name:'',hostDim:'over',hostT:-1,status:'Joining…'});
  NET.peers.clear();NET.byTr.clear();NET.pup.clear();NET.chunks.clear();NET.taken.clear();
  netSendTr(hostTr,{t:'hi',v:NET_V,gv:GAME_VERSION,name:PNAME});
  return new Promise((res,rej)=>{
    NET.joinCb={res,rej};
    setTimeout(()=>{if(NET.joinCb===null||!NET.joinCb)return;const cb=NET.joinCb;NET.joinCb=null;NET.err='The host did not send the world in time.';netStop('fail');cb.rej(new Error(NET.err));},120000);
  });
}
/* the world arrives: it becomes this game's world (never saved here: it lives on the host) */
function netWelcome(m){
  NET.me=m.id;NET.name=m.name;NET.pvp=m.pvp!==false;NET.hostDim=m.hostDim||'over';
  for(const q of (m.players||[]))NET.peers.set(q.id,{id:q.id,name:q.name,look:q.look||netLook(q.name),pose:q.pose||null,body:null,ready:true});
  applySave(m.w);
  timeOfDay=+m.time||timeOfDay;
  WORLD.name='link:'+NET.code;
  netBeInit();netBeatStart();
  enterGame();
  NET.status='';NET.wasDead=!!P.dead;NET.stT=0;
  sysMsg('[LINK] You joined the world as '+NET.name+'. Room code: '+NET.code);
  if(m.name!==pnClean(PNAME))sysMsg('[LINK] Someone here already has your name: you are '+m.name+' in this world');
  const cb=NET.joinCb;NET.joinCb=null;if(cb)cb.res(m.name);
  if(typeof netUiSync==='function')netUiSync();
}
/* the host is gone: back to the title, with a word about why */
function netLost(why){
  if(!netClient())return;
  const cb=NET.joinCb;NET.joinCb=null;
  netStop('lost');
  if(cb){NET.err=why;cb.rej(new Error(why));return;}
  if(playing)quitToTitle();
  showToast(why);NET.err=why;
  if(typeof netUiSync==='function')netUiSync();
}
/* close the room (host) or leave it (guest) */
function netStop(why){
  if(!NET.on)return;
  try{
    if(netHost()){for(const p of NET.peers.values())netSendTr(p.tr,{t:'bye',why:'The host closed the world'});}
    else if(netClient()&&NET.me){netStateOut();netSendTr(NET.hostTr,{t:'bye'});}
  }catch(e){}
  const T=NET.tr;
  if(NET.hb){clearInterval(NET.hb);NET.hb=0;}
  setTimeout(()=>{try{if(T)T.close();}catch(e){}},why==='test'?0:250);
  for(const p of NET.peers.values())netBodyDrop(p);
  netPupClear();
  Object.assign(NET,{on:false,role:null,tr:null,hostTr:null,me:'H',code:'',status:''});
  NET.peers.clear();NET.byTr.clear();NET.byNid.clear();NET.edits.length=0;NET.chunks.clear();
  if(typeof netUiSync==='function')netUiSync();
}

/* a heartbeat on a timer, not on frames: a paused or backgrounded game still says it is there (frames stop, timers slow down) */
function netBeat(){
  if(!NET.on){if(NET.hb){clearInterval(NET.hb);NET.hb=0;}return;}
  if(netClient()){if(NET.me)netSend('H',{t:'pg'});return;}
  const now=NET.clock();
  for(const p of [...NET.peers.values()])if(p.ready&&now-p.seen>45000){if(NET.tr)NET.tr.drop(p.tr);netPeerGone(p,'left');}
  netBcast({t:'pg'});
}
function netBeatStart(){if(NET.hb)clearInterval(NET.hb);NET.hb=uiLive()?setInterval(netBeat,2000):0;}
/* ----- every message ----- */
function netRecv(trId,m){
  if(netHost()){
    if(m.t==='hi'){netHello(trId,m);return;}
    const p=NET.byTr.get(trId);if(!p||!p.ready)return;
    p.seen=NET.clock();
    switch(m.t){
      case 'po':p.pose=m.p;break;
      case 'ed':netEditsIn(m.e);netBcast({t:'ed',e:m.e},p.id);break;
      case 'be':netBeIn(m.b);netBcast({t:'be',b:m.b},p.id);break;
      case 'ch':{const txt=(''+(m.txt||'')).slice(0,200);if(!txt)break;chatPush({k:'chat',from:p.name,txt});netBcast({t:'ch',from:p.name,txt},p.id);break;}
      case 'hit':netHitIn(p,m);break;
      case 'pv':if(!NET.pvp&&m.how!=='tnt')break;
        if(m.to==='H')netHurtMe(+m.d,+m.kx,+m.kz,p.name,m.how);
        else{const q=NET.peers.get(m.to);if(q)netSendTr(q.tr,{t:'dmg',d:+m.d,kx:+m.kx,kz:+m.kz,by:p.name,how:m.how});}
        break;
      case 'tk':netTakeIn(p,m.n);break;
      case 'rq':netRideRq(p,m.n);break;
      case 'pk':netParkIn(p,m);break;
      case 'fd':netFeedIn(p,m.n);break;
      case 'st':if(m.pl&&typeof m.pl==='object')NET.guests[p.name]={player:m.pl,dim:m.d||'over'};break;
      case 'dd':sysMsg(m.txt);netBcast({t:'dd',txt:m.txt},p.id);break;
      case 'fx':netFxIn(m);netBcast(m,p.id);break;
      case 'tg':netTerrIn(m);netBcast(m,p.id);break;
      case 'sh':netShotIn(m);netBcast(m,p.id);break;
      case 'cn':netCineIn(m);netBcast(m,p.id);break;
      case 'bye':if(NET.tr)NET.tr.drop(trId);netPeerGone(p,'left');break;
    }
    return;
  }
  if(!netClient()||trId!==NET.hostTr)return;
  switch(m.t){
    case 'wel':netWelcome(m);break;
    case 'no':{const cb=NET.joinCb;NET.joinCb=null;NET.err=m.why||'The host said no';netStop('fail');if(cb)cb.rej(new Error(NET.err));if(typeof netUiSync==='function')netUiSync();break;}
    case 'pj':NET.peers.set(m.id,{id:m.id,name:m.name,look:m.look||netLook(m.name),pose:null,body:null,ready:true});sysMsg('[LINK] '+m.name+' joined the world');break;
    case 'pl':{const q=NET.peers.get(m.id);if(q)netPeerGone(q,'left');break;}
    case 'ps':for(const r of (m.p||[])){const q=NET.peers.get(r.id);if(q&&q.id!==NET.me){q.pose=r;if(r.id==='H'){NET.hostDim=r.d;}}}break;
    case 'ed':netEditsIn(m.e);break;
    case 'be':netBeIn(m.b);break;
    case 'ch':chatPush({k:'chat',from:m.from,txt:''+(m.txt||'')});break;
    case 'en':netEntsIn(m);break;
    case 'dmg':netHurtMe(+m.d,+m.kx,+m.kz,m.by,m.how);break;
    case 'gv':if(m.st&&m.st.id){const st={...m.st},before=st.count,left=invAddTo(P.inv,st);if(left>0)spawnDrop(P.x,P.y+0.5,P.z,{...m.st,count:left},0,1,0);if(left<before)playS('pop');redrawHotbar();}break;
    case 'xp':if(+m.n>0)spawnXP(P.x,P.y+1.2,P.z,+m.n);break;
    case 'own':netOwnIn(m);break;
    case 'tst':if(m.txt)showToast(''+m.txt);break;
    case 'tm':if(m.v!=null&&Math.abs(((+m.v-timeOfDay)%1+1.5)%1-0.5)>0.002)timeOfDay=+m.v;
      if(m.d)NET.hostDim=m.d;if(m.pvp!=null)NET.pvp=!!m.pvp;if(m.mk)netMarketIn(m.mk);
      if(m.gr&&typeof m.gr==='object'){const keep=GR.bots;Object.assign(GR,m.gr);GR.bots=keep;if(typeof grApplyUI==='function')grApplyUI();}
      break;
    case 'dd':sysMsg(m.txt);break;
    case 'fx':netFxIn(m);break;
    case 'tg':netTerrIn(m);break;
    case 'sh':netShotIn(m);break;
    case 'cn':netCineIn(m);break;
    case 'bye':netLost(m.why||'The host closed the world');break;
  }
}

/* ----- chat, damage, deaths ----- */
function netChatOut(txt){if(NET.on&&(netHost()||NET.me))netShout({t:'ch',from:NET.name,txt});}
function netHurtMe(d,kx,kz,by,how){
  if(!(d>0)||!P)return;
  LASTDMG={by:by||null,how:how||'pvp',t:AG_T};
  damagePlayer(Math.min(d,100),kx||0,kz||0);
}
/* someone (anyone, on this screen) hit a remote player's body: it is that player's damage to take */
let NET_PVPTOLD=0;
function netPvpOut(e,dmg,kx,kz){
  const p=e.NP;if(!p||!(dmg>0))return;
  const how=typeof HIT_HOW!=='undefined'&&HIT_HOW?HIT_HOW:'melee';
  if(!NET.pvp&&how!=='tnt'){if(NET.clock()-NET_PVPTOLD>4000){NET_PVPTOLD=NET.clock();showToast('PvP is off in this world');}return;}
  if(e.hurtT>0.25)return;
  e.hurtT=0.5;for(const m of e.mats)m.emissive&&m.emissive.setRGB(0.45,0,0);
  playS('hit');
  const msg={d:+dmg.toFixed(2),kx:+(kx||0).toFixed(2),kz:+(kz||0).toFixed(2),how};
  if(netHost())netSendTr(p.tr,{t:'dmg',by:NET.name,...msg});
  else netSend('H',{t:'pv',to:p.id,...msg});
}
/* host: a mob (or anything else the host simulates) hurts a guest */
function netDmgTo(p,d,kx,kz,by,how){if(netHost()&&p&&p.tr!=null)netSendTr(p.tr,{t:'dmg',d:+d,kx:+(kx||0),kz:+(kz||0),by,how:how||'mob'});}
function netDeathOut(){
  const by=LASTDMG&&LASTDMG.by&&AG_T-LASTDMG.t<6?LASTDMG.by:null;
  const txt=NET.name+(by?' was killed by '+(by==='Dan'?NET.name:by):' died');
  netShout({t:'dd',txt});
}
/* a guest's own player, for the host to keep (every 15 s and when leaving) */
function netStateOut(){if(netClient()&&NET.me&&P&&playing)netSend('H',{t:'st',pl:snapPlayer(),d:DIM});}
/* what the Tab list shows for the room */
function netTabRows(){
  if(!NET.on)return [];
  const out=[];
  for(const p of NET.peers.values()){if(p.id===NET.me||!p.ready)continue;const q=p.pose;
    out.push([p.name+(p.id==='H'?' (host)':''),!q?'…':q.dead?'dead':Math.round(q.hp)+'❤','online',q&&q.d!==DIM?(q.d==='over'?'Overworld':q.d==='puppet'?'Puppet Purgatory':q.d):'']);}
  return out;
}
