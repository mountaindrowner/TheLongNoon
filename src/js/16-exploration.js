/* ============ exploration ============ */
const SPEED=4.4,TRAIL=[];let expo=0,thirst=0,stepSnd=0,titleT=0;
function resetTrail(){TRAIL.length=0;for(let i=0;i<40;i++)TRAIL.push([P.x,P.z]);}
function pushTrail(){const l=TRAIL[TRAIL.length-1];if(Math.hypot(l[0]-P.x,l[1]-P.z)>0.16){TRAIL.push([P.x,P.z]);if(TRAIL.length>90)TRAIL.shift();}}
function follow(a,back,dt){const i=Math.max(0,TRAIL.length-1-back);const [tx,tz]=TRAIL[i];const dx=tx-a.x,dz=tz-a.z,d=Math.hypot(dx,dz);
  if(d>0.04){const s=Math.min(d,SPEED*1.25*dt);a.x+=dx/d*s;a.z+=dz/d*s;a.moving=true;if(a.isChar)a.dir=Math.abs(dx)>Math.abs(dz)?(dx>0?'right':'left'):(dz>0?'down':'up');else a.flip=dx>0;}else a.moving=false;}
function movePlayer(dt){const v=inputVec();if(v.l<0.12){P.moving=false;return;}P.moving=true;const sp=SPEED*Math.max(0.45,v.l);const mx=v.x*sp*dt,mz=v.z*sp*dt;
  if(!blocked(P.x+mx,P.z,0.32))P.x+=mx;if(!blocked(P.x,P.z+mz,0.32))P.z+=mz;
  P.dir=Math.abs(v.x)>Math.abs(v.z)?(v.x>0?'right':'left'):(v.z>0?'down':'up');pushTrail();const ph=Math.floor(P.t*7)%4;if(ph!==P._ph){P._ph=ph;if(ph===0||ph===2)AU.step(tileAt(Math.floor(P.x),Math.floor(P.z)));}}
function wanderUpdate(o,a,area,sp,dt){if(o.wt<=0){if(Math.random()<0.55){o.tx=rnd(area[0],area[2]);o.tz=rnd(area[1],area[3]);o.wt=rnd(2,5);}else{o.tx=null;o.wt=rnd(1,3);}}o.wt-=dt;
  if(o.tx!=null){const dx=o.tx-a.x,dz=o.tz-a.z,d=Math.hypot(dx,dz);if(d<0.1){o.tx=null;a.moving=false;}else{a.x+=dx/d*sp*dt;a.z+=dz/d*sp*dt;a.moving=true;if(a.isChar)a.dir=Math.abs(dx)>Math.abs(dz)?(dx>0?'right':'left'):(dz>0?'down':'up');else a.flip=dx>0;}}else a.moving=false;}
function exploreUpdate(dt){
  movePlayer(dt);
  ST.clock+=dt;if(ST.clock>=1440){ST.clock-=1440;ST.day++;}
  if(NPC.kit.follower)follow(NPC.kit.actor,12,dt);
  if(ST.flags.drainDone&&PANCHA.visible)follow(PANCHA,24,dt);
  const ph=phaseOf(ST.clock),sheltered=Math.hypot(P.x-13,P.z-27)<3.4;const warn=$('#hWarn');
  if(ph==='Shutter'&&ST.flags.shutterWarn!==ST.day){ST.flags.shutterWarn=ST.day;toast('Shutter. Get under a roof before the white.','gold',4200);}
  if(ph==='Day'&&!sheltered){warn.hidden=false;warn.textContent='Daylight. Your water is burning.';expo+=dt;if(expo>3.5){expo=0;ST.water=Math.max(0,ST.water-1);AU.hurt();updateHUD(true);if(ST.water===0){faint();return;}}}
  else if(ph==='Shutter'){warn.hidden=false;warn.textContent='Shutter. Find a roof.';}else warn.hidden=true;
  thirst+=dt;if(thirst>150){thirst=0;if(ST.water>1){ST.water--;updateHUD(true);}}
  if(ST.step==='pancha'&&!ST.flags.drainStarted){const r=MAP.zones[0].r;if(P.x>r[0]&&P.x<r[2]&&P.z>r[1]&&P.z<r[3]){ST.flags.drainStarted=true;P.moving=false;runScript(DLG.drainIntro);}}
}
let curTarget=null;
function findTarget(){let best=null,bd=1e9;
  for(const k in NPC){const n=NPC[k];if(n.follower||!n.actor.visible)continue;const d=Math.hypot(P.x-n.actor.x,P.z-n.actor.z);if(d<1.8&&d<bd){bd=d;best={kind:'npc',n,x:n.actor.x,y:2.15,z:n.actor.z,label:'Talk to '+n.def.name};}}
  for(const it of MAP.interact){const d=Math.hypot(P.x-it.x,P.z-it.z);if(d<it.r&&d<bd){bd=d;best={kind:'obj',it,x:it.x,y:1.9,z:it.z,label:it.label};}}
  return best;}
function updatePrompt(){curTarget=findTarget();const el=$('#prompt');if(!curTarget){el.hidden=true;return;}const s=toScreen(curTarget.x,curTarget.y,curTarget.z);
  el.hidden=false;el.style.left=s.x+'px';el.style.top=s.y+'px';el.querySelector('b').textContent=isTouch?'A':'E';el.querySelector('span').textContent=curTarget.label;}
async function interact(){const t=findTarget();if(!t)return;AU.blip();P.moving=false;
  if(t.kind==='npc'){const a=t.n.actor,od=a.dir;a.face(P.x,P.z);P.face(a.x,a.z);t.n.talking=true;await runScript(resolveDlg(t.n.def.id));t.n.talking=false;if(!t.n.def.wander)a.dir=t.n.def.dir;}
  else{P.face(t.it.x,t.it.z);await runScript(resolveDlg(t.it.id));}}
function npcUpdate(n,dt){if(n.follower||n.talking)return;if(n.def.wander&&(mode==='explore'||mode==='title'))wanderUpdate(n,n.actor,n.def.wander,n.def.slow?0.7:1.3,dt);else n.actor.moving=false;}

