import { Group, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { buildCompanion, animateCompanion } from '../game/RideProps.js';
import { zhuangDisplayConfig as config } from '../config/characters.js';

// Explicit profile for the supplied Zhuang GLB; never infer uploaded skeletons.
export class ZhuangIdleController {
  constructor(gltf, bounds, scene) {
    this.height = bounds.max.y - bounds.min.y; this.time = 0; this.playing = true;
    this.gestureTime = this.rescueTime = null; this.resources = new Set();
    const bones = []; gltf.scene.traverse(n => { if (n.isBone) bones.push(n); });
    const byId = id => bones.find(n => gltf.parser.associations.get(n)?.nodes === id);
    this.poses = {};
    for (const [name, id] of Object.entries(config.nodes)) {
      const bone = byId(id); if (!bone) continue;
      const inverse = bone.getWorldQuaternion(new Quaternion()).invert();
      this.poses[name] = { bone, q: bone.quaternion.clone(), x: new Vector3(1,0,0).applyQuaternion(inverse), y: new Vector3(0,1,0).applyQuaternion(inverse), z: new Vector3(0,0,1).applyQuaternion(inverse) };
    }
    this.head = this.poses.head; this.supported = Object.keys(this.poses).length === Object.keys(config.nodes).length;
    this.eyelids = [];
    for (const [upperId, lowerId] of config.lids) {
      const upper = byId(upperId), lower = byId(lowerId);
      if (!upper || !lower || upper.parent !== lower.parent) continue;
      const meeting = upper.position.clone().lerp(lower.position, .75);
      for (const bone of [upper, lower]) this.eyelids.push({ bone, rest: bone.position.clone(), target: new Vector3(bone.position.x, meeting.y, meeting.z) });
    }
    this.offset = new Quaternion(); this.axis = new Quaternion();
    this.display = new Group(); this.display.name = 'zhuang-display-dragon'; this.display.visible = false;
    scene.add(this.display); this.dragon = buildCompanion(this, 'dragon'); this.display.add(this.dragon.root);
    this.display.position.set(bounds.getCenter(new Vector3()).x + this.height * .27, bounds.min.y + this.height * .61, bounds.getCenter(new Vector3()).z + this.height * .035);
    this.dragon.root.scale.setScalar(this.height * .115);
    this.applyBody();
  }
  own(r) { this.resources.add(r); return r; }
  material(color, extra = {}) { return this.own(new MeshStandardMaterial({ color, roughness: .8, ...extra })); }
  mesh(g,m,parent,p=[0,0,0],s=[1,1,1]) { const mesh=new Mesh(g,m);mesh.position.fromArray(p);mesh.scale.fromArray(s);parent.add(mesh);return mesh; }
  pose(name, pitch=0, yaw=0, roll=0) {
    const p=this.poses[name];if(!p)return;
    this.offset.setFromAxisAngle(p.x,pitch).multiply(this.axis.setFromAxisAngle(p.y,yaw)).multiply(this.axis.setFromAxisAngle(p.z,roll));p.bone.quaternion.copy(p.q).multiply(this.offset);
  }
  applyBody() { for (const p of Object.values(this.poses)) p.bone.quaternion.copy(p.q); }
  setBlink(amount) { for(const p of this.eyelids)p.bone.position.lerpVectors(p.rest,p.target,amount); }
  setPlaying(value) { this.playing=!!value; }
  setCompanionVisible(value) { this.display.visible=!!value; }
  stopGesture() { return false; }
  update(delta, cameraPosition) {
    if(!this.supported)return;
    if(this.playing)this.time+=Math.min(Math.max(delta,0),.12);
    const t=this.time, visit=Math.max(0,Math.sin((t%config.cycle-6)/7*Math.PI));
    const phase=t%config.cycle,inspect=phase>=12&&phase<=16?Math.sin((phase-12)/4*Math.PI):0;
    this.pose('spine',Math.sin(t*1.4)*.009,Math.sin(t*.5)*.012,Math.sin(t*.7)*.008);
    this.pose('head',Math.sin(t*.8)*.035,-visit*.24,visit*.055);
    this.pose('armL',.02,-inspect*.1,-.42+inspect*.12); this.pose('armR',-.02,.02,.46);
    this.pose('elbowL',inspect*.12,.02,inspect*.15);this.pose('wristL',inspect*.08,0,inspect*.12);
    this.pose('elbowR',.04,0,-.02);this.pose('wristR',0,0,Math.sin(t)*.025);
    this.pose('eyeL',0,-visit*.09);this.pose('eyeR',0,-visit*.09);
    this.setBlink(Math.max(0,1-Math.abs(t%4.6-.15)/.12));
    if(this.display.visible){
      this.dragon.root.position.set(-visit*this.height*.06,Math.sin(t*2.5)*this.height*.012,0);
      this.dragon.root.rotation.set(Math.sin(t*1.8)*.04,-visit*.5,Math.sin(t*2)*.07);
      if(cameraPosition){const p=this.display.position;this.dragon.root.rotation.y+=Math.atan2(cameraPosition.x-p.x,cameraPosition.z-p.z)*.35;}
      animateCompanion(this.dragon,t,{mood:inspect>.6?'smug':'calm',wave:visit,blink:Math.max(0,1-Math.abs(t%5-.12)/.1)});
    }
  }
  dispose(){this.applyBody();this.setBlink(0);this.display.removeFromParent();for(const r of this.resources)r.dispose();this.resources.clear();}
}
