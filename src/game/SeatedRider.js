import { Quaternion, Vector3 } from 'three';
import { LimbSolver } from '../viewer/LimbSolver.js';
import { seatedRigNodes } from '../config/rideConfig.js';

// Two explicit profiles for the supplied models. Runtime offsets only; clothing
// clipping is accepted for this prototype and the source skeleton is untouched.
export class SeatedRider {
  constructor(model, mount, height, { sideSaddle = false } = {}) {
    this.model = model; this.mount = mount; this.height = height;
    this.sideSaddle = sideSaddle;
    this.wave = this.lookBack = this.lastPoseTime = 0;
    const profile = seatedRigNodes[model.characterId];
    this.nodes = {};
    this.smileBones=[];
    const smileIds=model.characterId==='si'?[227,228,237,238,231,232,241,242]:[171,172,181,182,175,176,185,186];
    model.gltf.scene.traverse(node => {
      const id = model.gltf.parser.associations.get(node)?.nodes;
      for (const [name, index] of Object.entries(profile || {})) if (id === index && node.isBone) this.nodes[name] = node;
      if(node.isBone&&smileIds.includes(id))this.smileBones.push({bone:node,p:node.position.clone()});
    });
    this.supported = !!profile && Object.keys(profile).every(key => this.nodes[key]);
    for (const side of ['L', 'R']) {
      this.supported &&= this.nodes[`knee${side}`]?.parent === this.nodes[`thigh${side}`];
    }
    this.axis = new Vector3(); this.point = new Vector3(); this.target = new Vector3(); this.pole = new Vector3();
    this.q = new Quaternion(); this.parentQ = new Quaternion(); this.rotation = new Quaternion();
  }

  attach() {
    if (!this.supported) return false;
    const { group, idle } = this.model;
    idle.stopGesture(); idle.setPlaying(false);
    if (idle.supported) { idle.update(3, new Vector3()); idle.transition = null; idle.applyBody(null, 0); idle.setBlink(0); }
    this.bones = Object.values(this.nodes).map(bone => ({ bone, p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }));
    this.mount.add(group);
    group.position.set(0, 0, 0); group.rotation.set(0, Math.PI + (this.sideSaddle ? Math.PI / 2 : 0), 0);
    group.scale.setScalar(this.height / idle.height); group.updateWorldMatrix(true, true);
    this.solvers = {};
    for (const side of ['L', 'R']) this.solvers[side] = new LimbSolver(this.nodes[`arm${side}`], this.nodes[`elbow${side}`], this.nodes[`wrist${side}`]);
    this.update(0, 0, 0);
    // Align the pelvis, not the standing bounding box, with the seat cushion.
    this.nodes.pelvis.getWorldPosition(this.point);
    this.mount.worldToLocal(this.point);
    group.position.sub(this.point);
    return true;
  }

  rotate(name, axis, angle) {
    const bone = this.nodes[name];
    this.model.group.getWorldQuaternion(this.q);
    this.axis.set(...axis).applyQuaternion(this.q).normalize();
    this.rotation.setFromAxisAngle(this.axis, angle);
    bone.getWorldQuaternion(this.q);
    bone.parent.getWorldQuaternion(this.parentQ).invert();
    bone.quaternion.copy(this.parentQ.multiply(this.rotation.multiply(this.q))).normalize();
    bone.updateWorldMatrix(false, true);
  }

  update(time, lean, hit, pose = null) {
    if (!this.bones) return;
    const follow = 1 - Math.exp(-Math.max(0, Math.min(.12, time - this.lastPoseTime)) * 9);
    this.lastPoseTime = time;
    this.wave += ((pose?.wave ? 1 : 0) - this.wave) * follow;
    this.lookBack += ((pose?.lookBack || 0) - this.lookBack) * follow;
    for (const { bone, p, q, s } of this.bones) { bone.position.copy(p); bone.quaternion.copy(q); bone.scale.copy(s); }
    for(const {bone,p}of this.smileBones){bone.position.copy(p);if(pose?.celebrating)bone.position.y+=.00065*pose.celebrating;}
    this.model.group.updateWorldMatrix(true, true);
    this.rotate('spine', [0, 0, 1], -lean * .18);
    if (this.sideSaddle) this.rotate('spine', [0, 1, 0], pose?.front?-.1:-.9);
    if (pose?.determined) this.rotate('spine', [1, 0, 0], -.18 * pose.determined);
    this.rotate('head', [0, 1, 0], (pose?.front?0:this.sideSaddle ? -.35 + this.lookBack * .65 : -.3) + Math.sin(time * .8) * .12);
    this.rotate('head', [0, 0, 1], lean * .12 + hit * .18);
    if(pose?.encore){
      this.rotate('spine',[1,0,0],Math.sin(time*1.7)*.035);
      this.rotate('head',[0,1,0],pose.gesture===2?Math.sin(time*.9)*.3:.12);
      this.rotate('head',[1,0,0],pose.talking?Math.sin(time*5)*.09:Math.sin(time*1.1)*.025);
    }
    if(!this.sideSaddle&&pose){
      const alert=pose.story==='sponsor'||pose.story==='takeover';
      this.rotate('head',[1,0,0],alert?-.14:pose.story==='takeoff'?-.22:0);
      this.rotate('head',[0,1,0],pose.story==='drag'?Math.sin(time*.6)*.18:pose.grudge>=3?-.12:0);
    }
    for (const [index, side] of ['L', 'R'].entries()) {
      this.rotate(`thigh${side}`, [1, 0, 0], -1.45 + Math.sin(time * 5 + index) * .035);
      this.rotate(`knee${side}`, [1, 0, 0], 1.45);
      // Hands reach toward the armrest / brush; elbows point outwards.
      const sign = index ? -1 : 1;
      if (this.sideSaddle) this.target.set(sign * .25, .15 + (side === 'R' ? this.wave * (.75 + Math.sin(time * 14) * .08) : 0), -.25 - (side === 'R' ? this.wave * .15 : 0));
      else {
        const folded=pose?.story==='drag',magic=pose?.magic&&side==='R';
        this.target.set(folded?-sign*.19:sign*.35,magic ? .95 : folded ? .6 : .3,magic?-.85:folded?-.3:-.57);
        if(pose?.encore&&pose.gesture===1)this.target.set(side==='R'?.28:.18,side==='R'?.52:.6,-.3); // straighten a sleeve
        if(pose?.encore&&pose.gesture===2&&pose.talking&&side==='R')this.target.set(-.8,.65,-.15); // point at the other racer
      }
      this.mount.localToWorld(this.target);
      this.pole.set(sign * 1.1, .1, -.1); this.mount.localToWorld(this.pole);
      this.solvers[side].solve(this.target, this.pole);
    }
    if (this.model.idle.supported) this.model.idle.setBlink(Math.max(0, 1 - Math.abs(time % 4.2 - .1) / .1));
  }

  restore() {
    for (const { bone, p, q, s } of this.bones || []) { bone.position.copy(p); bone.quaternion.copy(q); bone.scale.copy(s); }
    for(const {bone,p}of this.smileBones)bone.position.copy(p);
  }
}
