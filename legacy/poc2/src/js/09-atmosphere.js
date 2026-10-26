/* ============ atmosphere: embers, moths, dust motes and light shafts (shader-driven, no per-frame CPU work) ============ */
const FX={t:0,dust:null,shafts:null};const FXZERO=new THREE.Vector3();
const SOFT_FRAG=`varying float vA;varying vec3 vC;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.05,d)*vA;if(a<0.003)discard;gl_FragColor=vec4(vC*a,a);}`;
function initFX(){
  MAT.spark=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:1},uOp:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 info;uniform float uTime,uPx,uOp;varying float vA;varying vec3 vC;
    void main(){vec3 p=position;float k=info.x,ph=info.y,r=info.z;float a,sz;
      if(k<0.5){float L=1.5+r*1.5;float t=fract(uTime/L+ph);p+=vec3(sin(t*7.0+ph*30.0)*0.25*t+(r-0.5)*0.35*t,t*(1.6+r*1.8),cos(t*5.0+ph*20.0)*0.16*t);
        a=(1.0-t)*smoothstep(0.0,0.08,t)*(0.7+0.3*sin(uTime*30.0+ph*90.0));sz=1.25-t*0.75;vC=mix(vec3(1.0,0.8,0.35),vec3(1.0,0.3,0.08),t);}
      else{float w=2.5+r*3.0;float t=uTime*w+ph*6.283;p+=vec3(cos(t)*(0.32+r*0.3),sin(t*1.7)*0.22+0.12,sin(t)*(0.22+r*0.2));
        a=0.8*(0.55+0.45*sin(uTime*26.0+ph*50.0));sz=0.5;vC=vec3(1.0,0.96,0.86);}
      vA=a*uOp;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uPx*sz*9.0/max(1.0,-mv.z);}`,fragmentShader:SOFT_FRAG});
  MAT.dust=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:1},uOp:{value:0.4},uCenter:{value:new THREE.Vector3()},uBox:{value:new THREE.Vector3(40,6.5,30)},uWind:{value:new THREE.Vector3(0.32,0,0.08)},uCol:{value:new THREE.Color(1,0.95,0.86)}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec4 seed;uniform float uTime,uPx,uOp;uniform vec3 uCenter,uBox,uWind,uCol;varying float vA;varying vec3 vC;
    void main(){vec3 lo=uCenter-uBox*0.5;vec3 p=seed.xyz*uBox+uWind*uTime*(0.6+seed.w)+vec3(sin(uTime*0.6+seed.w*40.0)*0.5,0.0,cos(uTime*0.5+seed.w*23.0)*0.5);
      p.xz=mod(p.xz-lo.xz,uBox.xz)+lo.xz;p.y=0.15+mod(seed.y*uBox.y+sin(uTime*0.4+seed.w*17.0)*0.6+uTime*0.06*(seed.w-0.4),uBox.y);
      float tw=0.5+0.5*sin(uTime*(1.2+seed.w*2.5)+seed.w*60.0);vA=uOp*tw*smoothstep(0.0,1.2,p.y);vC=uCol;
      vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=uPx*(0.45+seed.w*0.9)*8.0/max(1.0,-mv.z);}`,fragmentShader:SOFT_FRAG});
  const N=SET.quality==='low'?160:340,seed=new Float32Array(N*4),pos=new Float32Array(N*3);for(let i=0;i<N*4;i++)seed[i]=Math.random();
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('seed',new THREE.BufferAttribute(seed,4));
  FX.dust=new THREE.Points(g,MAT.dust);FX.dust.frustumCulled=false;scene.add(FX.dust);
  // light shafts: tall soft slanted bands of haze, drifting slowly behind the action
  const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');const img=x.createImageData(64,256);
  for(let j=0;j<256;j++)for(let i=0;i<64;i++){const u=i/63-0.5,v=j/255;const a=Math.exp(-u*u*14)*Math.pow(Math.sin(Math.PI*v),1.3)*(0.75+0.25*Math.sin(j*0.21+i*0.4));const k=(j*64+i)*4;img.data[k]=img.data[k+1]=img.data[k+2]=255;img.data[k+3]=a*255;}
  x.putImageData(img,0,0);MAT.shaft=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,opacity:0.08,color:0xc8d4ff});
  FX.shafts=new THREE.Group();const sg=new THREE.PlaneGeometry(3.4,30);
  for(let i=0;i<5;i++){const m=new THREE.Mesh(sg,MAT.shaft);m.userData={ox:-15+i*7.5+Math.random()*2,oz:-7-Math.random()*5,w:2+Math.random()*2.6,ph:Math.random()*6};m.scale.x=m.userData.w/3.4;m.rotation.z=-0.42;m.rotation.x=-0.25;FX.shafts.add(m);}
  scene.add(FX.shafts);}
function addSparks(C){const pts=[];C.fires.forEach(f=>{for(let i=0;i<24;i++)pts.push([f[0]+(Math.random()-0.5)*0.4,0.45,f[1]+(Math.random()-0.5)*0.3,0,Math.random(),Math.random()]);});
  C.lampHeads.forEach(h=>{for(let i=0;i<2;i++)pts.push([h[0],h[1],h[2],1,Math.random(),Math.random()]);});
  if(!pts.length)return;const pos=new Float32Array(pts.length*3),info=new Float32Array(pts.length*3);pts.forEach((p,i)=>{pos.set(p.slice(0,3),i*3);info.set(p.slice(3),i*3);});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('info',new THREE.BufferAttribute(info,3));
  const P=new THREE.Points(g,MAT.spark);P.frustumCulled=false;C.grp.add(P);}
function fxUpdate(dt){FX.t+=dt;const t=FX.t,px=DPR*SH/540;
  MAT.spark.uniforms.uTime.value=t;MAT.spark.uniforms.uPx.value=px*1.4;MAT.spark.uniforms.uOp.value=0.45+0.55*ENV.lamp;
  const D=MAT.dust.uniforms;D.uTime.value=t;D.uPx.value=px;const c=ARENA.on?FXZERO:CAM.look;D.uCenter.value.set(c.x,0,c.z);
  D.uOp.value=0.22+0.18*ENV.lamp+0.25*ENV.bleach;D.uCol.value.setRGB(1,0.93+0.05*ENV.bleach,0.82+0.12*ENV.bleach);
  MAT.shaft.opacity=(0.055+0.07*ENV.bleach+(ARENA.on?0.04:0))*(reduceMotion?0.7:1);MAT.shaft.color.copy(ENV.mc).lerp(new THREE.Color(1,1,1),0.3);
  const S=ARENA.on?ARENA.scene:scene;if(FX.dust.parent!==S){S.add(FX.dust);S.add(FX.shafts);}
  FX.shafts.position.set(c.x,0,c.z);FX.shafts.children.forEach(m=>{const u=m.userData;m.position.set(u.ox+Math.sin(t*0.05+u.ph)*2.5,9,u.oz);});
  if(SHADOWS()){moon.target.position.copy(CAM.look);moon.position.copy(CAM.look).addScaledVector(MOONDIR,45);}
  flickerLamps(t);}

