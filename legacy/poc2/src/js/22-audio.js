/* ============ audio: streamed music tracks + synthesized sound effects ============ */
const MUSIC_URL={};
function prepMusic(){const data=J('music-data');for(const k in data){const bin=atob(data[k]);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);MUSIC_URL[k]=URL.createObjectURL(new Blob([u],{type:'audio/mpeg'}));}}
const VOICES={'Papá':[245,'square',.016],'Mamá':[440,'sine',.04],'Little Juno':[900,'triangle',.028],'Juno':[520,'square',.016],'Kit':[690,'triangle',.03],'Hermana Lupe':[360,'sine',.04],'Doña Chayo':[430,'triangle',.03],'Don Beto':[230,'square',.014],'Rubén':[300,'square',.014],
  'Tavo':[760,'triangle',.028],'Abuelo Nacho':[205,'sine',.045],'Doña Fina':[470,'triangle',.028],'Memo':[260,'square',.014],'Nina':[840,'triangle',.028],'Abuela Toña':[330,'sine',.04]};
const STEPS={asphalt:['bandpass',1500,1.2,.035,.05],asphalt_crack:['bandpass',1400,1.2,.035,.05],asphalt_line:['bandpass',1500,1.2,.035,.05],lot:['bandpass',1500,1.2,.035,.05],lot_stripe:['bandpass',1500,1.2,.035,.05],
  sidewalk:['bandpass',2500,1.4,.03,.045],drain:['bandpass',2300,1.4,.032,.05],floor:['bandpass',2300,1.4,.03,.04],caliche:['lowpass',950,.7,.06,.055],caliche2:['lowpass',900,.7,.06,.055],dirtpath:['lowpass',800,.7,.065,.055],
  gravel:['highpass',1700,.7,.04,.04,1],sand:['lowpass',520,.6,.09,.04],deadgrass:['bandpass',3000,.8,.05,.03,1],mud:['lowpass',600,.7,.07,.05]};
const AU={ctx:null,started:false,want:'none',tr:{},
  init(){if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    try{const c=this.ctx=new C();this.m=c.createGain();this.m.connect(c.destination);this.sfx=c.createGain();this.sfx.connect(this.m);this.mus=c.createGain();this.mus.connect(this.m);this.applyVol();
      const n=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.wn=n;
      const bn=c.createBuffer(1,c.sampleRate*2,c.sampleRate),bd=bn.getChannelData(0);let b=0;for(let i=0;i<bd.length;i++){b=(b+0.02*(Math.random()*2-1))/1.02;bd[i]=b*3.5;}
      const src=c.createBufferSource();src.buffer=bn;src.loop=true;const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=420;this.wind=c.createGain();this.wind.gain.value=0.05;src.connect(lp);lp.connect(this.wind);this.wind.connect(this.sfx);src.start();
      for(const k in MUSIC_URL){const el=new Audio(MUSIC_URL[k]);el.loop=true;el.preload='auto';const s=c.createMediaElementSource(el),g=c.createGain();g.gain.value=0;s.connect(g);g.connect(this.mus);this.tr[k]={el,g,to:0};
        el.play().then(()=>{if(this.want!==k)el.pause();}).catch(()=>{});}
      this.started=true;setInterval(()=>this.amb(),380);this.music(this.want);}catch(e){console.warn('audio',e);this.ctx=null;}},
  applyVol(){if(!this.ctx)return;this.sfx.gain.value=SET.mute?0:0.9;this.mus.gain.value=SET.music===false?0:0.16;},
  setMute(){this.applyVol();},
  music(k){this.want=k;if(!this.ctx)return;const now=this.ctx.currentTime;
    for(const name in this.tr){const t=this.tr[name];t.g.gain.cancelScheduledValues(now);t.g.gain.setValueAtTime(t.g.gain.value,now);
      if(name===k){clearTimeout(t.to);if(t.el.paused){if(name==='combat')t.el.currentTime=0;t.el.play().catch(()=>{});}t.g.gain.linearRampToValueAtTime(1,now+0.9);}
      else{t.g.gain.linearRampToValueAtTime(0,now+0.7);clearTimeout(t.to);t.to=setTimeout(()=>{if(this.want!==name)t.el.pause();},900);}}},
  out(pan){if(pan&&this.ctx.createStereoPanner){const p=this.ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);p.connect(this.sfx);return p;}return this.sfx;},
  tone(type,f0,f1,dur,vol,o={}){const c=this.ctx;if(!c)return null;const t=c.currentTime+(o.delay||0),os=c.createOscillator(),g=c.createGain();os.type=type;os.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+(o.a||0.005));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    let node=os;if(o.lp){const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;os.connect(f);node=f;}node.connect(g);g.connect(o.dest||this.out(o.pan));os.start(t);os.stop(t+dur+0.05);return os;},
  noise(dur,vol,o={}){const c=this.ctx;if(!c)return;const t=c.currentTime+(o.delay||0),s=c.createBufferSource();s.buffer=this.wn;const f=c.createBiquadFilter();f.type=o.type||'lowpass';f.frequency.setValueAtTime(o.f||1000,t);
    if(o.f1)f.frequency.exponentialRampToValueAtTime(o.f1,t+dur);f.Q.value=o.q||0.7;const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+(o.a||0.003));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    s.connect(f);f.connect(g);g.connect(o.dest||this.out(o.pan));s.start(t,Math.random()*1.5);s.stop(t+dur+0.05);},
  metal(base,vol,dur){[1,2.27,3.81,5.24,6.71].forEach((r,i)=>this.tone('sine',base*r,base*r*0.995,dur*(1-i*0.12),vol/(1+i*0.6)));this.noise(0.02,vol*1.2,{type:'highpass',f:4000});},
  /* interface */
  blip(){this.tone('triangle',660,660,0.04,0.035);this.tone('triangle',990,990,0.05,0.03,{delay:0.03});},
  tick(){this.tone('triangle',1250,1250,0.02,0.012);},
  back(){this.tone('triangle',660,440,0.07,0.03);},
  open(){this.tone('triangle',520,520,0.05,0.03);this.tone('triangle',780,780,0.07,0.03,{delay:0.05});},
  close(){this.tone('triangle',780,780,0.05,0.03);this.tone('triangle',520,520,0.07,0.03,{delay:0.05});},
  page(){this.noise(0.16,0.07,{type:'bandpass',f:2400,q:0.8});this.noise(0.08,0.05,{type:'bandpass',f:3600,q:1,delay:0.12});},
  coin(){this.tone('square',988,988,0.07,0.025,{lp:3000});this.tone('square',1319,1319,0.14,0.025,{delay:0.07,lp:3000});},
  chime(){[784,988,1175].forEach((f,i)=>this.tone('triangle',f,f,0.35,0.03,{delay:i*0.09}));},
  save(){this.tone('sine',660,660,0.2,0.04);this.tone('sine',880,880,0.3,0.04,{delay:0.12});},
  voice(name){const v=VOICES[name];if(!v){this.noise(0.022,0.012,{type:'bandpass',f:1700,q:1.2});return;}const f=v[0]*(1+(Math.random()-0.5)*0.12);this.tone(v[1],f,f*0.93,0.055,v[2]);},
  /* world */
  step(tile){const p=STEPS[tile]||STEPS.caliche;this.noise(p[3],p[4]*(0.8+Math.random()*0.4),{type:p[0],f:p[1]*(0.9+Math.random()*0.2),q:p[2]});if(p[5])this.noise(p[3]*0.8,p[4]*0.6,{type:p[0],f:p[1]*1.3,q:p[2],delay:0.035});},
  pour(){for(let i=0;i<7;i++)this.noise(0.08,0.06,{type:'lowpass',f:500+Math.random()*500,q:4,delay:i*0.075});this.noise(0.6,0.025,{type:'bandpass',f:1400,q:0.6});},
  splash(){this.noise(0.3,0.08,{type:'lowpass',f:1800,f1:500});this.tone('sine',420,180,0.12,0.03,{delay:0.05});},
  creak(){this.tone('sawtooth',95,62,0.55,0.035,{lp:650});this.noise(0.4,0.03,{type:'bandpass',f:300,q:2});},
  goat(v=0.06,pan=0){const c=this.ctx;if(!c)return;const t=c.currentTime,o=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),am=c.createOscillator(),amg=c.createGain(),tg=c.createGain(),g=c.createGain(),bp=c.createBiquadFilter();
    const f=360+Math.random()*110,len=0.5+Math.random()*0.25;o.type='sawtooth';o.frequency.setValueAtTime(f,t);o.frequency.linearRampToValueAtTime(f*0.85,t+len);lfo.frequency.value=6;lg.gain.value=12;lfo.connect(lg);lg.connect(o.frequency);
    am.frequency.value=10+Math.random()*4;amg.gain.value=0.45;tg.gain.value=0.55;am.connect(amg);amg.connect(tg.gain);bp.type='bandpass';bp.frequency.value=1150;bp.Q.value=2.2;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.04);g.gain.setValueAtTime(v,t+len*0.7);g.gain.exponentialRampToValueAtTime(0.0001,t+len);
    o.connect(bp);bp.connect(tg);tg.connect(g);g.connect(this.out(pan));[o,lfo,am].forEach(x=>{x.start(t);x.stop(t+len+0.05);});},
  chicken(v=0.04,pan=0){const n=2+Math.floor(Math.random()*2);for(let i=0;i<n;i++){const f=820+Math.random()*160;this.tone('square',f,f*0.72,0.06,v,{delay:i*0.1,lp:2200,pan});}},
  growl(){this.tone('sawtooth',105,90,0.45,0.05,{lp:520});this.noise(0.45,0.04,{type:'lowpass',f:400,q:3});},
  yelp(){this.tone('sine',1100,1550,0.1,0.05);this.tone('sine',1500,800,0.18,0.05,{delay:0.1});this.tone('sine',1300,700,0.16,0.03,{delay:0.36});},
  howl(v=0.025){const c=this.ctx;if(!c)return;const t=c.currentTime,o=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),g=c.createGain(),lp=c.createBiquadFilter();
    o.type='sine';o.frequency.setValueAtTime(520,t);o.frequency.linearRampToValueAtTime(840,t+0.8);o.frequency.linearRampToValueAtTime(800,t+1.6);o.frequency.linearRampToValueAtTime(560,t+2.6);
    lfo.frequency.value=5;lg.gain.value=9;lfo.connect(lg);lg.connect(o.frequency);lp.type='lowpass';lp.frequency.value=1400;
    g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.5);g.gain.linearRampToValueAtTime(v*0.8,t+2);g.gain.exponentialRampToValueAtTime(0.0001,t+2.8);o.connect(lp);lp.connect(g);g.connect(this.out((Math.random()-0.5)*1.4));
    [o,lfo].forEach(x=>{x.start(t);x.stop(t+2.9);});},
  servo(){this.tone('sawtooth',160,420,0.32,0.035,{lp:1100});this.tone('sawtooth',168,440,0.32,0.03,{lp:1100});},
  beep(){this.tone('square',1320,1320,0.05,0.02,{lp:4000});this.tone('square',990,990,0.06,0.02,{delay:0.08,lp:4000});},
  zap(){this.noise(0.28,0.07,{type:'highpass',f:2800});for(let i=0;i<4;i++)this.tone('square',60+Math.random()*90,40,0.06,0.03,{delay:i*0.06,lp:1800});},
  crash(){this.noise(0.6,0.16,{type:'lowpass',f:2600,f1:400});this.metal(310,0.05,0.7);},
  powerDown(){this.tone('sawtooth',420,38,0.95,0.04,{lp:900});this.beep();},
  drone(){const c=this.ctx;if(!c)return;const t=c.currentTime,o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(48,t);o.frequency.linearRampToValueAtTime(41,t+14);
    f.type='lowpass';f.frequency.value=240;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.11,t+4);g.gain.linearRampToValueAtTime(0.0001,t+15);o.connect(f);f.connect(g);g.connect(this.sfx);o.start(t);o.stop(t+15.5);
    this.noise(14,0.04,{type:'lowpass',f:300,a:3});},
  /* combat */
  battleStart(){this.noise(0.5,0.1,{type:'bandpass',f:300,f1:4200,q:0.8});this.tone('sine',62,38,0.7,0.2);[220,277,330].forEach(f=>this.tone('square',f,f,0.32,0.022,{delay:0.42,lp:2400}));},
  whoosh(){this.noise(0.17,0.06,{type:'bandpass',f:500,f1:2600,q:1.1});},
  thud(){this.tone('sine',150,55,0.17,0.14);this.noise(0.08,0.07,{type:'lowpass',f:420});},
  clang(){this.metal(520,0.05,0.75);},
  hit(){this.thud();},
  twang(){this.tone('triangle',540,300,0.22,0.05);this.noise(0.04,0.03,{type:'highpass',f:3000});this.noise(0.22,0.025,{type:'bandpass',f:2200,f1:900,q:3,delay:0.05});},
  parry(){this.metal(880,0.06,0.9);this.tone('triangle',1800,2600,0.25,0.04);},
  brace(){this.noise(0.12,0.05,{type:'lowpass',f:1200});this.tone('sine',90,70,0.12,0.06,{delay:0.04});},
  gulp(){this.tone('sine',260,160,0.09,0.05);this.tone('sine',240,150,0.09,0.05,{delay:0.16});},
  heal(){this.tone('sine',440,880,0.3,0.04);this.tone('triangle',660,1320,0.3,0.025,{delay:0.08});},
  hurt(){this.noise(0.18,0.1,{type:'lowpass',f:700});this.tone('sawtooth',130,50,0.22,0.03);},
  brk(){this.crash();this.zap();},
  ko(){this.tone('sine',200,40,0.6,0.1);this.noise(0.4,0.05,{type:'lowpass',f:300});},
  turn(){this.tone('triangle',880,880,0.05,0.018);this.tone('triangle',1320,1320,0.07,0.015,{delay:0.05});},
  victory(){[523.25,659.25,783.99,1046.5].forEach((f,i)=>this.tone('triangle',f,f,i===3?0.6:0.22,0.045,{delay:i*0.11}));},
  win(){this.victory();},
  env(type,f,d,v,slide){this.tone(type,f,slide||f,d,v);},
  /* ambience, ticked a few times a second */
  timers:{goat:4,chick:3,pancha:2,howl:40},
  amb(){if(!this.ctx||!ST)return;const ph=phaseOf(ST.clock),day=ph==='Day';this.wind.gain.value=day?0.1:0.045;
    if(mode==='battle'||mode==='loading')return;const T=this.timers;for(const k in T)T[k]-=0.38;
    if(!day&&Math.random()<0.5){const t=this.ctx.currentTime;for(let k=0;k<3;k++){const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=4300+Math.random()*300;const s=t+k*0.07;
      g.gain.setValueAtTime(0.0001,s);g.gain.linearRampToValueAtTime(0.008,s+0.01);g.gain.linearRampToValueAtTime(0.0001,s+0.04);o.connect(g);g.connect(this.sfx);o.start(s);o.stop(s+0.05);}}
    if(!P)return;
    let fd=99;chunks.forEach(C=>(C.fires||[]).forEach(f=>{fd=Math.min(fd,Math.hypot(f[0]-P.x,f[1]-P.z));}));
    if(fd<7){const v=0.06*(1-fd/7);const n=Math.floor(Math.random()*3);for(let i=0;i<n;i++)this.noise(0.015,v,{type:'bandpass',f:2400+Math.random()*2400,q:2,delay:Math.random()*0.3});}
    const near=(kind,r)=>{let best=null,bd=r;ANIMALS.forEach(o=>{if(o.a.kind!==kind)return;const d=Math.hypot(o.a.x-P.x,o.a.z-P.z);if(d<bd){bd=d;best=o.a;}});return best?[best,bd]:null;};
    if(T.goat<=0){T.goat=5+Math.random()*9;const g=near('goat',11);if(g)this.goat(0.012+0.05*(1-g[1]/11),(g[0].x-P.x)/8);}
    if(T.chick<=0){T.chick=4+Math.random()*6;const c=near('chicken',8);if(c)this.chicken(0.01+0.035*(1-c[1]/8),(c[0].x-P.x)/8);}
    if(T.pancha<=0){T.pancha=4+Math.random()*3;if(PANCHA.visible&&ST.step==='pancha'&&!ST.flags.drainDone){const d=Math.hypot(PANCHA.x-P.x,PANCHA.z-P.z);if(d<26)this.goat(0.015+0.06*(1-d/26),(PANCHA.x-P.x)/10);}}
    if(T.howl<=0){T.howl=70+Math.random()*60;if(!day)this.howl();}}};
document.addEventListener('visibilitychange',()=>{if(!AU.ctx)return;if(document.hidden)AU.ctx.suspend();else AU.ctx.resume();});

