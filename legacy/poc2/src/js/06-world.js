/* ============ world: chunk streaming ============ */
const CS=MAP.chunk,NCX=MAP.size[0]/CS,NCZ=MAP.size[1]/CS,BND=MAP.bounds;
const CX0=-1,CX1=NCX,CZ0=-1,CZ1=NCZ;   // one ring of outer terrain chunks around the playable map
const ck=(cx,cz)=>cx+','+cz;
const PART={};
const chunkOf=(x,z)=>ck(clamp(Math.floor(x/CS),CX0,CX1),clamp(Math.floor(z/CS),CZ0,CZ1));
const inner=(cx,cz)=>cx>=0&&cx<NCX&&cz>=0&&cz<NCZ;
function partEntry(key){return PART[key]||(PART[key]={props:[],buildings:[],decor:[],outer:false});}
function partition(){
  MAP.props.forEach(p=>partEntry(chunkOf(p[1],p[2])).props.push(p));
  MAP.buildings.forEach(b=>partEntry(chunkOf(b.x,b.z)).buildings.push(b));
  MAP.decor.forEach(d=>{
    if(d.k==='wires'||d.k==='lights'){for(let i=0;i<d.pts.length-1;i++){if(d.skip&&d.skip.includes(i))continue;const a=d.pts[i],b=d.pts[i+1];partEntry(chunkOf((a[0]+b[0])/2,(a[1]+b[1])/2)).decor.push({k:d.k==='wires'?'wirespan':'lightspan',a,b});}return;}
    const x=d.r?(d.r[0]+d.r[2])/2:d.x,z=d.r?(d.r[1]+d.r[3])/2:(d.z!=null?d.z:40);partEntry(chunkOf(x,z)).decor.push(d);});
  for(let cx=CX0;cx<=CX1;cx++)for(let cz=CZ0;cz<=CZ1;cz++)if(!inner(cx,cz))genOuter(cx,cz,partEntry(ck(cx,cz)));
}
function pickAlt(base,alt,x,z,salt){if(!alt)return base;let h=hash2(x*7+salt*31,z*13-salt*17);for(const [t,p] of alt){if(h<p)return t;h-=p;}return base;}
function tileAt(x,z){let t=pickAlt(MAP.base.t,MAP.base.alt,x,z,1);const F=MAP.fills;for(let i=0;i<F.length;i++){const r=F[i].r;if(x>=r[0]&&x<r[2]&&z>=r[1]&&z<r[3])t=pickAlt(F[i].t,F[i].alt,x,z,i+3);}return t;}
const ROADISH=t=>t.startsWith('asphalt')||t==='sidewalk'||t==='drain'||t==='lot'||t==='lot_stripe';
/* Outer terrain: dense brush and caliche berms right at the edge so the map never just ends, thinning into ruins and scrub beyond. */
function genOuter(cx,cz,P){P.outer=true;const x0=cx*CS,z0=cz*CS;const pick=(h,arr)=>arr[Math.min(arr.length-1,Math.floor(h*arr.length))];
  for(let gx=0;gx<CS;gx+=2)for(let gz=0;gz<CS;gz+=2){
    const x=x0+gx+hash2(gx+cx*91,gz+cz*17)*1.8,z=z0+gz+hash2(gz+cz*77,gx+cx*13)*1.8;
    const d=Math.max(BND[0]-x,x-BND[2],BND[1]-z,z-BND[3]);if(d<0.3)continue;
    const h=hash2(Math.floor(x*3.1)+5,Math.floor(z*2.7)-3),h2=hash2(Math.floor(z*5.3)+11,Math.floor(x*1.9)+7);
    if(ROADISH(tileAt(Math.floor(x),Math.floor(z)))){if(h<0.06)P.props.push([pick(h2,['car','truck','rubble_b','tires','barrier','rubble_c']),x,z]);continue;}
    const dens=d<5?0.8:0.34;if(h>dens)continue;
    if(d<4.5&&h2<0.22){P.decor.push({k:'mound',x,z,rx:1.6+h2*6,rz:1.2+h*2.4,h:0.9+h2*2.6});continue;}
    if(h2<0.08&&d>6){P.decor.push({k:'mound',x,z,rx:2+h*4,rz:1.5+h2*8,h:0.7+h*1.8});continue;}
    const k=pick(h2,['mesquite_a','mesquite_b','mesquite_c','bush_a','bush_b','bush_a','bush_b','nopal_a','nopal_b','rubble_a','rubble_c','mesquite_a','bush_a','tires','palm','trash','mesquite_b','rubble_b']);
    P.props.push([h<0.012?'skull':k,x,z,k.startsWith('mesquite')?1.15+h*0.6:1]);}
  const hb=hash2(cx*13+3,cz*29+1);
  if(hb<0.75){const bx=x0+8+hb*14,bz=z0+8+hash2(cz,cx)*14,d=Math.max(BND[0]-bx,bx-BND[2],BND[1]-bz,bz-BND[3]);
    if(d>6&&!ROADISH(tileAt(Math.floor(bx),Math.floor(bz))))P.buildings.push({x:bx,z:bz,w:5+hb*3,d:4.5+hb*2,h:2.4,wall:hb<0.4?'wall_brick':'wall_house',ruin:true});}
}
const chunks=new Map();const GLOBAL_COL=[];
const RADIUS={mesquite_a:.45,mesquite_b:.45,mesquite_c:.45,bush_a:.7,bush_b:.7,nopal_a:.6,nopal_b:.6,tank:.55,crate:.5,well:.95,lantern:.18,pole:.15,powerpole:.22,palm:.25,
  rubble_a:.75,rubble_b:.95,rubble_c:.55,tires:.5,drum:.38,jugs:.45,crates_b:.5,bucket:.3,dewnet:.3,shrine:.6,dish:.3,cinder:.45,lookout:.8,fire_0:.55};
const BOXCOL={car:[1.15,0.35],truck:[1.4,0.4],barrier:[1.0,0.3],couch:[0.95,0.3],sandbags:[0.9,0.3],bench_w:[0.75,0.2],laundry:[0,0]};
function buildChunk(cx,cz){
  const key=ck(cx,cz),P=partEntry(key),grp=new THREE.Group();const C={key,cx,cz,grp,col:[],lanterns:[],fires:[],lampHeads:[],flags:[],anims:[],mats:[],texs:[]};
  const cv=document.createElement('canvas');cv.width=cv.height=CS*16;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
  for(let z=0;z<CS;z++)for(let x=0;x<CS;x++){const ti=MAN.tiles.index[tileAt(cx*CS+x,cz*CS+z)];g.drawImage(IMG.tiles,(ti%8)*16,Math.floor(ti/8)*16,16,16,x*16,z*16,16,16);}
  const tex=new THREE.CanvasTexture(cv);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const gmat=new THREE.MeshLambertMaterial({map:tex});const gm=new THREE.Mesh(new THREE.PlaneGeometry(CS,CS),gmat);gm.rotation.x=-Math.PI/2;gm.position.set(cx*CS+CS/2,0,cz*CS+CS/2);gm.userData.dyn=true;gm.userData.ground=true;grp.add(gm);
  C.mats.push(gmat);C.texs.push(tex);
  P.buildings.forEach(b=>b.ruin?buildRuin(b,C):buildBuilding(b,C));
  P.decor.forEach(d=>buildDecor(d,C));
  P.props.forEach(p=>buildProp(p,C));
  mergeStatic(C);addSparks(C);shadowFlags(C.grp);
  if(SET.chunks)addChunkLines(C);
  scene.add(grp);chunks.set(key,C);return C;
}
/* Merge every static mesh in a chunk that shares a material into one mesh: hundreds of props become a handful of draw calls. */
const _nm=new THREE.Matrix3(),_mv=new THREE.Vector3();
function mergeStatic(C){const groups=new Map();
  for(const o of C.grp.children){if(!o.isMesh||Array.isArray(o.material)||o.userData.dyn)continue;const k=o.material.uuid;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o);}
  for(const list of groups.values()){if(list.length<2)continue;let nv=0,ni=0;
    for(const o of list){const g=o.geometry;nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
    const pos=new Float32Array(nv*3),nor=new Float32Array(nv*3),uv=new Float32Array(nv*2),idx=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
    for(const o of list){o.updateMatrix();const g=o.geometry,Pa=g.attributes.position,Na=g.attributes.normal,Ua=g.attributes.uv;_nm.getNormalMatrix(o.matrix);
      for(let i=0;i<Pa.count;i++){_mv.fromBufferAttribute(Pa,i).applyMatrix4(o.matrix);pos[(vo+i)*3]=_mv.x;pos[(vo+i)*3+1]=_mv.y;pos[(vo+i)*3+2]=_mv.z;
        _mv.fromBufferAttribute(Na,i).applyMatrix3(_nm).normalize();nor[(vo+i)*3]=_mv.x;nor[(vo+i)*3+1]=_mv.y;nor[(vo+i)*3+2]=_mv.z;uv[(vo+i)*2]=Ua.getX(i);uv[(vo+i)*2+1]=Ua.getY(i);}
      if(g.index){const a=g.index.array;for(let j=0;j<a.length;j++)idx[io+j]=a[j]+vo;io+=a.length;}else{for(let j=0;j<Pa.count;j++)idx[io+j]=vo+j;io+=Pa.count;}
      vo+=Pa.count;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.BufferAttribute(nor,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));geo.computeBoundingSphere();
    const m=new THREE.Mesh(geo,list[0].material);m.renderOrder=list[0].renderOrder;C.grp.add(m);
    for(const o of list){C.grp.remove(o);if(!o.geometry.userData.shared)o.geometry.dispose();}}}
function disposeChunk(C){scene.remove(C.grp);C.grp.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});C.mats.forEach(m=>m.dispose());C.texs.forEach(t=>t.dispose());chunks.delete(C.key);}
function distToChunk(x,z,cx,cz){const dx=Math.max(cx*CS-x,0,x-(cx+1)*CS),dz=Math.max(cz*CS-z,0,z-(cz+1)*CS);return Math.hypot(dx,dz);}
function streamChunks(fx,fz,all){let built=0;
  for(let cx=CX0;cx<=CX1;cx++)for(let cz=CZ0;cz<=CZ1;cz++){const key=ck(cx,cz),d=distToChunk(fx,fz,cx,cz);
    if(d<30&&!chunks.has(key)){if(all||built<1){buildChunk(cx,cz);built++;}}
    else if(d>46&&chunks.has(key))disposeChunk(chunks.get(key));}}
const loadedAt=(x,z)=>chunks.has(chunkOf(x,z));
function addChunkLines(C){const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(CS-0.1,0.4,CS-0.1));const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:inner(C.cx,C.cz)?0x7cf29a:0xf2c27c}));
  l.position.set(C.cx*CS+CS/2,0.2,C.cz*CS+CS/2);l.name='chunkLines';C.grp.add(l);C.mats.push(l.material);}
function refreshChunkLines(){chunks.forEach(C=>{const o=C.grp.getObjectByName('chunkLines');if(o){C.grp.remove(o);o.geometry.dispose();}if(SET.chunks)addChunkLines(C);});}
function boxUV(geo,w,h,d){const uv=geo.attributes.uv,S=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];for(let f=0;f<6;f++)for(let v=0;v<4;v++){const i=f*4+v;uv.setXY(i,uv.getX(i)*S[f][0]/2,uv.getY(i)*S[f][1]/2);}uv.needsUpdate=true;}
const woodMat=new THREE.MeshLambertMaterial({color:0x6a4c32}),postMat=new THREE.MeshLambertMaterial({color:0x5a3e2b}),
  panelMat=new THREE.MeshLambertMaterial({color:0x26354f,emissive:0x0a1020}),frameMat=new THREE.MeshLambertMaterial({color:0x8a8a84}),wireMat=new THREE.LineBasicMaterial({color:0x1a1612});
function box(C,w,h,d,x,y,z,mat){const g=new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);C.grp.add(m);return m;}
function tbox(C,w,h,d,x,y,z,wall){const g=new THREE.BoxGeometry(w,h,d);boxUV(g,w,h,d);const m=new THREE.Mesh(g,wallMat(wall));m.position.set(x,y,z);C.grp.add(m);return m;}
function buildBuilding(b,C){
  const g=new THREE.BoxGeometry(b.w,b.h,b.d);boxUV(g,b.w,b.h,b.d);const wm=wallMat(b.wall),rm=wallMat('roof');
  const mesh=new THREE.Mesh(g,[wm,wm,rm,rm,wm,wm]);mesh.position.set(b.x,b.h/2,b.z);C.grp.add(mesh);
  tbox(C,b.w+0.3,0.22,b.d+0.3,b.x,b.h+0.11,b.z,'concrete');
  C.col.push({t:'b',x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2});
  if(b.door){const dg=new THREE.PlaneGeometry(b.door.w,b.door.h);const uv=dg.attributes.uv;for(let i=0;i<4;i++)uv.setXY(i,uv.getX(i)*b.door.w/2,uv.getY(i)*b.door.h/2);
    const dm=new THREE.Mesh(dg,wallMat(b.door.tex));dm.position.set(b.door.x,b.door.h/2,b.z+b.d/2+0.03);C.grp.add(dm);}
  if(b.sign){const s=propSprite(b.sign.f,b.sign.w/(MAN.frames[b.sign.f].w/PPU));s.rotation.x=0;s.position.set(b.sign.x,b.sign.y-0.9,b.z+b.d/2+0.06);C.grp.add(s);}
  if(b.tower){const th=b.h+3.2,tz=b.z-b.d/2+1.6;const tg=new THREE.BoxGeometry(3,th,3);boxUV(tg,3,th,3);const t=new THREE.Mesh(tg,[wm,wm,rm,rm,wm,wm]);t.position.set(b.x,th/2,tz);C.grp.add(t);
    box(C,0.22,1.6,0.22,b.x,th+0.8,tz,woodMat);box(C,0.9,0.2,0.22,b.x,th+1.15,tz,woodMat);C.col.push({t:'b',x0:b.x-1.5,x1:b.x+1.5,z0:tz-1.5,z1:tz+1.5});}
}
/* A roofless ruin: broken wall segments of uneven height, rubble inside. */
function buildRuin(b,C){const T=0.32,x0=b.x-b.w/2,x1=b.x+b.w/2,z0=b.z-b.d/2,z1=b.z+b.d/2;let k=0;
  const seg=(ax,az,bx,bz,gap)=>{const n=3;for(let i=0;i<n;i++){if(gap&&i===1)continue;const t0=i/n,t1=(i+1)/n,hh=b.h*(0.3+0.7*hash2(Math.floor(b.x*7)+k,Math.floor(b.z*5)+i*3));k++;
    const sx=lerp(ax,bx,t0),sz=lerp(az,bz,t0),ex=lerp(ax,bx,t1),ez=lerp(az,bz,t1),len=Math.hypot(ex-sx,ez-sz)+(i===n-1?T:0);
    const horiz=Math.abs(ez-sz)<0.01;tbox(C,horiz?len:T,hh,horiz?T:len,(sx+ex)/2,hh/2,(sz+ez)/2,b.wall);}};
  seg(x0,z0,x1,z0,false);seg(x0,z1,x1,z1,true);seg(x0,z0,x0,z1,false);seg(x1,z0,x1,z1,false);
  C.col.push({t:'b',x0:x0,x1:x1,z0:z0-0.1,z1:z0+0.2},{t:'b',x0:x0-0.1,x1:x0+0.2,z0:z0,z1:z1},{t:'b',x0:x1-0.2,x1:x1+0.1,z0:z0,z1:z1},
    {t:'b',x0:x0,x1:x0+b.w/3,z0:z1-0.2,z1:z1+0.1},{t:'b',x0:x1-b.w/3,x1:x1,z0:z1-0.2,z1:z1+0.1});
  const r1=propSprite('rubble_b',1.1);r1.position.set(b.x-b.w*0.18,0,b.z+0.2);C.grp.add(r1);const r2=propSprite('rubble_a',1);r2.position.set(b.x+b.w*0.22,0,b.z-b.d*0.2);C.grp.add(r2);
  const r3=propSprite(hash2(b.x|0,b.z|0)<0.5?'bricks':'rubble_c',1);r3.position.set(b.x+0.3,0,z1+0.6);C.grp.add(r3);}
function sagLine(a,b,y0,y1,sag,n){const pts=[];for(let i=0;i<=n;i++){const t=i/n;pts.push(new THREE.Vector3(lerp(a[0],b[0],t),lerp(y0,y1,t)-sag*4*t*(1-t),lerp(a[1],b[1],t)));}return pts;}
function addLine(C,pts){const g=new THREE.BufferGeometry().setFromPoints(pts);const l=new THREE.Line(g,wireMat);C.grp.add(l);}
function buildDecor(d,C){
  if(d.k==='pen'){const [x0,z0,x1,z1]=d.r;
    for(let x=x0;x<=x1;x+=2){box(C,0.16,1.15,0.16,x,0.58,z0,postMat);box(C,0.16,1.15,0.16,x,0.58,z1,postMat);}
    for(let z=z0;z<=z1;z+=2){box(C,0.16,1.15,0.16,x0,0.58,z,postMat);box(C,0.16,1.15,0.16,x1,0.58,z,postMat);}
    for(const y of[0.5,0.95]){box(C,x1-x0,0.08,0.08,(x0+x1)/2,y,z0,woodMat);box(C,x1-x0,0.08,0.08,(x0+x1)/2,y,z1,woodMat);box(C,0.08,0.08,z1-z0,x0,y,(z0+z1)/2,woodMat);box(C,0.08,0.08,z1-z0,x1,y,(z0+z1)/2,woodMat);}
    for(const [px,pz] of[[x0,z0],[x1,z0],[x0,z1],[x1,z1]])box(C,0.14,2.6,0.14,px,1.3,pz,postMat);
    const sm=new THREE.MeshLambertMaterial({color:0x2c4038,transparent:true,opacity:0.82,side:THREE.DoubleSide});C.mats.push(sm);
    const sc=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0+0.6,z1-z0+0.6),sm);sc.rotation.x=-Math.PI/2+0.06;sc.position.set((x0+x1)/2,2.55,(z0+z1)/2);C.grp.add(sc);
    const sk=propSprite('skull',1);sk.position.set(x0,1.0,z1+0.12);C.grp.add(sk);
    C.col.push({t:'b',x0:x0-0.1,x1:x1+0.1,z0:z0-0.1,z1:z0+0.1},{t:'b',x0:x0-0.1,x1:x1+0.1,z0:z1-0.1,z1:z1+0.1},{t:'b',x0:x0-0.1,x1:x0+0.1,z0:z0,z1:z1},{t:'b',x0:x1-0.1,x1:x1+0.1,z0:z0,z1:z1});}
  if(d.k==='platform'){box(C,2.8,0.5,1.5,d.x,0.25,d.z,woodMat);box(C,2.6,0.45,1.3,d.x,0.72,d.z,postMat);box(C,2.8,0.12,1.5,d.x,1.0,d.z,woodMat);
    const s=propSprite('shroud',1.05);s.position.set(d.x,1.04,d.z+0.1);s.rotation.x=-1.1;C.grp.add(s);C.col.push({t:'b',x0:d.x-1.4,x1:d.x+1.4,z0:d.z-0.75,z1:d.z+0.75});}
  if(d.k==='culvert'){const cm=wallMat('concrete');tbox(C,7.6,0.8,0.6,d.x,0.4,36.6,'concrete');tbox(C,7.6,0.8,0.6,d.x,0.4,45.4,'concrete');
    const hm=new THREE.MeshBasicMaterial({color:0x0b0a0a});C.mats.push(hm);const pipe=new THREE.Mesh(new THREE.CircleGeometry(1.15,16,0,Math.PI),hm);pipe.position.set(d.x,0.02,46);pipe.rotation.x=-Math.PI/2;C.grp.add(pipe);
    for(const xx of[d.x-3.2,d.x+3.2])tbox(C,0.4,0.1,64,xx,0.05,32,'concrete');}
  if(d.k==='panels'){for(let i=0;i<5;i++)for(let j=0;j<2;j++){const px=d.x-d.w/2+1.6+i*(d.w-3.2)/4,pz=d.z-d.d/2+2+j*(d.d-4);
      const p=box(C,2.4,0.08,1.5,px,d.y+0.5,pz,panelMat);p.rotation.x=-0.42;box(C,0.1,0.55,0.1,px-1,d.y+0.27,pz+0.45,frameMat);box(C,0.1,0.55,0.1,px+1,d.y+0.27,pz+0.45,frameMat);}}
  if(d.k==='wirespan'){const zo=-1.46,y=3.66;for(const xo of[-0.5,0.44])addLine(C,sagLine([d.a[0]+xo,d.a[1]+zo],[d.b[0]+xo,d.b[1]+zo],y,y,0.5+Math.abs(xo)*0.2,14));}
  if(d.k==='lightspan'){const zo=-0.7,y=1.78,pts=sagLine([d.a[0]+0.2,d.a[1]+zo],[d.b[0]+0.2,d.b[1]+zo],y,y,0.38,16);addLine(C,pts);
    const n=Math.max(3,Math.round(Math.hypot(d.b[0]-d.a[0],d.b[1]-d.a[1])/1.3));for(let i=1;i<n;i++){const p=pts[Math.round(i/n*16)];const bm=new THREE.Mesh(BULBGEO,MAT.glow);bm.position.set(p.x,p.y-0.08,p.z);bm.rotation.x=TILT;C.grp.add(bm);}}
  if(d.k==='mound'){const m=new THREE.Mesh(MOUNDGEO,MAT.mound);m.scale.set(d.rx,d.h,d.rz);m.position.set(d.x,-0.12,d.z);C.grp.add(m);
    if(hash2(d.x|0,d.z|0)<0.6){const b=propSprite(hash2(d.z|0,d.x|0)<0.5?'bush_a':'nopal_b',0.9);b.position.set(d.x,d.h*0.82,d.z);C.grp.add(b);}
    C.col.push({t:'c',x:d.x,z:d.z,r:Math.min(d.rx,d.rz)*0.85});}
}
function buildProp(p,C){
  const [k,x,z,s=1,f=0,y=0]=p;
  if(k==='flag'){const pole=propSprite('pole',s);pole.position.set(x,0,z);C.grp.add(pole);const fl=propSprite(`flag${f}_0`,s);fl.position.set(x+0.5*s,2.1*s,z+0.02);fl.userData={f,s,dyn:true};C.grp.add(fl);C.flags.push(fl);C.col.push({t:'c',x,z,r:.15});return;}
  const m=propSprite(k,s);m.position.set(x,y,z);C.grp.add(m);
  if(y<0.1){const sh=new THREE.Mesh(BLOB.geo,BLOB.mat);sh.scale.setScalar(Math.min(4,(MAN.frames[k].w/PPU)*s*0.75));sh.position.set(x,0.02,z);C.grp.add(sh);}
  if(k==='lantern'){const gl=new THREE.Mesh(GLOWGEO,MAT.glow);gl.position.set(x+0.19*s,1.3*s,z+0.15);gl.rotation.x=TILT;C.grp.add(gl);C.lanterns.push([x+0.19,1.3,z+0.35]);
    lightFX(C,x+0.19,z+0.1,1.3,5.2,MAT.pool,true);C.lampHeads.push([x+0.19,1.25,z+0.1]);}
  if(k==='fire_0'){m.userData.dyn=true;C.anims.push({mesh:m,frames:['fire_0','fire_1']});const gl=new THREE.Mesh(GLOWGEO,MAT.glow);gl.scale.setScalar(1.3);gl.position.set(x,0.6,z+0.1);gl.rotation.x=TILT;C.grp.add(gl);C.lanterns.push([x,0.7,z+0.4]);C.fires&&C.fires.push([x,z]);lightFX(C,x,z+0.1,0.6,6.5,MAT.poolFire,false);}
  if(k==='shrine'){const gl=new THREE.Mesh(GLOWGEO,MAT.glow);gl.scale.setScalar(0.8);gl.position.set(x,0.9,z+0.1);gl.rotation.x=TILT;C.grp.add(gl);C.lanterns.push([x,1.0,z+0.4]);lightFX(C,x,z+0.2,0.9,3,MAT.pool,false);}
  if(y>0.1)return;
  if(BOXCOL[k]){const [hw,hd]=BOXCOL[k];if(hw)C.col.push({t:'b',x0:x-hw*s,x1:x+hw*s,z0:z-hd,z1:z+hd});}
  else if(k.startsWith('stall'))C.col.push({t:'b',x0:x-1.2,x1:x+1.2,z0:z-0.35,z1:z+0.25});
  else if(RADIUS[k])C.col.push({t:'c',x,z,r:RADIUS[k]*(s>1?1.1:1)});
}
let GLOWGEO,BULBGEO,MOUNDGEO,POOLGEO,CONEGEO,STREAKGEO;const DEPTH={};
/* A warm pool of light on the ground, a faint cone of lit haze, and a thin lens streak at the flame. */
function lightFX(C,x,z,hy,r,poolMat,cone){const p=new THREE.Mesh(POOLGEO,poolMat);p.scale.set(r,r,1);p.rotation.x=-Math.PI/2;p.position.set(x,0.035,z+0.2);C.grp.add(p);
  if(cone){const c=new THREE.Mesh(CONEGEO,MAT.cone);c.scale.set(1.3,hy*1.02,1);c.position.set(x,0,z+0.05);c.rotation.x=TILT;C.grp.add(c);
    const st=new THREE.Mesh(STREAKGEO,MAT.streak);st.position.set(x,hy,z+0.3);st.rotation.x=TILT;C.grp.add(st);}}
function shadowFlags(root){const sh=SHADOWS();root.traverse(o=>{if(!o.isMesh)return;const mats=Array.isArray(o.material)?o.material:[o.material];const m=mats[0];
  if(o.userData.ground){o.receiveShadow=true;return;}
  if(m.transparent||m.blending===THREE.AdditiveBlending||m.isMeshBasicMaterial||o.userData.noShadow){o.castShadow=false;o.receiveShadow=false;return;}
  if(SPRITE_MATS.includes(m)){o.castShadow=true;o.customDepthMaterial=m.map===TEX.chars?DEPTH.chars:DEPTH.props;return;}
  o.castShadow=true;o.receiveShadow=true;});}
function radialTex(stops,size=64){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');const g=x.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);stops.forEach(([o,s])=>g.addColorStop(o,s));x.fillStyle=g;x.fillRect(0,0,size,size);return new THREE.CanvasTexture(c);}
function addMat(tex,op){return new THREE.MeshBasicMaterial({map:tex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:op,fog:false,side:THREE.DoubleSide});}
function initWorldMats(){MAT.props=spriteMat(TEX.props);MAT.charsStatic=spriteMat(TEX.chars);
  MAT.glow=new THREE.MeshBasicMaterial({map:TEX.props,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.85});
  GLOWGEO=new THREE.PlaneGeometry(1.9,1.9);setUV(GLOWGEO,MAN.frames.glow,IMG.props,false);GLOWGEO.userData.shared=true;BLOB.geo.userData.shared=true;
  BULBGEO=new THREE.PlaneGeometry(0.42,0.42);setUV(BULBGEO,MAN.frames.bulb,IMG.props,false);BULBGEO.userData.shared=true;
  MOUNDGEO=new THREE.SphereGeometry(1,14,7,0,Math.PI*2,0,Math.PI/2);MOUNDGEO.userData.shared=true;
  POOLGEO=new THREE.PlaneGeometry(1,1);POOLGEO.userData.shared=true;
  CONEGEO=new THREE.PlaneGeometry(1,1);CONEGEO.translate(0,0.5,0);CONEGEO.userData.shared=true;
  STREAKGEO=new THREE.PlaneGeometry(2.2,0.16);STREAKGEO.userData.shared=true;
  MAT.pool=addMat(radialTex([[0,'rgba(255,190,110,0.9)'],[0.35,'rgba(255,150,70,0.35)'],[1,'rgba(255,120,40,0)']]),0.5);
  MAT.poolFire=addMat(radialTex([[0,'rgba(255,160,70,1)'],[0.3,'rgba(255,110,40,0.4)'],[1,'rgba(255,80,20,0)']]),0.6);
  {const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');const img=x.createImageData(64,128);
   for(let j=0;j<128;j++)for(let i=0;i<64;i++){const v=j/127,w=0.18+0.8*(1-v),dx=Math.abs(i/63-0.5)*2/w,a=Math.max(0,1-dx*dx)*Math.pow(v,1.6)*(0.85+0.15*Math.sin(i*0.9+j*0.13));const k=(j*64+i)*4;img.data[k]=255;img.data[k+1]=200;img.data[k+2]=130;img.data[k+3]=a*255;}
   x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.flipY=false;MAT.cone=addMat(t,0.2);}
  {const c=document.createElement('canvas');c.width=128;c.height=8;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,128,0);g.addColorStop(0,'rgba(255,200,140,0)');g.addColorStop(0.5,'rgba(255,230,190,1)');g.addColorStop(1,'rgba(255,200,140,0)');x.fillStyle=g;x.fillRect(0,3,128,2);x.globalAlpha=0.35;x.fillRect(0,2,128,4);MAT.streak=addMat(new THREE.CanvasTexture(c),0.55);}
  DEPTH.chars=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:TEX.chars,alphaTest:0.5,side:THREE.DoubleSide});
  DEPTH.props=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:TEX.props,alphaTest:0.5,side:THREE.DoubleSide});
  initFX();
  const mc=document.createElement('canvas');mc.width=mc.height=64;const mg=mc.getContext('2d');mg.imageSmoothingEnabled=false;
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){const t=MAN.tiles.index[['caliche','caliche2','gravel','deadgrass'][Math.floor(hash2(i,j)*4)]];mg.drawImage(IMG.tiles,(t%8)*16,Math.floor(t/8)*16,16,16,i*16,j*16,16,16);}
  const mt=new THREE.CanvasTexture(mc);mt.wrapS=mt.wrapT=THREE.RepeatWrapping;mt.repeat.set(3,1.5);mt.magFilter=THREE.NearestFilter;MAT.mound=new THREE.MeshLambertMaterial({map:mt});}
function blocked(x,z,r){
  if(x<BND[0]||x>BND[2]||z<BND[1]||z>BND[3])return true;
  const test=c=>{if(c.t==='b'){const nx=clamp(x,c.x0,c.x1),nz=clamp(z,c.z0,c.z1),dx=x-nx,dz=z-nz;return dx*dx+dz*dz<r*r;}const dx=x-c.x,dz=z-c.z,rr=r+c.r;return dx*dx+dz*dz<rr*rr;};
  for(const C of chunks.values())for(const c of C.col)if(test(c))return true;
  for(const c of GLOBAL_COL)if(test(c))return true;return false;}
function assignLamps(fx,fz){const all=[];chunks.forEach(C=>C.lanterns.forEach(l=>all.push(l)));
  all.sort((a,b)=>((a[0]-fx)**2+(a[2]-fz)**2)-((b[0]-fx)**2+(b[2]-fz)**2));
  LAMPS.forEach((L,i)=>{const l=all[i];if(l&&ENV.lamp>0.02){L.position.set(l[0],l[1],l[2]);L.userData.base=1.75*ENV.lamp;}else L.userData.base=0;});}
function flickerLamps(t){LAMPS.forEach((L,i)=>{L.intensity=(L.userData.base||0)*(0.9+0.06*Math.sin(t*8.3+i*1.7)+0.05*Math.sin(t*21.7+i*3.1)+0.03*Math.sin(t*47+i));});
  if(MAT.glow)MAT.glow.opacity=0.85*ENV.lamp*(0.94+0.06*Math.sin(t*11.3));}
let flagT=0;function animFlags(){flagT^=1;chunks.forEach(C=>C.flags.forEach(fl=>{setUV(fl.geometry,MAN.frames[`flag${fl.userData.f}_${flagT}`],IMG.props,false);}));}
let fireT=0;function animFires(){fireT^=1;chunks.forEach(C=>C.anims.forEach(a=>setUV(a.mesh.geometry,MAN.frames[a.frames[fireT]],IMG.props,false)));}

