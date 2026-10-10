/* ============ post: tilt-shift + bloom + grade ============ */
function mkRT(w,h,depth){return new THREE.WebGLRenderTarget(w,h,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,depthBuffer:depth,stencilBuffer:false});}
let rtMain,rtQ1,rtQ2,rtB1,rtB2;
function sizeRTs(){const w=Math.max(2,Math.floor(SW*DPR)),h=Math.max(2,Math.floor(SH*DPR));
  [rtMain,rtQ1,rtQ2,rtB1,rtB2].forEach(r=>r&&r.dispose());rtMain=mkRT(w,h,true);
  const qw=Math.max(2,w>>2),qh=Math.max(2,h>>2);rtQ1=mkRT(qw,qh,false);rtQ2=mkRT(qw,qh,false);rtB1=mkRT(qw,qh,false);rtB2=mkRT(qw,qh,false);}
const VS='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const mCopy=new THREE.ShaderMaterial({uniforms:{tex:{value:null},texel:{value:new THREE.Vector2()},thr:{value:0}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tex;uniform vec2 texel;uniform float thr;varying vec2 vUv;
  void main(){vec3 c=(texture2D(tex,vUv+texel*vec2(-1.,-1.)).rgb+texture2D(tex,vUv+texel*vec2(1.,-1.)).rgb+texture2D(tex,vUv+texel*vec2(-1.,1.)).rgb+texture2D(tex,vUv+texel*vec2(1.,1.)).rgb)*0.25;
  if(thr>0.0){float l=max(c.r,max(c.g,c.b));c*=smoothstep(thr,thr+0.22,l);}gl_FragColor=vec4(c,1.0);}`});
const mBlur=new THREE.ShaderMaterial({uniforms:{tex:{value:null},dir:{value:new THREE.Vector2()}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tex;uniform vec2 dir;varying vec2 vUv;
  void main(){vec3 c=texture2D(tex,vUv).rgb*0.2270270;c+=texture2D(tex,vUv+dir*1.3846).rgb*0.3162162;c+=texture2D(tex,vUv-dir*1.3846).rgb*0.3162162;
  c+=texture2D(tex,vUv+dir*3.2308).rgb*0.0702703;c+=texture2D(tex,vUv-dir*3.2308).rgb*0.0702703;gl_FragColor=vec4(c,1.0);}`});
const mComp=new THREE.ShaderMaterial({uniforms:{tMain:{value:null},tBlur:{value:null},tBloom:{value:null},texel:{value:new THREE.Vector2()},
  focusY:{value:0.47},band:{value:0.15},strength:{value:1},bloomAmt:{value:0.72},bleach:{value:0},dpr:{value:1},time:{value:0},night:{value:1},heat:{value:0}},
  vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tMain,tBlur,tBloom;uniform vec2 texel;uniform float focusY,band,strength,bloomAmt,bleach,dpr;varying vec2 vUv; uniform float time,night,heat; float h12(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} vec2 shimmer(vec2 uv){return uv+vec2(sin(uv.y*95.0+time*5.5)*0.0016,sin(uv.x*60.0+time*3.0)*0.0006)*heat*smoothstep(0.85,0.2,uv.y);} vec3 grade(vec3 col,vec2 uv){   float l=dot(col,vec3(0.299,0.587,0.114));   vec3 sh=mix(vec3(1.0),vec3(0.82,0.93,1.16),night),hi=mix(vec3(1.0),vec3(1.12,1.0,0.84),night);   col*=mix(sh,hi,smoothstep(0.08,0.6,l));   col=mix(vec3(l),col,1.06+night*0.06-heat*0.5);   col=mix(col,vec3(1.0,0.985,0.94),heat*0.12)+heat*0.025;col=mix(col,col*col*1.25,heat*0.25);   col=col*0.965+vec3(0.016,0.012,0.03)*night;   vec2 q=uv-0.5;col*=1.0-dot(q,q)*(0.95-heat*0.65);   col+=(h12(uv*vec2(1733.0,977.0)+fract(time*7.0)*31.0)-0.5)*0.03;   return col;} 
  void main(){vec2 uv=shimmer(vUv);vec2 cq=(vUv-0.5)*0.0022;vec3 sharp=vec3(texture2D(tMain,uv+cq).r,texture2D(tMain,uv).g,texture2D(tMain,uv-cq).b);float d=abs(vUv.y-focusY);float b=smoothstep(band,band+0.34,d)*strength;
  vec3 soft=sharp;float rad=b*2.4*dpr;
  for(int i=0;i<8;i++){float fi=float(i);float a=fi*2.39996+0.5;float r=sqrt((fi+0.5)/8.0)*rad;soft+=texture2D(tMain,vUv+vec2(cos(a),sin(a))*r*texel).rgb;}
  soft/=9.0;vec3 col=mix(sharp,soft,clamp(b*2.0,0.0,1.0));col=mix(col,texture2D(tBlur,vUv).rgb,smoothstep(0.45,1.0,b));
  col+=texture2D(tBloom,vUv).rgb*bloomAmt;col+=texture2D(tBlur,vUv).rgb*0.06*night;
  gl_FragColor=vec4(grade(col,vUv),1.0);}`});
const mLite=new THREE.ShaderMaterial({uniforms:{tMain:{value:null},time:{value:0},night:{value:1},heat:{value:0}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tMain;varying vec2 vUv; uniform float time,night,heat; float h12(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);} vec2 shimmer(vec2 uv){return uv+vec2(sin(uv.y*95.0+time*5.5)*0.0016,sin(uv.x*60.0+time*3.0)*0.0006)*heat*smoothstep(0.85,0.2,uv.y);} vec3 grade(vec3 col,vec2 uv){   float l=dot(col,vec3(0.299,0.587,0.114));   vec3 sh=mix(vec3(1.0),vec3(0.82,0.93,1.16),night),hi=mix(vec3(1.0),vec3(1.12,1.0,0.84),night);   col*=mix(sh,hi,smoothstep(0.08,0.6,l));   col=mix(vec3(l),col,1.06+night*0.06-heat*0.5);   col=mix(col,vec3(1.0,0.985,0.94),heat*0.12)+heat*0.025;col=mix(col,col*col*1.25,heat*0.25);   col=col*0.965+vec3(0.016,0.012,0.03)*night;   vec2 q=uv-0.5;col*=1.0-dot(q,q)*(0.95-heat*0.65);   col+=(h12(uv*vec2(1733.0,977.0)+fract(time*7.0)*31.0)-0.5)*0.03;   return col;}  void main(){vec3 c=texture2D(tMain,shimmer(vUv)).rgb;gl_FragColor=vec4(grade(c,vUv),1.0);}`});
const UL=mLite.uniforms;
const U=mComp.uniforms;
const pScene=new THREE.Scene(),pCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mCopy);quad.frustumCulled=false;pScene.add(quad);
function pass(mat,target){quad.material=mat;renderer.setRenderTarget(target);renderer.render(pScene,pCam);}
function blur(src,dst,dx,dy,s){mBlur.uniforms.tex.value=src.texture;mBlur.uniforms.dir.value.set(dx*s/src.width,dy*s/src.height);pass(mBlur,dst);}
function render(){
  renderer.info.reset();
  const S=ARENA.on?ARENA.scene:scene;
  if(SET.quality==='low'){renderer.setRenderTarget(null);renderer.render(S,camera);return;}
  if(SET.quality==='medium'){renderer.setRenderTarget(rtMain);renderer.render(S,camera);UL.tMain.value=rtMain.texture;pass(mLite,null);return;}
  renderer.setRenderTarget(rtMain);renderer.render(S,camera);
  mCopy.uniforms.tex.value=rtMain.texture;mCopy.uniforms.texel.value.set(1/rtMain.width,1/rtMain.height);mCopy.uniforms.thr.value=0;pass(mCopy,rtQ1);
  blur(rtQ1,rtQ2,1,0,1.3);blur(rtQ2,rtQ1,0,1,1.3);
  mCopy.uniforms.tex.value=rtQ1.texture;mCopy.uniforms.texel.value.set(0,0);mCopy.uniforms.thr.value=0.7+0.22*ENV.bleach;pass(mCopy,rtB1);
  blur(rtB1,rtB2,1,0,1.5);blur(rtB2,rtB1,0,1,1.5);blur(rtB1,rtB2,1,0,3.2);blur(rtB2,rtB1,0,1,3.2);
  U.bloomAmt.value=0.7-0.4*ENV.bleach;U.tMain.value=rtMain.texture;U.tBlur.value=rtQ1.texture;U.tBloom.value=rtB1.texture;U.texel.value.set(1/rtMain.width,1/rtMain.height);U.dpr.value=DPR;
  pass(mComp,null);}

