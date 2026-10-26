/* ============ camera ============ */
const CAM={look:V3(0,0,0),override:null,off:V3(0,12.5,15.5)};const _t=V3(0,0,0),_c=V3(0,0,0);
function camGoal(){if(CAM.override)return[CAM.override.t,CAM.override.o,CAM.override.k||2.5];return[_t.set(P.x,0.8,P.z-0.4),CAM.off,6];}
function updateCam(dt,snap){const [t,o,k]=camGoal();const a=snap?1:1-Math.exp(-dt*k);CAM.look.lerp(t,a);_c.copy(CAM.look).add(o);camera.position.lerp(_c,a);camera.lookAt(CAM.look);}

