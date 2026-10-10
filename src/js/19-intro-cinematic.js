/* ============ intro cinematic: the old tale told at Mar Farm ============ */
const CINE={on:false,abort:false,actors:[]};
const TALE={cur:null,prev:null,t:0,pt:0,f:1,cv:null,ctx:null};
const INK='#1c0d07',LIGHT='#fff3cc';
function taleSet(id){TALE.prev=TALE.cur;TALE.pt=TALE.t;TALE.cur=id;TALE.t=0;TALE.f=0;$('#tale').hidden=false;$('#tale').classList.toggle('show',!!id||!!TALE.prev);}
function sheet(g,t){const fl=0.9+0.06*Math.sin(t*11)+0.04*Math.sin(t*23.7);const gr=g.createRadialGradient(160,118,10,160,95,190);
  gr.addColorStop(0,`rgba(${255*fl|0},${200*fl|0},${120*fl|0},1)`);gr.addColorStop(0.55,`rgba(${226*fl|0},${140*fl|0},${70*fl|0},1)`);gr.addColorStop(1,'#5a2410');g.fillStyle=gr;g.fillRect(0,0,320,150);}
const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const O=(g,x,y,r,c)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,Math.max(0,r),0,6.283);g.fill();};
function skyline(g,sink=0,broken=false){const B=[[8,34],[30,52],[52,26],[70,64],[94,40],[118,30],[136,72],[162,44],[186,56],[206,30],[226,62],[250,38],[272,50],[294,28]];
  B.forEach(([x,h],i)=>{const hh=h*(1-sink);R(g,x,130-hh,18,hh,INK);if(broken&&i%2===0){g.fillStyle='rgba(0,0,0,0)';R(g,x+12,130-hh,6,6+i%3*4,'#c97a3a');}
    if(!broken&&hh>20)for(let wy=130-hh+5;wy<126;wy+=8)for(let wx=x+3;wx<x+15;wx+=6)if((wx*7+wy*3+i)%5<2)R(g,wx,wy,2,3,'#e8a05a');});R(g,0,130,320,20,INK);}
function person(g,x,y,s=1,arms=0,c=INK){O(g,x,y-14*s,3*s,c);g.fillStyle=c;g.beginPath();g.moveTo(x-4*s,y);g.lineTo(x+4*s,y);g.lineTo(x+1.5*s,y-11*s);g.lineTo(x-1.5*s,y-11*s);g.fill();
  R(g,x-5*s,y-10*s-arms*3*s,1.5*s,5*s,c);R(g,x+3.5*s,y-10*s-arms*3*s,1.5*s,5*s,c);}
function drone(g,x,y,s=1,c=INK){R(g,x-12*s,y,24*s,1.6*s,c);R(g,x-3*s,y-1.5*s,7*s,3*s,c);R(g,x-11*s,y-2*s,1.4*s,3*s,c);R(g,x+10*s,y-2*s,1.4*s,3*s,c);}
const PANELS={
  rain(g,t){skyline(g);for(let k=0;k<3;k++){const cx=((k*120+t*6)%420)-50,cy=26+k*7;[[0,0,14],[14,-4,17],[30,0,13],[16,6,15]].forEach(([dx,dy,r])=>O(g,cx+dx,cy+dy,r,'rgba(28,13,7,0.88)'));}
    g.strokeStyle='rgba(28,13,7,0.7)';g.lineWidth=1;g.beginPath();for(let i=0;i<70;i++){const x=((i*37)%330+t*18)%330-5,y=((i*53)%90+t*130)%92+44;g.moveTo(x,y);g.lineTo(x-2,y+6);}g.stroke();
    const j=Math.abs(Math.sin(t*4))*4;person(g,205,130-j,1,1);person(g,190,130,1.15,0);},
  machines(g,t){O(g,252,40,17,LIGHT);R(g,0,0,320,150,`rgba(28,13,7,${Math.min(0.32,t*0.03)})`);skyline(g);
    for(let i=0;i<5;i++){const x=((t*28+i*74)%420)-50,y=24+i*9;g.fillStyle='rgba(28,13,7,0.35)';for(let k=1;k<14;k++){const px=x-k*7,sp=k*0.8;O(g,px,y+Math.sin(k+t)*sp*0.5,1.2+sp*0.35,'rgba(28,13,7,0.28)');}drone(g,x,y,0.8);}},
  veil(g,t){skyline(g);const N=180;for(let i=0;i<N;i++){const die=1.5+(i*7919%N)/N*9;if(t>die)continue;const x=(i*31)%320,y=18+Math.sin(x*0.05+t*0.6)*7+((i*13)%9)-4;
      const tw=0.5+0.5*Math.sin(t*6+i);R(g,x,y,1.4,1.4,`rgba(255,246,208,${0.5+0.5*tw})`);}
    const sc=Math.max(0,1-t/10);for(let k=0;k<2;k++){const cx=70+k*150;[[0,0,12],[13,-3,14],[26,0,11]].forEach(([dx,dy,r])=>O(g,cx+dx,46+dy,r*sc,'rgba(28,13,7,0.85)'));}
    for(let i=0;i<2;i++){const x=((t*24+i*170)%420)-50;drone(g,x,62+i*10,0.7);}},
  white(g,t){const w=Math.min(0.85,t*0.11);O(g,250,46,17+Math.min(110,t*12),LIGHT);skyline(g,Math.min(0.55,t*0.06));
    for(let i=0;i<6;i++){const x=40+i*45,fall=Math.max(0,Math.min(1,(t-1.5-i*0.8)/0.7));g.save();g.translate(x,130);g.rotate(fall*1.45*(i%2?1:-1));person(g,0,0,1);g.restore();}
    R(g,0,0,320,150,`rgba(255,248,226,${w})`);},
  below(g,t){R(g,0,0,320,70,'rgba(255,240,200,0.35)');O(g,250,24,14,LIGHT);R(g,0,70,320,80,INK);R(g,30,96,260,22,'#7a3414');R(g,150,70,10,26,'#7a3414');
    for(let k=0;k<5;k++)R(g,150,74+k*5,10,1.5,INK);
    const sx=((t*14)%380)-30;R(g,sx-10,58,20,10,INK);O(g,sx-6,69,2.5,INK);O(g,sx,69,2.5,INK);O(g,sx+6,69,2.5,INK);R(g,sx+7,60,3,3,'#ff6b3a');
    const wx=320-((t*9)%400);R(g,wx-6,40,12,16,INK);R(g,wx-5,56,3,14,INK);R(g,wx+2,56,3,14,INK);R(g,wx-2,36,4,4,'#ff6b3a');
    [[60,0],[100,1],[200,2],[245,3]].forEach(([x,i])=>{person(g,x,118,0.85,0,INK);const fl=0.6+0.4*Math.sin(t*9+i*2);O(g,x+5,104,3.5,`rgba(255,210,122,${0.25*fl})`);O(g,x+5,104,1.6,`rgba(255,226,160,${fl})`);});},
  circling(g,t){R(g,0,0,320,150,'rgba(255,248,226,0.35)');O(g,262,30,16,LIGHT);skyline(g,0.35,true);const x=-70+t*13,y=36+Math.sin(t*0.8)*2;R(g,x-34,y,68,2.2,INK);R(g,x-6,y-2.5,12,4.5,INK);for(const dx of[-24,-9,9,24])R(g,x+dx-1,y+2,2,3,INK);
    person(g,40,130,1);person(g,52,130,0.75);}
};
function taleDraw(dt){if(!TALE.ctx||$('#tale').hidden)return;TALE.t+=dt;TALE.pt+=dt;TALE.f=Math.min(1,TALE.f+dt/0.8);const g=TALE.ctx;
  sheet(g,TALE.t);if(TALE.prev&&TALE.f<1){g.globalAlpha=1-TALE.f;PANELS[TALE.prev](g,TALE.pt);g.globalAlpha=1;}
  if(TALE.cur){g.globalAlpha=TALE.f;PANELS[TALE.cur](g,TALE.t);g.globalAlpha=1;}
  else if(TALE.f>=1){$('#tale').classList.remove('show');setTimeout(()=>{if(!TALE.cur)$('#tale').hidden=true;},600);}}
async function chapter(lines,ms,keepBlack){const c=$('#chapter');c.innerHTML=lines;c.hidden=false;c.classList.remove('out');void c.offsetWidth;c.classList.add('in');
  await sleep(ms);if(keepBlack)$('#fade').style.transition='none',$('#fade').style.opacity=1;c.classList.add('out');await sleep(900);c.hidden=true;c.classList.remove('in','out');}
function skipIntro(){if(!CINE.on||CINE.abort)return;CINE.abort=true;AU.back();if(aWaiter){aWaiter();if(aWaiter)aWaiter();}}
async function runIntro(){CINE.on=true;CINE.abort=false;setMode('script');$('#hud').hidden=true;$('#objective').hidden=true;
  if(!TALE.ctx){TALE.cv=$('#tale canvas');TALE.ctx=TALE.cv.getContext('2d');TALE.ctx.imageSmoothingEnabled=false;}
  ST.clock=21*60+40;envAt(ST.clock);P.visible=false;NPC.lupe.hidden=true;
  const FXX=13.2,FXZ=29.9;
  const mk=(k,x,z,d)=>{const a=new Actor(k).place(x,z);a.dir=d;CINE.actors.push(a);return a;};
  mk('elias',FXX-1.6,FXZ,'right');mk('kidjuno',FXX-0.75,FXZ+0.8,'right');mk('rosa',FXX+1.5,FXZ+0.2,'left');
  streamChunks(FXX,FXZ,true);
  // a fire just for the tale: sprite, glow, ground pool, embers, and a slot in the lantern-light pool
  const G=new THREE.Group();const fm=propSprite('fire_0',1.15);fm.position.set(FXX,0,FXZ);G.add(fm);
  const gl=new THREE.Mesh(GLOWGEO,MAT.glow);gl.scale.setScalar(1.6);gl.position.set(FXX,0.65,FXZ+0.1);gl.rotation.x=TILT;G.add(gl);
  const pool=new THREE.Mesh(POOLGEO,MAT.poolFire);pool.scale.set(7.5,7.5,1);pool.rotation.x=-Math.PI/2;pool.position.set(FXX,0.04,FXZ+0.2);G.add(pool);
  const Cx={grp:G,fires:[[FXX,FXZ]],lampHeads:[]};addSparks(Cx);scene.add(G);
  const host=chunks.get(chunkOf(FXX,FXZ));const anchor=[FXX,0.75,FXZ+0.4];host.lanterns.unshift(anchor);
  let ff=0;const fiv=setInterval(()=>{ff^=1;setUV(fm.geometry,MAN.frames['fire_'+ff],IMG.props,false);},150);
  CINE.cleanup=()=>{clearInterval(fiv);scene.remove(G);G.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});const i=host.lanterns.indexOf(anchor);if(i>=0)host.lanterns.splice(i,1);};
  CAM.override={t:V3(FXX,1.0,FXZ),o:V3(0.4,6.4,12.5),k:3};updateCam(0,true);
  CAM.override={t:V3(FXX+0.3,0.95,FXZ+1.3),o:V3(0.2,4.1,7.6),k:0.09};
  $('#skip').hidden=false;escHandler=skipIntro;
  await chapter('<p>A story told at Mar Farm,<br>a long time ago.</p>',2800,false);
  if(!CINE.abort){await fadeTo(0,1600);await runScript(DLG.intro);}
  $('#skip').hidden=true;escHandler=null;taleSet(null);$('#tale').hidden=true;dlgEl.hidden=true;aWaiter=null;
  if(!CINE.abort)await chapter('<h1>The Long Noon</h1><p>Many years later.</p>',3600,true);
  else{$('#chapter').hidden=true;$('#fade').style.transition='none';$('#fade').style.opacity=1;}
  CINE.actors.forEach(a=>a.dispose());CINE.actors.length=0;CINE.cleanup&&CINE.cleanup();CINE.cleanup=null;P.visible=true;NPC.lupe.hidden=false;CINE.on=false;CINE.abort=false;}
$('#skip').addEventListener('click',e=>{e.stopPropagation();skipIntro();});

