/* ============ save / load ============ */
function save(quiet){if(!ST)return;if(!quiet)AU.save();ST.pos=[+P.x.toFixed(2),+P.z.toFixed(2)];ST.dir=P.dir;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(ST));if(!quiet)toast('Game saved','gold');}catch(e){toast("Couldn't save. Browser storage is turned off.");}}
function loadGame(){let s=null;try{s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');}catch(e){}
  if(!s||s.v!==1){toast('No saved game yet.');return false;}
  ST=s;CAM.override=null;DR.on=false;DRONE.visible=false;$('#card').hidden=true;$('#battle').hidden=true;dlgEl.hidden=true;aWaiter=null;qteHandler=null;escHandler=null;
  applyState();envAt(ST.clock);updateCam(0,true);streamChunks(CAM.look.x,CAM.look.z,true);setMode('explore');updateObjective(false);AU.music('explore');toast('Loaded your last save');return true;}

