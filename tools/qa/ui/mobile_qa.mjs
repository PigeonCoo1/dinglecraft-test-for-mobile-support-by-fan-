#!/usr/bin/env node
/* mobile_qa.mjs: the MUTED browser rig for the v7.0 touch controls (src/ui/p06c_touch.js), with real touch events.

   node tools/qa/ui/mobile_qa.mjs --launch [--port 9401] [--build dist/dinglecraft_v<VER>.html] [--out DIR]
   node tools/qa/ui/mobile_qa.mjs --port 9401 [--server 9501] ...      (your own Chrome + server already running)
     --devices phone,portrait,small,tablet,android   which screens (default: all five)
     --no-play                                         skip the behaviour run (photos only)
     --cdp-touch                                       send gestures with Input.dispatchTouchEvent (needs Chrome started with
                                                       --touch-events=enabled; with rAF frozen the compositor may still drop them)

   Chrome's touch emulation is on (so the page sees a touch screen: ontouchstart, pointer:coarse, maxTouchPoints). Gestures are
   the event sequence a phone browser fires, built in the page (Touch / TouchEvent / PointerEvent at document.elementFromPoint:
   pointerdown then touchstart, touchmove, pointerup then touchend on the start target, and the mouse + click a phone sends after
   an unprevented tap): deterministic, because with rAF frozen the compositor never commits the page's touch-listener regions and
   drops CDP touches at random. --cdp-touch uses Input.dispatchTouchEvent instead. Per device (<name>/NN_view.jpg): the title, play (the pad), the inventory,
   the creative inventory, the pause menu, Settings, the chat, the ... drawer, DEEP DIRT 2D, riding a car; each view measures
   that every visible pad button is inside the window and that no two overlap, and that the open panel fits the window. Once (the
   first device): the stick walks, a drag looks, a tap places, a hold mines, JUMP jumps, double-tap JUMP flies (creative), USE held
   eats, INV + the close button, SPLIT halves a stack, the drawer's Powers opens the powers menu, CHAT + SEND talks, and Touch
   controls: Off hides the pad. 5x6 contact sheets (tools/qa/ui/ui_sheet.py) and summary.json go to --out (default
   out/qa/mobile_qa_<time>/). Exit 1 on any failed check.
   MUTED, always (tools/qa/lib/cdp.mjs): --mute-audio, vx_vox_settings {snd:0,mus:0,tp:'og'} before the page runs, soundOn=false +
   AC.suspend() on every evaluation, rAF disabled, the brain on a dead port; Touch controls back to Auto and tp to 'og' at the
   end. It plays in its own worlds (mobqa*), never the player's. */
import fs from 'fs';import path from 'path';import {spawn,execFileSync} from 'child_process';
import {args,connect,REPO,defaultBuild,outDir,rel} from '../lib/cdp.mjs';

const A=args(),PORT=+(A.port||9401),SRV=+(A.server||PORT+100),BUILD=A.build||defaultBuild();
const OUT=path.resolve(A.out||outDir('mobile_qa'));fs.mkdirSync(OUT,{recursive:true});
const DEV={phone:{w:844,h:390,dpr:3},portrait:{w:390,h:844,dpr:3},small:{w:568,h:320,dpr:2},tablet:{w:1024,h:768,dpr:2},android:{w:915,h:412,dpr:2.625}};
const want=(A.devices||Object.keys(DEV).join(',')).split(',').filter(k=>DEV[k]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const kids=[];
const stopKids=()=>{for(const k of kids){try{process.kill(k.pid,'SIGTERM');}catch(e){}}};
process.on('exit',stopKids);process.on('SIGINT',()=>{stopKids();process.exit(130);});
if(A.launch){
  const prof=path.resolve(A.profile||path.join(REPO,'out','qa','chrome_'+PORT));
  const pid=execFileSync(path.join(REPO,'tools','qa','chrome.sh'),[String(PORT),prof],{encoding:'utf8'}).trim();
  kids.push({pid:+pid});
  const srv=spawn(process.execPath,[path.join(REPO,'scripts','serve.mjs'),'--port',String(SRV)],{cwd:REPO,stdio:'ignore'});
  kids.push({pid:srv.pid});
  for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${SRV}/`);if(r)break;}catch(e){}await sleep(100);}
}
const checks=[];
const check=(name,cond,info)=>{checks.push({name,ok:!!cond,info:info===undefined?null:info});console.log((cond?'ok   ':'FAIL ')+name+(info!==undefined?'  '+JSON.stringify(info).slice(0,240):''));};
const C=await connect(PORT);
const errs=()=>C.logs.filter(l=>/^(error|exception)/.test(l));
await C.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await C.send('Emulation.setEmitTouchEventsForMouse',{enabled:false});
await C.open(`http://127.0.0.1:${SRV}/${BUILD}?b=${Date.now()}`);
const HELP=`window.__mq={T:700000,stp(n){for(let i=0;i<(n||1);i++){this.T+=40;__vox.frameStep(this.T);}},
  box(id){const e=document.getElementById(id);if(!e)return null;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')return null;
    const r=e.getBoundingClientRect();return r.width>0&&r.height>0?{l:r.left,t:r.top,r:r.right,b:r.bottom}:null;},
  pad(){const out=[];for(const e of document.querySelectorAll('#tpad .tbtn,#hotbar')){const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden')continue;
    let p=e.parentElement,hid=false;while(p){if(getComputedStyle(p).display==='none'){hid=true;break;}p=p.parentElement;}if(hid)continue;
    const r=e.getBoundingClientRect();if(r.width>0)out.push({id:e.id||e.textContent.trim(),l:r.left,t:r.top,r:r.right,b:r.bottom});}return out;},
  panel(){let best=null;for(const o of document.querySelectorAll('.ovl')){if(getComputedStyle(o).display==='none')continue;
    for(const c of o.children){const r=c.getBoundingClientRect();if(r.width>0&&(!best||r.width*r.height>best.a))best={id:o.id,l:r.left,t:r.top,r:r.right,b:r.bottom,a:r.width*r.height};}}return best;}};`;
const SYN=`window.__ts=function(type,pts){const S=window.__tsS||(window.__tsS={act:new Map()}),act=S.act;
  const mk=(id,x,y,t)=>new Touch({identifier:id,target:t,clientX:x,clientY:y,pageX:x,pageY:y,screenX:x,screenY:y,radiusX:6,radiusY:6,force:1});
  const pe=(k,id,x,y,t)=>t.dispatchEvent(new PointerEvent(k,{pointerId:100+id,pointerType:'touch',isPrimary:act.size<=1,clientX:x,clientY:y,
    button:k==='pointermove'?-1:0,buttons:k==='pointerup'?0:1,bubbles:true,cancelable:true,composed:true}));
  const fire=(k,t,changed)=>{const all=[...act.values()].map(a=>a.touch);
    return t.dispatchEvent(new TouchEvent(k,{touches:k==='touchend'?all.filter(a=>!changed.includes(a)):all,targetTouches:all.filter(a=>a.target===t),
      changedTouches:changed,bubbles:true,cancelable:true,composed:true}));};
  if(type==='touchStart'){for(const [x,y,id] of pts){if(act.has(id))continue;const t=document.elementFromPoint(x,y)||document.body;const touch=mk(id,x,y,t);
      act.set(id,{touch,t,x,y,moved:false});pe('pointerdown',id,x,y,t);act.get(id).ok=fire('touchstart',t,[touch]);}}
  else if(type==='touchMove'){for(const [x,y,id] of pts){const a=act.get(id);if(!a||(a.x===x&&a.y===y))continue;a.touch=mk(id,x,y,a.t);a.x=x;a.y=y;a.moved=true;
      pe('pointermove',id,x,y,a.t);fire('touchmove',a.t,[a.touch]);}}
  else{const ids=new Set(pts.map(p=>p[2]));for(const [id,a] of [...act]){if(ids.has(id))continue;pe('pointerup',id,a.x,a.y,a.t);
      const ok=fire(type==='touchCancel'?'touchcancel':'touchend',a.t,[a.touch]);act.delete(id);
      if(ok&&a.ok&&!a.moved){for(const k of ['mousedown','mouseup','click'])a.t.dispatchEvent(new MouseEvent(k,{clientX:a.x,clientY:a.y,button:0,bubbles:true,cancelable:true}));}}}};`;
/* touchEnd lists the touches that stay down (Input.dispatchTouchEvent's own convention: an empty list lifts every finger) */
const tp=async(type,pts)=>A['cdp-touch']?C.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id,radiusX:6,radiusY:6,force:1}))})
  :C.ev('if(!window.__ts){'+SYN+'}__ts('+JSON.stringify(type)+','+JSON.stringify(pts)+');');
const center=async id=>C.ev(`const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];`);
/* a press, then a few frames so the pad's context (touchSync, every frame) follows */
const press=async(id,ms,tid)=>{const [x,y]=await center(id);await tp('touchStart',[[x,y,tid||7]]);await sleep(ms||60);await tp('touchEnd',[]);await sleep(30);await C.ev('__mq.stp(2)');};
const layout=async(dir,view,dev)=>{
  const L=await C.ev(`return {pad:__mq.pad(),panel:__mq.panel(),W:innerWidth,H:innerHeight,ctx:__vox.TCH.ctx};`);
  const out=L.pad.filter(b=>b.l<-1||b.t<-1||b.r>L.W+1||b.b>L.H+1).map(b=>b.id);
  check(`${dev} ${view}: every pad button on screen`,out.length===0,out);
  const hit=[];for(let i=0;i<L.pad.length;i++)for(let j=i+1;j<L.pad.length;j++){const a=L.pad[i],b=L.pad[j];
    if(a.l<b.r-2&&b.l<a.r-2&&a.t<b.b-2&&b.t<a.b-2)hit.push(a.id+'/'+b.id);}
  check(`${dev} ${view}: no two pad buttons overlap`,hit.length===0,hit);
  if(L.panel&&L.panel.id!=='title')check(`${dev} ${view}: the ${L.panel.id} panel fits the window`,L.panel.l>=-1&&L.panel.t>=-1&&L.panel.r<=L.W+1&&L.panel.b<=L.H+1,
    {l:Math.round(L.panel.l),t:Math.round(L.panel.t),r:Math.round(L.panel.r),b:Math.round(L.panel.b),W:L.W,H:L.H});
  await C.shot(path.join(dir,view));
};
await C.ev(HELP);
let firstPlay=!A['no-play'];
for(const dev of want){
  const D=DEV[dev],dir=path.join(OUT,D.w+'x'+D.h+'_'+dev);fs.mkdirSync(dir,{recursive:true});
  await C.send('Emulation.setDeviceMetricsOverride',{width:D.w,height:D.h,deviceScaleFactor:D.dpr,mobile:true,screenOrientation:{type:D.w>D.h?'landscapePrimary':'portraitPrimary',angle:D.w>D.h?90:0}});
  await C.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});   /* a metrics override switches touch emulation off again */
  await C.ev(`dispatchEvent(new Event('resize'));if(playing)quitToTitle&&quitToTitle();`);await sleep(300);
  const I=await C.ev(`return {touch:document.body.classList.contains('touch'),on:__vox.TCH.on,coarse:matchMedia('(pointer:coarse)').matches,ots:'ontouchstart' in window,hud:UIS.hud,eff:UIS.eff}`);
  check(`${dev}: the page sees a touch screen and the pad is on (Auto)`,I.on&&I.touch&&I.coarse,I);
  await C.shot(path.join(dir,'01_title.jpg'));
  await C.ev(`__vox.startNewWorld('mobqa_${dev}','4242','s');__vox.GR.mobSpawn=false;__vox.GR.dayCycle=false;__vox.setTime(0.3);__mq.stp(160);`);
  await sleep(100);await C.ev(`__mq.stp(2)`);
  check(`${dev}: in a world the context is play`,(await C.ev(`return __vox.TCH.ctx`))==='play');
  /* rAF is frozen, so nothing commits a frame by itself and the compositor does not know the page's touch listeners yet (it turns
     the touch into a plain tap): a screenshot commits one. Then tap the sky (an empty hand: nothing happens) until a touch arrives */
  await C.ev(`window.__tseen=0;if(!window.__tl){window.__tl=1;addEventListener('touchstart',()=>{window.__tseen++;},true);}__vox.P.sel=8;__vox.P.inv[8]=null;`);
  for(let i=0;i<20&&!(await C.ev('return window.__tseen'));i++){await C.send('Page.captureScreenshot',{format:'jpeg',quality:20});
    await tp('touchStart',[[D.w/2,D.h*0.12,30]]);await tp('touchEnd',[]);await sleep(120);}
  check(`${dev}: touch events reach the page`,(await C.ev('return window.__tseen'))>0);
  await C.ev('__mq.stp(10)');
  await layout(dir,'02_play.jpg',dev);
  if(firstPlay){firstPlay=false;await behaviour(dir);}
  await C.ev(`__vox.openModal('inv');__mq.stp(2);`);await layout(dir,'03_inventory.jpg',dev);
  await C.ev(`__vox.closeModal();__vox.P.mode='c';__vox.openModal('creative');__mq.stp(2);`);await layout(dir,'04_creative.jpg',dev);
  await C.ev(`__vox.closeModal();__vox.P.mode='s';__mq.stp(2);pauseGame();`);await sleep(350);await layout(dir,'05_pause.jpg',dev);
  await C.ev(`hidePause();openSet();`);await sleep(350);await layout(dir,'06_settings.jpg',dev);
  await C.ev(`closeSet();resumeGame();__mq.stp(2);`);
  await press('btnchat');await sleep(350);await C.ev(`__mq.stp(2)`);await layout(dir,'07_chat.jpg',dev);
  await C.ev(`closeChat();__mq.stp(2);`);
  await press('btnmore');await sleep(350);await C.ev(`__mq.stp(2)`);await layout(dir,'08_more.jpg',dev);
  await press('btnmore');
  await C.ev(`const P=__vox.P;__vox.openTerrAt(Math.floor(P.x)+3,Math.floor(P.y),Math.floor(P.z));__mq.stp(4);`);await sleep(350);await C.ev(`__mq.stp(2)`);
  {const q=await C.ev(`return {terr:terrOpen,ctx:__vox.TCH.ctx,on:__vox.TCH.on,seen:__vox.TCH.seen,coarse:matchMedia('(pointer:coarse)').matches,cls:document.body.className,b:!!__mq.box('btnbuild'),j:!!__mq.box('joy')}`);
    check(`${dev}: DEEP DIRT 2D is open, its pad is up`,q.terr&&q.ctx==='terr'&&q.b&&q.j,q);}
  if(dev===want[0]){
    const jx=D.w*0.14,jy=D.h*0.7;
    await tp('touchStart',[[jx,jy,40]]);await tp('touchMove',[[jx+60,jy,40]]);
    check('DEEP DIRT 2D: the stick holds D',(await C.ev(`return KEY.KeyD===true&&KEY.KeyA===false`))===true);
    await tp('touchEnd',[]);check('...and lets go',(await C.ev(`return !KEY.KeyD`))===true);
    await press('btnbuild');check('BUILD lights up and switches the canvas tap to building',(await C.ev(`return __vox.TCH.build&&document.getElementById('btnbuild').classList.contains('on')`))===true);
    const s0=await C.ev(`return TG.sel`);await press('btnitem',40);await sleep(200);await C.ev('__mq.stp(3)');   /* the key is down 140 ms: frames must see it */
    check('ITEM picks the next block ('+s0+' -> '+(await C.ev(`return TG.sel`))+')',(await C.ev(`return TG.sel`))!==s0);
  }
  await layout(dir,'09_deepdirt.jpg',dev);
  await press('btnback');await sleep(300);await C.ev('__mq.stp(2)');
  check(`${dev}: the close button powers DEEP DIRT off (BUILD resets)`,(await C.ev(`return !terrOpen&&!__vox.TCH.build`))===true);
  await C.ev(`__vox.openCine();__mq.stp(4);`);await sleep(300);await C.ev('__mq.stp(2)');
  check(`${dev}: the cinema has its pad (1 2 3 E)`,(await C.ev(`return __vox.TCH.ctx==='cine'&&!!__mq.box('btnc1')&&!!__mq.box('btnce')`))===true);
  await layout(dir,'11_cinema.jpg',dev);
  await C.ev(`__vox.closeCine();__mq.stp(2);const P=__vox.P;__vox.spawnCar(P.x+2,P.y,P.z);P.ride=__vox.entities[__vox.entities.length-1];__mq.stp(4);`);await sleep(350);await C.ev(`__mq.stp(2)`);
  check(`${dev}: in a car the context is ride and SNEAK reads EXIT`,(await C.ev(`return __vox.TCH.ctx+' '+document.getElementById('btnsneak').textContent`))==='ride EXIT');
  await layout(dir,'10_ride.jpg',dev);
  await C.ev(`__vox.P.ride=null;__mq.stp(4);quitToTitle();`);await sleep(300);
}
async function behaviour(dir){
  const S=JSON.stringify;
  const st=async()=>C.ev(`const P=__vox.P;return {x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch,vy:P.vy,fly:!!P.flying,hun:P.hunger,sel:P.sel,ctx:__vox.TCH.ctx,mbl:__vox.MB.l,mbr:__vox.MB.r,f:__vox.TOUCH.f}`);
  const W=await C.ev(`return [innerWidth,innerHeight]`);
  /* the stick */
  await C.ev(`const P=__vox.P;P.yaw=0;P.pitch=0;__mq.stp(30);`);
  let a=await st();
  const jx=W[0]*0.14,jy=W[1]*0.7;
  await tp('touchStart',[[jx,jy,1]]);await tp('touchMove',[[jx,jy-70,1]]);
  const mid=await st();await C.ev(`__mq.stp(30)`);let b=await st();
  check('the stick: pushed up = forward (TOUCH.f '+mid.f.toFixed(2)+'), the player walks '+Math.hypot(b.x-a.x,b.z-a.z).toFixed(2)+' blocks',mid.f>0.5&&Math.hypot(b.x-a.x,b.z-a.z)>1.5);
  await tp('touchEnd',[]);await C.ev(`__mq.stp(2)`);
  check('the stick: let go = stop (TOUCH.f 0)',(await st()).f===0);
  /* look */
  a=await st();
  await tp('touchStart',[[W[0]*0.6,W[1]*0.4,2]]);for(let i=1;i<=6;i++)await tp('touchMove',[[W[0]*0.6+i*15,W[1]*0.4,2]]);await tp('touchEnd',[]);
  b=await st();check('a drag on the right turns the view (yaw '+a.yaw.toFixed(3)+' -> '+b.yaw.toFixed(3)+')',b.yaw<a.yaw-0.2);
  /* stick and look at once (two fingers) */
  a=await st();
  await tp('touchStart',[[jx,jy,3]]);await tp('touchStart',[[jx,jy,3],[W[0]*0.6,W[1]*0.4,4]]);
  await tp('touchMove',[[jx,jy-70,3],[W[0]*0.6+60,W[1]*0.4,4]]);await C.ev(`__mq.stp(10)`);b=await st();
  check('two fingers: walking and turning together',b.f>0.5&&b.yaw<a.yaw-0.1&&Math.hypot(b.x-a.x,b.z-a.z)>0.3);
  await tp('touchEnd',[]);await C.ev(`__mq.stp(2)`);
  /* tap places, hold mines: look at the ground in front, a dirt stack in hand */
  await C.ev(`const P=__vox.P;P.inv[0]={id:__vox.B.DIRT,count:10};P.sel=0;P.pitch=-0.62;__vox.TCH.look.id=null;__mq.stp(20);`);
  const cnt=async()=>C.ev(`return __vox.P.inv[0]?__vox.P.inv[0].count:0`);
  /* dirt in the inventory plus dirt lying on the ground (a mined block drops first, then flies to you) */
  const dirt=async()=>C.ev(`const D=__vox.B.DIRT;let n=0;for(const s of __vox.P.inv)if(s&&s.id===D)n+=s.count;for(const e of __vox.entities)if(e.t==='drop'&&!e.dead&&e.st&&e.st.id===D)n+=e.st.count;return n;`);
  const n0=await cnt();
  await tp('touchStart',[[W[0]*0.6,W[1]*0.35,5]]);await sleep(60);await tp('touchEnd',[]);await sleep(80);
  const pul=await st();await C.ev(`__mq.stp(6)`);
  const n1=await cnt();check('a quick tap is a right-click: a dirt block placed ('+n0+' -> '+n1+')',pul.mbr===true&&n1===n0-1);
  check('the tap released the right button after the frames saw it',(await st()).mbr===false);
  await tp('touchStart',[[W[0]*0.6,W[1]*0.35,6]]);await sleep(420);await C.ev(`__mq.stp(1)`);
  const h=await st();check('press and hold = mine (MB.l on after the hold)',h.mbl===true);
  await C.ev(`__mq.stp(60)`);await tp('touchEnd',[]);await C.ev(`__mq.stp(30)`);
  const d1=await dirt();check('...and the block breaks and drops (dirt '+n1+' -> '+d1+'), the button lets go',d1>=n1+1&&(await st()).mbl===false);
  /* JUMP */
  await C.ev(`const P=__vox.P;P.pitch=0;__mq.stp(20);`);
  const [bx,by]=await center('btnjump');
  await tp('touchStart',[[bx,by,8]]);await C.ev(`__mq.stp(2)`);b=await st();await tp('touchEnd',[]);
  check('JUMP jumps (vy '+b.vy.toFixed(2)+')',b.vy>2);
  await C.ev(`__mq.stp(40)`);
  /* creative double-tap flies */
  await C.ev(`__vox.P.mode='c';__vox.P.flying=false;__mq.stp(10);`);
  /* the core's double-tap window is 280 ms of real time; software-rendered frames at 3x can be slower than that, so a pair that
     took too long is retried (up to 4 pairs) */
  let flew=false,gap=0;
  for(let k=0;k<4&&!flew;k++){
    await C.ev(`__vox.P.flying=false;__vox.P._tap=0;__mq.stp(2);`);
    const t0=Date.now();
    for(let i=0;i<2;i++){await tp('touchStart',[[bx,by,9]]);await C.ev(`__mq.stp(1)`);await tp('touchEnd',[]);if(!i)await C.ev(`__mq.stp(1)`);}
    gap=Date.now()-t0;await C.ev(`__mq.stp(1)`);flew=(await st()).fly===true;
    if(!flew&&gap<250)break;
  }
  check('creative: a double-tap on JUMP starts flying (once, not on and off again; pair took '+gap+' ms)',flew);
  await C.ev(`__vox.P.flying=false;__vox.P.mode='s';__mq.stp(30);`);
  /* USE held eats */
  await C.ev(`const P=__vox.P;P.hunger=10;P.inv[1]={id:__vox.IT.STEAK,count:3};P.sel=1;__mq.stp(5);`);
  const [ux,uy]=await center('btnuse');
  await tp('touchStart',[[ux,uy,10]]);await C.ev(`__mq.stp(55)`);await tp('touchEnd',[]);await C.ev(`__mq.stp(2)`);
  b=await st();check('USE held for 2 s eats a steak (hunger 10 -> '+b.hun+', steaks '+(await C.ev(`return __vox.P.inv[1]?__vox.P.inv[1].count:0`))+')',b.hun>10);
  /* INV, SPLIT, close */
  await press('btninv');await C.ev(`__mq.stp(2)`);
  check('INV opens the inventory (context inv, the tap bar up)',(await C.ev(`return MODAL.kind+' '+__vox.TCH.ctx+' '+!!__mq.box('tinvbar')`))==='inv inv true');
  await C.ev(`__vox.P.inv[2]={id:__vox.B.DIRT,count:10};redrawModal();`);
  await C.ev(`const b=[...document.querySelectorAll('#tinvbar [data-tm]')].find(b=>b.getAttribute('data-tm')==='split');const r=b.getBoundingClientRect();window.__sp=[r.left+r.width/2,r.top+r.height/2];`);
  const sp=await C.ev(`return window.__sp`);await tp('touchStart',[[sp[0],sp[1],11]]);await tp('touchEnd',[]);
  const slot=await C.ev(`const s=MODAL.slots.find(s=>s.kind!=='result'&&s.get()===__vox.P.inv[2]);const r=s.el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];`);
  await tp('touchStart',[[slot[0],slot[1],12]]);await tp('touchEnd',[]);
  const cur=await C.ev(`return {c:cursorStack?cursorStack.count:0,left:__vox.P.inv[2]?__vox.P.inv[2].count:0,mod:__vox.TCH.mod}`);
  check('SPLIT mode: a tap picks up half the stack ('+S(cur)+')',cur.c===5&&cur.left===5&&cur.mod==='split');
  const mv=await C.ev(`const b=[...document.querySelectorAll('#tinvbar [data-tm]')].find(b=>b.getAttribute('data-tm')==='');const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];`);
  await tp('touchStart',[[mv[0],mv[1],15]]);await tp('touchEnd',[]);
  await tp('touchStart',[[slot[0],slot[1],13]]);await tp('touchEnd',[]);
  check('MOVE mode: a tap puts the half back',(await C.ev(`return !cursorStack&&__vox.P.inv[2].count===10&&__vox.TCH.mod===''`))===true);
  await press('btnback');await sleep(250);await C.ev(`__mq.stp(2)`);
  await C.ev(`__vox.P.inv[2]=null;`);
  check('the close button closes the inventory',(await C.ev(`return !MODAL.kind&&__vox.TCH.ctx==='play'`))===true);
  /* the drawer: Powers */
  await press('btnmore');
  const pw=await C.ev(`const b=document.querySelector('#tmore [data-tk="KeyP"]');const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2,r.width>0]`);
  check('··· opens the drawer',pw[2]===true);
  await tp('touchStart',[[pw[0],pw[1],14]]);await tp('touchEnd',[]);await sleep(250);await C.ev('__mq.stp(2)');
  check('the drawer’s Powers opens the powers menu (a real P key press)',(await C.ev(`return powOpen&&__vox.TCH.ctx==='modal'`))===true);
  await press('btnback');await sleep(250);await C.ev(`__mq.stp(2)`);
  check('...and the close button closes it',(await C.ev(`return !powOpen&&__vox.TCH.ctx==='play'`))===true);
  /* chat */
  await press('btnchat');await sleep(250);
  check('CHAT opens the chat (context chat)',(await C.ev(`return chatOpen&&__vox.TCH.ctx==='chat'`))===true);
  await C.send('Input.insertText',{text:'hello from a phone'});
  const n=await C.ev(`return __vox.CHAT.length`);
  await press('btnsend');await sleep(250);
  check('SEND sends it',(await C.ev(`return !chatOpen&&__vox.CHAT.length>${n}&&JSON.stringify(__vox.CHAT.slice(-3)).includes('hello from a phone')`))===true);
  /* camera */
  const cm=await C.ev(`return camMode`);await press('btncam');await sleep(200);
  check('CAM cycles the camera',(await C.ev(`return camMode`))===(cm+1)%3);
  await C.ev(`camMode=0;`);
  await C.shot(path.join(dir,'00_behaviour.jpg'));
  /* Touch controls: Off */
  await C.ev(`__vox.touchSetPref('off',true);__mq.stp(2);`);
  check('Touch controls: Off hides the pad and the stick',(await C.ev(`return !document.body.classList.contains('touch')&&!__mq.box('btnjump')&&!__mq.box('joy')`))===true);
  await C.ev(`__vox.touchSetPref('auto',true);__mq.stp(2);`);
  check('Auto brings it back on a touch screen',(await C.ev(`return __vox.TCH.on&&!!__mq.box('btnjump')`))===true);
}
check('zero console errors / exceptions',errs().length===0,errs().slice(0,6));
const fin=await C.ev(`return soundOn`);check('sound never on',fin===false);
await C.ev(`try{__vox.touchSetPref('auto');}catch(e){}`);
await C.restoreOG();
C.close();
try{execFileSync('python3',[path.join(REPO,'tools','qa','ui','ui_sheet.py'),OUT],{stdio:'inherit'});}catch(e){console.log('mobile_qa: no contact sheets ('+e.message.split('\n')[0]+')');}
const pass=checks.filter(c=>c.ok).length,fail=checks.length-pass;
fs.writeFileSync(path.join(OUT,'summary.json'),JSON.stringify({build:BUILD,checks,date:new Date().toISOString()},null,1));
console.log(`mobile_qa: ${pass} passed, ${fail} failed; shots + summary.json in ${rel(OUT)}`);
stopKids();
process.exit(fail?1:0);
