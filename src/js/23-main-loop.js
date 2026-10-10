/* ============ main loop ============ */
const ACC={chunk:0,lamp:0,flag:0,fire:0,hud:0,stats:0};let frames=0,last=performance.now();
function update(dt){
  if(mode==='explore')exploreUpdate(dt);
  if(mode==='title'){titleT+=dt;const a=titleT*0.05+0.6;CAM.override={t:V3(12.5,1.2,30.5),o:V3(Math.sin(a)*16,7.8,Math.cos(a)*16),k:4};}
  P.update(dt);for(const k in NPC){const n=NPC[k];npcUpdate(n,dt);n.actor.update(dt);if(!(ARENA.on&&k==='kit'))n.actor.visible=!n.hidden&&loadedAt(n.actor.x,n.actor.z);}
  CINE.actors.forEach(a=>a.update(dt));taleDraw(dt);
  ANIMALS.forEach(o=>{if(mode!=='battle')wanderUpdate(o,o.a,o.area,o.sp,dt);o.a.update(dt);o.a.visible=loadedAt(o.a.x,o.a.z);});
  if(ST&&!ST.flags.drainDone&&ST.step!=='pancha'&&mode!=='end')PANCHA.visible=false;PANCHA.update(dt);if(PANCHA.visible&&!ST.flags.drainDone){PANCHA.anim=true;PANCHA.fps=2;}else PANCHA.anim=false;
  if(WRECK)WRECK.update(dt);for(const k in FOES)FOES[k].forEach(a=>a.update(dt));
  if(DR.on){DR.t+=dt;DRONE.position.set(-50+DR.t*12,15-DR.t*0.28,-2+Math.sin(DR.t*0.4)*1.2);DRONE.rotation.x=Math.sin(DR.t*0.7)*0.05;DRONE.rotation.z=-0.04;DSHADOW.visible=true;DSHADOW.position.x=DRONE.position.x+6;DSHADOW.position.z=DRONE.position.z+18;if(DR.t>24){DSHADOW.visible=false;DR.on=false;DRONE.visible=false;}}
  if(ARENA.on)arenaEnv(dt);else updateCam(dt,false);
  fxUpdate(dt);
  ACC.chunk+=dt;if(ACC.chunk>0.2){ACC.chunk=0;streamChunks(CAM.look.x,CAM.look.z,false);}
  ACC.lamp+=dt;if(ACC.lamp>0.25){ACC.lamp=0;assignLamps(CAM.look.x,CAM.look.z);}
  ACC.flag+=dt;if(ACC.flag>0.42){ACC.flag=0;animFlags();}ACC.fire+=dt;if(ACC.fire>0.16){ACC.fire=0;animFires();}
  if(ST)envAt(ST.clock);
  if(mode==='explore'){updatePrompt();updateMarker();}
  ACC.hud+=dt;if(ACC.hud>0.2){ACC.hud=0;updateHUD(false);}}
function stats(real){frames++;ACC.stats+=real;if(ACC.stats<0.5)return;const fps=Math.round(frames/ACC.stats),ms=(ACC.stats/frames*1000).toFixed(1);frames=0;ACC.stats=0;
  const el=$('#fps');el.hidden=!SET.showFps||mode==='loading'||mode==='title'||mode==='end';if(el.hidden)return;const i=renderer.info.render;
  el.textContent=`${fps} fps  ${ms} ms\ndraw calls ${i.calls}  triangles ${(i.triangles/1000).toFixed(1)}k\nchunks loaded ${chunks.size} of ${(CX1-CX0+1)*(CZ1-CZ0+1)}: ${[...chunks.keys()].join('  ')}\npixel ratio ${DPR}  graphics ${SET.quality}${SHADOWS()?' + shadows':''}`;}
function loop(now){requestAnimationFrame(loop);const real=(now-last)/1000;last=now;const dt=Math.min(0.05,real);update(dt);render();stats(real);}

