/* ============ menus: title, pause, card ============ */
function showTitle(){setMode('title');if(!AU.started){$('#title').classList.add('gate');$('#tapstart').hidden=false;}else{$('#tapstart').hidden=true;AU.music('intro');}ST=newState();applyState();envAt(ST.clock);$('#title').hidden=false;$('#card').hidden=true;$('#pause').hidden=true;$('#book').hidden=true;$('#battle').hidden=true;dlgEl.hidden=true;
  DR.on=false;DRONE.visible=false;let has=false;try{has=!!localStorage.getItem(SAVE_KEY);}catch(e){}
  $('#tmenu [data-a=continue]').hidden=!has;$('#tmenu [data-a=full]').hidden=!(isTouch&&document.documentElement.requestFullscreen);titleT=0;
  setTimeout(()=>{const b=$('#tmenu button:not([hidden])');b&&b.focus({preventScroll:true});},60);}
function ungate(e){const t=$('#title');if(!t.classList.contains('gate')||mode!=='title')return;AU.init();AU.music('intro');t.classList.remove('gate');$('#tapstart').hidden=true;AU.open();
  if(e&&e.type==='keydown')e.stopPropagation();setTimeout(()=>{const b=$('#tmenu button:not([hidden])');b&&b.focus({preventScroll:true});},30);}
addEventListener('pointerdown',ungate,true);addEventListener('keydown',ungate,true);
$('#tmenu').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||mode!=='title')return;AU.init();AU.blip();const a=b.dataset.a;
  if(a==='full'){try{await document.documentElement.requestFullscreen();if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape');}catch(err){}setTimeout(layout,350);return;}
  $('#title').hidden=true;b.blur();
  if(a==='new'){setMode('script');await fadeTo(1,700);ST=newState();applyState();await runIntro();AU.music('explore');ST=newState();applyState();envAt(ST.clock);CAM.override={t:V3(5.2,1,31.8),o:V3(1.6,6.4,10.2),k:1.6};updateCam(0,true);streamChunks(CAM.look.x,CAM.look.z,true);
    await fadeTo(0,1100);await runScript(DLG.burial);CAM.override=null;}
  if(a==='continue'){AU.music('explore');await fadeTo(1,400);loadGame();await fadeTo(0,600);}});
function syncPauseLabels(){const m=$('#pmenu');m.querySelector('[data-a=fps]').textContent='Frame counter: '+(SET.showFps?'on':'off');
  m.querySelector('[data-a=quality]').textContent='Graphics: '+({high:'high (shadows, blur, glow)',medium:'medium (color grading)',low:'low (fastest)'}[SET.quality]||SET.quality);
  m.querySelector('[data-a=chunks]').textContent='Show world chunks: '+(SET.chunks?'on':'off');m.querySelector('[data-a=mute]').textContent='Sound effects: '+(SET.mute?'off':'on');m.querySelector('[data-a=music]').textContent='Music: '+(SET.music===false?'off':'on');}
function renderPauseSide(){const pp=[`<p>Juno  ${ST.party.juno.hp}/42  ${ST.party.juno.dur>0?'Pipe '+ST.party.juno.dur+'/12':'Bent pipe'}</p>`];if(ST.joined.includes('kit'))pp.push(`<p>Kit  ${ST.party.kit.hp}/26  Sling</p>`);
  $('#pParty').innerHTML=pp.join('');const it=Object.entries(ST.items).filter(([k,n])=>n>0).map(([k,n])=>`<p>${esc(ITEM_NAMES[k]||k)}${n>1?' ×'+n:''}</p>`);
  it.push(`<p>Water ${ST.water}/10   White ${ST.white} tins</p>`);$('#pItems').innerHTML=it.join('');}
function openPause(){AU.open();setMode('menu');$('#pause').hidden=false;syncPauseLabels();renderPauseSide();$('#pmenu button').focus({preventScroll:true});}
function closePause(){AU.close();$('#pause').hidden=true;setMode('explore');}
$('#pmenu').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;AU.blip();const a=b.dataset.a;
  if(a==='resume')closePause();else if(a==='book'){$('#pause').hidden=true;setMode('explore');openBook();}
  else if(a==='save')save(false);else if(a==='load'){$('#pause').hidden=true;loadGame();}
  else if(a==='fps'){SET.showFps=!SET.showFps;saveSettings();syncPauseLabels();}
  else if(a==='quality'){SET.quality={high:'medium',medium:'low',low:'high'}[SET.quality]||'medium';saveSettings();applyQuality();syncPauseLabels();}
  else if(a==='chunks'){SET.chunks=!SET.chunks;saveSettings();refreshChunkLines();syncPauseLabels();}
  else if(a==='mute'){SET.mute=!SET.mute;saveSettings();AU.applyVol();syncPauseLabels();}
  else if(a==='music'){SET.music=SET.music===false;saveSettings();AU.applyVol();syncPauseLabels();}
  else if(a==='title'){$('#pause').hidden=true;showTitle();}});
$('#card .menu').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;AU.blip();const a=b.dataset.a;
  if(a==='read'){renderPage('last',true);$('#book').hidden=false;bookRes=()=>{const n=$('#card [data-a=explore]');n&&n.focus();};$('#bkClose').focus();}
  else if(a==='explore'){$('#card').hidden=true;continueAfterEnding();}
  else if(a==='title'){$('#card').hidden=true;continueAfterEnding();showTitle();}});

