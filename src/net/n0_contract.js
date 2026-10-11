/* ---- PART 58: n0_contract.js ---- */
/* ===================================================================== */
/* PART 58 — THE LINK UPDATE (v7.1): multiplayer. n0 contract.           */
/* Friends in other houses play in one world: the host opens a world     */
/* ("Open to friends" in the pause menu) and gets a room code; friends   */
/* type it under Multiplayer on the title screen, on any device.         */
/*                                                                       */
/* Shape: the host's game is the truth. A guest gets the host's world    */
/* (a save, minus the host's own player, bots and mobs) and then:        */
/*   blocks      every setBlock is sent (with its dimension) and relayed */
/*   containers  blockEnts diffs every half second (chests, furnaces...) */
/*   players     poses 10x a second; remote players are bodies built     */
/*               like the AI players' (agHumanoid, agTag, agAnimate),    */
/*               mobs and weapons treat them as players                  */
/*   mobs/drops  the host's, streamed to guests in the host's dimension  */
/*               as puppets; a guest's hits and pickups go to the host;  */
/*               a guest elsewhere (another dimension) runs its own      */
/*   chat, time of day, game rules, PvP, deaths, explosions (fx), XP     */
/* A guest never saves the host's world locally; the host keeps every    */
/* guest's player (inventory, health, position) in its world save, so    */
/* coming back gives you your stuff back.                                */
/* Transport (n1): PeerJS (vendored, assets/vendor) through the free     */
/* public PeerJS server for the introduction, then direct WebRTC; a      */
/* BroadcastChannel transport for two tabs of one browser (the QA rig);  */
/* a memory transport for the node suite. Everything testable is in      */
/* NTEX (spread into __vox).                                             */
/* ===================================================================== */
const NET={on:false,role:null,kind:'',hb:0,code:'',tr:null,me:'H',name:'',peers:new Map(),byTr:new Map(),pvp:true,
  applying:0,edits:[],nid:1,byNid:new Map(),pup:new Map(),hostDim:'over',hostT:-1,
  beLast:new Map(),beT:0,poseT:0,entT:0,timeT:0,stT:0,pingT:0,grLast:'',guests:{},
  status:'',err:'',joinCb:null,welcomeAt:0,chunks:new Map(),wasDead:false,taken:new Set(),
  stats:{tx:0,rx:0,msgsTx:0,msgsRx:0},clock:()=>(typeof performance!=='undefined'?performance.now():Date.now())};
const NET_V=1;                                  /* protocol version: guests with another one are turned away */
const NET_MAX=8;                                /* players in a room, the host included */
const NET_PREFIX='dinglecraft-link-';           /* PeerJS ids live in one public namespace: ours all start with this */
const NET_ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789';   /* room codes: no 0/O, 1/I/L */
const NET_RANGE=72;                             /* mobs and drops within this many blocks of a guest are streamed to it */
MOBT.netp={hp:20,hw:0.3,h:1.8,spd:1,pnc:1,body:'#d9822b',legc:'#34343a'};   /* a remote player's body (never counted, saved or despawned) */
function netOn(){return NET.on;}
function netHost(){return NET.on&&NET.role==='host';}
function netClient(){return NET.on&&NET.role==='client';}
/* a guest standing in the host's dimension shows the host's mobs instead of running its own. Puppet Purgatory is the exception:
   its cast and bosses are a show run by each player's own game (as Malgorath's are, everywhere) */
function netPuppetMobs(){return netClient()&&DIM===NET.hostDim&&DIM!=='puppet';}
function netCode(n){let s='';for(let i=0;i<(n||5);i++)s+=NET_ALPHA[(Math.random()*NET_ALPHA.length)|0];return s;}
function netCodeNorm(s){return (''+(s||'')).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);}
/* a name everybody can tell apart: never 'Dan' (the game maps 'Dan' to whoever is reading) and never a name already in the room */
function netNameFix(n,taken){
  n=pnClean(n)||'Player';if(n.toLowerCase()==='dan')n='Dan1';
  if(!pnValid(n))n='Player';
  let out=n,i=2;const low=new Set((taken||[]).map(x=>(''+x).toLowerCase()));
  while(low.has(out.toLowerCase()))out=n.slice(0,13)+(i++);
  return out;
}
/* the colours of a player's body, picked from their name (the same on every screen) */
function netLook(name){
  let h=2166136261;for(const c of ''+name){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  const pick=(a,s)=>a[((h>>>s)&255)%a.length];
  return {skin:pick([0xf2c9a6,0xe8b88f,0xd2a07a,0xa9734f,0x8a5a3c,0x6b4430],0),shirt:pick([0x3d6fd1,0xd13d3d,0x3da84f,0xd1a23d,0x8a3dd1,0x3dc2d1,0xd13d9a,0xf2f2f2],8),
    pants:pick([0x2c3a5a,0x3a2c2c,0x2c2c2c,0x4b3a28,0x34404a],16),shoe:pick([0x1e1e1e,0x2a2a20,0x5a3a2a],24),hat:null};
}
/* save fields (the host's world remembers its guests) */
function netSaveFields(){const g=NET.guests;return Object.keys(g).length?{net:{guests:JSON.parse(JSON.stringify(g))}}:{};}
function netLoad(d){NET.guests={};if(d&&d.guests&&typeof d.guests==='object')for(const k in d.guests){const g=d.guests[k];if(g&&g.player)NET.guests[k]=g;}}
function netReset(){NET.guests={};}
