import { BufferGeometry, Float32BufferAttribute, DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { LeekProp } from './LeekProp.js';
import { reverseBeat, ramp, windowWeight } from './actionTimeline.js';

const UP = new Vector3(0,1,0), Z = new Vector3(0,0,1);

// The actor wrapper moves, never the imported skeleton hierarchy. Four ink limbs
// share one geometry/material; the real posed wrist remains the grasp anchor.
export class ReverseLeekController {
  constructor(actor,wrist,bounds,height,config,propConfig) {
    this.actor=actor; this.wrist=wrist; this.height=height; this.config=config;
    this.stage=actor.parent || new Group(); if(!actor.parent)this.stage.add(actor);
    this.base=this.capture(); this.center=bounds.getCenter(new Vector3()); this.floor=bounds.min.y;
    this.active=false; this.visible=false; this.landing=null;
    this.pivot=new Vector3(); this.actual=new Vector3(); this.delta=new Vector3(); this.unit=new Vector3();
    this.rotation=new Quaternion();
    this.host=new Group(); this.host.name='si-giant-leek-host'; this.stage.add(this.host);
    const palm=new Group(); this.host.add(palm);
    this.leek=new LeekProp(this.host,palm,this.stage,height*config.leekScale,propConfig,'giant');
    this.ink=new Group(); this.ink.name='si-leek-ink-limbs'; this.ink.visible=false; this.stage.add(this.ink);
    this.material=new MeshBasicMaterial({color:0x17261e,map:this.leek.textures[0]||null,transparent:true,alphaTest:.1,side:DoubleSide,forceSinglePass:true});
    this.faceMaterial=this.leek.faceMaterial;
    this.limbGeometry=new BufferGeometry();
    // Bent, tapered crossed brush ribbons retain their shape from side views.
    const limbPosition=[],limbUV=[],limbIndex=[];
    for(let plane=0;plane<2;plane++)for(let i=0;i<=8;i++){
      const t=i/8,width=.55*(1-.6*t)*(1+.12*Math.sin(t*9)),curve=.25*Math.sin(Math.PI*t),base=plane*18+i*2;
      for(const sign of [-1,1]){const x=sign*width+curve;limbPosition.push(plane?curve:x,t-.5,plane?x:0);limbUV.push(sign===-1?0:1,t);}
      if(i<8)limbIndex.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    this.limbGeometry.setAttribute('position',new Float32BufferAttribute(limbPosition,3));this.limbGeometry.setAttribute('uv',new Float32BufferAttribute(limbUV,2));this.limbGeometry.setIndex(limbIndex);
    this.sphereGeometry=new SphereGeometry(1,8,5);
    this.segments=Array.from({length:8},()=>{const mesh=new Mesh(this.limbGeometry,this.material);this.ink.add(mesh);return mesh;});
    this.handGeometry=new BufferGeometry();
    const clawPosition=[],clawUV=[],clawIndex=[];
    for(let i=0;i<3;i++){
      const x=(i-1)*.6,length=i===1?1:.72,base=clawPosition.length/3;
      clawPosition.push(x-.19,-.4,0,x+.19,-.4,0,x+.12,length,.08,x-.12,length,.08);
      clawUV.push(0,0,1,0,1,1,0,1);clawIndex.push(base,base+1,base+2,base,base+2,base+3);
    }
    this.handGeometry.setAttribute('position',new Float32BufferAttribute(clawPosition,3));this.handGeometry.setAttribute('uv',new Float32BufferAttribute(clawUV,2));this.handGeometry.setIndex(clawIndex);
    this.hand=new Mesh(this.handGeometry,this.material);this.otherHand=new Mesh(this.handGeometry,this.material);this.ink.add(this.hand,this.otherHand);
    this.feet=[this.mark(this.material),this.mark(this.material)];
    this.drop=this.mark(this.material);this.drop.visible=false;
    this.points=Array.from({length:9},()=>new Vector3());
  }
  mark(material){const mesh=new Mesh(this.sphereGeometry,material);this.ink.add(mesh);return mesh;}
  capture(){return {position:this.actor.position.clone(),quaternion:this.actor.quaternion.clone(),scale:this.actor.scale.clone()};}
  point(x,y,z,out){out.set(this.center.x+x*this.height,this.floor+y*this.height,this.center.z+z*this.height);return this.stage.worldToLocal(out);}
  segment(mesh,a,b,width=1){
    mesh.position.copy(a).add(b).multiplyScalar(.5);this.delta.subVectors(b,a);
    mesh.quaternion.setFromUnitVectors(UP,this.unit.copy(this.delta).normalize());
    mesh.scale.set(this.height*this.config.armRadius*width*2.5,this.delta.length(),this.height*this.config.armRadius*width*2.5);
  }
  start(){this.active=true;this.landing=null;}
  stop(){if(!this.active)return;this.active=false;this.landing={...this.capture(),elapsed:0,visibility:this.beat?.fade ?? 1};}
  update(seconds,delta){
    const c=this.config;
    let weight=0, limbWeight=0;
    if(this.active){
      const beat=reverseBeat(seconds,c); this.beat=beat;
      weight=beat.summon*beat.fade;limbWeight=beat.limbs*beat.fade;
      const phase=(seconds-c.beats.swing)*Math.PI*2/c.cycle;
      const sway=.025*Math.sin(phase)*beat.first;
      const onionX=c.leekX+sway;
      this.actor.position.copy(this.base.position);
      this.actor.scale.copy(this.base.scale).multiplyScalar(MathUtils.lerp(1,c.characterScale,beat.attached));
      this.actor.quaternion.copy(this.base.quaternion).multiply(this.rotation.setFromAxisAngle(Z,beat.angle));
      this.actor.updateWorldMatrix(true,true);
      this.stage.worldToLocal(this.wrist.getWorldPosition(this.actual));
      this.point(c.gripX+.055*Math.sin(phase)*beat.first,c.gripY+.035*Math.cos(phase)*beat.first,.06,this.pivot);
      this.actor.position.addScaledVector(this.delta.subVectors(this.pivot,this.actual),beat.attached);
      this.actor.updateWorldMatrix(true,true);
      this.stage.worldToLocal(this.wrist.getWorldPosition(this.actual));
      this.point(onionX+.18,.57,.05,this.pivot).lerp(this.actual,beat.attached);
      if(beat.bow>0){this.point(onionX+.02,.27,.1,this.unit);this.pivot.lerp(this.unit,beat.bow);}
      this.point(onionX,c.leekY-.07*(1-beat.summon),0,this.host.position);
      // The onion bows with the solemnity of a calligraphy master.
      this.host.rotation.z=-.2*beat.bow;
      const [a,b,d,e,f,g,h,k,j]=this.points;
      this.point(onionX+.055,.46,.04,a);this.point(onionX+.13,.61+sway,.055,b);
      if(beat.bow>0)this.point(onionX+.19,.3,.04,b);
      this.segment(this.segments[0],a,b,1.3);this.segment(this.segments[1],b,this.pivot,.95);
      this.hand.position.copy(this.pivot);this.hand.scale.setScalar(this.height*.033);this.hand.rotation.z=-.3;
      this.point(onionX-.055,.42,.04,d);this.point(onionX-.18,.51,.04,e);
      this.point(onionX-.24,.63+.04*beat.first,.04,f);
      if(beat.bow>0){this.point(onionX+.035,.265,.105,f);this.point(onionX-.18,.3,.04,e);}
            const wipe=windowWeight(seconds,c.beats.limbs+.6,c.beats.stare,.08);
      if(wipe>0){this.point(onionX+.04,.37,.085,g);f.lerp(g,wipe);}
      this.segment(this.segments[2],d,e,1.3);this.segment(this.segments[3],e,f,.95);
      this.otherHand.position.copy(f);this.otherHand.scale.setScalar(this.height*.03);this.otherHand.rotation.z=.4;
      // Four unmistakable limbs: two-segment, wide-stance calligraphic legs.
      for(let side=0;side<2;side++){
        const sign=side?1:-1;
        this.point(onionX+sign*.025,.25,.0,g);
        this.point(onionX+sign*.12,.14-.02*beat.bow,.02,h);
        this.point(onionX+sign*.19,.025,.07,k);
        this.segment(this.segments[4+side*2],g,h,2.2);this.segment(this.segments[5+side*2],h,k,1.4);
        this.feet[side].position.copy(k);this.feet[side].scale.set(this.height*.063,this.height*.013,this.height*.045);
      }
      const dropTime=seconds-c.beats.limbs-.25;
      this.drop.visible=dropTime>0&&dropTime<.35;
      this.point(onionX-.24,.6-.7*Math.max(0,dropTime),.05,this.drop.position);
      this.drop.scale.set(this.height*.008,this.height*.016,this.height*.006);
    }else if(this.landing){
      this.landing.elapsed+=delta;const t=ramp(this.landing.elapsed,0,c.landing);weight=limbWeight=(1-t)*this.landing.visibility;
      this.actor.position.lerpVectors(this.landing.position,this.base.position,t);
      this.actor.quaternion.slerpQuaternions(this.landing.quaternion,this.base.quaternion,t);
      this.actor.scale.lerpVectors(this.landing.scale,this.base.scale,t);
      if(t===1)this.landing=null;
    }
    this.visible=this.active||!!this.landing;this.ink.visible=limbWeight>0;
    this.ink.scale.setScalar(1); // Geometry is authored in stage space.
    this.material.opacity=limbWeight;
    this.leek.update(this.active,delta,this.active?c.entry:c.landing,0);
    for(const material of this.leek.materials)material.opacity*=weight;
    const expression=this.active ? seconds<c.beats.limbs?'hidden':seconds<c.beats.grab?'peek':seconds<c.beats.bow?'serious':'smug' : 'hidden';
    this.leek.perform(seconds,expression,this.active && seconds<c.beats.grab?.35:0);
    this.leek.trail.visible=false;
    if(!this.active)this.drop.visible=false;
  }
  dispose(){
    this.actor.position.copy(this.base.position);this.actor.quaternion.copy(this.base.quaternion);this.actor.scale.copy(this.base.scale);
    this.leek.dispose();this.host.removeFromParent();this.ink.removeFromParent();
    for(const resource of [this.material,this.limbGeometry,this.handGeometry,this.sphereGeometry])resource.dispose();
    this.visible=false;this.active=false;this.landing=null;
  }
}
