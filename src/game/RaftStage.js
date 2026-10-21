import {
  BoxGeometry, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry,
  Float32BufferAttribute, Fog, Group, InstancedMesh, Line, LineBasicMaterial,
  Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping,
  SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { raftConfig, riverCenter } from '../config/raftConfig.js';

// Original low-poly scenery and an approximate ink companion. All resources are
// owned here; the original GLB, its materials and the shared renderer stay intact.
export class RaftStage {
  constructor(scene, camera, models, config = raftConfig) {
    this.config = config;
    this.center = config.center || riverCenter;
    this.scene = scene;
    this.camera = camera;
    this.models = models;
    this.root = new Group();
    this.root.name = 'qingbo-raft-prototype';
    this.root.visible = false;
    scene.scene.add(this.root);
    this.resources = new Set();
    this.temp = new Object3D();
    this.target = new Vector3();
    this.look = new Vector3();
    this.active = false;
    this.time = 0;
    this.build();
  }

  own(resource) { this.resources.add(resource); return resource; }
  material(color, extra = {}) { return this.own(new MeshStandardMaterial({ color, roughness: .85, ...extra })); }
  mesh(geometry, material, parent, position = [0, 0, 0], scale = [1, 1, 1]) {
    const mesh = new Mesh(geometry, material);
    mesh.position.fromArray(position);
    mesh.scale.fromArray(scale);
    parent.add(mesh);
    return mesh;
  }
  instances(geometry, material, transforms) {
    const mesh = new InstancedMesh(geometry, material, transforms.length);
    transforms.forEach(({ p, s, r = [0, 0, 0] }, i) => {
      this.temp.position.fromArray(p);
      this.temp.scale.fromArray(s);
      this.temp.rotation.fromArray(r);
      this.temp.updateMatrix();
      mesh.setMatrixAt(i, this.temp.matrix);
    });
    this.root.add(mesh);
    return mesh;
  }

  build() {
    const box = this.own(new BoxGeometry(1, 1, 1));
    const sphere = this.own(new SphereGeometry(1, 12, 8));
    const cylinder = this.own(new CylinderGeometry(1, 1, 1, 7));
    const cone = this.own(new ConeGeometry(1, 1, 5));
    const wood = this.material(0x967b49), bamboo = this.material(0x879654);
    const dark = this.material(0x182929), pale = this.material(0xe3e1c6);
    const leaf = this.material(0x496e55), rock = this.material(0x647b6b);
    const jade = this.material(0xb5e8bf, { emissive: 0x497f67, emissiveIntensity: .55 });
    this.foam = this.material(0xd8eee0, { transparent: true, opacity: .62, depthWrite: false });

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#457e73'; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 24; i++) {
      ctx.strokeStyle = i % 3 ? '#78a999' : '#acc9ad'; ctx.globalAlpha = .28;
      ctx.beginPath(); ctx.ellipse((i * 47) % 128, (i * 31) % 128, 9 + i % 13, 1.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    this.waterTexture = this.own(new CanvasTexture(canvas));
    this.waterTexture.wrapS = this.waterTexture.wrapT = RepeatWrapping;
    this.waterTexture.repeat.set(9, 55);
    const water = this.mesh(this.own(new PlaneGeometry(100, Math.max(340, this.config.length + 100))), this.material(0xb6d2af, { map: this.waterTexture, roughness: .45 }), this.root, [0, -.08, -this.config.length / 2]);
    water.rotation.x = -Math.PI / 2;

    // Two continuous banks, rather than hundreds of terrain tiles.
    for (const side of [-1, 1]) {
      const vertices = [], indices = [];
      for (let i = 0; i <= Math.ceil((this.config.length + 100) / 3.2); i++) {
        const s = -25 + i * 3.2, center = this.center(s);
        for (const width of [this.config.riverHalfWidth, 35]) vertices.push(center + side * width, .05, -s);
        if (i) { const j = i * 2; indices.push(j - 2, j, j - 1, j - 1, j, j + 1); }
      }
      const geometry = this.own(new BufferGeometry());
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometry.setIndex(side === 1 ? indices.reverse() : indices);
      geometry.computeVertexNormals();
      this.mesh(geometry, this.material(0x58785b), this.root);
    }
    const stems = [], leaves = [], rocks = [], huts = [], roofs = [], piers = [];
    for (let i = 0; i < Math.ceil((this.config.length + 50) / 3.2); i++) {
      const s = i * 3.2 - 15, side = i % 2 ? 1 : -1;
      const x = this.center(s) + side * (this.config.riverHalfWidth + 1.7 + i % 5 * .8), height = 3.7 + i % 4;
      stems.push({ p: [x, height / 2, -s], s: [.1, height, .1], r: [0, 0, side * .07] });
      for (let j = 0; j < 3; j++) {
        leaves.push({ p: [x + Math.sin(i + j) * .5, height - .4 - j * .55, -s], s: [1.65, .06, .5], r: [.2, i + j * 1.3, side * .32] });
      }
      if (i % 3 === 0) rocks.push({ p: [this.center(s) + side * (this.config.riverHalfWidth + .6), .25, -s], s: [1.6, 1.1, 1.2], r: [.1, i, .3] });
      if (i % 10 === 0) {
        huts.push({ p: [x + side * 3, 1.3, -s], s: [3.2, 2.5, 3] });
        roofs.push({ p: [x + side * 3, 3, -s], s: [3.5, 1.9, 3.5], r: [0, Math.PI / 4, 0] });
      }
      if (i % 13 === 0) piers.push({ p: [this.center(s) + side * (this.config.riverHalfWidth - .8), .35, -s], s: [3.2, .3, 3.6] });
    }
    this.instances(cylinder, bamboo, stems);
    this.instances(box, leaf, leaves);
    this.instances(sphere, rock, rocks);
    this.instances(box, wood, huts);
    this.instances(this.own(new ConeGeometry(1, 1, 4)), dark, roofs);
    this.instances(box, wood, piers);

    // A simple landmark waterwheel, all rigid pieces reused.
    this.wheel = new Group(); this.wheel.position.set(this.center(50) + this.config.riverHalfWidth + 2.7, 2.5, -50); this.root.add(this.wheel);
    const wheelRim = this.own(new TorusGeometry(2.8, .14, 5, 28));
    this.mesh(wheelRim, wood, this.wheel).rotation.y = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const spoke = this.mesh(box, wood, this.wheel, [0, 0, 0], [.13, 5.5, .13]); spoke.rotation.x = angle;
      const paddle = this.mesh(box, bamboo, this.wheel, [0, Math.cos(angle) * 2.7, Math.sin(angle) * 2.7], [1.4, .28, .6]); paddle.rotation.x = angle;
    }
    this.obstacleRoot = new Group(); this.root.add(this.obstacleRoot);
    for (const o of this.config.obstacles) {
      const x = this.center(o.s) + o.offset;
      this.mesh(cylinder, wood, this.obstacleRoot, [x, .6, -o.s], [o.radius * .65, 1.4, o.radius * .65]);
      this.mesh(cylinder, pale, this.obstacleRoot, [x, 1.32, -o.s], [o.radius * .68, .08, o.radius * .68]);
    }
    const stampGeometry = this.own(new TorusGeometry(.55, .12, 6, 16));
    this.stamps = this.config.stamps.map(o => {
      const mesh = this.mesh(stampGeometry, jade, this.root, [this.center(o.s) + o.offset, .95, -o.s]);
      this.mesh(box, pale, mesh, [0, 0, 0], [.3, .3, .15]).rotation.z = Math.PI / 4;
      return mesh;
    });
    // Finish pier and arch remain visibly different from ordinary scenery.
    const endX = this.center(this.config.length), archHalf = this.config.roadHalfWidth || 5.8;
    this.mesh(box, wood, this.root, [endX, .1, -this.config.length - 5], [archHalf * 2, .3, 4]);
    for (const side of [-1, 1]) this.mesh(cylinder, bamboo, this.root, [endX + side * archHalf, 3, -this.config.length], [.16, 6, .16]);
    this.mesh(box, dark, this.root, [endX, 5.6, -this.config.length], [archHalf * 2 + .8, .5, .9]);

    this.raft = new Group(); this.root.add(this.raft);
    this.buildVehicles({ box, sphere, cylinder, cone, wood, bamboo, dark, pale, jade });

    this.pet = new Group(); this.root.add(this.pet);
    this.petBody = new Group(); this.pet.add(this.petBody);
    this.mesh(sphere, dark, this.petBody, [0, .6, 0], [.73, .85, .66]);
    this.mesh(sphere, pale, this.petBody, [0, .43, .43], [.52, .57, .26]);
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = this.mesh(sphere, dark, this.petBody, [side * .7, .5, .03], [.38, .15, .22]); this.arms.push(arm);
      this.mesh(sphere, dark, this.petBody, [side * .3, -.04, .28], [.2, .13, .35]);
      const eye = this.mesh(box, jade, this.petBody, [side * .24, .86, .61], [.095, .25, .045]); eye.rotation.z = side * -.23;
      this.mesh(box, jade, this.petBody, [side * .37, .59, .65], [.13, .04, .04]);
    }
    this.mesh(box, dark, this.petBody, [0, .44, .695], [.16, .05, .03]);
    this.tail = this.mesh(cone, dark, this.petBody, [0, .65, -.7], [.3, 1.2, .3]); this.tail.rotation.x = -1.05;

    const ropeGeometry = this.own(new BufferGeometry());
    ropeGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(27), 3));
    this.rope = new Line(ropeGeometry, this.own(new LineBasicMaterial({ color: 0xe5d1a0 })));
    this.rope.frustumCulled = false; this.root.add(this.rope);
    this.ripple = new InstancedMesh(this.own(new TorusGeometry(1, .025, 3, 16)), this.foam, 16);
    this.ripple.frustumCulled = false; this.root.add(this.ripple);
    this.splashes = new InstancedMesh(sphere, this.foam, 14);
    this.splashes.frustumCulled = false; this.root.add(this.splashes);
    this.splashAt = new Vector3();
    this.cameraPosition = new Vector3();
  }

  buildVehicles({ box, cylinder, wood, bamboo }) {
    for (let i = 0; i < 7; i++) {
      const log = this.mesh(cylinder, bamboo, this.raft, [(i - 3) * .29, .14, 0], [.17, 3.5, .17]); log.rotation.x = Math.PI / 2;
    }
    for (const z of [-1.1, 1.1]) this.mesh(box, wood, this.raft, [0, .32, z], [2.2, .09, .12]);
    this.pole = this.mesh(cylinder, wood, this.raft, [-1.05, 1.1, -.5], [.035, 3.6, .035]); this.pole.rotation.z = -.3;
  }

  attach() {
    if (this.active) return true;
    const model = this.models.current;
    if (!this.canAttach(model)) return false;
    this.model = model;
    const { group, idle } = model;
    this.saved = {
      parent: group.parent, position: group.position.clone(), rotation: group.quaternion.clone(), scale: group.scale.clone(),
      playing: idle.playing, background: this.scene.scene.background, fog: this.scene.scene.fog,
      near: this.scene.camera.near, far: this.scene.camera.far,
    };
    this.mountRider(model);
    this.root.visible = this.active = true;
    this.time = 0;
    this.camera.transition = this.camera.story = null; this.camera.stopShoeOrbit(); this.camera.controls.enabled = false;
    this.scene.camera.clearViewOffset(); this.scene.camera.near = .1; this.scene.camera.far = 150;
    this.scene.scene.background = new Color(0xa9c3af); this.scene.scene.fog = new Fog(0xa9c3af, 28, 105);
    this.firstFrame = true;
    return true;
  }

  canAttach(model) { return model?.characterId === 'si' && model.idle.supported; }

  mountRider(model) {
    const { group, idle } = model;
    idle.stopGesture(); idle.setPlaying(false); idle.update(3, this.scene.camera.position); idle.transition = null;
    idle.applyBody(null, 0); idle.applyPose(idle.head, 0, 0, 0); idle.setBlink(0);
    this.bones = idle.transitionBones.map(bone => ({ bone, p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone() }));
    const scale = this.config.actorHeight / idle.height;
    this.raft.add(group);
    group.scale.setScalar(scale);
    group.rotation.set(0, Math.PI, 0);
    group.position.copy(this.saved.position).multiplyScalar(scale).applyQuaternion(group.quaternion).add(new Vector3(0, this.config.actorHeight / 2 + .37, 0));
  }

  update(engine, delta) {
    if (!this.active) return;
    const dt = engine.state === 'playing' ? Math.min(delta, .12) : 0;
    this.time += dt;
    const t = this.time, p = engine.pet;
    const slope = (this.center(engine.progress + .5) - this.center(engine.progress - .5)) + engine.velocity / Math.max(engine.speed, 1);
    this.raft.position.set(engine.x, Math.sin(t * 2.4) * .045, engine.z);
    this.raft.rotation.set(Math.sin(t * 2) * .025, -Math.atan(slope), -engine.velocity * .045 + Math.sin(t * 2.8) * .02);
    this.pole.rotation.x = Math.sin(t * 4) * .14;
    this.updateRider(engine, t);
    this.pet.position.set(p.x, .23 + Math.abs(Math.sin(t * 4)) * .17, p.z);
    // The passenger looks back at the player so its white face remains readable.
    this.pet.rotation.y = Math.atan2(engine.x - p.x, Math.max(.5, p.z - engine.z)) + Math.sin(t * 5) * .12;
    this.petBody.rotation.z = Math.max(-.7, Math.min(.7, -p.vx * .1));
    this.arms.forEach((arm, i) => arm.rotation.z = Math.sin(t * 10 + i * 2) * .45);
    this.tail.rotation.z = Math.sin(t * 8) * .25;
    const rope = this.rope.geometry.attributes.position;
    for (let i = 0; i < 9; i++) {
      const a = i / 8;
      rope.setXYZ(i, engine.x + (p.x - engine.x) * a, .38 - Math.sin(a * Math.PI) * .2, engine.z + 1.35 + (p.z - engine.z - 1.35) * a);
    }
    rope.needsUpdate = true;
    this.waterTexture.offset.y = t * .012;
    this.wheel.rotation.x = t * -.22;
    this.stamps.forEach((mesh, i) => { mesh.visible = !engine.ink.has(i); mesh.rotation.y = t * .9; mesh.position.y = .95 + Math.sin(t * 3 + i) * .12; });
    for (let i = 0; i < 16; i++) {
      const phase = (t * 1.8 + i / 8) % 1, pet = i >= 8;
      this.temp.position.set((pet ? p.x : engine.x) + (i % 2 ? .28 : -.28), .015, (pet ? p.z : engine.z) + 1 + phase * 4);
      this.temp.scale.set(.2 + phase * .7, .13 + phase * .3, 1);
      this.temp.rotation.set(-Math.PI / 2, 0, 0); this.temp.updateMatrix(); this.ripple.setMatrixAt(i, this.temp.matrix);
    }
    this.ripple.instanceMatrix.needsUpdate = true;
    if (engine.hit > .95) this.splashAt.set(engine.x, 0, engine.z);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, life = 1 - engine.hit;
      this.temp.position.set(this.splashAt.x + Math.cos(a) * life * 3, Math.max(0, Math.sin(life * Math.PI) * (1 + i % 3 * .3)), this.splashAt.z + Math.sin(a) * life * 3);
      this.temp.scale.setScalar(engine.hit > 0 ? .08 + engine.hit * .08 : 0);
      this.temp.rotation.set(0, 0, 0); this.temp.updateMatrix(); this.splashes.setMatrixAt(i, this.temp.matrix);
    }
    this.splashes.instanceMatrix.needsUpdate = true;
    this.frameCamera(engine, dt);
  }

  updateRider(engine, t) {
    const idle = this.model.idle;
    for (const { bone, p, q, s } of this.bones) { bone.position.copy(p); bone.quaternion.copy(q); bone.scale.copy(s); }
    for (const { name, pose } of idle.body) {
      const rest = idle.config.restBody[name] || [0, 0, 0];
      let pitch = 0, roll = 0;
      if (name === 'spine') { pitch = .1; roll = engine.velocity * .035; }
      if (name.startsWith('knee')) pitch = .1 + Math.sin(t * 3) * .04;
      if (name === 'armL') { pitch = -.45; roll = -.25; }
      if (name === 'armR') { pitch = -.2; roll = .12 + engine.velocity * .05; }
      idle.applyPose(pose, rest[0] + pitch, rest[1], rest[2] + roll);
    }
    idle.applyPose(idle.head, -.04, -.45 + Math.sin(t * .6) * .18, -engine.velocity * .025);
    idle.setBlink(Math.max(0, 1 - Math.abs((t % 4.6) - .12) / .12));
  }

  frameCamera(engine, delta = 0) {
    if (!this.active) return;
    const camera = this.scene.camera, landscape = camera.aspect > 1.3;
    // Bias toward the closer, trailing passenger; a leader-only camera clips it
    // on portrait screens. Pull back a little during the widest lateral swings.
    this.target.set(engine.x * .42 + engine.pet.x * .58, .8, engine.z + (engine.pet.z - engine.z) * .5);
    if (this.firstFrame || !delta) this.look.copy(this.target);
    else this.look.lerp(this.target, 1 - Math.exp(-delta * 5));
    const pullBack = Math.max(0, Math.abs(engine.pet.x - engine.x) - 1.5) * .55;
    this.cameraPosition.set(3.7, (landscape ? 6.4 : 8.7) + pullBack * .3, (landscape ? 10.5 : 14.5) + pullBack).add(this.look);
    camera.position.copy(this.cameraPosition);
    camera.lookAt(this.look);
    camera.updateProjectionMatrix();
    this.firstFrame = false;
  }

  restoreRider() {
    for (const { bone, p, q, s } of this.bones) { bone.position.copy(p); bone.quaternion.copy(q); bone.scale.copy(s); }
  }

  detach() {
    if (!this.active) return;
    const { group, idle } = this.model, saved = this.saved;
    saved.parent.add(group); group.position.copy(saved.position); group.quaternion.copy(saved.rotation); group.scale.copy(saved.scale);
    this.restoreRider();
    idle.setPlaying(saved.playing);
    this.scene.scene.background = saved.background; this.scene.scene.fog = saved.fog;
    this.scene.camera.near = saved.near; this.scene.camera.far = saved.far;
    this.scene.camera.updateProjectionMatrix();
    this.root.visible = this.active = false;
    this.model = null;
  }

  dispose() {
    this.detach();
    this.root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    this.root.removeFromParent();
    for (const resource of this.resources) resource.dispose();
  }
}
