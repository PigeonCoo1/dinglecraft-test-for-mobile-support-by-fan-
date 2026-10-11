/* u_touch.js (v7.0 The Pocket Update, lane UI, gate x1): the touch controls (src/ui/p06c_touch.js), the touch path of the UI
   scale (src/ui/p06e_ui_scale.js uiCaps) and their wiring into the core.
   Headless (the creativity boot): node is never live, so nothing turns the pad on by itself; the checks switch it on with
   touchSetPref('on') and drive the same functions the touch listeners call (touchStickStart/Move/End, touchLookStart/Move/End,
   touchPress). In node touchKey sets the key state the game polls instead of dispatching a KeyboardEvent (the browser rig
   tools/qa/ui/mobile_qa.mjs presses the real thing). TCH.clock is a fake clock here (the hold and tap timings).
   1 statics: the markup (every button the code binds, the drawer keys, the Settings rows, the help row, the viewport), the CSS
     contexts and safe areas, the core hooks (frame loop: first, tryLock, the inventory tap modes, DEEP DIRT's BUILD, saveSettings)
   2 Auto / On / Off, vox_settings round trip (tc, pf; an old vox_settings without them is Auto)
   3 the UI scale's touch path: every panel fits a phone (below 100%), the hotbar fits between the stick and the buttons
   4 the contexts (play ride inv modal chat terr cine cut none)
   5 the stick: dead zone, analog, walk, sprint past the ring, let go
   6 look, tap = use (a block placed), hold = mine (a block broken), a moved finger only looks
   7 the buttons: JUMP (and the creative double-tap flying once), MINE, USE held eats, SNEAK toggle, EXIT out of a car, RUN, INV,
     DROP, pause, a context change lets go of everything
   8 Pocket Performance: the resolution steps down under load and back up, the render distance drops at the floor and comes back,
     and the player's own distance is what gets saved */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs');
const V=boot({});
const step=boot.stepper(600000);
const HH=fs.readFileSync(boot.BUILD+'head.html','utf8');
const SRC=f=>fs.readFileSync(boot.P.SRC.ui+f,'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let FAKE=1000;
const T=V.TCH;T.clock=()=>FAKE;

boot.run(async()=>{
  ok('the touch seams are on __vox',['touchPress','touchCtxOf','touchSync','touchTick','touchSet','touchSetPref','touchSetPerfPref','touchWant',
    'touchStickStart','touchStickMove','touchStickEnd','touchLookStart','touchLookMove','touchLookEnd','touchKey','touchKeyName','touchPerfTick','touchMoreKey']
    .every(k=>typeof V[k]==='function')&&typeof V.TCH==='object'&&typeof V.TOUCH_BTN==='object');

  /* ===== 1. statics ===== */
  for(const n of Object.keys(V.TOUCH_BTN))if(n!=='sort'&&n!=='full')ok('button '+n+' has its element #btn'+n+' (once)',HH.split('id="btn'+n+'"').length===2);
  ok('SORT and Fullscreen have theirs (#btnsort, #btnfull)',HH.split('id="btnsort"').length===2&&HH.split('id="btnfull"').length===2);
  {const tk=[...HH.matchAll(/data-tk="([^"]+)"/g)].map(m=>m[1]);
    ok('the ... drawer: Powers, Players, Photo, Replay, Debug (P Tab F2 F8 F3)',JSON.stringify(tk)==='["KeyP","Tab","F2","F8","F3"]');}
  {const tm=[...HH.matchAll(/data-tm="([^"]*)"/g)].map(m=>m[1]);ok('the inventory tap modes: MOVE, SPLIT, QUICK',JSON.stringify(tm)==='["","split","quick"]');}
  ok('every pad button names its contexts (tp tp-<ctx>), the contexts all exist in the CSS',
    [...HH.matchAll(/class="tbtn[^"]*\btp\b[^"]*"/g)].length>=20&&['play','ride','modal','inv','terr','cine','chat','cut'].every(c=>HH.includes('body.tc-'+c+' .tp-'+c)));
  ok('the pad keeps clear of notches (safe-area insets) and sizes itself to the screen (vmin)',HH.includes('env(safe-area-inset-right')&&HH.includes('env(safe-area-inset-bottom')&&/--tb:clamp\(\d+px,[\d.]+vmin,\d+px\)/.test(HH));
  ok('the crosshair stays up in touch play (you see what a tap hits)',HH.includes('body.touch.tc-play #cross')&&!HH.includes('body.touch #cross{display:none}'));
  ok('the viewport: device width, no zoom, edge to edge (viewport-fit=cover)',/<meta name="viewport" content="[^"]*user-scalable=no[^"]*viewport-fit=cover/.test(HH));
  {const m=/<div id="s_tc"[^>]*>([\s\S]*?)<\/div>/.exec(HH),b=m?[...m[1].matchAll(/data-tc="([^"]+)">([^<]+)</g)].map(x=>x[1]+'='+x[2]):[];
    ok('Settings: Touch controls Auto / On / Off',b.join(',')==='auto=Auto,on=On,off=Off');}
  ok('Settings: the Pocket Performance button and the look sensitivity label for mouse and touch',HH.split('id="s_perf"').length===2&&HH.includes('Look sensitivity (mouse and touch)'));
  ok('Controls: the Touch row names the stick, MINE / USE, the drawer and the inventory modes',/<b>Touch<\/b>[^<]*MINE \/ USE[^<]*SPLIT/.test(HH));
  {const loop=fs.readFileSync(boot.P.SRC.core+'p07h_boot_loop.js','utf8'),inp=SRC('p06b_input.js'),inv=SRC('p06d_modal_inventory.js'),
    dd=fs.readFileSync(boot.P.SRC.feat+'p35_deepdirt_help.js','utf8'),st=SRC('p27_debug_gamerules_settings.js'),tc=SRC('p06c_touch.js');
    ok('the frame loop calls touchTick(t) first, before the player moves (a ride never sees a toggled SNEAK)',/if\(playing&&P\)\{\n\s*touchTick\(t\);[^\n]*\n(\s*netTick\(dt\);[^\n]*\n)?\s*if\(!paused(\|\|NET\.on)?\)\{/.test(loop));
    ok('touch play never asks for pointer lock (tryLock)',/function tryLock\(\)\{\n\s*if\(!usePLock\|\|TCH\.on\)return;/.test(inp));
    ok('inventory slots read the tap modes (SPLIT = right-click, QUICK = shift-click)',inv.includes("slotClick(s,ev.button===2||(TCH.on&&TCH.mod==='split'),ev.shiftKey||(TCH.on&&TCH.mod==='quick'))"));
    ok('DEEP DIRT 2D builds on a tap while BUILD is on',dd.includes('if(ev.button===2||TCH.build)TG.place=true;else TG.md=true;'));
    ok('saveSettings keeps tc and pf, and the player’s own render distance',st.includes('tc:TCH.pref,pf:TCH.pf')&&st.includes('rd:TCH.rdKeep||RD'));
    ok('on-screen keyboards: an Enter without a code is re-sent as Enter (trusted events only)',tc.includes("e.key!=='Enter'||e.code==='Enter'")&&tc.includes('!e.isTrusted'));
    ok('the old touch layer’s own fly toggle is gone (the core’s double-tap Space is the only one)',!/P\.flying=!P\.flying/.test(tc));}
  ok('touchKeyName: Space, Escape, Digit3, KeyP, F8',V.touchKeyName('Space')===' '&&V.touchKeyName('Escape')==='Escape'&&V.touchKeyName('Digit3')==='3'&&
    V.touchKeyName('KeyP')==='p'&&V.touchKeyName('F8')==='F8');

  /* ===== 2. Auto / On / Off ===== */
  ok('node: Auto, no touch screen, the pad is off',T.pref==='auto'&&T.on===false&&V.touchWant()===false);
  V.touchSetPref('on',true);ok('On: the pad is on',T.on===true&&T.pref==='on');
  V.touchSetPref('off',true);ok('Off: the pad is off',T.on===false);
  V.touchSetPref('bogus',true);ok('a bad value is Auto',T.pref==='auto');
  T.seen=true;ok('Auto follows the last touch (a finger: on)',V.touchWant()===true);T.seen=false;ok('...a mouse click: off',V.touchWant()===false);T.seen=null;
  {const read=async()=>{try{return JSON.parse((await global.storage.get('vox_settings')).value);}catch(e){return null;}};
    V.touchSetPref('on');V.touchSetPerfPref('off');await new Promise(r=>setImmediate(r));
    const s=await read();ok('vox_settings saves tc and pf',s&&s.tc==='on'&&s.pf==='off');
    V.touchSetPref('auto',true);V.touchSetPerfPref('auto',true);await V.loadSettings();
    ok('loadSettings reads them back',T.pref==='on'&&T.pf==='off');
    delete s.tc;delete s.pf;await global.storage.set('vox_settings',JSON.stringify(s));V.touchSetPref('auto',true);V.touchSetPerfPref('auto',true);await V.loadSettings();
    ok('an old vox_settings without tc / pf: Auto',T.pref==='auto'&&T.pf==='auto');}

  /* ===== 3. the UI scale on phones ===== */
  const B=V.UI_BASE,C=(w,h,t,p)=>V.uiCompute(p||'auto',w,h,1,t);
  for(const [w,h,n] of [[844,390,'phone landscape'],[390,844,'phone portrait'],[568,320,'small phone'],[915,412,'android'],[1024,768,'tablet']]){
    const r=C(w,h,true);
    ok(n+' '+w+'x'+h+': the inventory fits ('+r.eff+'), the HUD row fits the room it has ('+r.hud+')',r.eff*B.modalH<=h-16+1e-6&&r.eff*B.modalW<=w-16+1e-6&&r.hud>=0.45&&
      (r.hud===0.45||r.hud*B.hudW<=(w>h?w-2*(3*Math.min(80,Math.max(46,0.125*Math.min(w,h)))+30):w-16)+1e-6));}
  ok('touch on a big window keeps the comfortable Auto size (1920x1080: 150%)',C(1920,1080,true).eff===1.5);
  ok('without touch nothing changed (800x500: 100%, panels scroll inside)',C(800,500,false,1.5).eff===1&&C(800,500,false,1.5).hud===1);
  {const r=V.uiApply({w:844,h:390,dpr:3,touch:true});ok('uiApply with touch applies it (--uiz '+r.eff+')',r.eff<1&&r.hud<1);V.uiApply();}

  /* ===== 4. contexts ===== */
  V.touchSetPref('on',true);
  ok('the title: none',V.touchCtxOf()==='none');
  V.startNewWorld('utouch','4242','s');V.GR.mobSpawn=false;V.GR.dayCycle=false;step(160);
  V.touchSync();ok('in a world: play',V.touchCtxOf()==='play'&&T.ctx==='play');
  V.openModal('inv');V.touchSync();ok('the inventory: inv',T.ctx==='inv');
  T.mod='split';V.closeModal();V.touchSync();ok('closing it: play, and the tap mode resets to MOVE',T.ctx==='play'&&T.mod==='');
  V.openPow();ok('the powers menu: modal (the close button)',V.touchCtxOf()==='modal');V.closePow();
  V.openChat('');ok('the chat: chat',V.touchCtxOf()==='chat');V.closeChat();
  V.openCine();ok('the cinema: cine',V.touchCtxOf()==='cine');V.closeCine();
  {const P=V.P;V.openTerrAt(Math.floor(P.x)+3,Math.floor(P.y),Math.floor(P.z));ok('DEEP DIRT 2D: terr',V.touchCtxOf()==='terr');
    T.build=true;V.touchSync();V.closeTerr();V.touchSync();ok('leaving it resets BUILD',T.build===false);}
  V.getCUT().on=true;ok('a cutscene: cut (the skip button)',V.touchCtxOf()==='cut');V.getCUT().on=false;
  V.pauseGame();ok('paused: none (the pause menu has its own buttons)',V.touchCtxOf()==='none');V.resumeGame();
  step(5);V.touchSync();ok('back to play',T.ctx==='play');

  /* ===== 5. the stick ===== */
  const P=()=>V.P;
  P().yaw=0;P().pitch=0;step(20);
  V.touchStickStart(1,100,300);V.touchStickMove(103,297);
  ok('the dead zone: a few px is nothing',V.TOUCH.f===0&&V.TOUCH.s===0);
  V.touchStickMove(100,300-T.joy.r*0.58);
  ok('analog: half way up is about half forward ('+V.TOUCH.f.toFixed(2)+')',V.TOUCH.f>0.4&&V.TOUCH.f<0.6&&Math.abs(V.TOUCH.s)<1e-9);
  {const x0=P().x,z0=P().z;V.touchStickMove(100,300-T.joy.r);step(30);
    ok('pushed up: forward is -z at yaw 0 (moved '+(z0-P().z).toFixed(2)+')',z0-P().z>1.5&&Math.abs(P().x-x0)<0.5&&V.KEY.Sprint===false&&!P().sprint);}
  V.touchStickMove(100,300-T.joy.r*1.6);step(3);
  ok('pushed out past the ring: sprint',V.KEY.Sprint===true&&T.joy.spr===true&&P().sprint===true);
  V.touchStickMove(100+T.joy.r,300);ok('right is +s',V.TOUCH.s>0.99&&Math.abs(V.TOUCH.f)<1e-9&&V.KEY.Sprint===false);
  V.touchStickEnd();ok('let go: still, no sprint',V.TOUCH.f===0&&V.TOUCH.s===0&&V.KEY.Sprint===false&&T.joy.id===null);

  /* ===== 6. look, tap, hold (a stone wall right in front) ===== */
  const S=boot.studio(V,step,{keep:true});
  {const y0=P().yaw,p0=P().pitch;
    ok('a finger on the view starts a look',V.touchLookStart(2,500,200)===true&&V.touchLookStart(3,600,200)===false);
    V.touchLookMove(540,180);
    ok('dragging right turns right, up looks up (yaw '+(P().yaw-y0).toFixed(3)+', pitch +'+(P().pitch-p0).toFixed(3)+')',
      Math.abs((y0-P().yaw)-40*0.0055)<1e-9&&Math.abs((P().pitch-p0)-20*0.0055)<1e-9);
    FAKE+=500;V.touchLookEnd();step(2);ok('a long drag is only a look: no use, no mine',!V.MB.r&&!V.MB.l);}
  boot.aim(V,S.x+2.5,S.y,S.z+0.5);P().inv[0]={id:V.B.DIRT,count:5};P().sel=0;step(3);
  V.touchLookStart(4,500,200);FAKE+=80;V.touchLookEnd();
  ok('a quick tap is a right-click',V.MB.r===true);
  step(1);FAKE+=60;step(2);
  ok('...held for the frames the use code needs, then let go: one dirt placed ('+P().inv[0].count+' left)',V.MB.r===false&&P().inv[0].count===4&&V.getBlock(S.x+2,S.y,S.z)===V.B.DIRT);
  V.touchLookStart(5,500,200);FAKE+=150;step(1);ok('not yet a hold at 150 ms',V.MB.l===false);
  FAKE+=200;step(1);ok('a hold (280 ms) mines',V.MB.l===true);
  step(60);V.touchLookEnd();step(2);
  ok('...the placed dirt broke, and lifting the finger lets go',V.getBlock(S.x+2,S.y,S.z)!==V.B.DIRT&&V.MB.l===false);

  /* ===== 7. buttons ===== */
  step(30);
  V.touchPress('jump',true);ok('JUMP holds Space',V.KEY.Space===true);step(2);ok('...and jumps',P().vy>2);
  V.touchPress('jump',false);ok('let go',V.KEY.Space===false);step(30);
  P().mode='c';P().flying=false;step(5);
  for(let i=0;i<2;i++){V.touchPress('jump',true);step(1);V.touchPress('jump',false);step(1);}
  ok('creative: a double-tap on JUMP flies (toggled once, not on and straight off)',P().flying===true);
  P().flying=false;P().mode='s';step(20);
  V.touchPress('mine',true);ok('MINE holds the left button',V.MB.l===true);V.touchPress('mine',false);ok('let go',V.MB.l===false);
  P().hunger=10;P().inv[1]={id:V.IT.STEAK,count:2};P().sel=1;P().pitch=1.4;step(3);
  V.touchPress('use',true);step(48);V.touchPress('use',false);step(2);
  ok('USE held 1.9 s eats a steak (hunger 10 -> '+P().hunger+')',P().hunger>10&&P().inv[1].count===1&&V.MB.r===false);
  P().pitch=0;
  V.touchPress('sneak',true);step(2);ok('SNEAK toggles on (lit), Dan sneaks',T.sneak===true&&V.KEY.ShiftLeft===true&&P().sneak===true);
  V.touchPress('sneak',true);step(2);ok('...and off',T.sneak===false&&V.KEY.ShiftLeft===false&&P().sneak===false);
  V.touchPress('sprint',true);ok('RUN toggles sprint',T.sprint===true&&V.KEY.Sprint===true);V.touchPress('sprint',true);ok('...off',V.KEY.Sprint===false);
  V.touchPress('inv',true);ok('INV opens the inventory',V.MODAL.kind==='inv');V.touchPress('inv',true);ok('...and closes it',!V.MODAL.kind);
  {const n=P().inv[0]?P().inv[0].count:0;P().sel=0;V.touchPress('drop',true);ok('DROP drops one',(P().inv[0]?P().inv[0].count:0)===n-1);}
  V.touchPress('pause',true);ok('the pause button pauses',V.getPaused()===true);V.touchPress('pause',true);ok('...and resumes',V.getPaused()===false);
  {V.touchPress('sneak',true);V.spawnCar(P().x+2,P().y,P().z);const car=V.entities[V.entities.length-1];P().ride=car;step(3);
    ok('getting into a car clears the SNEAK toggle (Shift would throw you out) and it reads EXIT',T.ctx==='ride'&&T.sneak===false&&V.KEY.ShiftLeft===false);
    V.touchPress('sneak',true);step(2);ok('EXIT: out of the car',!P().ride);await sleep(220);step(2);ok('...a press, not a toggle (Shift let go)',V.KEY.ShiftLeft===false);}
  V.touchPress('mine',true);V.touchStickStart(9,100,300);V.touchStickMove(100,200);V.openModal('inv');V.touchSync();
  ok('a context change lets go of everything (stick, MINE)',V.MB.l===false&&V.TOUCH.f===0&&T.joy.id===null&&T.held.mine===false);
  V.closeModal();V.touchSync();

  /* ===== 8. Pocket Performance ===== */
  const R=V.getRD(),pr0=1.5;
  Object.assign(T,{perf:true,pr:pr0,prMax:2,ft:0,lastT:0,adjT:0,rdT:-1e9,rdKeep:0});
  const run=(ms,secs)=>{let t=1e6+FAKE;for(let i=0;i<secs*1000/ms;i++){t+=ms;FAKE+=ms;V.touchPerfTick(t);}};
  V.setRD(8,true);
  run(33,4);ok('30 fps: the resolution steps down ('+pr0+' -> '+T.pr+')',T.pr<pr0);
  run(40,30);ok('a phone that still struggles: the floor (0.75) and then one chunk less render distance (8 -> '+V.getRD()+')',T.pr===0.75&&V.getRD()<8&&T.rdKeep===8);
  V.saveSettings();await new Promise(r=>setImmediate(r));
  {let s=null;try{s=JSON.parse((await global.storage.get('vox_settings')).value);}catch(e){}ok('the save keeps the player’s own distance (8), not the lowered one',s&&s.rd===8);}
  run(16,120);ok('60 fps again: back to full resolution and the player’s render distance ('+T.pr+', '+V.getRD()+')',T.pr===2&&V.getRD()===8&&T.rdKeep===0);
  T.perf=false;V.setRD(R,true);
});
