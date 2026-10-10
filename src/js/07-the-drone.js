/* ============ the drone (NIMBUS-3) ============ */
let DSHADOW_=null;const DRONE=new THREE.Group();(function(){
  const wM=new THREE.MeshBasicMaterial({color:0x3a3d46,fog:false}),pM=new THREE.MeshBasicMaterial({color:0x1d2433,fog:false}),dM=new THREE.MeshBasicMaterial({color:0x2a2c33,fog:false});
  const add=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);DRONE.add(o);};
  add(3.4,0.35,60,0,0,0,wM);add(2.9,0.06,58,0.1,0.2,0,pM);
  for(const z of[-21,-7,7,21]){add(3.6,1.1,0.9,-0.4,-0.7,z,dM);add(0.3,1.6,0.08,-2.3,-0.3,z,dM);}
  add(5.2,1.5,2.2,-0.6,-0.9,0,wM);add(9,0.3,0.3,-4.5,-0.5,-6,dM);add(9,0.3,0.3,-4.5,-0.5,6,dM);add(1.4,0.2,13,-9,-0.4,0,wM);
  add(3.6,0.12,60.4,0.2,-0.05,0,new THREE.MeshBasicMaterial({color:0x8a8e98,fog:false}));
  DRONE.visible=false;scene.add(DRONE);
  const sc=document.createElement('canvas');sc.width=16;sc.height=64;const x=sc.getContext('2d');const g=x.createLinearGradient(0,0,16,0);g.addColorStop(0,'rgba(30,26,40,0)');g.addColorStop(.5,'rgba(30,26,40,.55)');g.addColorStop(1,'rgba(30,26,40,0)');x.fillStyle=g;x.fillRect(0,0,16,64);
  DSHADOW_=new THREE.Mesh(new THREE.PlaneGeometry(5,60),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));DSHADOW_.rotation.x=-Math.PI/2;DSHADOW_.position.y=0.05;DSHADOW_.visible=false;scene.add(DSHADOW_);})();
const DSHADOW=DSHADOW_;
const DR={on:false,t:0};

