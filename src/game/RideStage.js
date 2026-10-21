import { BoxGeometry, BufferGeometry, CanvasTexture, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Shape, ShapeGeometry, TorusGeometry, Vector3 } from 'three';
import { RaftStage } from './RaftStage.js';
import { SeatedRider } from './SeatedRider.js';
import { rideConfig, rideProfiles } from '../config/rideConfig.js';
import { buildCompanion, buildMiniDijiang } from './RideProps.js';

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
    const mini = buildMiniDijiang(this);
    this.ship = mini.root; this.shipSeat = mini.seat; this.shipMount = mini.mount; this.flames = mini.flames;
    this.chair = new Group(); this.raft.add(this.ship, this.chair);
    this.chairSeat = new Group(); this.chairSeat.position.y = .85; this.chair.add(this.chairSeat);
    this.chairMount = new Group(); this.chairSeat.add(this.chairMount);
    this.pole = new Group();
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
    this.petBody.removeFromParent();
    this.inkProp = buildCompanion(this, 'ink'); this.dragonProp = buildCompanion(this, 'dragon');
    this.inkBody = this.inkProp.root; this.inkArms = this.inkProp.arms; this.inkTail = this.inkProp.tail;
    this.dragon = this.dragonProp.root; this.dragonArms = this.dragonProp.arms; this.dragonTail = this.dragonProp.tail;
    this.pet.add(this.inkBody, this.dragon); this.dragon.visible = false;

    this.buildRoad();
    this.buildEffects();
  }

  buildRoad() {
    const c = this.config, half = c.roadHalfWidth;
    const vertices = [], indices = [], marks = [], rail = [], barriers = [], stripes = [];
    const box = this.own(new BoxGeometry(1, 1, 1));
    const segments = Math.ceil((c.length + 70) / 5);
    for (let i = 0; i <= segments; i++) {
      const s = -25 + i * 5, x = this.center(s);
      vertices.push(x - half, .065, -s, x + half, .065, -s);
      if (i) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
      const angle = -Math.atan(this.center(s + .5) - this.center(s - .5));
      if (i % 2 === 0) for (const offset of [-3.5, 3.5]) marks.push({ p: [x + offset, .08, -s], s: [.12, .015, 3], r: [0, angle, 0] });
      if (i % 2 === 0) for (const side of [-1, 1]) rail.push({ p: [x + side * (half + .1), .42, -s], s: [.2, .8, 2], r: [0, angle, 0] });
    }
    const geometry = this.own(new BufferGeometry()); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, this.material(0x414f50), this.root);
    this.instances(box, this.material(0xdfdeba), marks);
    this.instances(box, this.material(0xd6be76), rail);
    this.obstacleRoot.removeFromParent(); this.obstacleRoot = null;
    for (const obstacle of c.obstacles) {
      const x = this.center(obstacle.s) + obstacle.offset;
      barriers.push({ p: [x, .6, -obstacle.s], s: [obstacle.radius * 1.7, 1.2, .7] });
      for (const side of [-1, 0, 1]) stripes.push({ p: [x + side * .45, .63, -obstacle.s + .36], s: [.2, 1.05, .025], r: [0, 0, -.45] });
    }
    this.instances(box, this.material(0xe4bc66), barriers);
    this.instances(box, this.material(0x273537), stripes);
    this.ripple.visible = false;
    const tank = this.own(new CylinderGeometry(.23, .23, .72, 10));
    const cap = this.own(new CylinderGeometry(.15, .15, .12, 8));
    const mint = this.material(0xa9d5b3, { emissive: 0x52765a, emissiveIntensity: .3 });
    const dark = this.material(0x253e37), amber = this.material(0xefd390);
    const pickupRing = this.own(new TorusGeometry(.65, .04, 5, 20));
    this.pickupMeshes = c.pickups.map(item => {
      const root = new Group(); root.position.set(this.center(item.s) + item.offset, 1.1, -item.s);
      this.mesh(tank, mint, root); this.mesh(cap, dark, root, [0, .42, 0]);
      this.mesh(pickupRing, amber, root);
      this.mesh(box, amber, root, [0, 0, .235], [.22, .32, .025]);
      this.mesh(this.own(new PlaneGeometry(.4, .09)), dark, root, [0, .13, .26]);
      this.root.add(root); return root;
    });
    // Two small tanks are strapped to the office chair, so the gas launch reads.
    for (const side of [-1, 1]) {
      this.mesh(tank, mint, this.chairSeat, [side * .56, .12, .5]);
      this.mesh(cap, dark, this.chairSeat, [side * .56, .54, .5]);
    }
    for (const [index, sector] of c.sectors.entries()) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const context = canvas.getContext('2d'); context.fillStyle = '#213b35'; context.fillRect(0, 0, 512, 128);
      context.fillStyle = '#e4d59e'; context.font = 'bold 34px sans-serif'; context.fillText(`${index + 1} / ${sector.name}`, 18, 52); context.font = '22px sans-serif'; context.fillText(sector.caption, 18, 96);
      const material = this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)) }));
      const x = this.center(sector.s + 30) + half + 1;
      this.mesh(box, dark, this.root, [x, 1.9, -sector.s - 30], [.12, 3.8, .12]);
      this.mesh(this.own(new PlaneGeometry(4.6, 1.15)), material, this.root, [x, 3.4, -sector.s - 30]);
    }
  }

  buildEffects() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d'), gradient = context.createRadialGradient(32, 32, 3, 32, 32, 30);
    gradient.addColorStop(0, '#eef1d9dd'); gradient.addColorStop(.5, '#bdd2b9bb'); gradient.addColorStop(1, '#8fba9b00'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    const smokeMaterial = this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)), transparent: true, depthWrite: false, opacity: .7 }));
    this.smoke = new InstancedMesh(this.own(new PlaneGeometry(1, 1)), smokeMaterial, 40);
    this.smoke.frustumCulled = false; this.root.add(this.smoke);
    const star = new Shape();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + Math.PI / 2, r = i % 2 ? .09 : .23; if (!i) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r); } star.closePath();
    this.stars = new InstancedMesh(this.own(new ShapeGeometry(star)), this.own(new MeshBasicMaterial({ color: 0xffd978, depthWrite: false })), 8);
    this.stars.frustumCulled = false; this.root.add(this.stars);
    this.trackMaterial = this.own(new MeshBasicMaterial({ color: 0x93d8d1 }));
    this.tracks = new InstancedMesh(this.own(new BoxGeometry(.1, .018, .85)), this.trackMaterial, 40);
    this.tracks.frustumCulled = false; this.root.add(this.tracks);
    this.puffs = Array.from({ length: 40 }, () => ({ life: 0 }));
    this.starParticles = Array.from({ length: 8 }, () => ({ life: 0 }));
    this.trackParticles = Array.from({ length: 40 }, () => ({ life: 0 }));
    this.emitter = new Vector3(); this.resetEffects();
  }

  resetEffects() {
    this.puffIndex = this.trackIndex = this.emitClock = this.trackClock = this.lastFXBumps = 0;
    for (const item of [...this.puffs, ...this.starParticles, ...this.trackParticles]) item.life = 0;
    for (const mesh of [this.smoke, this.stars, this.tracks]) mesh.visible = false;
  }

  puff(x, y, z, size, speed) {
    const i = this.puffIndex++, p = this.puffs[i % this.puffs.length];
    Object.assign(p, { x, y, z, life: 1, size, vx: Math.sin(i * 2.4) * 1.5, vy: .5 + i % 3 * .3, vz: -speed * .25 });
  }

  updateEffects(engine, delta) {
    const dt = engine.state === 'playing' ? Math.min(delta, .12) : 0;
    if (engine.bumps > this.lastFXBumps) {
      this.lastFXBumps = engine.bumps;
      for (let i = 0; i < 12; i++) this.puff(engine.x + Math.sin(i) * .6, this.profile.hover + .6, engine.z, 1.2, 0);
      this.starParticles.forEach((p, i) => Object.assign(p, { life: 1, x: engine.x, y: this.profile.hover + 1.7, z: engine.z, vx: Math.cos(i * 2.4) * 3, vy: 2.5 + i % 3, vz: Math.sin(i * 2.4) * 3 }));
    }
    const jet = engine.gasTime > 0 || engine.boost > 0;
    if (jet) {
      this.emitClock += dt;
      while (this.emitClock > .04) {
        this.emitClock -= .04; this.emitter.set(this.puffIndex % 2 ? .8 : -.8, .35, this.character === 'si' ? 2.8 : .6); this.raft.localToWorld(this.emitter);
        this.puff(this.emitter.x, this.emitter.y, this.emitter.z, engine.gasTime ? 2.2 : 1.2, engine.speed);
      }
    }
    if (engine.isDrifting) {
      this.trackClock += dt;
      while (this.trackClock > .045) {
        this.trackClock -= .045;
        for (const side of [-1, 1]) { this.emitter.set(side * .65, 0, .25); this.raft.localToWorld(this.emitter); Object.assign(this.trackParticles[this.trackIndex++ % 40], { x: this.emitter.x, z: this.emitter.z, angle: this.raft.rotation.y, life: 1 }); }
      }
    }
    this.trackMaterial.color.set([0x93d8d1, 0x93d8d1, 0xf1b66d, 0xc3a1f4][engine.driftTier]);
    this.smoke.visible = this.stars.visible = this.tracks.visible = true;
    this.puffs.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt * 1.15);
      if (p.life) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; }
      this.temp.position.set(p.x || 0, p.y || 0, p.z || 0); this.temp.quaternion.copy(this.scene.camera.quaternion); this.temp.scale.setScalar(p.life ? p.size * (.25 + 1 - p.life) * Math.min(1, p.life * 4) : 0); this.temp.updateMatrix(); this.smoke.setMatrixAt(i, this.temp.matrix);
    });
    this.starParticles.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt * 1.7);
      if (p.life) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 9; }
      this.temp.position.set(p.x || 0, p.y || 0, p.z || 0); this.temp.quaternion.copy(this.scene.camera.quaternion); this.temp.rotateZ(this.time * (i % 2 ? 8 : -8)); this.temp.scale.setScalar(p.life * 2); this.temp.updateMatrix(); this.stars.setMatrixAt(i, this.temp.matrix);
    });
    this.trackParticles.forEach((p, i) => { p.life = Math.max(0, p.life - dt * .7); this.temp.position.set(p.x || 0, .09, p.z || 0); this.temp.rotation.set(0, p.angle || 0, 0); this.temp.scale.setScalar(p.life); this.temp.updateMatrix(); this.tracks.setMatrixAt(i, this.temp.matrix); });
    for (const mesh of [this.smoke, this.stars, this.tracks]) mesh.instanceMatrix.needsUpdate = true;
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
    this.saved.fov = this.scene.camera.fov;
    this.renderSpeed = this.config.speed; this.jetting = false; this.resetEffects();
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
    const routeHeading = -Math.atan(this.center(engine.progress + .5) - this.center(engine.progress - .5));
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
    this.renderSpeed = engine.speed; this.jetting = engine.boost > 0 || engine.gasTime > 0;
    for (const flame of this.flames) flame.scale.y = (engine.state === 'playing' ? .9 + Math.sin(time * 34) * .16 + (engine.gasTime ? 3 : engine.boost ? 1.8 : 0) : .4);
    // Base stage writes the rope after this hook; height correction follows in update.
    this.ropeHeight = si ? 1.2 : .35;
    this.warning.rotation.z = Math.sin(time * 16) * engine.hit * .5;
    this.pickupMeshes.forEach((mesh, i) => { mesh.visible = !engine.pickups.has(i); mesh.position.y = 1.1 + Math.sin(time * 3 + i) * .14; mesh.rotation.y = time * 1.5; });
    const prop = si ? this.inkProp : this.dragonProp;
    prop.face.material.map = prop.maps[engine.hit > .1 || engine.gasTime > 0 ? 1 : 0];
    this.petBody.scale.set(.85 + engine.hit * .2, .85 - engine.hit * .25, .85 + engine.hit * .2);
  }

  update(engine, delta) {
    super.update(engine, delta);
    if (!this.active) return;
    const rope = this.rope.geometry.attributes.position;
    for (let i = 0; i < rope.count; i++) rope.setY(i, rope.getY(i) + this.ropeHeight);
    rope.needsUpdate = true;
    this.pet.position.y += this.profile.hover + .2;
    this.updateEffects(engine, delta);
  }

  frameCamera(engine, delta = 0) {
    if (!this.active) return;
    const camera = this.scene.camera, rect = this.scene.renderer.domElement.getBoundingClientRect();
    camera.fov = (this.saved.fov || 40) + Math.max(0, Math.min(1, (this.renderSpeed - this.config.speed) / 15)) * 8;
    const landscape = rect.width > rect.height, hover = this.profile.hover;
    const close = this.time < this.shotUntil;
    const angle = Math.atan2(engine.pet.x - engine.x, Math.max(2, engine.pet.z - engine.z)) + .25;
    this.desiredCameraDirection.set(Math.sin(angle) * .86, .5, Math.cos(angle) * .86);
    if (this.firstFrame || !delta) this.cameraDirection.copy(this.desiredCameraDirection);
    else this.cameraDirection.lerp(this.desiredCameraDirection, 1 - Math.exp(-delta * 3)).normalize();
    let index = 0;
    const si = this.character === 'si';
    const bounds = [[engine.x, hover, engine.z, si ? 1.8 : .95, 3, si ? 3.5 : 1.1]];
    if (!close) bounds.push([engine.pet.x, hover + .1, engine.pet.z, 1.1, 2.5, 1.1]);
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
    camera.position.x += Math.sin(this.time * 83) * engine.hit ** 2 * .14;
    camera.position.y += Math.cos(this.time * 71) * engine.hit ** 2 * .07;
    camera.lookAt(this.look);
    camera.setViewOffset(rect.width, rect.height, 0, (bottom - top) / 2, rect.width, rect.height);
    camera.updateProjectionMatrix(); this.firstFrame = false;
  }

  detach() {
    const active = this.active, fov = this.saved?.fov;
    super.detach();
    if (active) { this.scene.camera.fov = fov; this.scene.camera.clearViewOffset(); this.scene.camera.updateProjectionMatrix(); }
  }
}
