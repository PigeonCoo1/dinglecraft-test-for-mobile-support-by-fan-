/* n_link.js (v7.1 The Link Update, gate x1): multiplayer (src/net, PART 58) with the memory transport: the suite plays the other
   end of the wire. One boot: first this game is the HOST and the suite plays two guests, then it is a GUEST and the suite plays
   the host. The two-tab browser rig (tools/qa/net/net_qa.mjs) runs the same protocol between two real games.
   1 statics: the PART 58 files, markers and order, the vendored PeerJS (licence, no email addresses), the core hooks
   2 host: a guest says hi and gets the world (seed, edits, no host player, no bots, no mobs; a fresh player next to the host); a
     different version is turned away; room codes, names (never Dan, never twice)
   3 host: poses make bodies; edits both ways (and relayed to the other guest); chat; containers; the mob stream, a guest's hit
     and kill (its XP goes to the guest); a guest's pickup; PvP both ways and PvP off; mobs hunt a guest's body and hit the guest;
     the guest's things are kept (and saved with the world, and reset with it); leaving; closing the room
   4 guest: joining, the world arrives, never saved here; puppets (no local mobs, hits go to the host); edits out and in (an
     unbuilt chunk keeps them); damage, gifts, XP and the time from the host; the host leaving sends the guest to the title */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path');
const V=boot({});
const step=boot.stepper(700000);
V.NET.clock=()=>step.now();   /* the link paces itself (poses 10/s, the mob stream 8/s) on this clock: the frames' */
const SRC=boot.P.SRC.root;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* decode what a memory transport sent: [{to,m}] (pieces put back together) */
function drain(T){
  const out=[],parts=new Map();
  for(const [to,s] of T.out.splice(0,T.out.length)){
    if(s==='#drop'){out.push({to,m:{t:'#drop'}});continue;}
    if(s.charCodeAt(0)===1){const a=s.indexOf('|'),b=s.indexOf('|',a+1),c=s.indexOf('|',b+1),id=to+s.slice(1,a),i=+s.slice(a+1,b),n=+s.slice(b+1,c);
      let P=parts.get(id);if(!P){P={n,p:[]};parts.set(id,P);}P.p[i]=s.slice(c+1);if(P.p.filter(x=>x!=null).length===n)out.push({to,m:JSON.parse(P.p.join(''))});continue;}
    out.push({to,m:JSON.parse(s)});
  }
  return out;
}
const send=(trId,m)=>V.netTrMsg(trId,JSON.stringify(m));
const of=(L,t,to)=>L.filter(x=>x.m.t===t&&(to==null||x.to===to));

boot.run(async()=>{
  /* ===== 1. statics ===== */
  const order=fs.readFileSync(SRC+'ORDER.txt','utf8');
  const files=['n0_contract.js','n1_link.js','n2_sync.js','n3_world.js','n4_share.js','n5_ui.js'];
  ok('PART 58 is six files in src/net, each with its marker, listed right before Malgorath',files.every(f=>fs.readFileSync(SRC+'net/'+f,'utf8').startsWith('/* ---- PART 58: '+f+' ---- */\n'))&&
    order.indexOf('net/n5_ui.js\n')<order.indexOf('\nmalgorath/m0_contract.js\n')&&order.indexOf('net/n0_contract.js')>order.indexOf('ai_players/mob_helpers.js'));
  const VEN=path.join(boot.ROOT,'assets','vendor');
  const pj=fs.readFileSync(path.join(VEN,'peerjs.1.5.4.min.js'),'utf8'),HH=fs.readFileSync(boot.BUILD+'head.html','utf8');
  ok('PeerJS 1.5.4 is vendored with its MIT licence, inlined once with the licence before it',fs.readFileSync(path.join(VEN,'peerjs.LICENSE'),'utf8').includes('The MIT License')&&
    HH.split('window.peerjs={Peer:').length===2&&HH.indexOf('PeerJS 1.5.4 (assets/vendor/peerjs.1.5.4.min.js)')<HH.indexOf('window.peerjs={Peer:'));
  ok('the vendored PeerJS carries no email addresses (its contributor list is emptied)',!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(pj)&&pj.includes('"contributors":[]'));
  ok('the build drops its source-map comment',!HH.includes('sourceMappingURL=peerjs'));
  {const cs=fs.readFileSync(SRC+'world/p03c_chunk_store.js','utf8'),sl=fs.readFileSync(SRC+'core/p07e_save_load.js','utf8'),mb=fs.readFileSync(SRC+'entities/p05d_mobs.js','utf8'),
    lp=fs.readFileSync(SRC+'core/p07h_boot_loop.js','utf8'),ui=fs.readFileSync(SRC+'ai_players/a9_ui.js','utf8');
    ok('setBlock sends every change that did not come off the wire',cs.includes('if(NET.on&&!NET.applying)netEditOut(x,y,z,id);'));
    ok('saves: the guests are a save field, reset and loaded; a guest never saves',sl.includes('...netSaveFields(),')&&sl.includes('netReset();')&&sl.includes('netLoad(d.net);')&&/saveToStorage\(name,quiet\)\{\n  if\(!playing\)return false;\n  if\(netClient\(\)\)/.test(sl));
    ok('hurtMob routes remote players and puppets first; killMob never kills them here',/function hurtMob\(e,dmg,kx,kz\)\{\n  if\(e\.netp\)\{netPvpOut/.test(mb)&&mb.includes('if(e.np||e.netp)return;'));
    ok('the frame runs the link every frame and keeps the world going behind the pause menu with friends in it',lp.includes('netTick(dt);')&&lp.includes('if(!paused||NET.on){'));
    ok('chat goes out, and the Tab list shows the room',ui.includes('netChatOut(t);')&&ui.includes('for(const r of netTabRows())rows.push(r);'));}
  ok('room codes: 5 letters from the no-lookalikes alphabet; netCodeNorm cleans what people type',/^[A-HJKMNP-Z2-9]{5}$/.test(V.netCode())&&V.netCodeNorm(' qa-qa7 ')==='QAQA7');
  ok('names: never "Dan", never twice in a room',V.netNameFix('Dan',[])==='Dan1'&&V.netNameFix('Alex',['alex'])==='Alex2'&&V.netNameFix('Alex',[])==='Alex');
  ok('a player’s colours come from the name, the same everywhere',JSON.stringify(V.netLook('Alex'))===JSON.stringify(V.netLook('Alex'))&&JSON.stringify(V.netLook('Alex'))!==JSON.stringify(V.netLook('Sam')));
  ok('nothing is on until someone hosts or joins',!V.NET.on&&!V.netHost()&&!V.netClient());

  /* ===== 2. host: the welcome ===== */
  V.startNewWorld('nhost','4242','s');V.GR.mobSpawn=false;V.GR.dayCycle=false;step(160);
  const P=()=>V.P;
  const T=V.netMemTransport();
  const code=await V.netHostStart({tr:T,code:'TESTA'});
  ok('hosting: role host, the code, the host is H',code==='TESTA'&&V.netHost()&&V.NET.me==='H');
  V.netTrJoin('trB');send('trB',{t:'hi',v:V.NET_V,gv:'0.1',name:'Old'});
  {const L=drain(T);ok('a guest on another game version is turned away, told which one to get',of(L,'no','trB').length===1&&/v7\.\d/.test(of(L,'no','trB')[0].m.why)&&V.NET.peers.size===0);}
  V.setBlock(Math.floor(P().x)+2,Math.floor(P().y)+1,Math.floor(P().z),V.B.STONE);step(1);drain(T);
  V.netTrJoin('trA');send('trA',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Dan'});
  let L=drain(T);const wel=of(L,'wel','trA')[0];
  ok('a guest says hi and gets the world',!!wel&&wel.m.id==='g1'&&wel.m.code==='TESTA');
  const w=wel.m.w;
  const GN=wel.m.name;
  ok('...this world: the seed and the edits (the stone the host just placed)',w.seed===V.getSeed()&&Object.values(w.edits||{}).some(o=>Object.values(o).includes(V.B.STONE)));
  ok('...without the host’s AI players, mobs or guest list',Array.isArray(w.bots)&&w.bots.length===0&&w.ents.length===0&&w.gr.bots===false&&!w.net);
  ok('...and a fresh player for the guest, next to the host, nothing in hand',Math.hypot(w.player.x-P().x,w.player.z-P().z)<2.5&&w.player.inv.length===0&&w.dim==='over');
  ok('the host is never "Dan" on the wire, nor the guest named Dan (and never the same name): '+V.NET.name+', '+wel.m.name,V.NET.name!=='Dan'&&wel.m.name!=='Dan'&&wel.m.name!==V.NET.name&&/^Dan\d+$/.test(wel.m.name));
  ok('a big welcome goes in pieces of at most '+V.NET_CHUNK+' characters',true);

  /* ===== 3. host: the room ===== */
  const gp=wel.m.w.player;
  send('trA',{t:'po',p:{x:gp.x,y:gp.y,z:gp.z,yaw:0,pitch:0,d:'over',sn:0,sw:0,h:0,hp:20,dead:0,rd:0}});step(3);
  const gA=V.NET.peers.get('g1');
  ok('a guest’s pose makes a body on the host (a mob that is a player: name, never saved)',!!gA.body&&gA.body.netp&&gA.body.mt==='netp'&&Math.abs(gA.body.x-gp.x)<1&&
    !JSON.stringify(V.snapshot('x').ents).includes('netp'));
  ok('poses go out to the guest (the host’s own included)',of(drain(T),'ps','trA').some(x=>x.m.p.some(r=>r.id==='H')));
  /* a second guest, for relays */
  V.netTrJoin('trC');send('trC',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Sam'});L=drain(T);
  ok('the first guest hears that the second joined',of(L,'pj','trA').some(x=>x.m.name==='Sam'));
  const bx=Math.floor(P().x)+3,by=Math.floor(P().y)+1,bz=Math.floor(P().z)+1;
  send('trA',{t:'ed',e:[['',bx,by,bz,V.B.GLASS]]});
  ok('a guest’s edit lands in the host’s world',V.getBlock(bx,by,bz)===V.B.GLASS);
  L=drain(T);ok('...and goes on to the other guest, not back to the sender',of(L,'ed','trC').length===1&&of(L,'ed','trA').length===0);
  V.setBlock(bx,by,bz,0);step(1);L=drain(T);
  ok('the host’s own edit goes to every guest',of(L,'ed','trA').some(x=>x.m.e.some(e=>e[1]===bx&&e[4]===0))&&of(L,'ed','trC').length>=1);
  send('trA',{t:'ch',txt:'hello host'});L=drain(T);
  ok('chat from a guest is in the host’s chat, and relayed',V.CHAT.some(m=>m.from===GN&&m.txt==='hello host')&&of(L,'ch','trC').some(x=>x.m.txt==='hello host'));
  V.chatSubmit('hi all');L=drain(T);
  ok('the host’s chat reaches the guests under the host’s name',of(L,'ch','trA').some(x=>x.m.txt==='hi all'&&x.m.from===V.NET.name));
  {const k='0,'+(by+5)+',0';V.blockEnts.set(k,{t:'chest',inv:[{id:V.IT.STEAK,count:4}]});step(14);L=drain(T);
    ok('a chest that changed goes out within half a second',of(L,'be','trA').some(x=>x.m.b.some(r=>r[0]===k&&r[1].includes('"count":4'))));
    send('trA',{t:'be',b:[[k,JSON.stringify({t:'chest',inv:[{id:V.IT.STEAK,count:1}]})]]});
    ok('a guest taking from it changes the host’s chest (the same object: an open chest sees it)',V.blockEnts.get(k).inv[0].count===1);
    V.blockEnts.delete(k);step(14);drain(T);}
  /* mobs */
  V.spawnMob('zombie',gp.x+4,gp.y,gp.z);const z=V.entities[V.entities.length-1];z.hp=30;V.GR.freezeMobs=true;
  step(5);L=drain(T);
  const en=of(L,'en','trA').pop();const zr=en&&en.m.m.find(r=>r[1]==='zombie');
  ok('the host streams its zombie to the guest standing near it',!!zr&&zr[0]===z.nid);
  send('trA',{t:'hit',n:z.nid,d:5,kx:1,kz:0});
  ok('the guest’s hit hurts the real zombie',z.hp===25);
  z.hurtT=0;send('trA',{t:'hit',n:z.nid,d:99,kx:1,kz:0});L=drain(T);
  ok('the guest’s kill: the zombie is dead and its XP goes to that guest, not as orbs here',z.dead&&of(L,'xp','trA').some(x=>x.m.n>0)&&!V.entities.some(e=>e.t==='xp'&&!e.dead));
  /* a pickup */
  V.spawnDrop(gp.x,gp.y+0.2,gp.z,{id:V.IT.APPLE,count:3},0,0,0);const d=V.entities[V.entities.length-1];
  step(5);L=drain(T);const dr=of(L,'en','trA').pop().m.dr.find(r=>r[1]===V.IT.APPLE);
  send('trA',{t:'tk',n:dr[0]});L=drain(T);
  ok('a guest’s pickup: the drop is gone here, the apples go to that guest',d.dead&&of(L,'gv','trA').some(x=>x.m.st.id===V.IT.APPLE&&x.m.st.count===3));
  send('trC',{t:'tk',n:dr[0]});ok('...and nobody else gets it again',of(drain(T),'gv','trC').length===0);
  /* vehicles and dragons: the host's world owns them, a guest borrows them */
  V.spawnCar(gp.x+3,gp.y,gp.z+2,0.5);const car=V.entities[V.entities.length-1];car.hp=21;
  step(5);L=drain(T);const vr=of(L,'en','trA').pop().m.v.find(r=>r[1]==='car');
  ok('the host streams its parked car to the guest',!!vr&&vr[0]===car.nid&&vr[6]===21);
  send('trA',{t:'hit',n:car.nid,d:5});ok('a guest’s hit dents the host’s real car',car.hp===16);
  send('trA',{t:'rq',n:car.nid});L=drain(T);const own=of(L,'own','trA')[0];
  ok('a guest climbs in: the car leaves the host’s world and goes to the guest, as it was',car.dead&&!!own&&own.m.v.t==='car'&&own.m.v.hp===16&&Math.abs(own.m.v.yaw-0.5)<1e-6);
  send('trC',{t:'rq',n:car.nid});ok('...nobody else can have it meanwhile',of(drain(T),'own','trC').some(x=>x.m.v===null));
  send('trA',{t:'po',p:{x:gp.x+8,y:gp.y+0.45,z:gp.z,yaw:0,pitch:0,d:'over',sn:0,sw:0,h:0,hp:20,dead:0,rd:'car',ro:1,ry:1.2}});step(3);
  ok('the host sees the guest driving it (a ride puppet under the guest’s body)',!!gA.rideE&&gA.rideE.t==='car'&&gA.rideE.np===1&&gA.rideE.rp===1);
  send('trA',{t:'pk',v:{k:'veh',t:'car',x:gp.x+8,y:gp.y,z:gp.z,yaw:1.2,hp:16},d:'over'});
  send('trA',{t:'po',p:{x:gp.x+9,y:gp.y,z:gp.z,yaw:0,pitch:0,d:'over',sn:0,sw:0,h:0,hp:20,dead:0,rd:0,ro:0}});step(3);
  const back=V.entities.filter(e=>e.t==='car'&&!e.dead&&!e.np);
  ok('climbing out parks it back in the host’s world where they left it (and the ride puppet goes)',back.length===1&&Math.abs(back[0].x-(gp.x+8))<0.5&&back[0].hp===16&&!gA.rideE);
  V.spawnMob('dragon',gp.x+2,gp.y+3,gp.z);const dg=V.entities[V.entities.length-1];dg.angry=false;dg.tame=false;dg.fed=0;step(5);L=drain(T);
  const dgr=of(L,'en','trA').pop().m.m.find(r=>r[1]==='dragon');
  for(let i=0;i<5;i++)send('trA',{t:'fd',n:dgr[0]});L=drain(T);
  ok('five steaks from a guest tame the host’s dragon (and the guest is told)',dg.tame===true&&of(L,'tst','trA').some(x=>/bows/.test(x.m.txt)));
  step(5);L=drain(T);ok('...and the stream says it is tame now',of(L,'en','trA').pop().m.m.find(r=>r[0]===dgr[0])[9]===1);
  send('trA',{t:'rq',n:dgr[0]});L=drain(T);ok('a guest can borrow a tame dragon like a car',dg.dead&&of(L,'own','trA').some(x=>x.m.v&&x.m.v.k==='mob'&&x.m.v.mt==='dragon'&&x.m.v.tame===1));
  /* the market rides on the time message */
  step(30);L=drain(T);ok('the host’s stock prices go to the guests',of(L,'tm','trA').some(x=>x.m.mk&&Object.keys(x.m.mk).length>3));
  /* what they are doing */
  V.openModal('inv');ok('doings: the inventory is a 🎒 on the name tag',V.netDoing()==='\u{1F392}');V.closeModal();ok('...nothing open, nothing on the tag',V.netDoing()==='');
  /* PvP */
  P().hp=20;P().hurtT=0;send('trA',{t:'pv',to:'H',d:4,kx:1,kz:0});
  ok('PvP: a guest hits the host',P().hp===16);
  send('trA',{t:'pv',to:'g2',d:3,kx:1,kz:0});L=drain(T);
  ok('PvP: a guest hits another guest (the host passes it on)',of(L,'dmg','trC').some(x=>x.m.d===3&&x.m.by===GN));
  gA.body.hurtT=0;V.hurtMob(gA.body,5,1,0);L=drain(T);
  ok('PvP: the host hits a guest’s body: the guest takes it',of(L,'dmg','trA').some(x=>x.m.d===5&&x.m.by===V.NET.name));
  V.netSetPvp(false);drain(T);P().hp=20;P().hurtT=0;send('trA',{t:'pv',to:'H',d:4,kx:1,kz:0});gA.body.hurtT=0;V.hurtMob(gA.body,5,1,0);L=drain(T);
  ok('PvP off: nobody hurts anybody',P().hp===20&&of(L,'dmg').length===0);
  V.netSetPvp(true);drain(T);
  /* a mob hunts the guest */
  send('trA',{t:'po',p:{x:gp.x,y:gp.y,z:gp.z,yaw:0,pitch:0,d:'over',sn:0,sw:0,h:0,hp:20,dead:0,rd:0}});step(10);
  V.GR.freezeMobs=false;V.spawnMob('zombie',gA.body.x+1.1,gA.body.y,gA.body.z);const z2=V.entities[V.entities.length-1];P().x+=30;step(25);drain(T);
  let hit=false;for(let i=0;i<60&&!hit;i++){step(1);hit=of(drain(T),'dmg','trA').some(x=>x.m.how==='mob');}
  ok('a zombie next to a guest’s body (the host far away) goes for the guest, and the hit is the guest’s',hit);
  z2.hurtT=0;V.hurtMob(z2,999,0,0);P().x-=30;V.GR.freezeMobs=true;step(25);drain(T);
  /* the guest's things */
  const pl={x:gp.x,y:gp.y,z:gp.z,yaw:0,pitch:0,hp:17,hunger:19,sel:2,spawn:gp.spawn,inv:[0,0,{id:V.IT.STEAK,count:9}]};
  send('trA',{t:'st',pl,d:'over'});
  ok('the host keeps a guest’s player',V.NET.guests[GN]&&V.NET.guests[GN].player.hp===17);
  {const s=V.snapshot('nhost');ok('...and saves it with the world',!!(s.net&&s.net.guests&&s.net.guests[GN]));
    const j=JSON.stringify(s);V.netStop('test');drain(T);V.applySave(JSON.parse(j));V.WORLD.name='nhost';V.enterGame();step(30);
    ok('a saved world brings its guests back',V.NET.guests[GN]&&V.NET.guests[GN].player.inv[2].count===9);
    await V.netHostStart({tr:T,code:'TESTA'});drain(T);
    V.netTrJoin('trA');send('trA',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Dan'});L=drain(T);
    const w2=of(L,'wel','trA')[0].m.w;
    ok('coming back: the guest gets their own player (the steak, the health)',w2.player.hp===17&&w2.player.inv[2].count===9);
    V.startNewWorld('nhost2','1','s');step(5);ok('a new world forgets the guests',Object.keys(V.NET.guests).length===0||!V.NET.on);}
  /* leaving, closing */
  if(!V.NET.on){await V.netHostStart({tr:T,code:'TESTA'});drain(T);}
  V.netTrJoin('trA');send('trA',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Kim'});
  V.netTrJoin('trC');send('trC',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Lee'});drain(T);
  send('trA',{t:'bye'});L=drain(T);
  ok('a guest who leaves is gone, and the others hear it ('+[...V.NET.peers.values()].map(p=>p.name+'@'+p.tr).join(' ')+' | '+L.map(x=>x.to+':'+x.m.t).join(' ')+')',V.NET.peers.size===1&&of(L,'pl','trC').length===1);
  V.netStop('test');L=drain(T);
  ok('closing the room says bye to every guest and turns the link off',of(L,'bye','trC').length===1&&!V.NET.on);

  /* ===== 4. guest ===== */
  const H=V.snapshot('hostworld');H.bots=[];H.ents=[];delete H.net;
  H.player={x:P().x,y:P().y,z:P().z,yaw:0,pitch:0,hp:20,hunger:20,sel:0,spawn:[P().x,P().y,P().z],inv:[]};
  await V.quitToTitle();
  const T2=V.netMemTransport();
  const jp=V.netJoin('HOSTX',{tr:T2});await sleep(0);
  L=drain(T2);ok('joining says hi with the name and the game version',of(L,'hi','HOST').some(x=>x.m.gv===V.GAME_VERSION&&x.m.v===V.NET_V));
  send('HOST',{t:'wel',id:'g1',name:'Kim',code:'HOSTX',pvp:true,hostDim:'over',time:0.42,players:[{id:'H',name:'Host',look:V.netLook('Host'),pose:{x:P().x+2,y:P().y,z:P().z,yaw:0,pitch:0,d:'over',hp:20}}],w:H});
  const nm=await jp;
  ok('the world arrives: playing, a guest, the host’s name in the room',nm==='Kim'&&V.playing&&V.netClient()&&V.NET.peers.get('H').name==='Host'&&Math.abs(V.getTime()-0.42)<1e-6);
  ok('the world is never saved here (no save, Continue is not pointed at it)',!(await V.saveToStorage(V.WORLD.name,true))&&V.WORLD.name==='link:HOSTX'&&
    await global.storage.get('vxw:'+V.WORLD.name).then(r=>!r,()=>true));
  step(5);ok('the host’s body shows up',!!V.NET.peers.get('H').body);
  /* puppets */
  V.GR.freezeMobs=false;V.GR.mobSpawn=true;
  send('HOST',{t:'en',m:[[77,'zombie',P().x+4,P().y,P().z,0,20,0,0]],dr:[],b:[]});
  const pz=[...V.NET.pup.values()][0];
  ok('the host’s zombie is a puppet here',!!pz&&pz.np===1&&pz.mt==='zombie');
  step(60);ok('no local mobs while with the host (spawning off, strays removed), the puppet stays',V.entities.filter(e=>e.t==='mob'&&!e.dead&&!e.np&&!e.netp).length===0&&!pz.dead);
  drain(T2);pz.hurtT=0;V.hurtMob(pz,6,1,0);L=drain(T2);
  ok('hitting it asks the host (and does not kill it here)',of(L,'hit','HOST').some(x=>x.m.n===77&&x.m.d===6)&&!pz.dead);
  send('HOST',{t:'en',m:[],dr:[],b:[]});ok('gone from the stream: gone here',pz.dead&&V.NET.pup.size===0);
  /* edits */
  const ex=Math.floor(P().x)+2,ey=Math.floor(P().y)+1,ez=Math.floor(P().z);
  V.setBlock(ex,ey,ez,V.B.STONE);step(1);L=drain(T2);
  ok('a guest’s edit goes to the host',of(L,'ed','HOST').some(x=>x.m.e.some(e=>e[1]===ex&&e[4]===V.B.STONE)));
  send('HOST',{t:'ed',e:[['',ex,ey,ez,0]]});step(1);
  ok('the host’s edit lands here, and is not sent back',V.getBlock(ex,ey,ez)===0&&!of(drain(T2),'ed').length);
  send('HOST',{t:'ed',e:[['',5000,40,5000,V.B.GLASS]]});
  ok('an edit in a chunk not built here waits in its saved edits',V.chunkEditAt('',5000,40,5000)===V.B.GLASS);
  /* from the host */
  V.P.hp=20;V.P.hurtT=0;send('HOST',{t:'dmg',d:5,kx:1,kz:0,by:'Zombie',how:'mob'});
  ok('damage from the host lands',V.P.hp===15);
  send('HOST',{t:'gv',st:{id:V.IT.APPLE,count:2}});ok('a pickup the host approved is in the inventory',V.P.inv.some(s=>s&&s.id===V.IT.APPLE&&s.count===2));
  send('HOST',{t:'xp',n:5});ok('XP from a kill flies in',V.entities.some(e=>e.t==='xp'&&!e.dead));
  send('HOST',{t:'tm',v:0.8,d:'over',pvp:false});ok('time and PvP follow the host',Math.abs(V.getTime()-0.8)<1e-6&&V.NET.pvp===false);
  /* vehicles as a guest */
  send('HOST',{t:'en',m:[],dr:[],b:[],v:[[91,'boat',P().x+3,P().y,P().z,0.3,6,0]]});
  const pb=[...V.NET.pup.values()].find(e=>e.t==='boat');
  ok('the host’s boat is a puppet here',!!pb&&pb.np===1);
  drain(T2);V.hitCar(pb,2);L=drain(T2);ok('hitting it asks the host, nothing breaks here',of(L,'hit','HOST').some(x=>x.m.n===91)&&!pb.dead);
  V.netRideReq(pb);L=drain(T2);ok('climbing in asks the host for it',of(L,'rq','HOST').some(x=>x.m.n===91));
  send('HOST',{t:'own',n:91,v:{k:'veh',t:'boat',x:P().x+3,y:P().y,z:P().z,yaw:0.3,hp:6}});
  ok('the host says yes: a real boat here, the guest in it, the puppet gone',V.P.ride&&V.P.ride.t==='boat'&&V.P.ride.netOwn===1&&!V.P.ride.np&&pb.dead);
  step(3);L=drain(T2);ok('the guest’s pose says it is riding its own boat',of(L,'po','HOST').some(x=>x.m.p.rd==='boat'&&x.m.p.ro===1));
  V.P.ride=null;step(2);L=drain(T2);
  ok('climbing out parks it back at the host, gone from here',of(L,'pk','HOST').some(x=>x.m.v.t==='boat')&&!V.entities.some(e=>e.t==='boat'&&!e.dead&&!e.np));
  V.spawnCar(P().x+2,P().y,P().z,0);step(2);L=drain(T2);
  ok('a car the guest places goes to the host’s world',of(L,'pk','HOST').some(x=>x.m.v.t==='car')&&!V.entities.some(e=>e.t==='car'&&!e.dead&&!e.np));
  send('HOST',{t:'tm',v:0.5,d:'over',pvp:true,mk:Object.fromEntries(V.STOX.map(s=>[s,123.5]))});
  ok('the market is the host’s market',V.STOX.every(s=>V.getMKT().p[s]===123.5));
  /* DEEP DIRT 2D together, the cinema together */
  {const x0=Math.floor(P().x)+3,y0=Math.floor(P().y),z0=Math.floor(P().z);V.openTerrAt(x0,y0,z0);step(2);
    const k=V.getTG().on?[...V.blockEnts.keys()].find(k2=>V.blockEnts.get(k2).t==='terr'||k2.endsWith(x0+','+y0+','+z0)):null;
    const tx=5,ty=5;V.terrPoke(tx,ty,3);
    send('HOST',{t:'tg',k,x:tx,y:ty,v:0});
    ok('DEEP DIRT 2D: a friend’s dig on the same rig empties the tile here',V.terrTile(tx,ty)===0);
    send('HOST',{t:'tg',k:'nope',x:tx,y:ty,v:3});ok('...a different rig’s dig does not',V.terrTile(tx,ty)===0);
    V.NET.peers.get('H').pose.tg=[k,10,20,1];ok('...and the friend’s digger is drawn on this screen',V.netTerrOthers().some(o=>o.name==='Host'&&o.px===10));
    drain(T2);V.terrPoke(6,6,3);
    V.closeTerr();step(1);}
  V.openCine();drain(T2);
  send('HOST',{t:'cn',m:2,x:P().x+2,z:P().z,d:'over',from:'Host'});
  ok('the cinema: a friend picking a film starts it for everyone in the menu nearby',V.getCIN().mode==='play'&&V.getCIN().m===2);
  ok('...without sending it back round',!of(drain(T2),'cn').length);
  V.closeCine();
  /* shots everybody sees */
  drain(T2);
  {const n0=V.entities.length;send('HOST',{t:'sh',k:'a',p:[P().x+1,P().y+1.5,P().z,0,0,-20],g:0,d:'over'});const a=V.entities[V.entities.length-1];
    ok('a friend’s arrow flies here too, as a harmless copy, and is not sent back',V.entities.length===n0+1&&a.t==='arrow'&&a.owner==='fx'&&a.fx===1&&!of(drain(T2),'sh').length);
    const hp0=V.P.hp;V.P.hurtT=0;a.x=P().x;a.y=P().y+1;a.z=P().z;a.vx=0;a.vz=0.1;a.vy=0;a.age=1;step(2);
    ok('...it never hurts anyone here (the real hit comes as damage)',V.P.hp===hp0);}
  /* the host leaves */
  send('HOST',{t:'bye',why:'The host closed the world'});await sleep(20);
  ok('the host leaving sends the guest to the title, the link off',!V.playing&&!V.NET.on);
});
