/* ============ rest, faint, ending ============ */
async function rest(quiet){AU.creak();await fadeTo(1,500);ST.party.juno.hp=BAT.units.juno.hp;ST.party.kit.hp=BAT.units.kit.hp;save(true);await sleep(350);await fadeTo(0,500);if(!quiet)toast('Rested. Game saved.','gold');}
async function faint(){if(mode!=='explore')return;setMode('script');await fadeTo(1,900,'#f4f0e6');await runScript(DLG.faint);setMode('script');
  ST.clock=1170;ST.day++;ST.water=3;ST.white=Math.max(0,ST.white-1);P.place(13,28.4);P.dir='down';resetTrail();if(NPC.kit.follower)NPC.kit.actor.place(14,28.8);if(ST.flags.drainDone)PANCHA.place(12,29);
  envAt(ST.clock);updateCam(0,true);save(true);updateHUD(true);await fadeTo(0,900);setMode('explore');}
async function lookUp(){P.dir='right';NPC.kit.actor.dir='right';CAM.override={t:V3(40,9,16),o:V3(-31,1.2,23),k:0.8};DR.on=true;DR.t=0;DRONE.visible=true;DRONE.position.set(-50,15,-2);AU.drone();await sleep(2600);}
async function ending(){AU.creak();AU.music('none');await fadeTo(1,800);dlgEl.hidden=true;
  await say('','Shutter. Doors sealed. The Span sleeps through the heat.');dlgEl.hidden=true;
  ST.party.juno.hp=42;ST.party.kit.hp=26;ST.clock=6*60+50;ST.day++;envAt(ST.clock);
  P.place(11.6,29.4);P.dir='up';P.moving=false;const kit=NPC.kit;kit.follower=false;kit.actor.place(13.5,29.9);kit.actor.dir='left';PANCHA.place(19.5,31);PANCHA.visible=true;
  CAM.override={t:V3(12.5,1,29),o:V3(0,7,11),k:3};updateCam(0,true);streamChunks(CAM.look.x,CAM.look.z,true);
  $('#hud').hidden=true;$('#objective').hidden=true;$('#touch').hidden=true;await fadeTo(0,1100,'#f4f0e6');await runScript(DLG.fall);dlgEl.hidden=true;await sleep(900);
  if(!ST.pages.includes('last'))ST.pages.push('last');
  setMode('end');$('#card').hidden=false;AU.music('intro');setTimeout(()=>$('#card [data-a=read]').focus(),60);}
function continueAfterEnding(){DR.on=false;DRONE.visible=false;CAM.override=null;ST.clock=19*60+30;P.place(13,28.4);P.dir='down';resetTrail();NPC.kit.follower=true;NPC.kit.actor.place(14,28.8);PANCHA.place(12,29);
  ST.step='free';updateCam(0,true);envAt(ST.clock);save(true);setMode('explore');updateObjective(true);AU.music('explore');AU.chime();}

