/* ============ input ============ */
const keys=new Set(),JOY={x:0,z:0};let aWaiter=null,qteHandler=null,escHandler=null;
function inputVec(){let x=0,z=0;if(keys.has('KeyA')||keys.has('ArrowLeft'))x--;if(keys.has('KeyD')||keys.has('ArrowRight'))x++;if(keys.has('KeyW')||keys.has('ArrowUp'))z--;if(keys.has('KeyS')||keys.has('ArrowDown'))z++;
  x+=JOY.x;z+=JOY.z;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}return{x,z,l:Math.min(1,l)};}
function pressA(){if(qteHandler){qteHandler();return;}if(aWaiter){aWaiter();return;}if(mode==='explore')interact();}
function visibleMenu(){for(const s of['#dialog .choices','#bmenu','#pause .menu','#card .menu','#title .menu','.bnav']){const el=$(s);if(el&&el.offsetParent!==null&&el.querySelector('button:not([disabled]):not([hidden])'))return el;}return null;}
function navMenus(k){const m=visibleMenu();if(!m)return false;const bs=[...m.querySelectorAll('button:not([disabled])')].filter(b=>!b.hidden);const i=bs.indexOf(document.activeElement);
  const fwd=k==='ArrowDown'||k==='ArrowRight';const n=i<0?0:(i+(fwd?1:-1)+bs.length)%bs.length;bs[n].focus();AU.tick();return true;}
addEventListener('keydown',e=>{const k=e.code;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(k))e.preventDefault();
  const ae=document.activeElement,onBtn=ae&&ae.tagName==='BUTTON'&&ae.offsetParent!==null&&!ae.closest('#touch');
  if(k.startsWith('Arrow')&&mode!=='explore'&&navMenus(k))return;
  keys.add(k);if(e.repeat)return;
  if(k==='Enter'||k==='Space'||k==='KeyE'||k==='KeyZ'){if(onBtn&&(k==='Enter'||k==='Space'))return;pressA();}
  else if(k==='Escape'||k==='KeyQ'||k==='Backspace'){if(escHandler){escHandler();return;}if(!$('#book').hidden){closeBook();return;}if(!$('#pause').hidden){closePause();return;}if(mode==='explore')openPause();}
  else if(k==='KeyB'||k==='Tab'){if(!$('#book').hidden)closeBook();else if(mode==='explore')openBook();}
  else if(k==='KeyF'){SET.showFps=!SET.showFps;saveSettings();syncPauseLabels();}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
stage.addEventListener('pointerdown',e=>{AU.init();if(e.target.closest('button'))return;if(e.target.closest('#stickzone')&&mode==='explore')return;if(qteHandler||aWaiter){e.preventDefault();pressA();}});
(function touch(){const zone=$('#stickzone'),st=$('#stick'),knob=st.firstElementChild;let id=null,x0=0,y0=0;
  zone.addEventListener('pointerdown',e=>{if(mode!=='explore')return;id=e.pointerId;zone.setPointerCapture(id);const r=stage.getBoundingClientRect();x0=e.clientX;y0=e.clientY;
    st.style.left=(e.clientX-r.left)+'px';st.style.top=(e.clientY-r.top)+'px';st.style.bottom='auto';st.style.marginTop='calc(var(--u)*-60)';e.preventDefault();});
  zone.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;const max=SH/540*48;let dx=e.clientX-x0,dy=e.clientY-y0;const l=Math.hypot(dx,dy);if(l>max){dx*=max/l;dy*=max/l;}
    JOY.x=dx/max;JOY.z=dy/max;if(Math.hypot(JOY.x,JOY.z)<0.18){JOY.x=JOY.z=0;}knob.style.transform=`translate(${dx}px,${dy}px)`;});
  const end=e=>{if(e.pointerId!==id)return;id=null;JOY.x=JOY.z=0;knob.style.transform='';st.style.left=st.style.top=st.style.bottom=st.style.marginTop='';};
  zone.addEventListener('pointerup',end);zone.addEventListener('pointercancel',end);
  const tap=(el,fn)=>el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();AU.init();fn();});
  tap($('#btnA'),pressA);tap($('#btnBook'),()=>{if(mode==='explore')openBook();});tap($('#btnMenu'),()=>{if(mode==='explore')openPause();});})();

