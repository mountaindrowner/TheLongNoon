/* ============ quests + HUD ============ */
function setStep(s){ST.step=s;updateObjective(true);if(s!=='burial'&&mode!=='title')AU.chime();if(s==='pancha'&&!ST.flags.drainDone){PANCHA.visible=true;PANCHA.place(MAP.pancha.x,MAP.pancha.z);}if(s!=='burial')save(true);}
function updateObjective(flash){const o=QST.steps[ST.step];const el=$('#objective');$('#oMission').textContent='Mission: '+QST.mission;$('#oText').textContent=o?o.obj:'';
  el.hidden=!(o&&o.obj)||!(mode==='explore'||mode==='script');if(flash){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}}
function markerPos(){const o=QST.steps[ST.step];if(!o||!o.marker)return null;const m=o.marker;
  if(m==='homeTasks'){const it=MAP.interact.find(i=>i.id===(ST.flags.fed?'tank':'pen'));return(ST.flags.fed&&ST.flags.tank)?null:[it.x,it.z];}
  if(typeof m==='string'&&m.startsWith('npc:')){const n=NPC[m.slice(4)];return[n.actor.x,n.actor.z];}
  if(typeof m==='string'&&m.startsWith('i:')){const it=MAP.interact.find(i=>i.id===m.slice(2));return[it.x,it.z];}
  return m;}
const _v=new THREE.Vector3();
function toScreen(x,y,z){_v.set(x,y,z).project(camera);return{x:(_v.x*0.5+0.5)*SW,y:(-_v.y*0.5+0.5)*SH,behind:_v.z>1};}
function updateMarker(){const el=$('#marker');const p=mode==='explore'?markerPos():null;if(!p||Math.hypot(P.x-p[0],P.z-p[1])<2.4){el.hidden=true;return;}
  const s=toScreen(p[0],2.1,p[1]);const m=26*SH/540;let x=s.x,y=s.y,edge=false;
  if(s.behind||x<m||x>SW-m||y<m+60*SH/540||y>SH-m){edge=true;const cx=SW/2,cy=SH/2;let dx=x-cx,dy=y-cy;if(s.behind){dx=-dx;dy=-dy;}const k=Math.min((SW/2-m)/Math.abs(dx||1e-3),(SH/2-m-30*SH/540)/Math.abs(dy||1e-3));x=cx+dx*k;y=cy+dy*k;}
  el.hidden=false;el.classList.toggle('edge',edge);el.style.transform=`translate(${x}px,${y}px)`;}
let hudKey='';
function updateHUD(force){if(!ST)return;const ph=phaseOf(ST.clock);const k=Math.floor(ST.clock)+'|'+ST.water+'|'+ST.white;if(!force&&k===hudKey)return;hudKey=k;
  $('#hTime').textContent=fmtTime(ST.clock);$('#hPhase').textContent=ph;const ic=$('#hud .clock .ic'),want=ph==='Day'?'ic_sun':'ic_moon';if(ic.dataset.ic!==want){ic.dataset.ic=want;iconCSS(ic,want,2);}
  const w=$('#hWater');if(w.children.length!==10){w.innerHTML='';for(let i=0;i<10;i++){const d=document.createElement('i');d.className='ic';iconCSS(d,'ic_drop',1);w.appendChild(d);}}
  [...w.children].forEach((d,i)=>d.classList.toggle('e',i>=ST.water));$('#hWhite').textContent=ST.white;}

