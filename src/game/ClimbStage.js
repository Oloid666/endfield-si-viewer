import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';

// Shares the viewer's scene, camera, character and render loop. The patrol is an
// original low-poly placeholder, not a claimed reproduction of the official pet.
export class ClimbStage {
  constructor(scene, cameraController, models, config, actor=null) {
    this.scene = scene; this.camera = cameraController; this.models = models; this.config = config;
    this.actor=actor;
    this.root = new Group(); this.root.name = 'climb-prototype'; this.root.visible = false; scene.scene.add(this.root);
    this.geometries = []; this.materials = []; this.blockMeshes = new Map();
    const geometry = value => { this.geometries.push(value); return value; };
    const material = value => { const m = new MeshStandardMaterial(value); this.materials.push(m); return m; };
    this.boxGeometry = geometry(new BoxGeometry(.96,.96,1.3));
    this.fixedMaterial = material({color:0x465958,roughness:.85,metalness:.25});
    this.crateMaterial = material({color:0x90b79a,emissive:0x294638,emissiveIntensity:.4,roughness:.65});
    this.fragileMaterial = material({color:0xc19464,roughness:1});
    const dark = material({color:0x1b292b,roughness:.9}), glow = material({color:0xcce9b1,emissive:0xa7d58b,emissiveIntensity:.5});
    this.trimGeometry = geometry(new BoxGeometry(.78,.05,.035));
    this.trimMaterial = glow;
    // One waste surface with a bounded pool of bubbles; no fluid simulation.
    this.waste = new Mesh(geometry(new BoxGeometry(config.width+6,.16,7)),material({color:0xa6b642,emissive:0x647318,emissiveIntensity:.45,transparent:true,opacity:.82,roughness:.5}));
    this.waste.position.set(config.width/2,-1,.9);this.root.add(this.waste);
    const bubbleGeometry = geometry(new SphereGeometry(.13,8,6)), bubbleMaterial = material({color:0xd7e798,transparent:true,opacity:.65});
    this.bubbles = Array.from({length:10},(_,i)=>{const m=new Mesh(bubbleGeometry,bubbleMaterial);m.position.set(i*1.5-.5,0,1.2+(i%3)*.6);this.root.add(m);return m;});
    const back = new Mesh(geometry(new BoxGeometry(config.width+6,15,.3)),dark);back.position.set(config.width/2,5,-1.9);this.root.add(back);
    const railGeometry=geometry(new CylinderGeometry(.055,.055,13,6));
    for(const x of [-1,3.5,7.5,12.8]) { const rail=new Mesh(railGeometry,this.fixedMaterial);rail.position.set(x,5,-1.55);this.root.add(rail); }
    this.exit=new Group();this.exit.position.set(config.exit.x,config.exit.y,0);
    const door=new Mesh(geometry(new BoxGeometry(1.05,2,.12)),material({color:0x80b798,emissive:0x315f45,emissiveIntensity:.7}));door.position.set(0,1,-.65);this.exit.add(door);
    const arrow=new Mesh(geometry(new ConeGeometry(.21,.45,3)),glow);arrow.rotation.z=-Math.PI/2;arrow.position.set(.05,1.3,.15);this.exit.add(arrow);this.root.add(this.exit);
    this.enemy=new Group();this.enemy.name='bubble-patrol-placeholder';
    const sphere=geometry(new SphereGeometry(1,12,8));
    const body=new Mesh(sphere,material({color:0x84bdc5,metalness:.18,roughness:.55}));body.scale.set(.38,.28,.3);this.enemy.add(body);
    const finGeometry=geometry(new ConeGeometry(.17,.38,3));
    for(const side of [-1,1]){const fin=new Mesh(finGeometry,dark);fin.rotation.z=side*1.1;fin.position.set(side*.33,.02,0);this.enemy.add(fin);}
    const eye=new Mesh(sphere,glow);eye.scale.set(.12,.12,.06);eye.position.set(0,.05,.29);this.enemy.add(eye);
    this.ring=new Mesh(geometry(new TorusGeometry(.46,.025,5,24)),glow);this.enemy.add(this.ring);
    this.scanMaterial=material({color:0xe6bd68,emissive:0xb44e37,emissiveIntensity:.4,transparent:true,opacity:.18,depthWrite:false});
    this.scan=new Mesh(geometry(new ConeGeometry(.7,config.patrol.range,12,1,true)),this.scanMaterial);
    this.scan.rotation.z=-Math.PI/2;this.root.add(this.scan);this.root.add(this.enemy);
    this.target=new Vector3();this.lookAt=new Vector3();this.cameraOffset=new Vector3();
    this.active=false;
    if(actor)this.root.add(actor.root);
  }
  attach() {
    if(this.actor){
      this.currentPosition=new Vector3(this.config.start.x,this.config.start.y,0);this.facing=.55;this.animation=null;this.time=0;
      this.active=true;this.root.visible=true;this.camera.transition=null;this.camera.story=null;this.camera.stopShoeOrbit();
      this.camera.controls.enabled=false;this.scene.camera.near=.05;this.scene.camera.far=100;this.frameCamera(true);return true;
    }
    const model=this.models.current;
    if(!model?.idle?.supported)return false;
    if(this.model===model)return true;
    this.detach();this.model=model;const idle=model.idle;
    this.saved={position:model.group.position.clone(),quaternion:model.group.quaternion.clone(),scale:model.group.scale.clone(),playing:idle.playing};
    idle.stopGesture();idle.setPlaying(false);idle.update(3,this.scene.camera.position);idle.transition=null;
    idle.applyBody(null,0);idle.applyPose(idle.head,0,0,0);idle.setBlink(0);
    this.bones=idle.transitionBones.map(bone=>({bone,position:bone.position.clone(),quaternion:bone.quaternion.clone(),scale:bone.scale.clone()}));
    model.group.scale.setScalar(this.config.actorHeight/idle.height);model.group.quaternion.identity();
    this.currentPosition=new Vector3(this.config.start.x,this.config.start.y,0);
    this.facing=.55;this.animation=null;this.time=0;this.active=true;this.root.visible=true;
    this.camera.transition=null;this.camera.story=null;this.camera.stopShoeOrbit();
    this.camera.controls.enabled=false;this.scene.camera.near=.05;this.scene.camera.far=100;
    this.frameCamera(true);return true;
  }
  move(action, engine) {
    if(!this.active)return;
    this.animation=action?{...action,time:0}:null;
    if(!action)this.currentPosition.set(engine.player.x,engine.player.y,0);
  }
  frameCamera(immediate=false,delta=0) {
    if(!this.active)return;
    const canvas=this.scene.renderer.domElement,rect=canvas.getBoundingClientRect();
    const landscape=rect.width>rect.height;
    const top=landscape?120:(this.config.cameraTop??185),bottom=landscape?80:(this.config.cameraBottom??170);
    const available=Math.max(140,rect.height-top-bottom),visibleRatio=available/rect.height;
    // Track a small local section, not the entire tower; keep Si readable.
    const distance=Math.max(6.6/Math.max(.5,rect.width/available),5.7)/(2*Math.tan(this.scene.camera.fov*Math.PI/360)*visibleRatio);
    const p=this.currentPosition;
    this.target.set(Math.min(this.config.width-2.1,Math.max(2,p.x+1.3)),p.y+1.3,0);
    if(immediate)this.lookAt.copy(this.target);else this.lookAt.lerp(this.target,1-Math.exp(-delta*5));
    this.scene.camera.setViewOffset(rect.width,rect.height,0,(bottom-top)/2,rect.width,rect.height);
    this.scene.camera.position.copy(this.lookAt).add(this.cameraOffset.set(1.3,2.4,distance));
    this.scene.camera.lookAt(this.lookAt);this.scene.camera.updateProjectionMatrix();
  }
  update(engine,delta) {
    if(!this.active)return;
    const frozen=['paused','call'].includes(engine.state),dt=frozen?0:delta;
    this.time+=dt;const idle=this.model?.idle;
    let weight=0,kind='idle';
    if(this.animation){
      this.animation.time+=engine.state==='call'?delta:dt;const a=this.animation,t=Math.min(1,a.time/this.config.moveSeconds),e=t*t*(3-2*t);
      this.currentPosition.set(a.from.x+(a.to.x-a.from.x)*e,a.from.y+(a.to.y-a.from.y)*e,0);
      if(['climb','drop'].includes(a.kind))this.currentPosition.y+=Math.sin(t*Math.PI)*.28;
      weight=Math.sin(t*Math.PI);kind=a.kind;
      if(t===1)this.animation=null;
    }else this.currentPosition.set(engine.player.x,engine.player.y,0);
    const facing=engine.state==='call'?.3:engine.player.facing*Math.PI*.38;
    this.facing+=(facing-this.facing)*(1-Math.exp(-dt*14));
    if(this.actor)this.actor.update(this.currentPosition,this.facing,this.time,weight,kind,engine.state);
    else {
    this.model.group.rotation.set(0,this.facing,0);
    // The imported model's origin is not its center. Rotate and scale the saved
    // centering translation together with the wrapper before placing its feet.
    this.model.group.position.copy(this.saved.position).multiplyScalar(this.model.group.scale.x).applyQuaternion(this.model.group.quaternion)
      .add(this.target.set(this.currentPosition.x,this.currentPosition.y+this.config.actorHeight/2+.008*Math.sin(this.time*3),.3));
    for(const {bone,position,quaternion,scale} of this.bones){bone.position.copy(position);bone.quaternion.copy(quaternion);bone.scale.copy(scale);}
    const pushing=['push','pull'].includes(kind),climbing=kind==='climb';
    for(const {name,pose} of idle.body){
      const rest=idle.config.restBody[name]||[0,0,0];let pitch=0,roll=0;
      if(name==='spine')pitch=(pushing?.17:climbing?.14:.045)*weight;
      if(name==='thighL')pitch=.42*weight;if(name==='thighR')pitch=-.32*weight;
      if(name==='kneeL')pitch=.5*weight;if(name==='kneeR')pitch=.35*weight;
      if(name==='armL'){pitch=(pushing?-.6:climbing?-.9:-.18)*weight;roll=climbing?-.4*weight:0;}
      if(name==='armR'){pitch=(pushing?-.6:climbing?-.75:.18)*weight;roll=climbing?.4*weight:0;}
      if(name.startsWith('elbow'))pitch=(pushing?-.3:-.15)*weight;
      idle.applyPose(pose,rest[0]+pitch,rest[1],rest[2]+roll);
    }
    idle.setBlink(Math.max(0,1-Math.abs((this.time%4)-.1)/.1));
    }
    this.syncBlocks(engine);
    this.waste.position.y=engine.waste;
    this.waste.visible=this.config.wasteEnabled!==false;
    for(const b of this.bubbles)b.visible=this.waste.visible;
    for(let i=0;i<this.bubbles.length;i++){const b=this.bubbles[i];b.position.y=engine.waste+.12+((this.time*.28+i*.17)%1)*.5;b.scale.setScalar(.6+.4*Math.sin(this.time*2+i)**2);}
    const patrol=engine.patrol;this.enemy.position.set(patrol.x,patrol.y+1.15+Math.sin(this.time*3)*.12,.7);
    this.ring.rotation.z=this.time;this.enemy.visible=engine.called&&this.config.patrolEnabled!==false;
    this.scan.visible=this.enemy.visible&&patrol.phase!=='rest';
    this.scan.position.set(patrol.x+patrol.direction*this.config.patrol.range/2,patrol.y+.65,.35);
    this.scan.rotation.z=patrol.direction>0?-Math.PI/2:Math.PI/2;
    this.scanMaterial.color.set(patrol.phase==='scan'?0xf58268:0xf0d678);
    this.scanMaterial.opacity=patrol.phase==='scan'?.22:.08;
    this.frameCamera(false,dt);
  }
  syncBlocks(engine) {
    const ids=new Set(engine.blocks.map(b=>b.id));
    for(const [id,mesh] of this.blockMeshes)if(!ids.has(id)){this.root.remove(mesh);this.blockMeshes.delete(id);}
    for(const block of engine.blocks){
      let mesh=this.blockMeshes.get(block.id);
      if(!mesh){
        mesh=new Mesh(this.boxGeometry,block.kind==='crate'?this.crateMaterial:block.kind==='fragile'?this.fragileMaterial:this.fixedMaterial);
        if(block.kind==='crate')for(const y of [-.3,.3]){const trim=new Mesh(this.trimGeometry,this.trimMaterial);trim.position.set(0,y,.67);mesh.add(trim);}
        this.root.add(mesh);this.blockMeshes.set(block.id,mesh);
      }
      mesh.position.set(block.x,block.y+.5,0);
      if(this.animation?.block===block.id&&this.animation.blockFrom){
        const t=Math.min(1,this.animation.time/this.config.moveSeconds),e=t*t*(3-2*t),from=this.animation.blockFrom;
        mesh.position.set(from.x+(block.x-from.x)*e,from.y+(block.y-from.y)*e+.5,0);
      }
      mesh.rotation.z=block.crack===null?0:Math.sin(this.time*40)*.025;
    }
  }
  detach() {
    if(this.actor){this.active=false;this.root.visible=false;this.scene.camera.clearViewOffset();return;}
    if(!this.model)return;
    const {group,idle}=this.model;
    group.position.copy(this.saved.position);group.quaternion.copy(this.saved.quaternion);group.scale.copy(this.saved.scale);
    for(const {bone,position,quaternion,scale} of this.bones||[]){bone.position.copy(position);bone.quaternion.copy(quaternion);bone.scale.copy(scale);}
    idle.setPlaying(this.saved.playing);this.model=null;this.active=false;this.root.visible=false;
    this.scene.camera.clearViewOffset();
  }
  dispose() { this.detach();this.actor?.dispose();this.root.removeFromParent();for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose(); }
}
