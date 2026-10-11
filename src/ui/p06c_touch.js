/* ----- touch controls (v7.0 The Pocket Update: full mobile support) -----
   Phones and tablets get the whole game, not a demo of it:
   - a floating move stick (left side: it appears under your thumb; push past the ring to sprint), drag anywhere else to look,
     quick tap = place / use, press and hold = mine / attack (the crosshair stays up so you can see what you aim at);
   - buttons for everything the keyboard does: MINE and USE (hold: eat, draw a bow, aim a gun), JUMP (double-tap flies in
     creative), SNEAK (a toggle; EXIT while riding), RUN, HONK, INV, DROP, pause, chat, camera, and a ... drawer (powers, player
     list, photo, replay, F3, fullscreen);
   - a context for every screen (touchCtxOf): menus get a close button, the inventory gets MOVE / SPLIT / QUICK tap modes and
     SORT, DEEP DIRT 2D and the cinema get their own pads, cutscenes a skip, the chat a send button that rides above the keyboard;
   - Settings -> Touch controls (Auto / On / Off; Auto follows the last thing you touched, mouse or finger) and Pocket Performance
     (Auto / On / Off: dynamic resolution and a lighter first render distance on phones; OG pack only, Hyperreal has its tiers).
   Every key a button sends is a real KeyboardEvent (touchKey), so it runs the exact code a keyboard runs. Nothing here is live
   in node (uiLive() is false): the handlers are plain functions the tests drive directly (tests/ui/u_touch.js). */
const TOUCH={f:0,s:0};
const TCH={pref:'auto',on:false,seen:null,ctx:'',mod:'',build:false,sprint:false,sneak:false,more:false,tab:false,
  pf:'auto',perf:false,pr:0,prMax:2,ft:0,lastT:0,adjT:0,rdT:0,rdSet:false,rdKeep:0,lay:'',tip:false,
  joy:{id:null,cx:0,cy:0,r:60,spr:false,keys:false},
  look:{id:null,x:0,y:0,sx:0,sy:0,t0:0,moved:false,mine:false},
  held:{mine:false,use:false,jump:false},rPulse:-1,rPulseT:0,keys:[],clock:()=>performance.now()};
const TOUCH_HOLD=280,TOUCH_LOOK=0.0055;
function touchCapable(){
  if(!uiLive())return false;
  try{return 'ontouchstart' in window||(navigator.maxTouchPoints|0)>0||!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);}
  catch(e){return false;}
}
/* a phone or tablet: its main pointer is a finger */
function touchPrimary(){
  if(!uiLive())return false;
  try{return !!(window.matchMedia&&(matchMedia('(pointer:coarse)').matches||(touchCapable()&&!matchMedia('(any-pointer:fine)').matches)));}
  catch(e){return false;}
}
function touchPrefNorm(v){return v==='on'||v==='off'?v:'auto';}
function touchWant(){return TCH.pref==='on'?true:TCH.pref==='off'?false:(TCH.seen===null?touchPrimary():TCH.seen);}
function touchSet(on){
  on=!!on;if(on===TCH.on)return;
  TCH.on=on;
  try{document.body.classList.toggle('touch',on);}catch(e){}
  touchRelease();TCH.ctx='';
  if(on)tryLockOff();
  uiApply();touchLayout(true);touchSync();touchPerfApply();
}
function tryLockOff(){try{lockWanted=false;if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();}catch(e){}}
function touchApplyPref(){touchSet(touchWant());touchSyncSetUI();}
function touchSetPref(v,skipSave){
  TCH.pref=touchPrefNorm(v);TCH.seen=null;touchApplyPref();
  if(!skipSave&&typeof saveSettings==='function')saveSettings();
  return TCH.on;
}
/* ----- virtual keys: a real KeyboardEvent, so the button runs the keyboard's own code path ----- */
const TOUCH_KN={Space:' ',Escape:'Escape',Enter:'Enter',Tab:'Tab',F2:'F2',F3:'F3',F8:'F8',ShiftLeft:'Shift'};
function touchKeyName(code){return TOUCH_KN[code]||(code.startsWith('Digit')?code.slice(5):code.startsWith('Key')?code.slice(3).toLowerCase():code);}
function touchKey(code,down){
  TCH.keys.push((down?'+':'-')+code);if(TCH.keys.length>40)TCH.keys.shift();
  if(uiLive()&&typeof KeyboardEvent==='function'){
    try{document.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:touchKeyName(code),bubbles:true,cancelable:true}));return;}catch(e){}
  }
  KEY[code]=!!down;   /* node: no DOM events, just the key state the game polls */
}
function touchTap(code,ms){touchKey(code,true);setTimeout(()=>touchKey(code,false),ms||140);}
/* ----- the move stick ----- */
function touchStickR(){const j=$('joy');let w=0;try{w=j&&j.getBoundingClientRect?j.getBoundingClientRect().width:0;}catch(e){}return Math.max(30,(w||110)*0.4);}
function touchStickStart(id,x,y){
  const J=TCH.joy;J.id=id;J.r=touchStickR();J.cx=x;J.cy=y;J.spr=false;
  const j=$('joy');
  if(j&&j.style&&uiLive()){const w=J.r/0.4;j.style.left=(x-w/2)+'px';j.style.top=(y-w/2)+'px';j.style.bottom='auto';j.classList.add('act');}
}
function touchStickMove(x,y){
  const J=TCH.joy;if(J.id===null)return;
  const dx=(x-J.cx)/J.r,dy=(y-J.cy)/J.r,d=Math.hypot(dx,dy),ux=d>0?dx/d:0,uy=d>0?dy/d:0;
  const m=Math.min(1,d),k=m<0.16?0:(m-0.16)/0.84;
  TOUCH.s=ux*k;TOUCH.f=-uy*k;
  J.spr=d>1.32&&-uy>0.75;                       /* thumb pushed out past the ring, forward: sprint */
  KEY.Sprint=TCH.sprint||J.spr;
  if(terrOpen){J.keys=true;KEY.KeyA=TOUCH.s<-0.3;KEY.KeyD=TOUCH.s>0.3;}   /* DEEP DIRT 2D reads A / D */
  const n=$('joynub');
  if(n&&n.style)n.style.transform='translate(calc(-50% + '+(ux*m*J.r)+'px),calc(-50% + '+(uy*m*J.r)+'px))';
  const j=$('joy');if(j&&j.classList&&j.classList.toggle)j.classList.toggle('spr',J.spr);
}
function touchStickEnd(){
  const J=TCH.joy;J.id=null;J.spr=false;TOUCH.f=TOUCH.s=0;KEY.Sprint=TCH.sprint;
  if(J.keys){J.keys=false;KEY.KeyA=KEY.KeyD=false;}
  const j=$('joy'),n=$('joynub');
  if(j&&j.style){j.style.left=j.style.top=j.style.bottom='';if(j.classList){j.classList.remove('act');j.classList.remove('spr');}}
  if(n&&n.style)n.style.transform='';
}
/* ----- look, tap = use, hold = mine ----- */
function touchMB(){MB.l=TCH.held.mine||TCH.look.mine;}
function touchLookStart(id,x,y){
  if(!playing||paused||modalOpen()||!P||P.dead)return false;
  const L=TCH.look;if(L.id!==null)return false;
  L.id=id;L.x=L.sx=x;L.y=L.sy=y;L.t0=TCH.clock();L.moved=false;L.mine=false;
  return true;
}
function touchLookMove(x,y){
  const L=TCH.look;if(L.id===null)return;
  if(!modalOpen()&&!paused)look(x-L.x,y-L.y,TOUCH_LOOK);
  if(Math.abs(x-L.sx)+Math.abs(y-L.sy)>14)L.moved=true;
  L.x=x;L.y=y;
}
function touchLookHold(){
  const L=TCH.look;
  if(L.id!==null&&!L.moved&&!L.mine&&TCH.clock()-L.t0>=TOUCH_HOLD){L.mine=true;touchMB();}
}
function touchLookEnd(){
  const L=TCH.look;if(L.id===null)return;
  touchLookHold();
  if(!L.moved&&!L.mine)touchPulseR();
  L.id=null;L.mine=false;touchMB();
}
/* a quick tap is a right-click: held for at least two frames so the use code sees it */
function touchPulseR(){MB.r=true;TCH.rPulse=typeof frameCount==='number'?frameCount:0;TCH.rPulseT=TCH.clock();}
function touchPulseTick(){
  if(TCH.rPulse<0)return;
  const fc=typeof frameCount==='number'?frameCount:0;
  if((fc-TCH.rPulse>=2&&TCH.clock()-TCH.rPulseT>=50)||TCH.clock()-TCH.rPulseT>600){TCH.rPulse=-1;if(!TCH.held.use)MB.r=false;}
}
/* let go of everything (a context change, the window losing focus, controls switched off) */
function touchRelease(){
  if(TCH.joy.id!==null)touchStickEnd();
  TCH.look.id=null;TCH.look.mine=false;
  if(TCH.held.mine||TCH.held.use){TCH.held.mine=TCH.held.use=false;MB.l=MB.r=false;}
  if(TCH.rPulse>=0){TCH.rPulse=-1;MB.r=false;}
  if(TCH.held.jump){TCH.held.jump=false;touchKey('Space',false);}
  try{for(const b of document.querySelectorAll('#tpad .dn'))b.classList.remove('dn');}catch(e){}
}
/* ----- which pad shows ----- */
function touchCtxOf(){
  if(!playing||!P)return 'none';
  if(paused||P.dead)return 'none';
  if(chatOpen)return 'chat';
  if(typeof CUT!=='undefined'&&CUT.on)return 'cut';
  if(terrOpen)return 'terr';
  if(cineOpen)return 'cine';
  if(MODAL.kind)return 'inv';
  if(modalOpen())return 'modal';
  return P.ride?'ride':'play';
}
function touchSync(){
  if(!TCH.on){if(TCH.ctx){TCH.ctx='';touchBodyCtx('');}return;}
  const c=touchCtxOf();
  if(c!==TCH.ctx){
    const prev=TCH.ctx;TCH.ctx=c;
    if(!((prev==='play'||prev==='ride')&&(c==='play'||c==='ride')))touchRelease();
    if(c==='ride'&&TCH.sneak){TCH.sneak=false;touchKey('ShiftLeft',false);}   /* Shift leaves a vehicle: never carry the toggle in */
    if(c!=='inv')TCH.mod='';
    if(c!=='terr')TCH.build=false;
    if(c!=='play'&&c!=='ride')TCH.more=false;
    touchBodyCtx(c);
    const sn=$('btnsneak');if(sn)sn.textContent=c==='ride'?'EXIT':'SNEAK';
    if(c==='play'&&!TCH.tip&&uiLive()&&innerHeight>innerWidth*1.15){TCH.tip=true;showToast('Tip: turn your device sideways for a wider view');}
  }
  if(TCH.sneak&&!KEY.ShiftLeft)TCH.sneak=false;   /* the window lost focus: every key let go */
  if(TCH.tab&&!tabHeld)TCH.tab=false;
  touchMarks();touchChatLift(c);touchLayout(false);
}
function touchBodyCtx(c){
  try{const cl=document.body.classList;
    for(const k of ['play','ride','modal','inv','terr','cine','chat','cut','none'])cl.remove('tc-'+k);
    if(c)cl.add('tc-'+c);}catch(e){}
}
/* the toggles' lit state */
function touchMarks(){
  if(!uiLive())return;
  const on=(id,v)=>{const b=$(id);if(b&&b.classList)b.classList.toggle('on',!!v);};
  on('btnsneak',TCH.sneak);on('btnsprint',TCH.sprint);on('btnbuild',TCH.build);on('btnmore',TCH.more);
  const m=$('tmore');if(m&&m.classList)m.classList.toggle('open',TCH.more);
  try{for(const b of document.querySelectorAll('#tinvbar [data-tm]'))b.classList.toggle('on',b.getAttribute('data-tm')===TCH.mod);
    for(const b of document.querySelectorAll('#tmore [data-tk="Tab"]'))b.classList.toggle('on',TCH.tab);}catch(e){}
}
/* the chat rides above an on-screen keyboard that covers the page without resizing it (iOS) */
function touchChatLift(c){
  const cb=$('chatbox');if(!cb||!cb.style||!uiLive())return;
  let kb=0;
  if(c==='chat'){try{const v=window.visualViewport;if(v)kb=Math.max(0,innerHeight-(v.height+v.offsetTop));}catch(e){}}
  const want=kb>40?((kb+8)/(UIS.hud||1))+'px':'';
  if(cb.style.bottom!==want)cb.style.bottom=want;
}
/* portrait: the pad sits above the hotbar stack; landscape: beside it */
function touchLayout(force){
  if(!uiLive()||!TCH.on)return;
  const key=innerWidth+'x'+innerHeight+'@'+UIS.hud;
  if(!force&&key===TCH.lay)return;
  TCH.lay=key;
  const port=innerHeight>innerWidth,tb=Math.min(80,Math.max(46,0.125*Math.min(innerWidth,innerHeight)));
  uiSetVar('--tbot',(port?Math.round(116*(UIS.hud||1))+14:12)+'px');
  uiSetVar('--tpw',Math.max(240,port?innerWidth-16:innerWidth-2*(3*tb+44))+'px');   /* DEEP DIRT / cinema panels stay between the pads */
}
/* ----- buttons ----- */
function touchBuzz(){try{if(navigator.vibrate)navigator.vibrate(8);}catch(e){}}
function touchBind(id,down,up){
  const el=typeof id==='string'?$(id):id;
  if(!el||!el.addEventListener)return;
  const dn=e=>{e.preventDefault();e.stopPropagation();if(el.classList)el.classList.add('dn');touchBuzz();if(down)down(e);};
  const upf=e=>{e.preventDefault();e.stopPropagation();if(el.classList)el.classList.remove('dn');if(up)up(e);};
  el.addEventListener('touchstart',dn,{passive:false});
  el.addEventListener('touchend',upf,{passive:false});
  el.addEventListener('touchcancel',upf,{passive:false});
  /* a mouse presses them too (Touch controls: On, on a computer) */
  el.addEventListener('mousedown',e=>{if(e.button===0)dn(e);});
  el.addEventListener('mouseup',e=>{if(e.button===0)upf(e);});
  el.addEventListener('mouseleave',e=>{if(el.classList&&el.classList.contains('dn'))upf(e);});
}
/* what each button does (the tests press them through this table) */
const TOUCH_BTN={
  jump:[()=>{TCH.held.jump=true;touchKey('Space',true);},()=>{if(TCH.held.jump){TCH.held.jump=false;touchKey('Space',false);}}],
  mine:[()=>{TCH.held.mine=true;touchMB();},()=>{TCH.held.mine=false;touchMB();}],
  use:[()=>{TCH.held.use=true;MB.r=true;},()=>{TCH.held.use=false;if(TCH.rPulse<0)MB.r=false;}],
  sneak:[()=>{
    if(P&&P.ride){touchTap('ShiftLeft',160);return;}               /* riding: a press, out you hop */
    TCH.sneak=!TCH.sneak;touchKey('ShiftLeft',TCH.sneak);touchMarks();}],
  sprint:[()=>{TCH.sprint=!TCH.sprint;KEY.Sprint=TCH.sprint||TCH.joy.spr;touchMarks();}],
  honk:[()=>touchTap('KeyH')],
  inv:[()=>{if(!P)return;if(modalOpen())closeModal();else if(!paused&&!P.dead)openModal(P.mode==='c'?'creative':'inv');}],
  drop:[()=>{if(P&&!modalOpen()&&!paused)dropSel(false);}],
  pause:[()=>{if(!playing||!P)return;if(paused)resumeGame();else pauseGame();}],
  more:[()=>{TCH.more=!TCH.more;touchMarks();}],
  chat:[null,()=>touchTap('KeyT')],                                   /* on release: the keyboard opens from a finished tap */
  cam:[()=>touchTap('KeyF')],
  back:[null,()=>{if(helpOpen){const h=$('h_close');if(h&&h.click)h.click();return;}touchTap('Escape');}],
  send:[null,()=>touchTap('Enter')],
  item:[()=>{const i=TBAR.indexOf(TG.sel);touchTap('Digit'+(((i<0?0:i)+1)%TBAR.length+1));}],
  build:[()=>{TCH.build=!TCH.build;touchMarks();}],
  craft:[()=>touchTap('KeyC')],
  c1:[()=>touchTap('Digit1')],c2:[()=>touchTap('Digit2')],c3:[()=>touchTap('Digit3')],ce:[()=>touchTap('KeyE')],
  sort:[()=>touchTap('KeyR')],
  full:[()=>touchFullscreen()]
};
function touchPress(name,down){const b=TOUCH_BTN[name],f=b&&b[down?0:1];if(f)f();}
/* the ... drawer's keys; Players (Tab) is a toggle, the rest are taps */
function touchMoreKey(code){
  if(code==='Tab'){TCH.tab=!TCH.tab;touchKey('Tab',TCH.tab);touchMarks();return;}
  touchTap(code);
  if(code!=='F3'){TCH.more=false;touchMarks();}
}
function touchFullscreen(){
  const d=document,el=d.documentElement;
  try{
    if(d.fullscreenElement||d.webkitFullscreenElement){const x=d.exitFullscreen||d.webkitExitFullscreen;if(x)x.call(d);return;}
    const rq=el.requestFullscreen||el.webkitRequestFullscreen;
    if(!rq){showToast('No fullscreen in this browser: Share → Add to Home Screen plays it full-screen');return;}
    const lock=()=>{try{const o=screen.orientation;if(o&&o.lock){const p=o.lock('landscape');if(p&&p.catch)p.catch(()=>{});}}catch(e){}};
    const p=rq.call(el,{navigationUI:'hide'});
    if(p&&p.then)p.then(lock,()=>{});else lock();
  }catch(e){}
}
/* ----- Pocket Performance: dynamic resolution (OG), a lighter first render distance on phones ----- */
function touchPerfOn(){return TCH.pf==='on'||(TCH.pf==='auto'&&touchPrimary());}
function touchSetPR(pr){
  TCH.pr=pr;
  try{if(renderer&&renderer.setPixelRatio&&renderer.getPixelRatio()!==pr){renderer.setPixelRatio(pr);renderer.setSize(innerWidth,innerHeight);}}catch(e){}
}
function touchPerfApply(){
  const was=TCH.perf;
  TCH.perf=uiLive()&&touchPerfOn();
  const dpr=uiLive()&&devicePixelRatio>0?devicePixelRatio:1;
  TCH.prMax=Math.min(dpr,2);
  if(TP.hr)return;                                     /* Hyperreal owns the pixel ratio (its quality tiers) */
  if(TCH.perf&&!was){touchSetPR(Math.min(TCH.prMax,1.5));TCH.ft=0;TCH.adjT=TCH.clock();}
  else if(!TCH.perf&&was)touchSetPR(TCH.prMax);
}
/* frame time in ms (rAF stamps): steps the resolution down when the game drops under ~42 fps, back up when it holds 60; at the
   floor, a phone that still struggles gets one chunk less render distance (down to 4), and gets it back once it holds 60 again at
   full resolution. TCH.rdKeep remembers the player's own distance: saveSettings saves that one, and moving the slider clears it */
function touchPerfTick(t){
  if(!TCH.perf||TP.hr||!playing||paused){TCH.lastT=0;return;}
  const ft=TCH.lastT?t-TCH.lastT:0;TCH.lastT=t;
  if(ft<=0||ft>250)return;                             /* a hitch or a background tab says nothing */
  TCH.ft=TCH.ft?TCH.ft*0.94+ft*0.06:ft;
  const now=TCH.clock();
  if(now-TCH.adjT<2500)return;
  if(TCH.ft>24&&TCH.pr>0.75){touchSetPR(Math.max(0.75,Math.round((TCH.pr-0.25)*100)/100));TCH.adjT=now;}
  else if(TCH.ft>30&&TCH.pr<=0.75&&RD>4&&now-TCH.rdT>9000){if(!TCH.rdKeep)TCH.rdKeep=RD;setRD(RD-1,true);TCH.rdT=TCH.adjT=now;
    showToast('Pocket Performance: render distance '+RD+' to keep it smooth');}
  else if(TCH.ft<17.8&&TCH.pr<TCH.prMax&&now-TCH.adjT>6000){touchSetPR(Math.min(TCH.prMax,TCH.pr+0.25));TCH.adjT=now;}
  else if(TCH.ft<17.8&&TCH.rdKeep&&RD<TCH.rdKeep&&now-TCH.adjT>9000){setRD(RD+1,true);if(RD>=TCH.rdKeep)TCH.rdKeep=0;TCH.adjT=now;}
}
/* first run on a phone or tablet (no saved render distance): 5 chunks on a phone, 6 on a tablet */
async function touchFirstRD(){
  if(!uiLive()||!touchPerfOn()||TCH.rdSet)return;
  TCH.rdSet=true;
  let saved=false;
  try{const r=await storage.get('vox_settings');const s=JSON.parse(r.value);saved=!!(s&&s.rd);}catch(e){}
  if(!saved)setRD(Math.min(innerWidth,innerHeight)<=540?5:6,true);
}
/* the frame loop's hook (p07h), every frame while a world is open */
function touchTick(t){
  if(!TCH.on){if(TCH.perf)touchPerfTick(t);return;}
  touchSync();touchLookHold();touchPulseTick();
  if(TCH.perf)touchPerfTick(t);
}
/* ----- Settings rows ----- */
function touchSyncSetUI(){
  try{
    const box=$('s_tc');
    if(box&&typeof box.querySelectorAll==='function')for(const b of box.querySelectorAll('[data-tc]')){
      const on=b.getAttribute('data-tc')===TCH.pref;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');}
    const i=$('s_tcinfo');
    if(i)i.textContent=TCH.pref==='auto'?(TCH.on?'(on: touch screen)':'(off: mouse and keyboard)'):'';
    const p=$('s_perf');
    if(p)p.textContent='\u{1F4F1} Pocket Performance: '+(TCH.pf==='auto'?'Auto ('+(touchPerfOn()?'On':'Off')+')':TCH.pf==='on'?'On':'Off');
  }catch(e){}
}
function touchSetPerfPref(v,skipSave){
  TCH.pf=touchPrefNorm(v);touchPerfApply();touchSyncSetUI();
  if(!skipSave&&typeof saveSettings==='function')saveSettings();
}
/* ----- wiring (setupInput, at boot) ----- */
function setupTouch(){
  const box=$('s_tc');
  if(box&&typeof box.querySelectorAll==='function')for(const b of box.querySelectorAll('[data-tc]'))
    b.onclick=()=>{touchSetPref(b.getAttribute('data-tc'));if(typeof playS==='function')playS('click');
      showToast(TCH.on?'Touch controls on':'Touch controls off');};
  const pb=$('s_perf');
  if(pb)pb.onclick=()=>{touchSetPerfPref(TCH.pf==='auto'?'on':TCH.pf==='on'?'off':'auto');if(typeof playS==='function')playS('click');};
  if(!uiLive())return;
  /* Auto follows the last thing you touched: a finger shows the pad, a mouse click hides it */
  document.addEventListener('touchstart',()=>{if(TCH.pref==='auto'&&TCH.seen!==true){TCH.seen=true;touchApplyPref();}},{capture:true,passive:true});
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&TCH.pref==='auto'&&TCH.seen!==false&&(TCH.seen===true||touchPrimary())){TCH.seen=false;touchApplyPref();}},true);
  document.addEventListener('touchend',kickAudio,true);               /* iOS unlocks audio on a finished tap */
  document.addEventListener('gesturestart',e=>e.preventDefault());    /* no pinch-zoom of the page (iOS ignores user-scalable) */
  /* on-screen keyboards often send Enter with no code: give it one, so chat and every Enter field work */
  addEventListener('keydown',e=>{
    if(!e.isTrusted||e.key!=='Enter'||e.code==='Enter'||e.code==='NumpadEnter')return;
    e.stopImmediatePropagation();e.preventDefault();
    try{(e.target||document).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true}));}catch(err){}
  },true);
  addEventListener('blur',()=>{touchRelease();TCH.sneak=TCH.sprint=false;KEY.Sprint=false;});
  /* the main pointer can change under us (a tablet docks a keyboard and trackpad, a browser's device emulation): Auto follows */
  try{const mq=matchMedia('(pointer:coarse)'),f=()=>{if(TCH.pref==='auto'&&TCH.seen===null)touchApplyPref();};
    if(mq.addEventListener)mq.addEventListener('change',f);else if(mq.addListener)mq.addListener(f);}catch(e){}
  const zone=$('joyzone');
  zone.addEventListener('touchstart',e=>{
    e.preventDefault();
    if(TCH.joy.id!==null)return;
    const t=e.changedTouches[0];touchStickStart(t.identifier,t.clientX,t.clientY);
  },{passive:false});
  $('gl').addEventListener('touchstart',e=>{
    const t=e.changedTouches[0];
    if(touchLookStart(t.identifier,t.clientX,t.clientY))e.preventDefault();
  },{passive:false});
  addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===TCH.joy.id)touchStickMove(t.clientX,t.clientY);
      else if(t.identifier===TCH.look.id)touchLookMove(t.clientX,t.clientY);
    }
  },{passive:true});
  const end=e=>{
    for(const t of e.changedTouches){
      if(t.identifier===TCH.joy.id)touchStickEnd();
      else if(t.identifier===TCH.look.id)touchLookEnd();
    }
  };
  addEventListener('touchend',end);
  addEventListener('touchcancel',end);
  for(const n in TOUCH_BTN){
    const el=$('btn'+n);
    if(el)touchBind(el,TOUCH_BTN[n][0]&&(()=>touchPress(n,true)),TOUCH_BTN[n][1]&&(()=>touchPress(n,false)));
  }
  for(const b of document.querySelectorAll('#tmore [data-tk]'))touchBind(b,null,()=>touchMoreKey(b.getAttribute('data-tk')));
  for(const b of document.querySelectorAll('#tinvbar [data-tm]'))touchBind(b,()=>{TCH.mod=b.getAttribute('data-tm');touchMarks();});
  addEventListener('resize',()=>{touchLayout(true);
    if(TCH.perf&&!TP.hr&&TCH.pr){TCH.prMax=Math.min(devicePixelRatio>0?devicePixelRatio:1,2);touchSetPR(Math.min(TCH.pr,TCH.prMax));}});
  setInterval(()=>{if(TCH.on&&!playing)touchSync();},300);             /* the title and the pause menu have no frame loop */
  touchApplyPref();
  if(typeof SETTINGS_P!=='undefined'&&SETTINGS_P.then)SETTINGS_P.then(touchFirstRD,touchFirstRD);
  else setTimeout(touchFirstRD,0);
}
