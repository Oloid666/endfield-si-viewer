import { BufferGeometry, Float32BufferAttribute, Group, Quaternion, Vector3 } from 'three';
import { RaftStage } from './RaftStage.js';
import { SeatedRider } from './SeatedRider.js';
import { rideConfig, rideProfiles } from '../config/rideConfig.js';
import { riverCenter } from '../config/raftConfig.js';

// A fan-made miniature ship and a runaway office chair, not official assets.
export class RideStage extends RaftStage {
  constructor(scene, camera, models) {
    super(scene, camera, models, rideConfig);
    this.character = 'si'; this.profile = rideProfiles.si;
    this.root.name = 'seated-ride-prototype';
    this.screenPoint = new Vector3(); this.inverseCamera = new Quaternion();
    this.cameraDirection = new Vector3(0, .5, .86).normalize();
    this.desiredCameraDirection = new Vector3();
    this.framePoints = Array.from({ length: 16 }, () => new Vector3());
  }

  buildVehicles({ box, sphere, cylinder, cone, dark, pale, jade }) {
    const steel = this.material(0x46595b, { metalness: .45 });
    const orange = this.material(0xf4aa56, { emissive: 0xaf5818, emissiveIntensity: .3 });
    const cushion = this.material(0x344d49);
    this.ship = new Group(); this.chair = new Group(); this.raft.add(this.ship, this.chair);
    this.shipSeat = new Group(); this.shipSeat.position.set(0, .93, .05); this.ship.add(this.shipSeat);
    this.chairSeat = new Group(); this.chairSeat.position.y = .85; this.chair.add(this.chairSeat);
    this.shipMount = new Group(); this.shipSeat.add(this.shipMount);
    this.chairMount = new Group(); this.chairSeat.add(this.chairMount);
    this.pole = new Group(); // shared stage's optional paddle animation is inert here
    this.mesh(box, steel, this.ship, [0, .38, .05], [2, .58, 3.4]);
    const bow = this.mesh(cone, steel, this.ship, [0, .38, -1.9], [1.42, 1.8, .36]); bow.rotation.x = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
    this.mesh(box, pale, this.ship, [0, .73, .7], [1.3, .18, 1.9]);
    this.mesh(box, dark, this.ship, [0, .79, -.6], [.85, .14, 1]);
    this.mesh(box, pale, this.ship, [0, 1.02, 1.28], [.52, .6, .5]);
    this.mesh(box, jade, this.ship, [0, 1.2, 1.55], [.45, .15, .04]);
    this.flames = [];
    for (const side of [-1, 1]) {
      this.mesh(box, steel, this.ship, [side * 1.35, .34, .6], [.65, .5, 2.4]);
      this.mesh(box, orange, this.ship, [side * 1.35, .61, -.08], [.38, .05, .75]);
      const nozzle = this.mesh(cylinder, dark, this.ship, [side * 1.35, .35, 1.85], [.29, .45, .29]); nozzle.rotation.x = Math.PI / 2;
      const flame = this.mesh(cone, jade, this.ship, [side * 1.35, .35, 2.5], [.23, 1.2, .23]); flame.rotation.x = Math.PI / 2; this.flames.push(flame);
      this.mesh(box, dark, this.shipSeat, [side * .46, .25, -.12], [.1, .1, .8]);
    }
    this.mesh(box, cushion, this.shipSeat, [0, -.08, 0], [.86, .14, .72]);
    this.mesh(box, cushion, this.shipSeat, [0, .34, .36], [.84, .8, .15]);

    this.mesh(cylinder, steel, this.chair, [0, .48, 0], [.09, .65, .09]);
    this.mesh(box, cushion, this.chairSeat, [0, -.07, 0], [1.02, .18, .9]);
    this.mesh(box, cushion, this.chairSeat, [0, .48, .42], [.95, 1.15, .17]);
    this.mesh(box, jade, this.chairSeat, [0, .8, .52], [.48, .08, .04]);
    for (const side of [-1, 1]) {
      this.mesh(box, steel, this.chairSeat, [side * .57, .14, .1], [.07, .38, .07]);
      this.mesh(box, dark, this.chairSeat, [side * .57, .35, -.03], [.18, .1, .8]);
    }
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const spoke = this.mesh(box, steel, this.chair, [Math.sin(angle) * .36, .16, Math.cos(angle) * .36], [.1, .09, .8]); spoke.rotation.y = angle;
      const wheel = this.mesh(cylinder, dark, this.chair, [Math.sin(angle) * .73, .12, Math.cos(angle) * .73], [.13, .13, .13]); wheel.rotation.z = Math.PI / 2;
    }
    this.warning = this.mesh(box, orange, this.chairSeat, [0, .1, .53], [.8, .14, .04]);
    this.vehicleParts = { sphere, cone, pale, jade, dark };
  }

  build() {
    super.build();
    this.inkBody = this.petBody; this.inkArms = this.arms; this.inkTail = this.tail;
    const { sphere, cone, pale, jade, dark } = this.vehicleParts;
    const dragon = this.dragon = new Group(); this.pet.add(dragon);
    this.mesh(sphere, pale, dragon, [0, .63, 0], [.78, .7, .72]);
    this.mesh(sphere, jade, dragon, [0, .72, .45], [.65, .52, .35]);
    this.dragonArms = [];
    for (const side of [-1, 1]) {
      const horn = this.mesh(cone, pale, dragon, [side * .43, 1.28, -.05], [.15, .6, .17]); horn.rotation.z = side * -.5;
      this.mesh(sphere, dark, dragon, [side * .25, .8, .74], [.07, .09, .04]);
      this.dragonArms.push(this.mesh(sphere, jade, dragon, [side * .72, .4, .04], [.24, .12, .3]));
    }
    this.dragonTail = this.mesh(cone, jade, dragon, [0, .3, -.75], [.24, .7, .24]); this.dragonTail.rotation.x = -1.1;
    this.mesh(sphere, pale, dragon, [0, .42, .69], [.25, .17, .14]);
    dragon.visible = false;

    // A narrow industrial service road over the water: cheap static triangles.
    const vertices = [], indices = [], marks = [], rail = [];
    for (let i = 0; i <= 100; i++) {
      const s = -25 + i * 3.3, x = riverCenter(s);
      vertices.push(x - 6.3, .06, -s, x + 6.3, .06, -s);
      if (i) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
      if (i % 2 === 0) marks.push({ p: [x, .075, -s], s: [.12, .02, 1.4] });
      if (i % 3 === 0) for (const side of [-1, 1]) rail.push({ p: [x + side * 6, .38, -s], s: [.16, .7, 1.2] });
    }
    const geometry = this.own(new BufferGeometry()); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, this.material(0x465452), this.root);
    this.instances(this.own(this.stamps[0].children[0].geometry.clone()), this.material(0xd8c388), marks);
    this.instances(this.own(this.stamps[0].children[0].geometry.clone()), this.material(0xc8b875), rail);
    this.ripple.visible = false;
    this.trails = new Group(); this.root.add(this.trails);
    this.trailPieces = [];
    const trailMaterial = this.material(0xf0d995, { emissive: 0xd3a54a, emissiveIntensity: .6 });
    const trailGeometry = this.own(this.stamps[0].children[0].geometry.clone());
    for (let i = 0; i < 12; i++) this.trailPieces.push(this.mesh(trailGeometry, trailMaterial, this.trails));
  }

  setCharacter(character) { this.character = character; this.profile = rideProfiles[character]; }
  canAttach(model) {
    if (!model || model.characterId !== this.character) return false;
    this.rider = new SeatedRider(model, this.character === 'si' ? this.shipMount : this.chairMount, this.config.actorHeight);
    return this.rider.supported;
  }
  mountRider() {
    const si = this.character === 'si';
    this.ship.visible = si; this.chair.visible = !si;
    this.inkBody.visible = si; this.dragon.visible = !si;
    this.petBody = si ? this.inkBody : this.dragon;
    this.arms = si ? this.inkArms : this.dragonArms;
    this.tail = si ? this.inkTail : this.dragonTail;
    this.rider.attach(); this.seatSpin = 0; this.lastSpins = 0; this.lastBumps = 0;
    this.shotUntil = this.lastTime = 0;
    // Start facing the viewer: the vehicles travel forwards, the passengers have
    // knowingly swivelled their seats backwards. A later spin reverses that gag.
    this.shipSeat.rotation.y = this.chairSeat.rotation.y = Math.PI;
  }
  restoreRider() { this.rider?.restore(); this.rider = null; }

  updateRider(engine, time) {
    const dt = Math.max(0, time - (this.lastTime || 0)); this.lastTime = time;
    const si = this.character === 'si';
    this.raft.position.y = this.profile.hover + Math.sin(time * 3) * (si ? .12 : .025);
    const routeHeading = -Math.atan(riverCenter(engine.progress + .5) - riverCenter(engine.progress - .5));
    this.raft.rotation.y = routeHeading - engine.heading;
    this.raft.rotation.z = Math.max(-.38, Math.min(.38, -engine.drift * .065 - engine.heading * .2));
    this.raft.rotation.x = si ? -.04 - (engine.boost ? .08 : 0) + engine.hit * .15 : engine.hit * -.17;
    if (engine.spins > this.lastSpins || engine.bumps > this.lastBumps) {
      this.seatSpin += Math.PI; this.lastSpins = engine.spins; this.lastBumps = engine.bumps;
      this.shotUntil = time + 1.4;
    }
    const seat = si ? this.shipSeat : this.chairSeat;
    const spin = si ? Math.sin(time * 12) * engine.hit * .4 : this.seatSpin;
    seat.rotation.y += (Math.PI + spin - seat.rotation.y) * (1 - Math.exp(-dt * 4));
    this.rider.update(time, engine.heading, engine.hit);
    for (const flame of this.flames) flame.scale.y = (engine.state === 'playing' ? 1.1 + Math.sin(time * 34) * .16 + (engine.boost ? 2 : 0) : .4);
    // Base stage writes the rope after this hook; height correction follows in update.
    this.ropeHeight = si ? 1.2 : .35;
    this.warning.rotation.z = Math.sin(time * 16) * engine.hit * .5;
    this.trailPieces.forEach((piece, i) => {
      const age = (time * 2 + i / 6) % 1;
      piece.visible = engine.state === 'playing' && (Math.abs(engine.drift) > .6 || engine.boost > 0);
      piece.position.set(engine.x + (i % 2 ? .8 : -.8), .09, engine.z + age * 10);
      piece.scale.set(.06, .02, .6 + age * 1.2);
    });
  }

  update(engine, delta) {
    super.update(engine, delta);
    if (!this.active) return;
    const rope = this.rope.geometry.attributes.position;
    for (let i = 0; i < rope.count; i++) rope.setY(i, rope.getY(i) + this.ropeHeight);
    rope.needsUpdate = true;
    this.pet.position.y += this.profile.hover + .2;
  }

  frameCamera(engine, delta = 0) {
    if (!this.active) return;
    const camera = this.scene.camera, rect = this.scene.renderer.domElement.getBoundingClientRect();
    const landscape = rect.width > rect.height, hover = this.profile.hover;
    const close = this.time < this.shotUntil;
    const angle = Math.atan2(engine.pet.x - engine.x, Math.max(2, engine.pet.z - engine.z)) + .25;
    this.desiredCameraDirection.set(Math.sin(angle) * .86, .5, Math.cos(angle) * .86);
    if (this.firstFrame || !delta) this.cameraDirection.copy(this.desiredCameraDirection);
    else this.cameraDirection.lerp(this.desiredCameraDirection, 1 - Math.exp(-delta * 3)).normalize();
    let index = 0;
    const si = this.character === 'si';
    const bounds = [[engine.x, hover, engine.z, si ? 1.8 : .95, 2.8, si ? 2.7 : 1.1]];
    if (!close) bounds.push([engine.pet.x, hover + .1, engine.pet.z, 1.1, 1.8, 1.1]);
    for (const [x, y, z, w, h, d] of bounds) {
      for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) this.framePoints[index++].set(x + sx * w, y + sy * h, z + sz * d);
    }
    this.target.set(close ? engine.x : (engine.x + engine.pet.x) * .5, hover + 1.3, close ? engine.z : (engine.z + engine.pet.z) * .5);
    if (this.firstFrame || !delta) this.look.copy(this.target); else this.look.lerp(this.target, 1 - Math.exp(-delta * 6));
    camera.clearViewOffset();
    camera.position.copy(this.look).addScaledVector(this.cameraDirection, 20); camera.lookAt(this.look);
    this.inverseCamera.copy(camera.quaternion).invert();
    const top = landscape ? 80 : 180, bottom = landscape ? 100 : 145;
    const visible = Math.max(.38, (rect.height - top - bottom) / rect.height);
    const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
    let distance = si ? 13 : 10;
    for (let i = 0; i < index; i++) {
      const point = this.framePoints[i];
      this.screenPoint.copy(point).sub(this.look).applyQuaternion(this.inverseCamera);
      distance = Math.max(distance, this.screenPoint.z + Math.abs(this.screenPoint.x) / (tanH * .86), this.screenPoint.z + Math.abs(this.screenPoint.y) / (tanV * visible * .92));
    }
    camera.position.copy(this.look).addScaledVector(this.cameraDirection, distance);
    camera.lookAt(this.look);
    camera.setViewOffset(rect.width, rect.height, 0, (bottom - top) / 2, rect.width, rect.height);
    camera.updateProjectionMatrix(); this.firstFrame = false;
  }

  detach() { const active = this.active; super.detach(); if (active) this.scene.camera.clearViewOffset(); }
}
