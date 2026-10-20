import { DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Vector3 } from 'three';
import { ramp, windowWeight } from './actionTimeline.js';

// Fixed-size pool, shared geometry and the prop's existing dry-brush map.
export class InkStage {
  constructor(parent,bounds,height,config,texture){
    this.height=height;this.config=config;this.center=bounds.getCenter(new Vector3());this.floor=bounds.min.y;
    this.root=new Group();this.root.name='si-ink-stage';parent.add(this.root);
    this.material=new MeshBasicMaterial({color:0x1c3227,map:texture,transparent:true,opacity:0,side:DoubleSide,depthWrite:false,forceSinglePass:true});
    this.plane=new PlaneGeometry(1,1);this.ringGeometry=new RingGeometry(.75,1,32);
    this.ringMaterial=this.material.clone();
    this.ringMaterial.color.set(0x9bac8a);
    this.ring=new Mesh(this.ringGeometry,this.ringMaterial);this.root.add(this.ring);this.ring.rotation.x=-Math.PI/2;
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
      const hit=c.stompTime;ring=windowWeight(time,hit,hit+.8,.12);
      this.ring.scale.setScalar(h*(.06+.15*ramp(time,hit,hit+.7)));
    }else{ring=windowWeight(time,0,backward?3:1.5,.4);this.ring.scale.setScalar(h*(backward?.24:.12));}
    this.ring.visible=ring>.001;this.ringMaterial.opacity=.4*ring;
    this.world.copy(foot);this.world.y=this.floor+h*.002;this.root.parent.worldToLocal(this.world);this.ring.position.copy(this.world);
    const moving=kind==='leek'?windowWeight(time,...c.strokeWindow,.3):backward?(reverse?.beat?.first||reverse?.beat?.second||0):0;
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
  dispose(){this.root.removeFromParent();for(const item of [this.material,this.ringMaterial,this.plane,this.ringGeometry])item.dispose();}
}
