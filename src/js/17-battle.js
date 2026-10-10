/* ============ battle ============ */
const tween=(ms,fn)=>new Promise(res=>{const t0=performance.now();const f=()=>{const t=Math.min(1,(performance.now()-t0)/ms);fn(easeOut(t));if(t<1)requestAnimationFrame(f);else res();};f();});
const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
async function spawnEnemies(id){const def=BAT[id],s=MAP.battleSpots[def.spot];
  FOES[id]=def.enemies.map(e=>{const a=new Actor(e.id,e.frames);a.anim=true;a.fps=e.id==='stray'?3:6;a.place(s.x+e.pos[0]+1.2,s.z-8);return a;});
  AU.servo();setTimeout(()=>AU.beep(),500);setTimeout(()=>AU.growl(),900);await Promise.all(FOES[id].map((a,i)=>{const e=def.enemies[i];const tx=s.x+e.pos[0],tz=s.z+e.pos[1],sx=a.x,sz=a.z;a.moving=true;return sleep(i*500).then(()=>tween(1500,t=>{a.x=lerp(sx,tx,t);a.z=lerp(sz,tz,t);})).then(()=>{a.moving=false;});}));}
const alive=f=>!f.fled&&f.parts.find(p=>p.id==='body').hp>0;
function liveUnits(all){return all.filter(u=>u.party?u.hp>0:alive(u));}
function nextTurn(all){const live=liveUnits(all);for(let g=0;g<1000;g++){let best=null;for(const u of live)if(u.ct>=100&&(!best||u.ct>best.ct))best=u;if(best){best.ct-=100;return best;}for(const u of live)u.ct+=u.spd;}return live[0];}
function preview(all,n){const live=liveUnits(all).map(u=>({u,ct:u.ct}));const out=[];for(let g=0;g<800&&out.length<n;g++){let best=null;for(const s of live)if(s.ct>=100&&(!best||s.ct>best.ct))best=s;if(best){best.ct-=100;out.push(best.u);}else for(const s of live)s.ct+=s.u.spd;}return out;}
function renderTurns(cur,all){$('#turnbar .q').innerHTML=[cur,...preview(all,5)].map(u=>`<span class="${u.party?'':'e'}">${esc(u.name)}</span>`).join('');}
let BPARTY=[];
function renderParty(cur){$('#bparty').classList.add('panel');$('#bparty').innerHTML=BPARTY.map(p=>{const w=p.id==='juno'?(ST.party.juno.dur>0?`Pipe ${ST.party.juno.dur}/12`:'Pipe (bent)'):p.weapon;
  return `<div class="pc ${cur===p?'act':''}"><b>${esc(p.name)}</b><div class="bar"><i style="width:${Math.round(100*p.hp/p.max)}%"></i></div><span class="hp">${p.hp}/${p.max}</span><span class="wpn">${w}${p.brace?' · bracing':''}</span></div>`;}).join('');}
const bmsg=async(t,ms=900)=>{$('#bmsg').textContent=t;if(ms)await sleep(ms);};
function bmenu(items,hd){return new Promise(res=>{const m=$('#bmenu');m.innerHTML='';m.classList.add('panel');
  if(hd){const h=document.createElement('div');h.className='hd';h.textContent=hd;m.appendChild(h);}
  const done=v=>{m.innerHTML='';m.classList.remove('panel');escHandler=null;if(v===null)AU.back();else AU.blip();res(v);};
  items.forEach(it=>{const b=document.createElement('button');b.innerHTML=it.html||esc(it.label);if(it.sub){const s=document.createElement('small');s.textContent=it.sub;b.appendChild(s);}b.disabled=!!it.disabled;b.onclick=e=>{e.stopPropagation();done(it.id);};m.appendChild(b);});
  escHandler=()=>done(null);const f=m.querySelector('button:not([disabled])');f&&f.focus({preventScroll:true});});}
function float(a,t,cls='',dy=0){const s=toScreen(a.x,1.5+dy,a.z);const d=document.createElement('div');d.className='fl '+cls;d.textContent=t;d.style.left=s.x+'px';d.style.top=s.y+'px';$('#floats').appendChild(d);setTimeout(()=>d.remove(),1150);}
function shake(a){if(reduceMotion)return;const m=a.mesh;tween(240,t=>{m.position.x=Math.sin(t*40)*0.08*(1-t);}).then(()=>m.position.x=0);}
async function lunge(a,t,frac=0.62){const sx=a.x,sz=a.z,tx=lerp(sx,t.x,frac),tz=lerp(sz,t.z,frac);a.moving=true;AU.whoosh();await tween(200,k=>{a.x=lerp(sx,tx,k);a.z=lerp(sz,tz,k);});await tween(220,k=>{a.x=lerp(tx,sx,k);a.z=lerp(tz,sz,k);});a.moving=false;}
async function shoot(a,t){const b=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,4),new THREE.MeshBasicMaterial({color:0xe8e2d4}));const S=activeScene();S.add(b);AU.twang();
  await tween(110,k=>{a.y=Math.sin(k*Math.PI)*0.2;});await tween(260,k=>{b.position.set(lerp(a.x+0.3,t.x,k),0.9+Math.sin(k*Math.PI)*0.6,lerp(a.z,t.z+0.1,k));});S.remove(b);b.geometry.dispose();b.material.dispose();a.y=0;}
function qte(a){return new Promise(res=>{const el=$('#qte'),ring=el.querySelector('i'),lab=el.querySelector('b');const first=!ST.flags.qteSeen;ST.flags.qteSeen=true;
  const T=first?1200:900;lab.textContent=first?(isTouch?'Tap when the ring closes':'Press Space when the ring closes'):'';const s=toScreen(a.x,0.9,a.z);el.style.transform=`translate(${s.x}px,${s.y}px)`;el.hidden=false;
  const t0=performance.now()+(first?500:150);let over=false;
  const end=r=>{if(over)return;over=true;qteHandler=null;el.hidden=true;res(r);};
  const fr=()=>{if(over)return;const p=(performance.now()-t0)/T;ring.style.transform=`scale(${lerp(2.5,1,clamp(p,0,1))})`;ring.style.opacity=p<0?0.4:1;if(p>1.22){end('fail');return;}requestAnimationFrame(fr);};
  qteHandler=()=>{const p=(performance.now()-t0)/T;end(p>=0.78&&p<=1.22?'parry':'fail');};fr();});}
async function sparkFx(f,targets){AU.zap();for(let i=0;i<3;i++){targets.forEach(t=>{t.actor.flash();});await sleep(90);}}
async function fleeAnim(f){f.fled=true;AU.yelp();await bmsg(`The ${f.name.toLowerCase()} yelps and limps off into the brush.`,0);const a=f.actor,sx=a.x;a.flip=true;a.moving=true;await tween(900,k=>{a.x=sx+k*7;});a.visible=false;await sleep(500);}
async function playerTurn(u,foes,def){u.brace=false;renderParty(u);await bmsg(`${u.name}'s turn.`,0);
  for(;;){const c=await bmenu([{id:'fight',label:'Fight',sub:u.id==='juno'?(ST.party.juno.dur>0?'Pipe':'Bent pipe'):'Sling'},{id:"brace",label:"Brace",sub:"Half damage"},{id:'drink',label:'Drink water',sub:`${ST.water} left`,disabled:ST.water<=0||u.hp>=u.max},{id:'run',label:'Run'}],u.name);
    if(c==='fight'){const items=[];const known=ST.pages.includes('5');
      foes.filter(alive).forEach(f=>f.parts.filter(p=>p.hp>0).forEach(p=>{let tag='';if(known&&p.soft)tag='<span class="tag soft">Soft</span>';if(p.armor)tag=f.stunned?'<span class="tag brk">Broken</span>':'<span class="tag armor">Armor</span>';
        const lbl=f.parts.length>1?`${f.name}: ${p.name}`:f.name;items.push({id:f.id+'|'+p.id,html:`${esc(lbl)}${tag}`,sub:`${p.hp}/${p.max}`});}));
      items.push({id:null,label:'Back'});const tg=await bmenu(items,'Hit what?');if(!tg)continue;
      const [fid,pid]=tg.split('|');const f=foes.find(x=>x.id===fid);await doAttack(u,f,f.parts.find(p=>p.id===pid));return;}
    if(c==='brace'){u.brace=true;AU.brace();renderParty(null);await bmsg(`${u.name} braces.`,700);return;}
    if(c==='drink'){ST.water--;updateHUD(true);u.hp=Math.min(u.max,u.hp+16);float(u.actor,'+16','good');AU.gulp();setTimeout(()=>AU.heal(),300);await bmsg(`${u.name} drinks. One less cup of water.`,900);return;}
    if(c==='run'){await bmsg(def.noRun,1200);continue;}
    if(c===null)continue;}}
async function doAttack(u,f,part){
  if(u.sling)await shoot(u.actor,f.actor);else await lunge(u.actor,f.actor);
  let mult=1,brk=false;if(part.soft)mult*=u.sling?2.2:1.4;
  if(part.armor){if(f.stunned){mult*=2;brk=true;}else mult*=u.sling?0.3:(f.eyeBroken?0.6:part.armor);}
  if(u.id==='juno'){const s=ST.party.juno;if(s.dur<=0)mult*=0.6;else{s.dur=Math.max(0,s.dur-(part.armor?2:1));if(s.dur===0)toast("The pipe bends. It won't swing straight anymore.");}}
  const dmg=Math.max(1,Math.round((u.atk+ri(0,2))*mult));part.hp=Math.max(0,part.hp-dmg);f.actor.flash();shake(f.actor);if(part.armor&&!brk)AU.clang();else AU.thud();float(f.actor,String(dmg),brk?'brk':'');renderParty(null);
  if(part.armor&&!f.stunned&&!f.eyeBroken&&!u.sling&&!ST.flags.armorHint){ST.flags.armorHint=true;await bmsg("Armor. The pipe barely dents it. Hit what's soft.",1700);}
  if(part.id==='eye'&&part.hp===0&&!f.eyeBroken){f.eyeBroken=true;f.stunned=1;f.actor.override=f.def.broken;f.actor.anim=false;float(f.actor,'BREAK!','brk',0.7);AU.brk();await bmsg('Sensor broken! The Stray is blind and stunned.',1600);}
  if(f.def.flee&&!f.fled&&f.parts[0].hp<=f.def.flee){await fleeAnim(f);}
  else if(!alive(f)){f.actor.anim=false;if(f.id==='stray')AU.powerDown();await bmsg(`The ${f.name.toLowerCase()} shudders and goes still.`,1100);}
  await sleep(250);}
async function enemyHit(f,targets,base,kind){
  const r=await qte(targets[0].actor);
  if(kind==='spark')await sparkFx(f,targets);else await lunge(f.actor,targets[0].actor,0.6);
  for(const t of targets){let d=base;if(r==='parry')d=Math.round(d*0.2);if(t.brace)d=Math.round(d*0.5);t.hp=Math.max(0,t.hp-d);t.actor.flash();shake(t.actor);float(t.actor,String(d),r==='parry'?'small':'');}
  if(r==='parry'){float(targets[0].actor,'Parry!','good',0.85);AU.parry();}else AU.hurt();renderParty(null);
  for(const t of targets)if(t.hp===0){AU.ko();await bmsg(`${t.name} is down.`,900);}await sleep(300);}
async function enemyTurn(f,party){const live=party.filter(p=>p.hp>0);if(!live.length)return;
  if(f.id==='coyote'){const t=live.slice().sort((a,b)=>a.hp-b.hp)[0];AU.growl();await bmsg(`The coyote lunges at ${t.name}!`,450);await enemyHit(f,[t],ri(4,6),'lunge');return;}
  if(f.stunned>0){f.stunned--;AU.beep();await bmsg('The Stray spins in place, blind.',1200);return;}
  if(!f.eyeBroken&&Math.random()<0.35){await bmsg('The Stray sparks! Arcs jump across the concrete.',600);await enemyHit(f,live,ri(4,6),'spark');return;}
  const t=live[ri(0,live.length-1)];AU.servo();await bmsg(`The Stray rams ${t.name}!`,450);
  if(f.eyeBroken&&Math.random()<0.4){await lunge(f.actor,t.actor,0.35);float(t.actor,'Miss','miss');await bmsg('Blind, it slams into the concrete instead.',1000);return;}
  await enemyHit(f,[t],ri(7,10),'ram');}
function toArena(a){scene.remove(a.grp);ARENA.scene.add(a.grp);}
function toWorld(a){ARENA.scene.remove(a.grp);scene.add(a.grp);}
async function battle(id,retry){const def=BAT[id],s=MAP.battleSpots[def.spot];dlgEl.hidden=true;aWaiter=null;setMode('battle');
  const kit=NPC.kit.actor;
  if(!FOES[id])await spawnEnemies(id);
  if(!retry){AU.battleStart();AU.music('combat');await slash('in');}
  // move everyone onto the battle stage
  const ar=buildArena(def.arena||'brush');Object.values(ARENA.cache).forEach(c=>c.grp.visible=false);ar.grp.visible=true;ARENA.cur=ar;
  const cast=[P,kit,PANCHA,...FOES[id]];if(!ARENA.on){cast.forEach(toArena);ARENA.on=true;}
  BPARTY=def.party.map(u=>{const b=BAT.units[u];return{id:u,name:b.name,party:true,actor:u==='juno'?P:kit,hp:ST.party[u].hp,max:b.hp,atk:b.atk,spd:b.spd,ct:Math.random()*30,sling:!!b.sling,weapon:b.weapon};});
  const startHp=BPARTY.map(p=>p.hp),startDur=ST.party.juno.dur;
  BPARTY.forEach(p=>{const q=def.party_pos[p.id];p.actor.place(q[0],q[1]);p.actor.dir='left';p.actor.moving=false;});
  PANCHA.visible=true;PANCHA.place(def.pancha[0],def.pancha[1]);PANCHA.flip=true;
  const foes=FOES[id].map((a,i)=>{const e=def.enemies[i];a.override=null;a.anim=true;a.flip=true;a.visible=true;a.place(e.apos[0],e.apos[1]);
    return{id:e.id,name:e.name,party:false,actor:a,def:e,parts:e.parts.map(p=>Object.assign({},p,{max:p.hp})),spd:e.spd,ct:Math.random()*30,stunned:0,eyeBroken:false,fled:false};});
  const stray=foes.find(f=>f.id==='stray');ARENA.eye.position.set(stray?stray.actor.x+1.1:0,0.9,stray?stray.actor.z+0.7:0);ARENA.eye.intensity=stray?0.8:0;
  U.focusY.value=0.5;U.band.value=0.24;arenaEnv(0);
  if(!retry)await slash('out');
  $('#battle').hidden=false;$('#bmsg').textContent='';renderParty(null);const all=[...BPARTY,...foes];let result=null;
  if(!retry){await bmsg('A Stray and a coyote block the drain!',1100);}
  while(!result){const u=nextTurn(all);renderTurns(u,all);if(u.party){AU.turn();await playerTurn(u,foes,def);}else await enemyTurn(u,BPARTY);renderParty(null);
    if(stray)ARENA.eye.intensity=stray.eyeBroken||!alive(stray)?0:0.8;
    if(foes.every(f=>!alive(f)))result='win';else if(BPARTY.every(p=>p.hp<=0))result='lose';}
  $('#turnbar .q').innerHTML='';
  if(result==='lose'){AU.ko();await bmsg('Juno goes down.',1300);const c=await bmenu([{id:'retry',label:'Try the fight again'},{id:'load',label:'Load last save'}],'');
    BPARTY.forEach((p,i)=>ST.party[p.id].hp=Math.max(startHp[i],Math.round(p.max*0.6)));ST.party.juno.dur=startDur;
    if(c==='load'){$('#battle').hidden=true;cast.forEach(toWorld);ARENA.on=false;loadGame();AU.music('explore');return 'load';}
    foes.forEach(f=>{f.actor.visible=true;f.actor.override=null;});return battle(id,true);}
  await bmsg('The drain goes quiet.',0);AU.music('none');AU.victory();await sleep(1700);
  $('#battle').hidden=true;$('#bparty').classList.remove('panel');BPARTY.forEach(p=>ST.party[p.id].hp=Math.max(1,p.hp));
  await fadeTo(1,450);
  cast.forEach(toWorld);ARENA.on=false;ar.grp.visible=false;ARENA.eye.intensity=0;
  ST.flags.drainDone=true;FOES[id].forEach(a=>a.dispose());delete FOES[id];makeWreck();
  P.place(s.x-2.4,s.z+0.9);P.dir='left';kit.place(P.x+0.9,P.z+0.4);kit.dir='left';PANCHA.flip=false;PANCHA.place(P.x+1.6,P.z+0.9);resetTrail();
  CAM.override={t:V3(s.x-0.6,0.9,s.z+0.4),o:V3(0,9,12.5),k:2.2};updateCam(0,true);U.focusY.value=0.47;U.band.value=0.15;
  setMode('script');AU.music('explore');await fadeTo(0,600);CAM.override=null;return 'win';}

