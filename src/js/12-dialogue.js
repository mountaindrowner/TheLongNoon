/* ============ dialogue ============ */
const dlgEl=$('#dialog'),nameEl=dlgEl.querySelector('.name'),txtEl=dlgEl.querySelector('.text'),choicesEl=dlgEl.querySelector('.choices');
const PORTRAIT={'Papá':'elias','Mamá':'rosa','Little Juno':'kidjuno','Juno':'juno','Kit':'kit','Hermana Lupe':'lupe','Doña Chayo':'chayo','Don Beto':'beto','Rubén':'ruben','Tavo':'tavo','Abuelo Nacho':'nacho','Doña Fina':'fina','Memo':'memo','Nina':'nina','Abuela Toña':'tona'};
const ptEl=dlgEl.querySelector('.pt');let ptKey=null,ptTimer=0;
function setPortrait(name){ptKey=PORTRAIT[name]||null;dlgEl.classList.toggle('has-pt',!!ptKey);clearInterval(ptTimer);if(ptKey)iconCSS(ptEl,`pt_${ptKey}_0`,2.5);}
function talk(on){clearInterval(ptTimer);if(!ptKey)return;if(!on){iconCSS(ptEl,`pt_${ptKey}_0`,2.5);return;}let f=0;ptTimer=setInterval(()=>{f^=1;iconCSS(ptEl,`pt_${ptKey}_${f}`,2.5);},120);}
function say(name,text){return new Promise(res=>{dlgEl.hidden=false;dlgEl.classList.toggle('narr',!name);dlgEl.classList.remove('done');nameEl.textContent=name||'';choicesEl.innerHTML='';
  setPortrait(name);if(!DEBUG&&text.length>3)talk(true);
  let i=0,done=false,tm=0;txtEl.textContent='';
  const finish=()=>{done=true;clearTimeout(tm);txtEl.textContent=text;dlgEl.classList.add('done');talk(false);};
  const step=()=>{if(done)return;i++;txtEl.textContent=text.slice(0,i);if(i%2===0&&text[i-1]!==' ')AU.voice(name);if(i>=text.length)finish();else tm=setTimeout(step,text[i-1]==='.'||text[i-1]==='?'?110:22);};
  if(DEBUG)finish();else tm=setTimeout(step,60);
  aWaiter=()=>{if(!done){finish();return;}aWaiter=null;AU.blip();res();};});}
function choice(q,opts){return new Promise(res=>{setPortrait(null);dlgEl.hidden=false;dlgEl.classList.add('narr','done');nameEl.textContent='';txtEl.textContent=q;choicesEl.innerHTML='';
  opts.forEach(([label,cmds])=>{const b=document.createElement('button');b.textContent=label;b.onclick=e=>{e.stopPropagation();choicesEl.innerHTML='';AU.blip();res(cmds);};choicesEl.appendChild(b);});
  choicesEl.firstChild.focus();});}
function cond(k){return k.split('&').every(tok=>{if(tok[0]==='!')return !ST.flags[tok.slice(1)];if(QST.steps[tok])return ST.step===tok;return !!ST.flags[tok];});}
function resolveDlg(id){const d=DLG[id];if(!d)return null;if(Array.isArray(d))return d;for(const k in d){if(k!=='*'&&cond(k))return d[k];}return d['*']||null;}
let scriptDepth=0;
async function runScript(lines){if(!lines)return;scriptDepth++;if(mode==='explore')setMode('script');
  try{for(const l of lines){if(CINE.abort)break;if(Array.isArray(l))await say(l[0],l[1]);else await doCmd(l);}}
  finally{scriptDepth--;if(scriptDepth===0){dlgEl.hidden=true;if(mode==='script')setMode('explore');}}}
async function doCmd(c){switch(c.do){
  case 'wait':await sleep(c.ms);break;
  case 'item':addItem(c.id,c.n);toast(c.n>1?`${ITEM_NAMES[c.id]} ×${c.n}`:`Got ${ITEM_NAMES[c.id].toLowerCase()}`,'gold');AU.coin();break;
  case 'take':ST.items[c.id]=Math.max(0,(ST.items[c.id]||0)-c.n);break;
  case 'white':ST.white+=c.add;toast(`+${c.add} tins of white`,'gold');AU.coin();updateHUD(true);break;
  case 'water':ST.water=c.set!=null?c.set:Math.min(10,ST.water+c.add);toast(c.set!=null?'Water topped off':`+${c.add} water`);AU.pour();updateHUD(true);break;
  case 'page':await unlockPage(String(c.n));break;
  case 'step':setStep(c.to);break;
  case 'flag':ST.flags[c.f]=true;break;
  case 'sfx':AU[c.s]&&AU[c.s]();break;
  case 'checkHome':if(ST.flags.fed&&ST.flags.tank)await runScript(DLG.homeDone);break;
  case 'hint':toast(isTouch?'Drag on the left to walk. Tap A to talk.':'Walk with WASD or the arrows. E or Space to talk. B opens the staybook.',null,6000);break;
  case 'choice':{const cmds=await choice(c.q,c.opts);dlgEl.hidden=true;await runScript(cmds);break;}
  case 'rest':await rest(false);break;
  case 'ending':await ending();break;
  case 'cam':CAM.override={t:V3(c.x,0.9,c.z),o:V3(0,9,12.5),k:2.2};break;
  case 'spawnEnemies':await spawnEnemies(c.id);break;
  case 'battle':{const r=await battle(c.id);if(r==='win')await runScript(DLG.drainWin);break;}
  case 'join':{ST.joined.push(c.who);NPC[c.who].follower=true;resetTrail();toast('Kit joined the party','gold');AU.coin();break;}
  case 'salvage':addItem('scrap',4);addItem('cell',1);addItem('bearings',6);toast('Stripped the Stray: scrap ×4, dead cell, bearings ×6');await sleep(400);break;
  case 'lookUp':await lookUp();break;
  case 'tale':taleSet(c.p);AU.page();break;
  case 'waitDrone':while(DR.on&&DRONE.position.x<95)await sleep(100);break;
}}
function toast(t,cls,ms=2600){const d=document.createElement('div');d.className='toast'+(cls?' '+cls:'');d.textContent=t;$('#toasts').appendChild(d);setTimeout(()=>d.remove(),ms);}
function fadeTo(v,ms=600,color='#000'){const f=$('#fade');f.style.background=color;f.style.transition=`opacity ${ms}ms`;f.style.opacity=v;return sleep(ms);}

