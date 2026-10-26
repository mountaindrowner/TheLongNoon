/* ============ assets ============ */
const IMG={},TEX={},MAT={},SPRITE_MATS=[];const PPU=16,TILT=-0.38;
const DIRS=['down','left','right','up'],WALK=[1,0,2,0];
function atlasTex(img){const t=new THREE.Texture(img);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
function spriteMat(tex){const m=new THREE.MeshLambertMaterial({map:tex,emissive:0xffffff,emissiveMap:tex,emissiveIntensity:ENV.em,alphaTest:0.5,side:THREE.DoubleSide});SPRITE_MATS.push(m);return m;}
function setUV(geo,fr,img,flip){const W=img.width,H=img.height,e=0.01;let u0=(fr.x+e)/W,u1=(fr.x+fr.w-e)/W;const v1=1-(fr.y+e)/H,v0=1-(fr.y+fr.h-e)/H;if(flip){const t=u0;u0=u1;u1=t;}
  const uv=geo.attributes.uv;uv.setXY(0,u0,v1);uv.setXY(1,u1,v1);uv.setXY(2,u0,v0);uv.setXY(3,u1,v0);uv.needsUpdate=true;}
const WALLTEX={};
function wallMat(name){if(MAT['w_'+name])return MAT['w_'+name];const i=MAN.walls.index[name],c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');
  g.drawImage(IMG.walls,(i%4)*32,Math.floor(i/4)*32,32,32,0,0,32,32);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
  return MAT['w_'+name]=new THREE.MeshLambertMaterial({map:t});}
const BLOB={};
function initBlob(){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(12,8,24,0.5)');g.addColorStop(1,'rgba(12,8,24,0)');x.fillStyle=g;x.fillRect(0,0,32,32);
  BLOB.geo=new THREE.PlaneGeometry(1,0.6);BLOB.geo.rotateX(-Math.PI/2);BLOB.mat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false});}
function propSprite(name,scale=1,flip=false){const fr=MAN.frames[name];const img=IMG[fr.a];const w=fr.w/PPU*scale,h=fr.h/PPU*scale;const g=new THREE.PlaneGeometry(w,h);g.translate(0,h/2,0);setUV(g,fr,img,flip);
  const m=new THREE.Mesh(g,fr.a==='props'?MAT.props:MAT.charsStatic);m.rotation.x=TILT;return m;}
function iconCSS(el,name,s){const fr=MAN.frames[name],img=IMG[fr.a];el.style.backgroundImage=`url(${img.src})`;
  el.style.backgroundSize=`calc(var(--u)*${img.width*s}) calc(var(--u)*${img.height*s})`;el.style.backgroundPosition=`calc(var(--u)*${-fr.x*s}) calc(var(--u)*${-fr.y*s})`;}
function paintIcons(){document.querySelectorAll('.ic[data-ic]').forEach(el=>iconCSS(el,el.dataset.ic,el.dataset.s?+el.dataset.s:2));}

