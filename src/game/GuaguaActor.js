import { ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';

// Lightweight original penguin stand-in. No downloaded fan model or claim of an
// exact Guagua design; swapping the actor later does not alter game rules.
export class GuaguaActor {
  constructor(){
    this.root=new Group();this.root.name='guagua-penguin-placeholder';this.rig=new Group();this.root.add(this.rig);
    this.sphere=new SphereGeometry(1,16,12);this.beakGeometry=new ConeGeometry(.12,.25,4);
    this.materials=[0x202d36,0xf1eee0,0xf0bc57,0x99cdb7].map(color=>new MeshStandardMaterial({color,roughness:.8}));
    const part=(parent,material,position,scale)=>{const m=new Mesh(this.sphere,this.materials[material]);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;};
    part(this.rig,0,[0,.57,0],[.37,.47,.3]);part(this.rig,1,[0,.57,.23],[.28,.35,.095]);
    this.head=new Group();this.head.position.y=.99;this.rig.add(this.head);
    part(this.head,0,[0,0,0],[.32,.28,.28]);
    this.eyes=[];
    for(const sign of [-1,1]){part(this.head,1,[sign*.13,.015,.235],[.095,.12,.055]);this.eyes.push(part(this.head,0,[sign*.13,.015,.281],[.033,.055,.017]));}
    const beak=new Mesh(this.beakGeometry,this.materials[2]);beak.rotation.x=Math.PI/2;beak.position.set(0,-.075,.32);this.head.add(beak);
    const badge=part(this.rig,3,[.19,.65,.31],[.08,.11,.02]);badge.rotation.z=-.14;
    this.wings=[];this.feet=[];
    for(const sign of [-1,1]){
      const pivot=new Group();pivot.position.set(sign*.31,.77,0);this.rig.add(pivot);
      const wing=part(pivot,0,[sign*.07,-.2,0],[.11,.29,.12]);wing.rotation.z=sign*.2;this.wings.push(pivot);
      this.feet.push(part(this.rig,2,[sign*.17,.055,.12],[.15,.055,.22]));
    }
  }
  update(position,facing,time,weight,kind,state){
    this.root.position.set(position.x,position.y,.35);this.root.rotation.y=facing;
    const effort=['push','pull','build','reclaim'].includes(kind),climb=['climb','rope'].includes(kind);
    this.rig.rotation.set(effort?-.18*weight:climb?-.12*weight:0,0,Math.sin(time*7)*weight*.08);
    this.rig.position.y=Math.abs(Math.sin(time*11))*.045*weight;
    this.head.rotation.z=state==='call'?-.15:0;
    this.wings.forEach((wing,i)=>{wing.rotation.x=climb?-1.8*weight:effort?-1.2*weight:Math.sin(time*11+i*Math.PI)*weight*.5;wing.rotation.z=(i?1:-1)*(climb?.4*weight:.1);});
    this.feet.forEach((foot,i)=>{foot.position.y=.055+Math.max(0,Math.sin(time*11+i*Math.PI))*.1*weight;foot.rotation.x=Math.sin(time*11+i*Math.PI)*weight*.3;});
    const blink=1-Math.max(0,1-Math.abs(time%3.8-.1)/.1)*.95;for(const eye of this.eyes)eye.scale.y=.055*blink;
  }
  dispose(){this.root.removeFromParent();this.sphere.dispose();this.beakGeometry.dispose();for(const m of this.materials)m.dispose();}
}
