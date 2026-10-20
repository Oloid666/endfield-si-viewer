import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3 } from 'three';
import { ramp, windowWeight } from './actionTimeline.js';

// Fixed-size pool, shared geometry and the prop's existing dry-brush map.
export class InkStage {
  constructor(parent,bounds,height,config,texture){
    this.height=height;this.config=config;this.center=bounds.getCenter(new Vector3());this.floor=bounds.min.y;
    this.root=new Group();this.root.name='si-ink-stage';parent.add(this.root);
    this.material=new MeshBasicMaterial({color:0x1c3227,map:texture,transparent:true,opacity:0,side:DoubleSide,depthWrite:false,forceSinglePass:true});
    this.plane=new PlaneGeometry(1,1);this.circle=new CircleGeometry(1,12);this.ringGeometry=new RingGeometry(.75,1,32);
    this.ringMaterial=this.material.clone();this.flowerMaterial=this.material.clone();
    this.ringMaterial.color.set(0x9bac8a);this.flowerMaterial.color.set(0xc3d5a3);
    this.ring=new Mesh(this.ringGeometry,this.ringMaterial);this.root.add(this.ring);this.ring.rotation.x=-Math.PI/2;
    this.flower=new Group();this.root.add(this.flower);
    for(let i=0;i<5;i++){
      const petal=new Mesh(this.circle,this.flowerMaterial),angle=i*Math.PI*2/5;
      petal.position.set(Math.cos(angle)*.018,Math.sin(angle)*.018,0);
      petal.scale.set(.027,.012,1);petal.rotation.z=angle;this.flower.add(petal);
    }

    this.strokes=Array.from({length:config.strokeCount},()=>{const m=new Mesh(this.plane,this.material);this.root.add(m);return m;});
    this.world=new Vector3();this.previous=new Vector3();this.direction=new Vector3();
    this.kind='';this.lastTime=0;
  }
  update(kind,time,wrist,foot,reverse,delta,cameraPosition){
    const h=this.height,c=this.config;
    this.root.visible=!!kind;
    if(!kind){this.kind='';return;}
    const fresh=this.kind!==kind||time<this.lastTime;
    this.kind=kind;this.lastTime=time;
    const stomp=kind==='tsundere',backward=kind==='reverse';
    let ring=0;
    if(stomp){
      const first=windowWeight(time,2.45,3.3,.12),second=windowWeight(time,6.35,7,.1);
      ring=first+second;
      const hit=time>6.35?6.35:2.45;
      this.ring.scale.setScalar(h*(.06+.15*ramp(time,hit,hit+.7)));
    }else{ring=windowWeight(time,0,backward?3:1.5,.4);this.ring.scale.setScalar(h*(backward?.24:.12));}
    this.ring.visible=ring>.001;this.ringMaterial.opacity=.4*ring;
    this.world.copy(foot);this.world.y=this.floor+h*.002;this.root.parent.worldToLocal(this.world);this.ring.position.copy(this.world);
    const flower=stomp?windowWeight(time,c.flowerStart,c.flowerEnd,.3):0;
    this.flower.visible=flower>.001;this.flowerMaterial.opacity=.7*flower;
    this.flower.position.copy(this.world);this.flower.position.y+=h*.045;this.flower.scale.setScalar(h*(.9+.9*flower));
    if(cameraPosition)this.flower.lookAt(cameraPosition);
    const moving=kind==='leek'?windowWeight(time,1.3,5.6,.3):backward?(reverse?.beat?.first||reverse?.beat?.second||0):0;
    this.world.copy(wrist);this.root.parent.worldToLocal(this.world);
    if(fresh){this.previous.copy(this.world);for(const stroke of this.strokes)stroke.visible=false;}
    this.material.opacity=.28*moving;
    // Eight short brush echoes, authored from the current motion; no particle spawning.
    for(let i=0;i<this.strokes.length;i++){
      const stroke=this.strokes[i];stroke.visible=moving>.01;
      const t=(i+1)/this.strokes.length;
      stroke.position.copy(this.world).lerp(this.previous,t);
      stroke.position.x+=Math.sin(time*5-t*3)*h*.04*t;
      stroke.position.y+=Math.cos(time*5-t*3)*h*.035*t;
      stroke.rotation.z=time*2-t*1.5;
      stroke.scale.set(h*(.12+.08*moving)*(1-t*.65),h*.012*(1-t*.7),1);
    }
    this.previous.lerp(this.world,1-Math.exp(-delta*12));
  }
  dispose(){this.root.removeFromParent();for(const item of [this.material,this.ringMaterial,this.flowerMaterial,this.plane,this.circle,this.ringGeometry])item.dispose();}
}
