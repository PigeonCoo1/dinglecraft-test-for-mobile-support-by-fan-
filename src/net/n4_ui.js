/* ---- PART 58: n4_ui.js ---- */
/* the Multiplayer panel (title screen: join; pause menu: open your world, or see who is here), the corner badge, and the hooks
   the rest of the game calls. The panel is rebuilt from NET whenever something changes (netUiSync). */
let netpOpen=false;
function netEl(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function netBtn(txt,f,cls){const b=netEl('button','mc-btn'+(cls?' '+cls:''),txt);b.onclick=()=>{try{playS('click');}catch(e){}f();};return b;}
function openNetPanel(){
  netpOpen=true;
  if(playing&&paused)hidePause();
  const el=$('netpanel');if(el)el.style.display='flex';
  netUiSync();
  try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}
}
function closeNetPanel(){
  netpOpen=false;
  const el=$('netpanel');if(el)el.style.display='none';
  if(playing)restorePause();
}
/* rebuild the panel (and the badge) from the state */
function netUiSync(){
  const badge=$('netbadge');
  if(badge&&badge.style){
    if(NET.on&&playing){badge.style.display='block';badge.textContent='\u{1F310} '+NET.code+' · '+(NET.peers.size+(netHost()?1:0))+(netHost()?' (host)':'');}
    else badge.style.display='none';
  }
  const body=$('net_body'),st=$('net_status');
  if(!body||!netpOpen||typeof body.appendChild!=='function')return;
  body.innerHTML='';
  const add=e=>{body.appendChild(e);return e;};
  if(netHost()){
    add(netEl('div','mlabel','Your world is open. Give your friends this code:'));
    add(netEl('div','netcode',NET.code));
    add(netEl('div','sinfo','They open DINGLECRAFT (the same version, '+RELEASE_LABEL+'), tap \u{1F310} Multiplayer and type it. Phones work too.'));
    netPlayersBox(add,true);
    add(netBtn('PvP: '+(NET.pvp?'On':'Off'),()=>netSetPvp(!NET.pvp)));
    add(netBtn('Close the world to friends',()=>{netStop('close');sysMsg('[LINK] Your world is closed to friends');},'danger'));
  }else if(netClient()&&NET.me){
    add(netEl('div','mlabel','You are in '+(NET.peers.get('H')?NET.peers.get('H').name+'’s':'a friend’s')+' world as '+NET.name+'.'));
    add(netEl('div','netcode',NET.code));
    netPlayersBox(add,false);
    add(netEl('div','sinfo','PvP is '+(NET.pvp?'on':'off')+'. This world lives on the host’s computer: it saves there, with your things.'));
    add(netBtn('Leave the world',()=>{closeNetPanel();quitToTitle();},'danger'));
  }else if(playing){
    add(netEl('div','mlabel','Play this world with friends in other houses, on phones or computers.'));
    add(netBtn('\u{1F310} Open to friends',()=>{NET.err='';NET.status='Opening the world…';netUiSync();
      netHostStart().then(()=>netUiSync(),e=>{NET.status='';NET.err=NET.err||netErrText(e);netUiSync();});},'tgo'));
    add(netEl('div','sinfo','You get a room code to give them. Your world keeps running while they play, and remembers their things for next time.'));
    add(netEl('div','sinfo','To join someone else’s world instead, use \u{1F310} Multiplayer on the title screen.'));
  }else{
    add(netEl('div','mlabel','Join a friend’s world (any house, any device).'));
    add(netEl('label','mlabel','Your name'));
    const nm=add(netEl('input','mc-in'));nm.id='net_name';nm.maxLength=16;nm.value=PNAME;nm.autocomplete='off';nm.spellcheck=false;
    nm.onchange=()=>{if(!pnSet(nm.value)){if(pnClean(nm.value))showToast('Pick another name: 2 or more letters, and not an AI player’s name');nm.value=PNAME;}};
    add(netEl('label','mlabel','Room code'));
    const cd=add(netEl('input','mc-in netin'));cd.id='net_code';cd.maxLength=8;cd.placeholder='e.g. K7QXD';cd.autocomplete='off';cd.spellcheck=false;
    cd.setAttribute('autocapitalize','characters');cd.value=NET.lastCode||'';
    const go=()=>{const c=netCodeNorm(cd.value);NET.lastCode=c;if(nm.value!==PNAME)nm.onchange();NET.err='';
      netJoin(c).then(()=>{closeNetPanel();},e=>{NET.err=(e&&e.message)||NET.err;netUiSync();});};
    cd.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go();}};
    add(netBtn('Join world',go,'tgo'));
    add(netEl('div','sinfo','To host: open one of your worlds, pause (Esc or | |), \u{1F310} Multiplayer, Open to friends.'));
  }
  if(st)st.textContent=NET.err||NET.status||'';
  if(st&&st.classList)st.classList.toggle('neterr',!!NET.err);
}
function netPlayersBox(add,host){
  const box=add(netEl('div','netlist'));
  const row=(name,extra,kick)=>{const r=netEl('div','netrow');r.appendChild(netEl('span','',name));if(extra)r.appendChild(netEl('span','sinfo',extra));
    if(kick){const b=netBtn('Remove',kick);b.classList.add('netkick');r.appendChild(b);}box.appendChild(r);};
  row((host?NET.name:NET.name)+' (you)',host?'host':'');
  for(const p of NET.peers.values()){if(p.id===NET.me||!p.ready)continue;
    row(p.name,p.id==='H'?'host':(p.pose&&p.pose.d!==DIM?'in another dimension':''),host?()=>netKick(p.id):null);}
  if(NET.peers.size===0)box.appendChild(netEl('div','sinfo','Nobody else yet.'));
}
/* wiring (boot): the title and pause buttons, the panel's own keys (it eats them, so the title's arrow keys and the game's never
   see what you type in the code box) */
{
  const tb=$('t_go_net');if(tb)tb.onclick=()=>{try{playS('click');}catch(e){}openNetPanel();};
  const pb=$('p_net');if(pb)pb.onclick=()=>{try{playS('click');}catch(e){}openNetPanel();};
  const cb=$('net_close');if(cb)cb.onclick=()=>{try{playS('click');}catch(e){}closeNetPanel();};
  const pn=$('netpanel');
  if(pn&&pn.addEventListener)pn.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeNetPanel();}});
  if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',()=>{if(NET.on)netStop('unload');});
}
/* exports (spread into __vox, src/boot/export_boot.js) */
const NTEX={NET,NET_V,NET_MAX,NET_CHUNK,netOn,netHost,netClient,netPuppetMobs,netCode,netCodeNorm,netNameFix,netLook,netSaveFields,netLoad,
  netMemTransport,netBcTransport,netPeerTransport,netSendTr,netTrMsg,netTrJoin,netTrLeave,netErrText,netHostStart,netJoin,netStop,netKick,netSetPvp,
  netWorldFor,netRecv,netEditOut,netApplyEdit,netBeScan,netBeIn,netMyPose,netBodiesSync,netEntsOut,netEntsIn,netTick,netBodies,netTabRows,
  netKillXP,openNetPanel,closeNetPanel,netUiSync,getNetp:()=>netpOpen,getSeed:()=>SEED,WORLD,enterGame,
  chunkEditAt:(pf,x,y,z)=>{const cx=Math.floor(x/CH),cz=Math.floor(z/CH),m=chunkEdits.get(pf+cx+','+cz);return m?m.get((x-cx*CH)+','+y+','+(z-cz*CH)):undefined;}};
