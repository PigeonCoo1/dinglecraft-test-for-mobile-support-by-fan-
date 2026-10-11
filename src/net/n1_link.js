/* ---- PART 58: n1_link.js ---- */
/* the wire. A transport moves strings between two kinds of ends:
     host side  T.host(code) opens the room; T.onjoin(trId) / T.onleave(trId) as guests come and go
     guest side T.join(code) resolves to the host's trId
     both       T.send(trId,string), T.drop(trId), T.close(), T.onmsg(trId,string)
   Messages are JSON; anything over NET_CHUNK characters goes as numbered pieces (a whole world is megabytes, a data channel
   message is not), reassembled per sender. */
const NET_CHUNK=14000;
/* PeerJS (assets/vendor/peerjs.1.5.4.min.js): the free public PeerJS server only introduces the two ends; its default config
   brings public STUN and TURN servers, so most home, school and mobile networks can connect. window.__DINGLE_NET can override
   the options (a private PeerJS server: {host,port,path,secure}) */
function netPeerOpts(){const o={debug:0};try{if(typeof window!=='undefined'&&window.__DINGLE_NET&&window.__DINGLE_NET.peer)Object.assign(o,window.__DINGLE_NET.peer);}catch(e){}return o;}
function netPeerTransport(){
  const T={kind:'peer',peer:null,conns:new Map(),onmsg:null,onjoin:null,onleave:null,onerr:null};
  const wire=(c,opened)=>{
    c.on('open',()=>{T.conns.set(c.peer,c);if(opened)opened(c.peer);else if(T.onjoin)T.onjoin(c.peer);});
    c.on('data',d=>{if(T.onmsg)T.onmsg(c.peer,typeof d==='string'?d:String(d));});
    c.on('close',()=>{if(T.conns.get(c.peer)===c){T.conns.delete(c.peer);if(T.onleave)T.onleave(c.peer);}});
    c.on('error',()=>{});
  };
  T.host=code=>new Promise((res,rej)=>{
    if(typeof Peer!=='function'){rej(new Error('nopeer'));return;}
    let done=false;const p=new Peer(NET_PREFIX+code,netPeerOpts());T.peer=p;
    p.on('open',()=>{if(!done){done=true;res(code);}});
    p.on('connection',c=>wire(c));
    p.on('error',e=>{if(!done){done=true;try{p.destroy();}catch(x){}rej(e);}else if(T.onerr)T.onerr(e);});
    p.on('disconnected',()=>{try{if(!p.destroyed)p.reconnect();}catch(e){}});   /* lost the matchmaker: the room and its links stay up */
    setTimeout(()=>{if(!done){done=true;try{p.destroy();}catch(x){}rej(new Error('timeout'));}},20000);
  });
  T.join=code=>new Promise((res,rej)=>{
    if(typeof Peer!=='function'){rej(new Error('nopeer'));return;}
    let done=false;const p=new Peer(netPeerOpts());T.peer=p;
    const fail=e=>{if(!done){done=true;try{p.destroy();}catch(x){}rej(e);}};
    p.on('open',()=>{const c=p.connect(NET_PREFIX+code,{reliable:true,serialization:'raw'});
      wire(c,id=>{if(!done){done=true;res(id);}});});
    p.on('error',e=>{if(!done)fail(e);else if(T.onerr)T.onerr(e);});
    setTimeout(()=>fail(new Error('timeout')),25000);
  });
  T.send=(id,s)=>{const c=T.conns.get(id);if(c&&c.open)c.send(s);};
  T.drop=id=>{const c=T.conns.get(id);if(c){try{c.close();}catch(e){}}};
  T.close=()=>{try{if(T.peer)T.peer.destroy();}catch(e){}T.conns.clear();};
  return T;
}
/* two tabs of one browser (the QA rig, or trying it on one computer): a BroadcastChannel per room code */
function netBcTransport(){
  const T={kind:'bc',ch:null,id:'b'+netCode(10),conns:new Set(),onmsg:null,onjoin:null,onleave:null};
  const open=code=>{T.ch=new BroadcastChannel(NET_PREFIX+code);T.ch.onmessage=ev=>{const m=ev.data;if(!m||m.from===T.id)return;T.rx(m);};};
  const post=m=>{try{T.ch.postMessage(Object.assign({from:T.id},m));}catch(e){}};
  T.host=code=>new Promise(res=>{open(code);
    T.rx=m=>{if(m.k==='hi'&&!m.to){if(!T.conns.has(m.from)){T.conns.add(m.from);post({k:'ok',to:m.from});if(T.onjoin)T.onjoin(m.from);}else post({k:'ok',to:m.from});}
      else if(m.to!==T.id)return;
      else if(m.k==='msg'&&T.conns.has(m.from)){if(T.onmsg)T.onmsg(m.from,m.d);}
      else if(m.k==='bye'&&T.conns.has(m.from)){T.conns.delete(m.from);if(T.onleave)T.onleave(m.from);}};
    res(code);});
  T.join=code=>new Promise((res,rej)=>{open(code);let done=false,host=null;
    T.rx=m=>{if(m.to!==T.id)return;
      if(m.k==='ok'&&!done){done=true;host=m.from;T.conns.add(host);res(host);}
      else if(m.k==='msg'&&m.from===host){if(T.onmsg)T.onmsg(m.from,m.d);}
      else if(m.k==='bye'&&m.from===host){T.conns.delete(host);if(T.onleave)T.onleave(host);}};
    let n=0;const knock=()=>{if(done)return;if(++n>16){done=true;rej({type:'peer-unavailable'});return;}post({k:'hi'});setTimeout(knock,500);};knock();});
  T.send=(id,s)=>{if(T.conns.has(id))post({k:'msg',to:id,d:s});};
  T.drop=id=>{if(T.conns.has(id)){post({k:'bye',to:id});T.conns.delete(id);}};
  T.close=()=>{for(const id of T.conns)post({k:'bye',to:id});T.conns.clear();try{if(T.ch)T.ch.close();}catch(e){}};
  return T;
}
/* the node suite's wire: everything sent lands in T.out; the suite plays the other end through netTrMsg / netTrJoin / netTrLeave */
function netMemTransport(){
  const T={kind:'mem',out:[],closed:false,onmsg:null,onjoin:null,onleave:null};
  T.host=async code=>code;T.join=async()=>'HOST';
  T.send=(id,s)=>{T.out.push([id,s]);};T.drop=id=>{T.out.push([id,'#drop']);};T.close=()=>{T.closed=true;};
  return T;
}
function netWire(T){T.onmsg=netTrMsg;T.onjoin=netTrJoin;T.onleave=netTrLeave;T.onerr=e=>{NET.err=netErrText(e);};}
/* send one message to one transport end (pieces if it is big) */
function netSendTr(trId,msg){
  const T=NET.tr;if(!T||trId==null)return;
  const s=JSON.stringify(msg);
  NET.stats.tx+=s.length;NET.stats.msgsTx++;
  if(s.length<=NET_CHUNK){T.send(trId,s);return;}
  const id=netCode(6),n=Math.ceil(s.length/NET_CHUNK);
  for(let i=0;i<n;i++)T.send(trId,'\u0001'+id+'|'+i+'|'+n+'|'+s.slice(i*NET_CHUNK,(i+1)*NET_CHUNK));
}
function netTrMsg(trId,s){
  if(typeof s!=='string'||!s)return;
  NET.stats.rx+=s.length;NET.stats.msgsRx++;
  if(s.charCodeAt(0)===1){
    const a=s.indexOf('|'),b=s.indexOf('|',a+1),c=s.indexOf('|',b+1);
    const id=trId+':'+s.slice(1,a),i=+s.slice(a+1,b),n=+s.slice(b+1,c);
    let C=NET.chunks.get(id);if(!C){C={n,got:0,parts:new Array(n)};NET.chunks.set(id,C);}
    if(C.parts[i]==null){C.parts[i]=s.slice(c+1);C.got++;}
    if(n>8&&netClient()&&!NET.me)NET.status='Downloading the world… '+Math.round(C.got/n*100)+'%';
    if(C.got<C.n)return;
    NET.chunks.delete(id);s=C.parts.join('');
  }
  let msg;try{msg=JSON.parse(s);}catch(e){return;}
  if(!msg||typeof msg.t!=='string')return;
  try{netRecv(trId,msg);}catch(e){if(typeof console!=='undefined')console.warn('[LINK] '+msg.t+': '+(e&&e.message));}
}
function netTrJoin(trId){if(!netHost())return;const old=NET.byTr.get(trId);if(old)netPeerGone(old,'left');NET.byTr.set(trId,null);}   /* a link is up: they still have to say hi (the same end again: a new session) */
function netTrLeave(trId){
  if(netHost()){const p=NET.byTr.get(trId);NET.byTr.delete(trId);if(p)netPeerGone(p,'left');}
  else if(netClient()&&trId===NET.hostTr)netLost('The host closed the world (or the link dropped)');
}
/* human words for what went wrong */
function netErrText(e){
  const t=e&&(e.type||e.message)||''+e;
  if(t==='peer-unavailable')return 'No world with that code. Check the code, and that the host still has it open.';
  if(t==='unavailable-id')return 'That room code is taken right now. Try again.';
  if(t==='network'||t==='server-error'||t==='socket-error'||t==='socket-closed')return 'Can’t reach the matchmaker. Check your internet connection.';
  if(t==='browser-incompatible'||t==='nopeer')return 'This browser can’t do multiplayer (no WebRTC).';
  if(t==='timeout')return 'Nobody answered in time. Check the code and your internet, then try again.';
  return 'Link error: '+t;
}
