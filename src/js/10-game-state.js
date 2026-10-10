/* ============ game state ============ */
let ST=null,mode='loading';
function newState(){return{v:1,step:'burial',flags:{},clock:19*60+20,day:1,water:6,white:0,items:{},pages:[],party:{juno:{hp:42,dur:12},kit:{hp:26}},joined:[],pos:[MAP.spawn.x,MAP.spawn.z],dir:MAP.spawn.dir};}
function setMode(m){mode=m;document.body.className='mode-'+m;
  const play=(m==='explore'||m==='script')&&!(DR.on)&&!(typeof CINE!=='undefined'&&CINE.on);$('#hud').hidden=!play;$('#objective').hidden=!(play&&QST.steps[ST&&ST.step]&&QST.steps[ST.step].obj);
  $('#touch').hidden=!(isTouch&&(m==='explore'||m==='script'));if(m!=='explore'){$('#prompt').hidden=true;$('#marker').hidden=true;JOY.x=JOY.z=0;}}
let P;const NPC={},ANIMALS=[];let PANCHA=null,WRECK=null;const FOES={};
function initActors(){
  P=new Actor('juno');
  MAP.npcs.forEach(d=>{const a=new Actor(d.char).place(d.x,d.z);a.dir=d.dir;NPC[d.id]={def:d,actor:a,follower:false,wt:0};});
  MAP.animals.forEach(d=>{const fr=d.kind==='goat'?['goat_0','goat_1']:['chicken_0','chicken_1'];const a=new Actor(d.kind,fr).place(d.x,d.z);a.fps=d.kind==='goat'?5:8;ANIMALS.push({a,area:d.area,sp:d.kind==='goat'?0.7:1.1,wt:rnd(0,2)});});
  PANCHA=new Actor('goat',['goat_0','goat_1']);PANCHA.visible=false;PANCHA.fps=6;
}
function applyState(){
  P.place(ST.pos[0],ST.pos[1]);P.dir=ST.dir||'down';P.moving=false;resetTrail();
  const kit=NPC.kit;if(ST.joined.includes('kit')){kit.follower=true;kit.actor.place(P.x-0.8,P.z+0.4);}else{kit.follower=false;kit.actor.place(kit.def.x,kit.def.z);kit.actor.dir=kit.def.dir;}
  if(ST.flags.drainDone){PANCHA.visible=true;PANCHA.place(P.x-1.4,P.z+0.6);}else if(ST.step==='pancha'){PANCHA.visible=true;PANCHA.place(MAP.pancha.x,MAP.pancha.z);PANCHA.flip=false;}else PANCHA.visible=false;
  for(const k in FOES){FOES[k].forEach(f=>f.dispose());delete FOES[k];}
  if(WRECK){WRECK.dispose();WRECK=null;GLOBAL_COL.length=0;}
  if(ST.flags.drainDone)makeWreck();
  updateHUD(true);updateObjective(false);
}
function makeWreck(){const s=MAP.battleSpots.drain,e=BAT.drain.enemies[0];WRECK=new Actor('stray',[e.broken]);WRECK.place(s.x+e.pos[0],s.z+e.pos[1]);GLOBAL_COL.push({t:'c',x:WRECK.x,z:WRECK.z,r:0.9});}
function addItem(id,n){ST.items[id]=(ST.items[id]||0)+n;}
const ITEM_NAMES={staybook:'The staybook',milk:'Goat milk',scrap:'Scrap metal',cell:'Dead solar cell',bearings:'Ball bearings'};

