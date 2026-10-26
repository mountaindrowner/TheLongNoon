/* ============ boot ============ */
async function boot(){layout();prog(0.04,'Reading the asset manifest');await nextFrame();
  const names=Object.keys(MAN.images);let i=0;
  for(const n of names){const img=new Image();img.src=MAN.images[n];try{await img.decode();}catch(e){await new Promise(r=>{img.onload=r;img.onerror=r;});}IMG[n]=img;i++;prog(0.04+0.36*i/names.length,`Decoding sprite sheets (${i} of ${names.length})`);await nextFrame();}
  TEX.chars=atlasTex(IMG.chars);TEX.props=atlasTex(IMG.props);
  prog(0.42,'Loading music');await nextFrame();try{prepMusic();}catch(e){console.warn(e);}
  prog(0.44,'Loading fonts');try{await Promise.race([Promise.all(['24px VT323','24px "Permanent Marker"','24px Caveat'].map(f=>document.fonts.load(f))),sleep(2500)]);}catch(e){}
  prog(0.55,'Reading map, dialogue and mission data');await nextFrame();
  initBlob();initWorldMats();partition();initActors();paintIcons();
  ST=newState();applyState();envAt(ST.clock);applyQuality();
  prog(0.68,'Building Mar Farm');await nextFrame();
  CAM.override={t:V3(12.5,1.2,30.5),o:V3(0,7.8,16),k:4};updateCam(0,true);streamChunks(CAM.look.x,CAM.look.z,true);
  prog(0.88,'Warming up shaders');await nextFrame();renderer.compile(scene,camera);buildArena('drain');ARENA.scene.add(P.grp);renderer.compile(ARENA.scene,camera);ARENA.scene.remove(P.grp);scene.add(P.grp);render();
  prog(1,'Ready');await sleep(250);$('#loading').hidden=true;showTitle();requestAnimationFrame(loop);
  if(DEBUG)window.__LN={get ST(){return ST},get mode(){return mode},P,NPC,PANCHA,chunks,setStep,runScript,DLG,save,loadGame,tp:(x,z)=>{P.place(x,z);resetTrail();updateCam(0,true);streamChunks(x,z,true);},
    setClock:m=>{ST.clock=m;}};}
boot().catch(e=>{console.error(e);prog(1,'Something went wrong while loading: '+e.message);});
})();

