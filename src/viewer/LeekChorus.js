import { Group, Vector3 } from 'three';
import { LeekProp } from './LeekProp.js';
import { windowWeight } from './actionTimeline.js';

// Three fixed props; no clones of the character, physics or spawned particles.
export class LeekChorus {
  constructor(parent,bounds,height,config,propConfig){
    this.config=config;this.height=height;this.parent=parent;
    this.center=bounds.getCenter(new Vector3());this.floor=bounds.min.y;
    this.entries=config.positions.map((offset,index)=>{
      const host=new Group();host.name=`si-chorus-leek-${index}`;
      parent.add(host);const palm=new Group();host.add(palm);
      const position=new Vector3(this.center.x+offset[0]*height,this.floor+offset[1]*height,this.center.z+offset[2]*height);
      parent.worldToLocal(position);host.position.copy(position);
      const prop=new LeekProp(host,palm,parent,height*config.scale,propConfig,'dancer');
      return {host,position,prop};
    });
  }
  update(active,time,delta,cycle){
    const c=this.config;
    for(const [index,{host,position,prop}] of this.entries.entries()){
      const delayed=time-(index===2?c.lag:0),dance=active?windowWeight(delayed,c.start,c.stop,.2):0;
      const phase=delayed*Math.PI*2/cycle;
      host.position.copy(position);host.position.y+=Math.abs(Math.sin(phase))*this.height*.013*dance;
      prop.update(active && time>=c.start && time<c.stop+.55,delta,.22,Math.sin(phase)*.24*dance);
      prop.perform(time,dance>.05?'smug':'dead',index===2 && active && time>c.stop && time<c.stop+c.lag+ .2?1:dance);
      prop.trail.visible=false;
    }
  }
  dispose(){for(const {host,prop} of this.entries){prop.dispose();host.removeFromParent();}}
}
