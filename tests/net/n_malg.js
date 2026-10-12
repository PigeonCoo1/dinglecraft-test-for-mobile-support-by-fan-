/* n_malg.js (v7.1 The Link Update, gate x1): Malgorath together (src/net/n6_malg.js) over the memory transport. One boot: first
   this game is the HOST of a live fight and the suite plays a guest on his plate, then it is a GUEST and the suite plays the host.
   1 statics: PART 57 is untouched (the wrappers live in PART 58), every wrapper is a pass-through with the link off
   2 host: the boss, his rig state and his drawings stream to a guest near him; his parts/adds ride the entity stream; a guest's
     hits count (the hide x0.1, a weak point x1); he picks, hits, chomps, throws and heals a guest over the wire; a friend on the
     plate keeps him awake while the host steps off
   3 guest: the mirror (his body made by mgSpawnBoss, a puppet; drawings; bar state), hits go to the host, his adds are puppets,
     his damage, chomp, throw, bone pile and heal land here; the local fight never runs; a silent host drops the mirror */
'use strict';
const boot=require('../lib/mg_boot.js'),{ok,skip}=boot;
const fs=require('fs');
const V=boot({seed:20261012});
const step=boot.stepper(900000);
V.NET.clock=()=>step.now();
const SRC=boot.P.SRC.root;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function drain(T){
  const out=[],parts=new Map();
  for(const [to,s] of T.out.splice(0,T.out.length)){
    if(s==='#drop'){out.push({to,m:{t:'#drop'}});continue;}
    if(s.charCodeAt(0)===1){const a=s.indexOf('|'),b=s.indexOf('|',a+1),c=s.indexOf('|',b+1),id=to+s.slice(1,a),i=+s.slice(a+1,b),n=+s.slice(b+1,c);
      let Q=parts.get(id);if(!Q){Q={n,p:[]};parts.set(id,Q);}Q.p[i]=s.slice(c+1);if(Q.p.filter(x=>x!=null).length===Q.n)out.push({to,m:JSON.parse(Q.p.join(''))});continue;}
    out.push({to,m:JSON.parse(s)});
  }
  return out;
}
const send=(trId,m)=>V.netTrMsg(trId,JSON.stringify(m));
const of=(L,t,to)=>L.filter(x=>x.m.t===t&&(to==null||x.to===to));
const info=()=>V.mgInfo(),G=()=>V.getMG2(),bossE=()=>boot.boss(V);
const until=(f,max)=>{for(let i=0;i<(max||600);i++){if(f())return true;step(1);}return !!f();};

boot.run(async()=>{
  /* ===== 1. statics ===== */
  const n6=fs.readFileSync(SRC+'net/n6_malg.js','utf8'),order=fs.readFileSync(SRC+'ORDER.txt','utf8');
  ok('n6_malg.js is PART 58, after the UI file and before PART 57 (its wrappers must run before PART 57 captures the functions)',
    n6.startsWith('/* ---- PART 58: n6_malg.js ---- */\n')&&order.indexOf('net/n5_ui.js\n')<order.indexOf('net/n6_malg.js\n')&&order.indexOf('net/n6_malg.js\n')<order.indexOf('\nmalgorath/m0_contract.js\n'));
  const wraps=[...n6.matchAll(/^if\(typeof (\w+)==='function'\)\{const o=\1;\1=function/gm)].map(m=>m[1]);
  ok('every wrapper is guarded (a build without PART 57 skips it) and keeps the original as o: '+wraps.join(' '),wraps.length>=18&&
    wraps.every(n=>new RegExp('^function '+n+'\\(','m').test(fs.readdirSync(SRC+'malgorath').map(f=>f.endsWith('.js')?fs.readFileSync(SRC+'malgorath/'+f,'utf8'):'').join('\n'))));
  ok('PART 57 names no PART 58 state (the wrappers are the only bridge)',!fs.readdirSync(SRC+'malgorath').filter(f=>f.endsWith('.js')).some(f=>/\bNET\b|\bnet[A-Z]\w*\(/.test(fs.readFileSync(SRC+'malgorath/'+f,'utf8'))));
  ok('the fight API captured the wrappers (MGREG.fight.hit, MGEX.mg2Hit are the wrapped mg2Hit)',V.MGREG.fight.hit===V.mg2Hit&&/netg/.test(String(V.mg2Hit)));
  if(boot.mgStubbed('2')){skip('n_malg fight','M2 is on its stub');return;}

  /* ===== 2. host ===== */
  boot.world(V,'nmh','1337',step);boot.kit(V,'A');V.GR.god=true;
  const T=V.netMemTransport();await V.netHostStart({tr:T,code:'MALGA'});
  V.netTrJoin('trA');send('trA',{t:'hi',v:V.NET_V,gv:V.GAME_VERSION,name:'Kim'});
  let L=drain(T);const GN=of(L,'wel','trA')[0].m.name;
  boot.bite(V,step,{r:15});
  const F=V.mgF(),gx=1000.5-12,gz=1000.5+3;
  const pose=(x,y,z,o)=>send('trA',{t:'po',p:Object.assign({x,y,z,yaw:0,pitch:0,d:'over',sn:0,sw:0,h:0,hp:20,dead:0,rd:0},o||{})});
  pose(gx,F,gz);step(3);
  V.mgSkipTo(1);until(()=>!V.getCUT().on&&info().live,600);step(4);
  const boss=bossE();
  ok('the host is in a live Round I with the guest’s body on his plate',!!boss&&info().live===1&&V.mgArena(gx,F,gz)&&!!V.NET.peers.get('g1').body);
  step(4);L=drain(T);
  const mg=of(L,'mg','trA').pop();
  ok('his state streams to the guest near him: live, the round, his body ['+(mg&&mg.m.b||[]).slice(0,4).join(',')+']',!!mg&&mg.m.lv===1&&mg.m.r===1&&
    Array.isArray(mg.m.b)&&mg.m.b[0]===boss.nid&&Math.abs(mg.m.b[1]-boss.x)<0.01&&mg.m.b[5]===Math.round(boss.hp*10)/10);
  ok('...with the rig state, the look and his drawings',mg.m.A&&mg.m.A.round===1&&typeof mg.m.A.stance==='string'&&mg.m.L&&'dark' in mg.m.L&&Array.isArray(mg.m.tl));
  const ad=V.netMgWho(GN);
  ok('the guest is someone he can see: a target like the bots, by name, in play',!!ad&&ad.netg==='g1'&&V.netMgGuests().length===1&&V.netMgGuests()[0]===ad);
  /* the guest's hits */
  boss.hurtT=0;let h0=boss.hp;send('trA',{t:'hit',n:boss.nid,d:13,kx:1,kz:0,how:'melee'});
  ok('a guest’s sword on the hide counts like the host’s (x0.1): '+(h0-boss.hp).toFixed(2),Math.abs(h0-boss.hp-1.3)<1e-6);
  ok('...and the hit is in his book under the guest’s name',V.mgTel().hits.some(h=>h[1]==='dan')&&G().dmg8.some(h=>h[1]===GN));
  h0=boss.hp;send('trA',{t:'hit',n:boss.nid,d:13,how:'arrow'});step(8);
  ok('a guest’s arrow on the hide does nothing (his rules, not ours)',boss.hp===h0);
  const sawWin=until(()=>{const w=G().win;return !!(w&&w.part&&!w.part.dead);},700);
  if(sawWin){const w=G().win;drain(T);step(7);L=drain(T);
    const en=of(L,'en','trA').pop(),pr=en&&(en.m.g||[]).find(r=>r[1]==='mgpart');
    ok('an open weak point rides the entity stream to the guest (mt mgpart, its box): '+(pr?pr.slice(0,2).join(' '):'none'),!!pr&&pr[0]===w.part.nid&&pr[7]>0);
    step(8);h0=boss.hp;const d0=w.dmg;send('trA',{t:'hit',n:w.part.nid,d:9,how:'melee'});
    ok('a guest’s hit on the weak point lands at x1 (a full partner, not a bot at x0.5): '+(h0-boss.hp).toFixed(2),Math.abs(h0-boss.hp-9)<1e-6&&Math.abs(w.dmg-d0-9)<1e-6);}
  else skip('weak points over the link','no window opened in time');
  ok('the boss himself never rides the entity stream (only his state message)',!of(L,'en','trA').some(x=>(x.m.g||[]).some(r=>r[1]==='demon')||x.m.m.some(r=>r[1]==='demon')));
  /* his hits on the guest */
  pose(gx,F,gz);step(2);drain(T);
  const lost=V.mg2Hit(ad,6,0.4,'slap',{atk:1,kx:1,kz:0});L=drain(T);
  const d=of(L,'mgd','trA')[0];
  ok('his hit on a guest goes over the wire (the guest’s screen does the armour): '+(d&&JSON.stringify(d.m)),lost===6&&!!d&&d.m.n===6&&d.m.p===0.4&&d.m.how==='slap'&&d.m.f===1&&d.m.kx===1);
  ok('...and the spacing rule holds (a second impact within 0.5 s is skipped)',V.mg2Hit(ad,6,0.4,'slap',{atk:1})===0&&!of(drain(T),'mgd','trA').length);
  V.mg2Chomp(ad,'chomp');L=drain(T);const ce=of(L,'mge','trA')[0];
  ok('a chomp on a guest: 10, then spat onto his plate',!!ce&&ce.m.n===10&&Array.isArray(ce.m.to)&&V.mgSite(ce.m.to[0],ce.m.to[1],ce.m.to[2]));
  V.mg2Knock(ad,1000.5,1000.5,4,{apex:1});L=drain(T);const kk=of(L,'mgk','trA')[0];
  ok('a knock: the host picks the landing, the guest flies it',!!kk&&kk.m.d>0&&Math.hypot(kk.m.x1-1000.5,kk.m.z1-1000.5)>Math.hypot(gx-1000.5,gz-1000.5));
  /* the host steps off his plate; the guest stays */
  pose(gx,F,gz);const away0=G().away;boot.lip(V,step);for(let i=0;i<40;i++){pose(gx,F,gz);step(1);}
  ok('a friend on his plate keeps him awake while the host stands at the Bone Pile (away '+G().away.toFixed(2)+')',G().away===0&&info().live===1);
  V.netStop('test');drain(T);
  ok('with the link closed he is the host’s alone again (no guests in his list)',V.netMgGuests().length===0&&!V.netMgWho(GN));

  /* ===== 3. guest ===== */
  boot.world(V,'nmg','1337',step);boot.bite(V,step,{r:15});
  const H=V.snapshot('hostworld');H.bots=[];H.ents=[];delete H.net;
  H.player={x:V.P.x,y:V.P.y,z:V.P.z,yaw:0,pitch:0,hp:20,hunger:20,sel:0,spawn:[V.P.x,V.P.y,V.P.z],inv:[]};
  await V.quitToTitle();
  const T2=V.netMemTransport();const jp=V.netJoin('MALGX',{tr:T2});await sleep(0);drain(T2);
  send('HOST',{t:'wel',id:'g1',name:'Kim',code:'MALGX',pvp:true,hostDim:'over',time:0.4,players:[{id:'H',name:'Host',look:V.netLook('Host'),pose:{x:V.P?V.P.x:H.player.x,y:H.player.y,z:H.player.z+2,yaw:0,pitch:0,d:'over',hp:20}}],w:H});
  await jp;step(30);
  ok('a guest at the Bite with no word from the host: no fight here, no boss (his own fight never runs on a guest)',!bossE()&&info().live===0);
  const A={round:1,stance:'lean',jaw:0.3,heart:60,breathe:0,split:0,tongue:0,armL:{pose:'rest',t:0},armR:{pose:'rest',t:0},eyeL:0,eyeR:0,tail:{pose:'rest',t:0},
    cubeGlow:0,belly:{bulge:0,lift:0,glow:0,items:[]},strata:{tree:0,roof:1},tel:[0,0,0,0,0],crack:{hue:0,i:0.6},rim:1,commit:0,vuln:0,hurt:0,flinch:0,recoil:0,
    light:{at:'chest',i:1.6,col:0xff5a22},hat:null,heads:0,dead:0,yaw:0.5,x:1000.5,y:F-8,z:1000.5,lookX:0,lookY:0,lookZ:0};
  let clock=50;
  const mgMsg=o=>send('HOST',Object.assign({t:'mg',c:clock,lv:1,r:1,fr:1,ph:'live',met:1,dd:0,hat:null,hd:0,b:[4242,1000.5,F-8,1000.5,0.5,250,2.5,13],A,
    L:{live:1,round:1,phase:'live',flash:0,pulse:0.5,eclipse:0,dawn:0,dark:0,heart:60,light:A.light},tl:[{id:7,kind:'slap',col:'red',shape:'disc',x:1000.5+10,z:1000.5,r:2.5,locked:0}],fx:[],pl:0},o||{}));
  mgMsg();step(2);
  let gb=bossE();
  ok('his state arrives: a boss here, made by mgSpawnBoss, a puppet of the host’s (nid 4242), his bar at 250',!!gb&&gb.np===1&&gb.nid===4242&&gb.mgBoss===1&&gb.hp===250&&info().live===1&&V.getMGF().boss===gb);
  ok('...his drawings are drawn here (the host’s slap disc)',V.mgTel().tel.some(t=>t.kind==='slap'&&Math.abs(t.x-1010.5)<1e-6&&t.r===2.5));
  ok('...and the rig state is his (stance, jaw)',V.getMGA().stance==='lean'&&V.getMGA().jaw===0.3);
  clock+=0.1;mgMsg({tl:[{id:7,kind:'slap',col:'red',shape:'disc',x:1000.5+10,z:1000.5,r:2.5,locked:1}]});step(1);
  ok('a drawing the host locks locks here',V.mgTel().tel.some(t=>t.kind==='slap'&&t.locked===1));
  clock+=0.1;mgMsg({tl:[]});step(1);ok('a drawing the host frees is freed here',!V.mgTel().tel.some(t=>t.kind==='slap'));
  drain(T2);gb.hurtT=0;V.mgHitAs(gb,13,'Dan','melee');L=drain(T2);
  ok('hitting him here asks the host (nid 4242), nothing changes here',of(L,'hit','HOST').some(x=>x.m.n===4242&&x.m.d===13)&&gb.hp===250);
  send('HOST',{t:'en',m:[],dr:[],b:[],v:[],g:[[555,'mgmorsel',1000.5-10,F,1000.5,0,12,0.6,1.2,0,0],[556,'mgpart',1000.5-3,F+2,1000.5,0,999,0.8,1.1,0,'handeye']]});
  const pm=[...V.NET.pup.values()].find(e=>e.mt==='mgmorsel'),pp=[...V.NET.pup.values()].find(e=>e.mt==='mgpart');
  ok('his adds and parts are puppets here (a Morsel; a hand-eye with its box)',!!pm&&pm.np===1&&!!pp&&pp.np===1&&pp.kind==='handeye'&&pp.hw===0.8);
  drain(T2);pp.hurtT=0;V.mgHitAs(pp,9,'Dan','melee');L=drain(T2);ok('...a hit on his weak point goes to the host',of(L,'hit','HOST').some(x=>x.m.n===556));
  step(20);ok('...and they survive this screen’s stray-mob sweep',!pm.dead&&!pp.dead);
  /* his damage */
  V.P.hp=20;V.P.hurtT=0;V.P.armor=[null,null,null,null];send('HOST',{t:'mgd',n:6,p:0.4,how:'slap',f:1});
  ok('his slap from the host lands here (6, no armour)',Math.abs(V.P.hp-14)<1e-6);
  V.P.hp=20;send('HOST',{t:'mgd',n:3,how:'bile',tr:1});ok('true damage ignores everything (bile 3)',V.P.hp===17);
  V.P.hp=20;send('HOST',{t:'mge',why:'chomp',n:10,to:[1000.5-14,F+0.3,1000.5]});
  ok('chomped: 10 off, spat onto his plate where the host said',V.P.hp===10&&Math.abs(V.P.x-986.5)<1e-6&&Math.abs(V.P.y-(F+0.3))<1e-6);
  send('HOST',{t:'mgk',x1:1000.5-18,z1:1000.5,y1:F,d:0.3,a:1,nf:1});step(12);
  ok('thrown: this screen flies the arc to the host’s landing',Math.abs(V.P.x-982.5)<0.01&&Math.abs(V.P.z-1000.5)<0.01);
  send('HOST',{t:'mgh'});ok('his round-end heal heals here too',V.P.hp===20);
  send('HOST',{t:'mgt',p:[1000.5-40,F+3,1000.5]});ok('sent to the Bone Pile when the host says',Math.abs(V.P.x-960.5)<1e-6);
  /* the host goes quiet (left, another dimension, far away): the mirror goes */
  step(80);
  ok('no word for 2.5 s: his body, his drawings and the live flag go (nothing of his is left here)',!bossE()&&info().live===0&&!V.mgTel().tel.length);
  send('HOST',{t:'bye',why:'The host closed the world'});await sleep(20);
  ok('the host closing the world ends it all',!V.NET.on);
});
