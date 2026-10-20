import { BufferGeometry, Float32BufferAttribute, DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { LeekProp } from './LeekProp.js';
import { reverseBeat, ramp } from './actionTimeline.js';

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
    this.leek=new LeekProp(this.host,palm,this.stage,height*config.leekScale,propConfig);
    this.ink=new Group(); this.ink.name='si-leek-ink-limbs'; this.ink.visible=false; this.stage.add(this.ink);
    this.material=new MeshBasicMaterial({color:0x17261e,map:this.leek.textures[0]||null,transparent:true,alphaTest:.1,side:DoubleSide,forceSinglePass:true});
    this.faceMaterial=new MeshBasicMaterial({color:0x18251d,transparent:true});
    this.facePaperMaterial=new MeshBasicMaterial({color:0xe2e7c9,transparent:true});
    this.limbGeometry=new BufferGeometry();
    // Crossed brush ribbons stay visible from side views with one draw per segment.
    this.limbGeometry.setAttribute('position',new Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0,0,-.5,-.5,0,-.5,.5,0,.5,-.5,0,.5,.5],3));
    this.limbGeometry.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1,1,1,0,0,1,0,0,1,1,1],2));
    this.limbGeometry.setIndex([0,1,2,1,3,2,4,5,6,5,7,6]);
    this.sphereGeometry=new SphereGeometry(1,8,5);
    this.segments=Array.from({length:8},()=>{const mesh=new Mesh(this.limbGeometry,this.material);this.ink.add(mesh);return mesh;});
    this.hand=this.mark(this.material); this.otherHand=this.mark(this.material);
    this.feet=[this.mark(this.material),this.mark(this.material)];
    this.facePaper=this.mark(this.facePaperMaterial);
    this.eyes=[this.mark(this.faceMaterial),this.mark(this.faceMaterial)]; this.mouth=this.mark(this.faceMaterial);
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
      this.point(onionX,c.leekY-.07*(1-beat.summon),0,this.host.position);
      // The onion bows with the solemnity of a calligraphy master.
      this.host.rotation.z=-.2*beat.bow;
      const [a,b,d,e,f,g,h,k,j]=this.points;
      this.point(onionX,.49,.03,a);this.point(onionX+.13,.61+sway,.055,b);
      this.segment(this.segments[0],a,b);this.segment(this.segments[1],b,this.pivot);
      this.hand.position.copy(this.pivot);this.hand.scale.setScalar(this.height*.026);
      this.point(onionX-.015,.44,.02,d);this.point(onionX-.18,.51,.04,e);
      this.point(onionX-.24,.63+.04*beat.first,.04,f);
      if(beat.bow>0)this.point(onionX+.09,.46,.075,f);
      this.segment(this.segments[2],d,e);this.segment(this.segments[3],e,f);
      this.otherHand.position.copy(f);this.otherHand.scale.setScalar(this.height*.024);
      // Four unmistakable limbs: two-segment, wide-stance calligraphic legs.
      for(let side=0;side<2;side++){
        const sign=side?1:-1;
        this.point(onionX+sign*.025,.25,.0,g);
        this.point(onionX+sign*.12,.14-.02*beat.bow,.02,h);
        this.point(onionX+sign*.19,.025,.07,k);
        this.segment(this.segments[4+side*2],g,h,1.35);this.segment(this.segments[5+side*2],h,k,1.35);
        this.feet[side].position.copy(k);this.feet[side].scale.set(this.height*.045,this.height*.018,this.height*.045);
      }
      this.point(onionX,.543,.1,this.facePaper.position);this.facePaper.scale.set(this.height*.05,this.height*.055,this.height*.004);
      this.eyes.forEach((eye,index)=>{
        this.point(onionX+(index?1:-1)*.022,.558,.109,j);eye.position.copy(j);
        eye.scale.set(this.height*.014,this.height*.004,this.height*.004);eye.rotation.z=index?-.19:.19;
      });
      this.point(onionX,.52,.11,this.mouth.position);this.mouth.scale.set(this.height*.015,this.height*.003,this.height*.004);
    }else if(this.landing){
      this.landing.elapsed+=delta;const t=ramp(this.landing.elapsed,0,c.landing);weight=limbWeight=(1-t)*this.landing.visibility;
      this.actor.position.lerpVectors(this.landing.position,this.base.position,t);
      this.actor.quaternion.slerpQuaternions(this.landing.quaternion,this.base.quaternion,t);
      this.actor.scale.lerpVectors(this.landing.scale,this.base.scale,t);
      if(t===1)this.landing=null;
    }
    this.visible=this.active||!!this.landing;this.ink.visible=limbWeight>0;
    this.ink.scale.setScalar(1); // Geometry is authored in stage space.
    this.material.opacity=limbWeight;this.faceMaterial.opacity=weight;this.facePaperMaterial.opacity=weight;
    this.leek.update(this.active,delta,this.active?c.entry:c.landing,0);
    for(const material of this.leek.materials)material.opacity*=weight;
    this.leek.trail.visible=false;
  }
  dispose(){
    this.actor.position.copy(this.base.position);this.actor.quaternion.copy(this.base.quaternion);this.actor.scale.copy(this.base.scale);
    this.leek.dispose();this.host.removeFromParent();this.ink.removeFromParent();
    for(const resource of [this.material,this.faceMaterial,this.facePaperMaterial,this.limbGeometry,this.sphereGeometry])resource.dispose();
    this.visible=false;this.active=false;this.landing=null;
  }
}
