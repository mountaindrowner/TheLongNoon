/* ============ actors ============ */
class Actor{
  constructor(kind,frames){this.kind=kind;this.isChar=!!MAN.characters[kind];this.frames=frames||null;
    const f0=this.isChar?null:MAN.frames[frames[0]];this.fw=this.isChar?16:f0.w;this.fh=this.isChar?24:f0.h;
    this.geo=new THREE.PlaneGeometry(this.fw/PPU,this.fh/PPU);this.geo.translate(0,this.fh/PPU/2,0);
    this.mat=spriteMat(TEX.chars);this.mesh=new THREE.Mesh(this.geo,this.mat);this.mesh.rotation.x=TILT;this.mesh.castShadow=true;this.mesh.customDepthMaterial=DEPTH.chars;
    this.shadow=new THREE.Mesh(BLOB.geo,BLOB.mat);this.shadow.position.y=0.02;this.shadow.scale.setScalar(Math.max(0.7,this.fw/PPU*0.7));
    this.grp=new THREE.Group();this.grp.add(this.mesh,this.shadow);scene.add(this.grp);
    this.x=0;this.z=0;this.y=0;this.dir='down';this.moving=false;this.t=0;this.flip=false;this.key='';this.override=null;this.flashT=0;this.anim=false;this.fps=6;this.setFrame();}
  place(x,z){this.x=x;this.z=z;this.sync();return this;}
  sync(){this.grp.position.set(this.x,this.y,this.z);}
  setFrame(){let k,fr;
    if(this.isChar){const row=DIRS.indexOf(this.dir),col=this.moving?WALK[Math.floor(this.t*7)%4]:0;k=row*3+col;if(k===this.key)return;const b=MAN.frames[this.kind];fr={x:b.x+col*16,y:b.y+row*24,w:16,h:24};setUV(this.geo,fr,IMG.chars,false);}
    else{const name=this.override||this.frames[(this.moving||this.anim)?Math.floor(this.t*this.fps)%this.frames.length:0];k=name+(this.flip?'|f':'');if(k===this.key)return;setUV(this.geo,MAN.frames[name],IMG.chars,this.flip);}
    this.key=k;}
  update(dt){this.t+=dt;if(this.flashT>0){this.flashT-=dt;this.mat.userData.flashing=true;this.mat.emissiveIntensity=2.2;if(this.flashT<=0){this.mat.userData.flashing=false;this.mat.emissiveIntensity=ENV.em;}}this.setFrame();this.sync();}
  face(tx,tz){const dx=tx-this.x,dz=tz-this.z;if(this.isChar)this.dir=Math.abs(dx)>Math.abs(dz)?(dx>0?'right':'left'):(dz>0?'down':'up');else this.flip=dx>0;}
  flash(){this.flashT=0.13;}
  set visible(v){this.grp.visible=v;}get visible(){return this.grp.visible;}
  dispose(){scene.remove(this.grp);this.geo.dispose();this.mat.dispose();const i=SPRITE_MATS.indexOf(this.mat);if(i>=0)SPRITE_MATS.splice(i,1);}
}

