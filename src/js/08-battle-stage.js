/* ============ battle stage (a separate scene, themed to where the fight started) ============ */
const ARENA={scene:new THREE.Scene(),cache:{},cur:null,on:false,t:0};
(function(){const A=ARENA;A.hemi=new THREE.HemisphereLight(0x6070b0,0x3a3040,0.6);A.moon=new THREE.DirectionalLight(0xa8b8ff,0.45);A.moon.position.set(-8,14,10);
  A.lamp=new THREE.PointLight(0xffb060,0,16,2);A.lamp.position.set(2,3.2,3);A.eye=new THREE.PointLight(0xff5a30,0,4,2);
  A.scene.add(A.hemi,A.moon,A.lamp,A.eye);A.scene.add(A.moon.target);window.__arenaMoon=A.moon;A.moon.shadow.mapSize.set(1024,1024);Object.assign(A.moon.shadow.camera,{left:-18,right:18,top:12,bottom:-12,near:1,far:60});A.moon.shadow.bias=-0.0006;A.moon.shadow.normalBias=0.03;A.scene.fog=new THREE.Fog(0x1b1e3a,16,46);A.scene.background=skyTex;})();
function buildArena(id){if(ARENA.cache[id])return ARENA.cache[id];const cfg=BAT.arenas[id],G=new THREE.Group();const W=46,D=22;
  const cv=document.createElement('canvas');cv.width=W*16;cv.height=D*16;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
  for(let z=0;z<D;z++)for(let x=0;x<W;x++){const wz=z-11;let t='caliche';for(const [tt,a,b] of cfg.rows)if(wz>=a&&wz<b)t=tt;
    if(t==='caliche'&&hash2(x,z)<0.22)t='caliche2';if(t==='asphalt'&&hash2(x+3,z)<0.15)t='asphalt_crack';if(t==='deadgrass'&&hash2(x,z+5)<0.3)t='caliche';
    const ti=MAN.tiles.index[t];g.drawImage(IMG.tiles,(ti%8)*16,Math.floor(ti/8)*16,16,16,x*16,z*16,16,16);}
  if(cfg.wetness){g.fillStyle='rgba(20,18,30,0.22)';for(let k=0;k<14;k++){g.beginPath();g.ellipse(hash2(k,1)*W*16,(7+hash2(1,k)*8)*16,30+hash2(k,k)*60,6+hash2(k,2)*8,0,0,Math.PI*2);g.fill();}}
  const tex=new THREE.CanvasTexture(cv);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
  const gm=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshLambertMaterial({map:tex}));gm.rotation.x=-Math.PI/2;G.add(gm);
  const Cx={grp:G,col:[],lanterns:[],flags:[],anims:[],mats:[],texs:[]};
  for(const [x,y,z,w,h,d,wt] of cfg.walls)tbox(Cx,w,h,d,x,y,z,wt);
  if(cfg.upper){const u=cfg.upper,ucv=document.createElement('canvas');ucv.width=W*16;ucv.height=(u.z1-u.z0)*16|0;const ug=ucv.getContext('2d');ug.imageSmoothingEnabled=false;
    for(let z=0;z<ucv.height/16;z++)for(let x=0;x<W;x++){const ti=MAN.tiles.index[hash2(x,z+40)<0.3?'deadgrass':u.tile];ug.drawImage(IMG.tiles,(ti%8)*16,Math.floor(ti/8)*16,16,16,x*16,z*16,16,16);}
    const ut=new THREE.CanvasTexture(ucv);ut.magFilter=THREE.NearestFilter;const um=new THREE.Mesh(new THREE.PlaneGeometry(W,u.z1-u.z0),new THREE.MeshLambertMaterial({map:ut}));
    um.rotation.x=-Math.PI/2;um.position.set(0,u.y,(u.z0+u.z1)/2);G.add(um);}
  if(cfg.culvert){const [cx,cz,r]=cfg.culvert;const hm=new THREE.MeshBasicMaterial({color:0x07060a});const c=new THREE.Mesh(new THREE.CircleGeometry(r,20,0,Math.PI),hm);c.position.set(cx,0,cz);G.add(c);
    const rim=new THREE.Mesh(new THREE.RingGeometry(r,r+0.25,20,1,0,Math.PI),new THREE.MeshLambertMaterial({color:0x8f8a80}));rim.position.set(cx,0,cz+0.01);G.add(rim);}
  for(const p of cfg.props){const [k,x,z,s=1,y=0]=p;const m=propSprite(k,s);m.position.set(x,y,z);G.add(m);if(y<0.1){const sh=new THREE.Mesh(BLOB.geo,BLOB.mat);sh.scale.setScalar(Math.min(4,(MAN.frames[k].w/PPU)*s*0.75));sh.position.set(x,0.02,z);G.add(sh);}}
  if(cfg.skyline){const sm=new THREE.MeshBasicMaterial({color:0x1a1c30});for(let i=0;i<14;i++){const w=2+hash2(i,7)*5,h=2+hash2(7,i)*6;const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,2),sm);b.position.set(-30+i*4.6,h/2+1.5,-24-hash2(i,3)*6);G.add(b);}}
  gm.userData.ground=true;shadowFlags(G);G.visible=false;ARENA.scene.add(G);return ARENA.cache[id]={grp:G,cfg};}
function arenaEnv(dt){const A=ARENA;A.t+=dt;A.hemi.color.copy(ENV.hs);A.hemi.groundColor.copy(ENV.hg);A.hemi.intensity=ENV.hi*1.05;A.moon.color.copy(ENV.mc);A.moon.intensity=ENV.mi+0.32;A.hemi.intensity=ENV.hi*0.9;
  A.scene.fog.color.copy(ENV.fog);A.moon.position.set(-14,24,10);A.moon.target.position.set(0,0,0);A.lamp.intensity=(A.cur?A.cur.cfg.lamp:0)*ENV.lamp*1.6;
  const sw=reduceMotion?0:Math.sin(A.t*0.25)*0.5;camera.position.set(2.1+sw,5.9,15.6);camera.lookAt(1.8,1.7,-0.9);}
const activeScene=()=>ARENA.on?ARENA.scene:scene;
async function slash(dir){const w=$('#wipe');w.className=dir;await sleep(dir==='in'?620:560);if(dir==='out')w.className='';}

