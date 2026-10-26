/* ============ stage + renderer ============ */
const stage=$('#stage'),canvas=$('#game');
let SW=960,SH=540,DPR=1,portraitOK=false;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.info.autoReset=false;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,16/9,0.5,500);
function layout(){
  const vw=document.body.clientWidth||innerWidth,vh=document.body.clientHeight||innerHeight;
  let w=vw,h=vh;if(w/h<16/9)h=Math.round(w*9/16);else if(w/h>2.35)w=Math.round(h*2.35);
  SW=w;SH=h;Object.assign(stage.style,{width:w+'px',height:h+'px',left:Math.round((vw-w)/2)+'px',top:Math.round((vh-h)/2)+'px'});
  stage.style.setProperty('--u',(h/540)+'px');camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);sizeRTs();
  $('#rotate').hidden=!(isTouch&&vh>vw*1.05&&!portraitOK);
}
const SHADOWS=()=>SET.quality==='high';
function applyQuality(){const q=SET.quality;DPR=Math.min(window.devicePixelRatio||1,q==='high'?2:q==='medium'?1.5:1.25);renderer.setPixelRatio(DPR);
  const sh=SHADOWS();renderer.shadowMap.enabled=sh;moon.castShadow=sh;if(window.__arenaMoon)window.__arenaMoon.castShadow=sh;if(BLOB.mat)BLOB.mat.opacity=sh?0.55:1;
  [scene,ARENA_SCENE()].forEach(S=>S&&S.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true);}));layout();}
const ARENA_SCENE=()=>{try{return ARENA.scene;}catch(e){return null;}};
addEventListener('resize',layout);addEventListener('orientationchange',()=>setTimeout(layout,300));
$('#rotOk').onclick=()=>{portraitOK=true;layout();};

