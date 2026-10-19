import { CylinderGeometry, Group, MathUtils, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { LeekProp } from './LeekProp.js';

const smooth = (t) => MathUtils.smoothstep(t, 0, 1);
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

// A stage-level prop and an actor wrapper: the original skeleton is never
// reparented to the onion. The wrist is aligned to the ink hand every frame.
export class ReverseLeekController {
  constructor(actor, wrist, bounds, height, config, propConfig) {
    this.actor = actor; this.wrist = wrist; this.height = height; this.config = config;
    this.stage = actor.parent || new Group();
    if (!actor.parent) this.stage.add(actor);
    this.base = this.capture();
    this.center = bounds.getCenter(new Vector3()); this.floor = bounds.min.y;
    this.active = false; this.visible = false;
    this.pivot = new Vector3(); this.actual = new Vector3(); this.delta = new Vector3();
    this.rotation = new Quaternion();
    this.host = new Group(); this.host.name = 'si-giant-leek-host'; this.stage.add(this.host);
    const palm = new Group(); this.host.add(palm);
    this.leek = new LeekProp(this.host, palm, this.stage, height * config.leekScale, propConfig);
    this.ink = new Group(); this.ink.name = 'si-leek-ink-arms'; this.ink.visible = false; this.stage.add(this.ink);
    this.material = new MeshBasicMaterial({ color: 0x61735d, transparent: true });
    this.faceMaterial = new MeshBasicMaterial({ color: 0x26392d, transparent: true });
    this.limbGeometry = new CylinderGeometry(1, 1, 1, 7);
    this.sphereGeometry = new SphereGeometry(1, 10, 7);
    this.segments = Array.from({ length: 4 }, () => {
      const mesh = new Mesh(this.limbGeometry, this.material); this.ink.add(mesh); return mesh;
    });
    this.hand = new Mesh(this.sphereGeometry, this.material); this.hand.scale.setScalar(height * .028); this.ink.add(this.hand);
    this.otherHand = new Mesh(this.sphereGeometry, this.material); this.otherHand.scale.setScalar(height * .023); this.ink.add(this.otherHand);
    this.eyes = [-1, 1].map(() => { const mesh = new Mesh(this.sphereGeometry, this.faceMaterial); this.ink.add(mesh); return mesh; });
    this.mouth = new Mesh(this.sphereGeometry, this.faceMaterial); this.ink.add(this.mouth);
    this.points = Array.from({ length: 6 }, () => new Vector3());
  }

  capture() { return { position: this.actor.position.clone(), quaternion: this.actor.quaternion.clone(), scale: this.actor.scale.clone() }; }

  point(x, y, z, out) {
    out.set(this.center.x + x*this.height, this.floor + y*this.height, this.center.z + z*this.height);
    return this.stage.worldToLocal(out);
  }

  segment(mesh, a, b) {
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    this.delta.subVectors(b, a);
    mesh.quaternion.setFromUnitVectors(UP, this.delta.clone().normalize());
    mesh.scale.set(this.height*this.config.armRadius, this.delta.length(), this.height*this.config.armRadius);
  }

  start() { this.active = true; this.landing = null; }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.landing = { ...this.capture(), elapsed: 0 };
  }

  update(seconds, delta) {
    const c = this.config;
    let weight = 0;
    if (this.active) {
      weight = smooth(seconds / c.entry);
      const phase = seconds * Math.PI*2/c.cycle;
      const angle = c.swing*Math.sin(phase)*weight;
      const onionX = c.leekX + .015*Math.sin(phase);
      const targetScale = MathUtils.lerp(1,c.characterScale,weight);
      this.actor.scale.copy(this.base.scale).multiplyScalar(targetScale);
      this.actor.quaternion.copy(this.base.quaternion).multiply(this.rotation.setFromAxisAngle(Z,angle));
      // Align the actual posed wrist after scaling/rotation, so the grip never slides.
      this.actor.updateWorldMatrix(true,true);
      this.stage.worldToLocal(this.wrist.getWorldPosition(this.actual));
      this.point(c.gripX + .045*Math.sin(phase),c.gripY + .04*Math.cos(phase),.06,this.pivot);
      this.actor.position.addScaledVector(this.delta.subVectors(this.pivot,this.actual),weight);
      this.actor.updateWorldMatrix(true,true);
      this.stage.worldToLocal(this.wrist.getWorldPosition(this.pivot));
      this.point(onionX,c.leekY,0,this.host.position);
      const [a,b,d,e,f,g] = this.points;
      this.point(onionX,.43,.04,a); this.point(-.17,.66+.035*Math.sin(phase),.06,b);
      this.segment(this.segments[0],a,b); this.segment(this.segments[1],b,this.pivot); this.hand.position.copy(this.pivot);
      this.point(onionX-.02,.38,.03,d); this.point(-.56,.48,.04,e); this.point(-.64,.54+.08*Math.sin(phase+1),.04,f);
      this.segment(this.segments[2],d,e); this.segment(this.segments[3],e,f); this.otherHand.position.copy(f);
      this.eyes.forEach((eye,j) => { this.point(onionX+(j?1:-1)*.012,.47,.033,g);eye.position.copy(g);eye.scale.set(this.height*.009,this.height*.014,this.height*.004); });
      this.point(onionX,.431,.034,this.mouth.position); this.mouth.scale.set(this.height*.015,this.height*.005,this.height*.004);
    } else if (this.landing) {
      this.landing.elapsed += delta;
      const t = smooth(this.landing.elapsed/c.landing);
      weight = 1-t;
      this.actor.position.lerpVectors(this.landing.position,this.base.position,t);
      this.actor.quaternion.slerpQuaternions(this.landing.quaternion,this.base.quaternion,t);
      this.actor.scale.lerpVectors(this.landing.scale,this.base.scale,t);
      if(t===1)this.landing=null;
    }
    this.visible = this.active || !!this.landing;
    this.ink.visible = weight>0;
    this.material.opacity = weight; this.faceMaterial.opacity = weight;
    this.leek.update(this.active,delta,this.active?c.entry:c.landing,0);
    // An onion with arms uses no moving leaf-tip trail.
    this.leek.trail.visible = false;
  }

  dispose() {
    this.actor.position.copy(this.base.position); this.actor.quaternion.copy(this.base.quaternion); this.actor.scale.copy(this.base.scale);
    this.leek.dispose(); this.host.removeFromParent(); this.ink.removeFromParent();
    for(const resource of [this.material,this.faceMaterial,this.limbGeometry,this.sphereGeometry])resource.dispose();
    this.visible=false;this.active=false;this.landing=null;
  }
}
