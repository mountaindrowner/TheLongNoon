/* ============ lights, sky, environment by clock ============ */
const hemi=new THREE.HemisphereLight(0x6070b0,0x3a3040,0.55);scene.add(hemi);
const moon=new THREE.DirectionalLight(0x9fb0ff,0.35);moon.position.set(-20,30,12);scene.add(moon);scene.add(moon.target);
renderer.shadowMap.type=THREE.PCFSoftShadowMap;moon.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);Object.assign(moon.shadow.camera,{left:-26,right:26,top:22,bottom:-22,near:1,far:110});moon.shadow.bias=-0.0006;moon.shadow.normalBias=0.03;
const MOONDIR=new THREE.Vector3(-20,30,12).normalize();
const LAMPS=[...Array(6)].map(()=>{const l=new THREE.PointLight(0xffb060,0,8.5,2);scene.add(l);return l;});
scene.fog=new THREE.Fog(0x1b1e3a,34,82);
const skyCv=document.createElement('canvas');skyCv.width=2;skyCv.height=128;const skyCtx=skyCv.getContext('2d');
const skyTex=new THREE.CanvasTexture(skyCv);scene.background=skyTex;
const PRE={
  night:{top:'#0b0f26',hor:'#25284c',fog:'#1b1e3a',hs:'#6474b4',hg:'#3a3040',hi:.6,mc:'#a8b8ff',mi:.38,lamp:1,em:.34,bleach:0},
  lamp:{top:'#171a3e',hor:'#7a4a68',fog:'#3a2c48',hs:'#8a7ab0',hg:'#5a4038',hi:.62,mc:'#ffb090',mi:.36,lamp:1,em:.3,bleach:0},
  dusk:{top:'#2a2a5a',hor:'#e0905a',fog:'#8a5a58',hs:'#c0a0b0',hg:'#7a5a40',hi:.8,mc:'#ffb080',mi:.7,lamp:.6,em:.22,bleach:0},
  gray:{top:'#4a5276',hor:'#c9a8a0',fog:'#8a8090',hs:'#a8a8c8',hg:'#7a6a5a',hi:.8,mc:'#ffd0b0',mi:.55,lamp:.45,em:.2,bleach:.12},
  day:{top:'#e9e4d8',hor:'#f6f1e6',fog:'#ddd5c2',hs:'#f4efe4',hg:'#a8936c',hi:0.72,mc:'#fff6e4',mi:1.05,lamp:0,em:.06,bleach:.6}};
for(const k in PRE)for(const c of['top','hor','fog','hs','hg','mc'])PRE[k][c]=new THREE.Color(PRE[k][c]);
const ENVK=[[0,'night'],[270,'night'],[330,'gray'],[395,'day'],[1080,'day'],[1110,'dusk'],[1170,'lamp'],[1250,'night'],[1440,'night']];
const ENV={top:new THREE.Color(),hor:new THREE.Color(),fog:new THREE.Color(),hs:new THREE.Color(),hg:new THREE.Color(),mc:new THREE.Color(),hi:0,mi:0,lamp:1,em:.3,bleach:0};
let skyKey='';
function envAt(m){m=((m%1440)+1440)%1440;let i=0;while(i<ENVK.length-2&&m>=ENVK[i+1][0])i++;
  const a=PRE[ENVK[i][1]],b=PRE[ENVK[i+1][1]],t=clamp((m-ENVK[i][0])/(ENVK[i+1][0]-ENVK[i][0]),0,1);
  for(const c of['top','hor','fog','hs','hg','mc'])ENV[c].copy(a[c]).lerp(b[c],t);
  for(const c of['hi','mi','lamp','em','bleach'])ENV[c]=lerp(a[c],b[c],t);
  hemi.color.copy(ENV.hs);hemi.groundColor.copy(ENV.hg);hemi.intensity=ENV.hi;moon.color.copy(ENV.mc);moon.intensity=ENV.mi;
  const dayish=m>330&&m<1110;MOONDIR.set(dayish?-8:-20,dayish?40:28,dayish?6:14).normalize();
  U.night.value=UL.night.value=clamp(ENV.lamp,0,1);U.heat.value=UL.heat.value=ENV.bleach;MAT.pool&&(MAT.pool.opacity=0.5*ENV.lamp,MAT.poolFire.opacity=0.62*ENV.lamp,MAT.cone.opacity=0.2*ENV.lamp,MAT.streak.opacity=0.55*ENV.lamp);
  scene.fog.color.copy(ENV.fog);scene.fog.near=lerp(34,60,ENV.bleach);scene.fog.far=lerp(82,170,ENV.bleach);U.bleach.value=ENV.bleach;
  const key=ENV.top.getHexString()+ENV.hor.getHexString();
  if(key!==skyKey){skyKey=key;const g=skyCtx.createLinearGradient(0,0,0,128);g.addColorStop(0,'#'+ENV.top.getHexString());g.addColorStop(0.75,'#'+ENV.hor.getHexString());g.addColorStop(1,'#'+ENV.fog.getHexString());skyCtx.fillStyle=g;skyCtx.fillRect(0,0,2,128);skyTex.needsUpdate=true;}
  for(const m2 of SPRITE_MATS)if(!m2.userData.flashing)m2.emissiveIntensity=ENV.em;
  MAT.glow&&(MAT.glow.opacity=0.85*ENV.lamp);
}
function phaseOf(m){m=((m%1440)+1440)%1440;if(m>=1110&&m<1200)return 'Lamp';if(m>=1200||m<270)return 'Long night';if(m<360)return 'Shutter';return 'Day';}
function fmtTime(m){m=((Math.floor(m)%1440)+1440)%1440;let h=Math.floor(m/60),mm=m%60;const ap=h>=12?'pm':'am';h=h%12||12;return `${h}:${String(mm).padStart(2,'0')} ${ap}`;}

