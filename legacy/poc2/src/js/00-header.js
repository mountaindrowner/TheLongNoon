
'use strict';
(function(){
if(!window.THREE){document.getElementById('loadtxt').textContent='The 3D engine (three.js) did not load. Check your connection and reload.';return;}
const $=s=>document.querySelector(s);
const J=id=>JSON.parse(document.getElementById(id).textContent);
const MAN=J('asset-manifest'),MAP=J('data-map'),DLG=J('data-dialogue'),QST=J('data-quests'),PAGES=J('data-pages'),BAT=J('data-battles');
const DEBUG=location.hash==='#debug';
const isTouch=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window);
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a),ri=(a,b)=>Math.floor(rnd(a,b+1));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const nextFrame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
const easeOut=t=>1-(1-t)*(1-t);
function hash2(x,z){let h=Math.imul(x|0,374761393)+Math.imul(z|0,668265263)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const SAVE_KEY='longnoon.poc2.save',SET_KEY='longnoon.poc2.settings';
const SET={showFps:true,quality:isTouch?'medium':'high',chunks:false,mute:false};
try{Object.assign(SET,JSON.parse(localStorage.getItem(SET_KEY)||'{}'));}catch(e){}
const saveSettings=()=>{try{localStorage.setItem(SET_KEY,JSON.stringify(SET));}catch(e){}};
const loadBar=$('#loadbar i'),loadTxt=$('#loadtxt');
const prog=(p,t)=>{loadBar.style.width=(p*100)+'%';if(t)loadTxt.textContent=t;};

