#!/usr/bin/env node
/* net_qa.mjs: the MUTED two-player browser rig for multiplayer (src/net, PART 58).

   node tools/qa/net/net_qa.mjs --launch [--port 9403] [--build dist/dinglecraft_v<VER>.html] [--out DIR]
   node tools/qa/net/net_qa.mjs --port 9403 [--server 9503] ...          (your own Chrome + server already running)
     --phone 1|0     the guest is a phone (844x390, touch on) and joins through the Multiplayer panel with taps (default 1)

   Two tabs of one Chrome: the host opens a world and "Open to friends" over the BroadcastChannel transport (the same messages
   as PeerJS, without the internet: this container cannot reach the public PeerJS server), the guest joins with the room code.
   Checks: the guest gets the host's world (seed, blocks, the host's body with its name), never saves it, sees the host and is
   seen; blocks both ways (and into a chunk the guest has not built), a chest's contents, chat both ways, the time of day; the
   host's zombie streams to the guest as a puppet, the guest's hits hurt the real one, the zombie hunts and hurts the guest; a
   drop the host spawns is picked up by the guest (and gone on the host); PvP both ways and PvP off; the Tab list; the guest
   leaves (the host keeps the guest's inventory) and comes back with it; the host closes the world and the guest is back on
   the title. Screenshots of both screens and a contact sheet; summary.json. Exit 1 on any failed check.
   MUTED, always (tools/qa/lib/cdp.mjs): --mute-audio, vx_vox_settings {snd:0,mus:0,tp:'og'} before the page runs, soundOn=false +
   AC.suspend() on every evaluation, rAF disabled (__vox.frameStep moves each game), the brain on a dead port. Its own worlds only. */
import fs from 'fs';import path from 'path';import {spawn,execFileSync} from 'child_process';
import {args,connect,REPO,defaultBuild,outDir,rel} from '../lib/cdp.mjs';

const A=args(),PORT=+(A.port||9403),SRV=+(A.server||PORT+100),BUILD=A.build||defaultBuild(),PHONE=A.phone!=='0';
const OUT=path.resolve(A.out||outDir('net_qa'));const SH=path.join(OUT,'1280x720_net');fs.mkdirSync(SH,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const kids=[];const stopKids=()=>{for(const k of kids){try{process.kill(k.pid,'SIGTERM');}catch(e){}}};
process.on('exit',stopKids);process.on('SIGINT',()=>{stopKids();process.exit(130);});
if(A.launch){
  const prof=path.resolve(A.profile||path.join(REPO,'out','qa','chrome_'+PORT));
  const pid=execFileSync(path.join(REPO,'tools','qa','chrome.sh'),[String(PORT),prof],{encoding:'utf8',env:{...process.env,CHROME_FLAGS:((process.env.CHROME_FLAGS||'')+' --touch-events=enabled').trim()}}).trim();
  kids.push({pid:+pid});
  const srv=spawn(process.execPath,[path.join(REPO,'scripts','serve.mjs'),'--port',String(SRV)],{cwd:REPO,stdio:'ignore'});kids.push({pid:srv.pid});
  for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${SRV}/`);if(r)break;}catch(e){}await sleep(100);}
}
const checks=[];let shotN=0;
const check=(name,cond,info)=>{checks.push({name,ok:!!cond,info:info===undefined?null:info});console.log((cond?'ok   ':'FAIL ')+name+(info!==undefined?'  '+JSON.stringify(info).slice(0,260):''));};
const URL=`http://127.0.0.1:${SRV}/${BUILD}?b=${Date.now()}`;
/* leftover tabs (an earlier run) could still be hosting or joining rooms on the same origin: close every page but one */
{const list=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const pages=list.filter(t=>t.type==='page');
  for(const t of pages.slice(1))await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);}
const RC='Q'+Math.random().toString(36).slice(2,6).toUpperCase().replace(/[^A-Z2-9]/g,'Z');   /* a fresh room code per run */
const H=await connect(PORT),G=await connect(PORT,{fresh:true});
if(PHONE)await G.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await H.open(URL);await G.open(URL);
if(PHONE){await G.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
  await G.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await G.ev(`dispatchEvent(new Event('resize'))`);}
const STEP=`window.__T=window.__T||700000;window.stp=n=>{for(let i=0;i<(n||1);i++){__T+=40;__vox.frameStep(__T);}};`;
await H.ev(STEP);await G.ev(STEP);
/* both games run a few frames, then the wire gets a moment */
const both=async(n,ms)=>{for(let i=0;i<(n||1);i++){await H.ev('stp(1)');await G.ev('stp(1)');}await sleep(ms==null?60:ms);};
/* a screenshot that never comes back (a renderer that cannot make a frame) must not hang the rig: 60 s, then on */
const shot=async(C,name)=>{const f=path.join(SH,String(++shotN).padStart(2,'0')+'_'+name+'.jpg');
  await C.send('Page.bringToFront');   /* headless Chrome draws no frames for a tab behind another: no screenshot either */
  const r=await Promise.race([C.shot(f).then(()=>'ok'),sleep(60000).then(()=>'timeout')]);if(r!=='ok')console.log('shot timed out: '+name);return f;};
const S=JSON.stringify;

/* ===== the host opens a world ===== */
await H.ev(`try{localStorage.removeItem('vx_vxw:netqa_host');}catch(e){}__vox.startNewWorld('netqa_host','4242','s');__vox.GR.mobSpawn=false;__vox.GR.dayCycle=false;__vox.setTime(0.3);stp(160);`);
const code=await H.ev(`return await __vox.netHostStart({kind:'bc',code:'${RC}'})`);
check('the host opens the world to friends: room code '+code,code===RC&&(await H.ev(`return __vox.NET.role`))==='host');
/* ===== the guest joins (on a phone: through the panel, with taps) ===== */
const gNames=await G.ev(`return __vox.TCH?__vox.TCH.on:null`);
if(PHONE){
  check('the phone guest sees touch controls',gNames===true);
  await G.ev(`document.getElementById('t_go_net').click();`);await sleep(200);
  check('🌐 Multiplayer on the title opens the panel with a code box',(await G.ev(`return !!document.getElementById('net_code')&&__vox.getNetp()`))===true);
  await G.ev(`const c=document.getElementById('net_code');c.value='${RC.toLowerCase()}';`);
  /* the join button goes over the BroadcastChannel transport in the rig: the panel calls netJoin(code); point it at bc */
  await G.ev(`__vox.NET.kind='bc';[...document.querySelectorAll('#net_body button')].find(b=>b.textContent==='Join world').click();`);
}else await G.ev(`__vox.netJoin('${RC}',{kind:'bc'}).catch(e=>{window.__jerr=e.message;});`);
for(let i=0;i<60;i++){await both(2,100);if(await G.ev(`return playing&&__vox.NET.role==='client'&&!!__vox.NET.me`))break;}
const J=await G.ev(`return {playing,role:__vox.NET.role,me:__vox.NET.me,name:__vox.NET.name,seed:SEED,err:__vox.NET.err||window.__jerr||'',
  world:WORLD.name,peers:[...__vox.NET.peers.values()].map(p=>p.name),panel:__vox.getNetp(),dim:DIM}`);
const HS=await H.ev(`return {seed:SEED,name:__vox.NET.name}`);
check('the guest is in the host’s world (same seed, a guest id, the host in its room)',J.playing&&J.role==='client'&&J.me==='g1'&&J.seed===HS.seed&&J.peers.length===1,J);
check('the panel closed itself after joining',J.panel===false);
check('the guest never saves the host’s world: no saved world, Continue not pointed at it',(await G.ev(`await saveToStorage(WORLD.name,true);
  return localStorage.getItem('vx_vxw:'+WORLD.name)===null&&localStorage.getItem('vx_vxwlast')!==WORLD.name`))===true);
await both(30,150);await both(10);
const HB=await H.ev(`const p=__vox.NET.peers.get('g1');return {n:__vox.NET.peers.size,body:!!(p&&p.body),bx:p&&p.body?+p.body.x.toFixed(1):null,gx:p&&p.pose?p.pose.x:null}`);
check('the host sees the guest’s body where the guest is',HB.n===1&&HB.body&&Math.abs(HB.bx-HB.gx)<1.5,HB);
const GB=await G.ev(`const p=__vox.NET.peers.get('H');return {body:!!(p&&p.body),tag:!!(p&&p.body&&p.body.M.tag),name:p&&p.name}`);
check('the guest sees the host’s body, name tag and all',GB.body&&GB.tag,GB);
/* face each other for the photos */
await H.ev(`const P=__vox.P,b=__vox.NET.peers.get('g1').body;P.yaw=Math.atan2(-(b.x-P.x),-(b.z-P.z));P.pitch=-0.1;stp(2);`);
await G.ev(`const P=__vox.P,b=__vox.NET.peers.get('H').body;P.yaw=Math.atan2(-(b.x-P.x),-(b.z-P.z));P.pitch=-0.1;stp(2);`);
await both(10);await shot(H,'host_sees_guest');await shot(G,'guest_sees_host');

/* ===== blocks ===== */
const BP=await H.ev(`const P=__vox.P;return [Math.floor(P.x)+3,Math.floor(P.y)+2,Math.floor(P.z)]`);
await H.ev(`__vox.setBlock(${BP},__vox.B.GOLD||__vox.B.STONE);stp(1);`);await both(3);
check('a block the host places shows up for the guest',(await G.ev(`return __vox.getBlock(${BP})`))===(await H.ev(`return __vox.getBlock(${BP})`))&&(await G.ev(`return __vox.getBlock(${BP})`))!==0);
await G.ev(`__vox.setBlock(${BP},0);stp(1);`);await both(3);
check('a block the guest breaks is gone for the host',(await H.ev(`return __vox.getBlock(${BP})`))===0);
const far=await H.ev(`const P=__vox.P;return [Math.floor(P.x)+900,40,Math.floor(P.z)+900]`);
await H.ev(`const D=__vox.B.STONE;__vox.forceChunksNear(${far[0]},${far[2]});stp(25);__vox.setBlock(${far},__vox.B.GLASS||D);stp(1);`);await both(3);
{const want=await H.ev(`return __vox.getBlock(${far})`);
  const got=await G.ev(`const x=${far[0]},z=${far[2]},cx=Math.floor(x/16),cz=Math.floor(z/16),m=chunkEdits.get(cx+','+cz);return m?m.get((x-cx*16)+',${far[1]},'+(z-cz*16)):null`);
  check('an edit in a chunk the guest has not built waits in its saved edits ('+got+' = '+want+')',got===want&&want!==0);}
/* a chest */
const CP=[BP[0],BP[1]-1,BP[2]+2];
await H.ev(`__vox.setBlock(${CP},__vox.B.CHEST);const k=bkey(${CP});blockEnts.set(k,{t:'chest',inv:Array(27).fill(null)});blockEnts.get(k).inv[0]={id:__vox.IT.STEAK,count:7};stp(1);`);
await both(20,80);
check('a chest’s contents reach the guest',(await G.ev(`const b=blockEnts.get(bkey(${CP}));return b&&b.inv&&b.inv[0]?b.inv[0].count:0`))===7);
await G.ev(`const b=blockEnts.get(bkey(${CP}));if(b&&b.inv&&b.inv[0])b.inv[0].count=3;stp(1);`);await both(20,80);
check('...and the guest taking some is seen by the host',(await H.ev(`const b=blockEnts.get(bkey(${CP}));return b&&b.inv[0]?b.inv[0].count:-1`))===3,await G.ev(`return {beLast:__vox.NET.beLast.size,keys:[...blockEnts.keys()].slice(0,5),stats:__vox.NET.stats}`));

/* ===== chat, time ===== */
await G.ev(`chatSubmit('hi from the guest');stp(1);`);await both(2);
check('chat: guest to host',(await H.ev(`return CHAT.some(m=>m.txt==='hi from the guest'&&m.from===${S(J.name)})`))===true);
await H.ev(`chatSubmit('hi from the host');stp(1);`);await both(2);
check('chat: host to guest',(await G.ev(`return CHAT.some(m=>m.txt==='hi from the host'&&m.from===${S(HS.name)})`))===true);
await H.ev(`__vox.setTime(0.71);`);await sleep(1100);await both(3);
check('the time of day follows the host',Math.abs((await G.ev(`return timeOfDay`))-0.71)<0.01);
await H.ev(`__vox.setTime(0.3);`);await sleep(1100);await both(3);

/* ===== the host's mobs ===== */
await H.ev(`const p=__vox.NET.peers.get('g1').pose;__vox.spawnMob('zombie',p.x+5,p.y,p.z);window.__z=__vox.entities[__vox.entities.length-1];__z.hp=40;__vox.GR.freezeMobs=true;stp(2);`);
await both(6,80);
const ZP=await G.ev(`const z=[...__vox.NET.pup.values()].find(e=>e.mt==='zombie');return z?{x:+z.x.toFixed(1),np:z.np,nid:z.nid}:null`);
check('the host’s zombie streams to the guest as a puppet',!!ZP&&ZP.np===1,ZP);
const hp0=await H.ev(`return __z.hp`);
await G.ev(`const z=[...__vox.NET.pup.values()].find(e=>e.mt==='zombie');z.hurtT=0;__vox.hurtMob(z,6,1,0);stp(1);`);await both(3);
check('the guest’s hit hurts the host’s real zombie ('+hp0+' -> '+(await H.ev(`return __z.hp`))+')',(await H.ev(`return __z.hp`))===hp0-6);
check('the guest has no mobs of its own while it is with the host',(await G.ev(`return __vox.entities.filter(e=>e.t==='mob'&&!e.dead&&!e.np&&!e.netp).length`))===0);
const ghp0=await G.ev(`return __vox.P.hp`);
await H.ev(`const p=__vox.NET.peers.get('g1').body,bx=Math.floor(p.x),by=Math.floor(p.y),bz=Math.floor(p.z);   /* headroom: a ledge above the body strands the zombie on it */
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=0;dy<=4;dy++)__vox.setBlock(bx+dx,by+dy,bz+dz,0);stp(2);`);await both(3);
await H.ev(`__vox.GR.freezeMobs=false;const p=__vox.NET.peers.get('g1').body;__z.x=p.x+1.2;__z.z=p.z;__z.y=p.y;__z.atkT=0;`);
for(let i=0;i<20;i++){await both(2,40);if((await G.ev(`return __vox.P.hp`))<ghp0)break;}
check('the host’s zombie hunts the guest and its hit lands on the guest ('+ghp0+' -> '+(await G.ev(`return __vox.P.hp`))+')',(await G.ev(`return __vox.P.hp`))<ghp0,
  await H.ev(`const p=__vox.NET.peers.get('g1');return {z:[__z.x,__z.y,__z.z].map(v=>+v.toFixed(2)),zd:__z.dead,mode:__z.mode,b:[p.body.x,p.body.y,p.body.z].map(v=>+v.toFixed(2)),pvp:__vox.NET.pvp,god:__vox.GR.god,fm:__vox.GR.freezeMobs}`));
await H.ev(`__z.hurtT=0;__vox.hurtMob(__z,999,0,0);stp(2);`);await both(4);
check('a mob the host kills is gone for the guest',(await G.ev(`return [...__vox.NET.pup.values()].filter(e=>e.mt==='zombie'&&!e.dead).length`))===0);
await G.ev(`__vox.P.hp=20;`);

/* ===== drops ===== */
await G.ev(`__vox.P.inv=__vox.P.inv.map(()=>null);redrawHotbar();`);
await H.ev(`const p=__vox.NET.peers.get('g1').pose;__vox.spawnDrop(p.x,p.y+0.3,p.z,{id:__vox.IT.APPLE,count:5},0,0,0);window.__d=__vox.entities[__vox.entities.length-1];stp(2);`);
for(let i=0;i<12;i++)await both(3,60);
check('the guest picks up the host’s drop (5 apples in the inventory)',(await G.ev(`return __vox.P.inv.reduce((n,s)=>n+(s&&s.id===__vox.IT.APPLE?s.count:0),0)`))===5);
check('...and it is gone on the host (first come, first served)',(await H.ev(`return !!__d.dead`))===true);

/* ===== PvP ===== */
await H.ev(`__vox.P.hp=20;__vox.P.hurtT=0;`);
await G.ev(`const b=__vox.NET.peers.get('H').body;b.hurtT=0;__vox.hurtMob(b,4,1,0);stp(1);`);await both(3);
check('PvP: the guest hits the host (20 -> '+(await H.ev(`return __vox.P.hp`))+')',(await H.ev(`return __vox.P.hp`))===16);
await G.ev(`__vox.P.hp=20;__vox.P.hurtT=0;`);
await H.ev(`const b=__vox.NET.peers.get('g1').body;b.hurtT=0;__vox.hurtMob(b,5,1,0);stp(1);`);await both(3);
check('PvP: the host hits the guest (20 -> '+(await G.ev(`return __vox.P.hp`))+')',(await G.ev(`return __vox.P.hp`))===15);
await H.ev(`__vox.netSetPvp(false);stp(1);`);await both(3);
await H.ev(`__vox.P.hp=20;__vox.P.hurtT=0;`);
await G.ev(`const b=__vox.NET.peers.get('H').body;b.hurtT=0;__vox.hurtMob(b,4,1,0);stp(1);`);await both(3);
check('PvP off: the guest’s hit does nothing (and the guest knows it is off)',(await H.ev(`return __vox.P.hp`))===20&&(await G.ev(`return __vox.NET.pvp`))===false);
await H.ev(`__vox.netSetPvp(true);`);

/* ===== Tab list, the badge ===== */
await H.ev(`tabHeld=true;stp(2);`);
check('the host’s Tab list shows the guest',(await H.ev(`renderTab();return document.getElementById('tablist').textContent`)).includes(J.name));
await H.ev(`tabHeld=false;stp(1);`);
check('the corner badge shows the room on both screens',(await H.ev(`return document.getElementById('netbadge').textContent`)).includes(RC)&&(await G.ev(`return document.getElementById('netbadge').textContent`)).includes(RC));
await H.ev(`openNetPanel();`);await sleep(200);await shot(H,'host_panel');
check('the host’s Multiplayer panel shows the code and the guest with a Remove button',(await H.ev(`const t=document.getElementById('net_body').textContent;return t.includes('${RC}')&&t.includes(${S(J.name)})&&t.includes('Remove')`))===true);
await H.ev(`closeNetPanel();resumeGame&&0;`);

/* ===== vehicles, looks and doings ===== */
await H.ev(`const p=__vox.NET.peers.get('g1').pose;__vox.spawnCar(p.x+2.5,p.y,p.z,0);window.__car=__vox.entities[__vox.entities.length-1];stp(2);`);
await both(6,80);
const pc=await G.ev(`const c=[...__vox.NET.pup.values()].find(e=>e.t==='car');return c?{nid:c.nid}:null`);
check('the host’s parked car shows up on the guest’s screen',!!pc);
await G.ev(`const c=[...__vox.NET.pup.values()].find(e=>e.t==='car');__vox.netRideReq(c);`);await both(4,120);
check('the guest climbs in: the host hands the car over, the guest drives it',(await G.ev(`return !!(__vox.P.ride&&__vox.P.ride.t==='car'&&__vox.P.ride.netOwn)`))===true&&(await H.ev(`return !!__car.dead`))===true);
await G.ev(`__vox.P.ride.yaw=0.8;stp(1);`);await both(8,80);
check('the host sees the guest sitting in the car (a ride puppet under the body)',(await H.ev(`const p=__vox.NET.peers.get('g1');return !!(p.rideE&&p.rideE.t==='car'&&!p.rideE.dead&&p.body)`))===true);
await H.ev(`const P=__vox.P,b=__vox.NET.peers.get('g1').body;P.yaw=Math.atan2(-(b.x-P.x),-(b.z-P.z));P.pitch=-0.2;stp(2);`);await both(4);
await shot(H,'host_sees_guest_driving');
await G.ev(`__vox.P.ride=null;stp(1);`);await both(6,120);
check('the guest climbs out: the car is parked back in the host’s world',(await H.ev(`return __vox.entities.filter(e=>e.t==='car'&&!e.dead&&!e.np).length`))===1&&(await H.ev(`const p=__vox.NET.peers.get('g1');return !p.rideE`))===true);
await G.ev(`__vox.P.cos=__vox.P.cos||{};__vox.P.cos.hat='crown';openModal('inv');stp(1);`);await both(6,80);
const tagInfo=await H.ev(`const b=__vox.NET.peers.get('g1').body;return {tag:b.M._tagTxt,hat:b.M._hat}`);
check('the guest’s crown is on its body and its name tag says it is in its inventory 🎒',tagInfo.hat==='crown'&&/\u{1F392}/u.test(tagInfo.tag),tagInfo);
await G.ev(`closeModal();stp(1);`);await both(3);
await shot(H,'host_sees_guest_crown');

/* ===== Puppet Purgatory together: the host's cast is the guest's cast ===== */
await H.ev(`const P=__vox.P;window.__ret=[P.x,P.y,P.z];P.mode='c';__vox.setDim('puppet',0.5,63,-60);stp(40);`);   /* creative: a teleport into the air is no fall */await both(2);
await G.ev(`__vox.P.mode='c';__vox.setDim('puppet',2.5,63,-60);stp(40);`);await both(20,80);
{const a=await H.ev(`const p=__vox.NET.peers.get('g1');return {body:!!p.body,d:p.pose&&p.pose.d,dead:p.pose&&p.pose.dead,me:DIM}`),b=await G.ev(`const p=__vox.NET.peers.get('H');return {body:!!p.body,d:p.pose&&p.pose.d,me:DIM,dead:__vox.P.dead}`);
  check('both in Puppet Purgatory, they see each other',a.body&&a.d==='puppet'&&b.body,{a,b});}
await H.ev(`const p=__vox.NET.peers.get('g1').pose;__vox.GR.freezeMobs=true;__vox.spawnMob('pghog',p.x+4,p.y,p.z);window.__hog=__vox.entities[__vox.entities.length-1];stp(2);`);await both(8,80);
check('the host’s Purgatory hog streams to the guest (built by the Purgatory cast’s own mesh)',(await G.ev(`return [...__vox.NET.pup.values()].some(e=>e.mt==='pghog'&&!e.dead)`))===true);
const hh0=await H.ev(`return __hog.hp`);
await G.ev(`const z=[...__vox.NET.pup.values()].find(e=>e.mt==='pghog');z.hurtT=0;__vox.hurtMob(z,5,1,0);stp(1);`);await both(3);
check('the guest’s hit lands on the real hog ('+hh0+' -> '+(await H.ev(`return __hog.hp`))+')',(await H.ev(`return __hog.hp`))<hh0);
check('the guest runs no Purgatory cast of its own while the host is there',(await G.ev(`return __vox.entities.filter(e=>e.t==='mob'&&!e.dead&&!e.np&&!e.netp&&__vox.MOBT[e.mt]&&__vox.MOBT[e.mt].pmob).length`))===0);
await shot(G,'guest_purgatory');
await H.ev(`__hog.hurtT=0;__vox.hurtMob(__hog,999,0,0);__vox.GR.freezeMobs=false;__vox.setDim('over',...__ret);__vox.P.mode='s';stp(30);`);await G.ev(`__vox.P.mode='s';__vox.setDim('over',__vox.P.spawn[0],__vox.P.spawn[1],__vox.P.spawn[2]);stp(30);`);await both(20,80);

/* ===== Malgorath together: the host's fight on the guest's screen ===== */
{const tp=(C,r,th)=>C.ev(`const F=__vox.mgF(),x=1000.5+Math.cos(${th})*${r},z=1000.5+Math.sin(${th})*${r};__vox.forceChunksNear(x,z);__vox.forceChunksNear(1000,1000);
    const P=__vox.P;P.x=Math.floor(x)+0.5;P.z=Math.floor(z)+0.5;P.y=F;P.vx=P.vy=P.vz=0;P.fallD=0;P.yaw=Math.atan2(-(1000.5-P.x),-(1000.5-P.z));P.pitch=0.35;stp(30);`);
  await H.ev(`__vox.GR.god=true;`);await tp(H,15,Math.PI);await tp(G,13,Math.PI+0.5);await both(30,40);
  await H.ev(`__vox.mgSkipTo(1);`);
  for(let i=0;i<80;i++){await both(5,30);if(await H.ev(`return !__vox.getCUT().on&&__vox.mgInfo().live===1`))break;}
  await both(40,40);
  const gm=await G.ev(`const b=__vox.getMGF().boss;return {boss:!!b,np:b&&b.np,mgBoss:b&&b.mgBoss,hp:b&&b.hp,live:__vox.mgInfo().live,bar:(document.getElementById('mgbar')||{style:{}}).style.display,round:__vox.getMALG().round}`);
  const hm=await H.ev(`const b=__vox.getMGF().boss;return {hp:b&&b.hp,nid:b&&b.nid,live:__vox.mgInfo().live}`);
  check('Malgorath: the host’s live fight is on the guest’s screen (his body a puppet, his bar up, the same health)',gm.boss&&gm.np===1&&gm.mgBoss===1&&gm.live===1&&gm.bar==='block'&&Math.abs(gm.hp-hm.hp)<20,{gm,hm});
  await shot(G,'guest_sees_malgorath');await shot(H,'host_fights_with_guest');
  let tel=0;for(let i=0;i<60&&!tel;i++){await both(3,30);tel=await G.ev(`return __vox.mgTel().tel.length`);}
  check('his drawings (the attacks he telegraphs) are drawn on the guest’s screen too',tel>0,{tel});
  if(tel)await shot(G,'guest_sees_his_tell');
  await H.ev(`__vox.getMGF().boss.hurtT=0;`);const bh0=await H.ev(`return __vox.getMGF().boss.hp`);
  await G.ev(`const b=__vox.getMGF().boss;b.hurtT=0;window.HIT_HOW='melee';__vox.hurtMob(b,13,1,0);stp(1);`);await both(3,60);
  const bh1=await H.ev(`return __vox.getMGF().boss.hp`);
  check('the guest’s sword on his hide counts on the host’s Malgorath ('+bh0+' -> '+bh1+')',bh1<bh0,{bh0,bh1});
  /* the end of the world, together */
  await H.ev(`const p=__vox.NET.peers.get('g1').pose;__vox.startDisaster('tornado',p.x+12,p.z);stp(2);`);await both(12,60);
  check('a tornado on the host is a twister on the guest’s screen',(await G.ev(`return __vox.entities.some(e=>e.t==='twister'&&e.fx===1&&!e.dead)`))===true);
  await shot(G,'guest_sees_host_tornado');
  await H.ev(`__vox.endDisaster(true);__vox.P.pitch=0;__vox.fireLaser();stp(1);`);await both(1,60);
  check('the host’s laser eyes draw their beam on the guest’s screen',(await G.ev(`return __vox.entities.some(e=>e.t==='beam'&&!e.dead)`))===true);
  await both(60,30);check('the guest’s copy of the tornado goes when the host’s does',(await G.ev(`return !__vox.entities.some(e=>e.t==='twister'&&!e.dead)`))===true);
  await H.ev(`__vox.GR.god=false;const P=__vox.P;P.x=__ret[0];P.y=__ret[1]+0.5;P.z=__ret[2];P.vx=P.vy=P.vz=0;P.fallD=0;stp(40);`);
  await G.ev(`const P=__vox.P;P.x=P.spawn[0];P.y=P.spawn[1]+0.5;P.z=P.spawn[2];P.vx=P.vy=P.vz=0;P.fallD=0;stp(40);`);await both(80,30);
  check('both walk away: his fight goes dormant on the host, the mirror goes on the guest',(await G.ev(`return !__vox.getMGF().boss&&__vox.mgInfo().live===0`))===true);}

/* ===== the guest leaves and comes back with its things ===== */
await G.ev(`__vox.P.inv[3]={id:__vox.IT.STEAK,count:9};redrawHotbar();`);
await G.ev(`await quitToTitle();`);await sleep(400);await both(4,100);
check('the guest leaves: back on the title, the host sees them go',(await G.ev(`return !playing&&!__vox.NET.on`))===true&&(await H.ev(`return __vox.NET.peers.size`))===0);
check('the host keeps the guest’s things for next time',(await H.ev(`const g=__vox.NET.guests[${S(J.name)}];return !!g&&g.player.inv.some(s=>s&&s.id===__vox.IT.STEAK&&s.count===9)`))===true);
await G.ev(`__vox.netJoin('${RC}',{kind:'bc'}).catch(e=>{window.__jerr=e.message;});`);
for(let i=0;i<60;i++){await both(2,100);if(await G.ev(`return playing&&!!__vox.NET.me`))break;}
check('back in: the guest’s steak is still there',(await G.ev(`return __vox.P.inv.some(s=>s&&s.id===__vox.IT.STEAK&&s.count===9)`))===true);
await H.ev(`await saveToStorage('netqa_host',true);`);
check('the host’s world save remembers its guests',(await H.ev(`const s=JSON.parse(localStorage.getItem('vx_vxw:netqa_host'));return !!(s.net&&s.net.guests&&s.net.guests[${S(J.name)}])`))===true);

/* ===== the host closes the world ===== */
await H.ev(`__vox.netStop('close');stp(1);`);
for(let i=0;i<20;i++){await both(1,100);if(!(await G.ev(`return playing`)))break;}
check('the host closes the world: the guest is back on the title, told why',(await G.ev(`return !playing&&!__vox.NET.on`))===true);
await shot(G,'guest_back_on_title');
const errs=C=>C.logs.filter(l=>/^(error|exception)/.test(l));
console.log('host warnings:',H.logs.slice(0,8));console.log('guest warnings:',G.logs.slice(0,8));
check('zero console errors / exceptions (host)',errs(H).length===0,errs(H).slice(0,4));
check('zero console errors / exceptions (guest)',errs(G).length===0,errs(G).slice(0,4));
check('sound never on',(await H.ev(`return soundOn`))===false&&(await G.ev(`return soundOn`))===false);
await H.ev(`try{localStorage.removeItem('vx_vxw:netqa_host');}catch(e){}`);
await H.restoreOG();H.close();G.close();
try{execFileSync('python3',[path.join(REPO,'tools','qa','ui','ui_sheet.py'),OUT],{stdio:'inherit'});}catch(e){}
const pass=checks.filter(c=>c.ok).length,fail=checks.length-pass;
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({build:BUILD,checks,date:new Date().toISOString()},null,1));
console.log(`net_qa: ${pass} passed, ${fail} failed; shots + summary.json in ${rel(OUT)}`);
stopKids();process.exit(fail?1:0);
