import { BoxGeometry, BufferGeometry, CanvasTexture, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Shape, ShapeGeometry, TorusGeometry, Vector3 } from 'three';
import { RaftStage } from './RaftStage.js';
import { SeatedRider } from './SeatedRider.js';
import { RideOpponent } from './RideOpponent.js';
import { rideConfig, rideProfiles, zhuangRideConfig } from '../config/rideConfig.js';
import { buildCompanion, buildFlyingBrush, animateCompanion } from './RideProps.js';
import { takeoverBlend, zhuangRace } from './ZhuangRaceStory.js';

// A fan-made flying brush and a runaway office chair, not official assets.
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
    const brush = buildFlyingBrush(this);
    this.brush = brush.root; this.brushSeat = brush.seat; this.brushMount = brush.mount; this.flames = brush.flames;this.brushCharge=brush.charge;
    this.chair = new Group(); this.raft.add(this.brush, this.chair);
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
    this.chairWheels = [];
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const spoke = this.mesh(box, steel, this.chair, [Math.sin(angle) * .36, .16, Math.cos(angle) * .36], [.1, .09, .8]); spoke.rotation.y = angle;
      const wheel = this.mesh(cylinder, dark, this.chair, [Math.sin(angle) * .73, .12, Math.cos(angle) * .73], [.13, .13, .13]); wheel.rotation.z = Math.PI / 2; this.chairWheels.push(wheel);
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
    this.buildStoryProps();
    this.buildDragonHazards();
    this.opponent = this.config.airHazards ? new RideOpponent(this) : null;
  }

  buildStoryProps() {
    const box = this.own(new BoxGeometry(1, 1, 1));
    this.spell = new Group(); this.raft.add(this.spell);
    const glow = this.own(new MeshBasicMaterial({ color: 0xe7db8d, transparent: true, opacity: .85, depthWrite: false }));
    const ring = this.mesh(this.own(new TorusGeometry(1.25, .045, 4, 32)), glow, this.spell);
    ring.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const rune = this.mesh(box, glow, this.spell, [Math.cos(a) * 1.25, .12, Math.sin(a) * 1.25], [.15, .24, .15]);
      rune.rotation.y = a;
    }
    this.spell.visible = false;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#243e35'; ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#dfce88'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 180);
    ctx.fillStyle = '#efe6b9'; ctx.textAlign = 'center'; ctx.font = 'bold 46px sans-serif'; ctx.fillText('冠軍神祕獎品', 256, 78);
    ctx.font = 'bold 35px sans-serif'; ctx.fillText('贊助：管理員', 256, 145);
    this.sponsorBoard = this.mesh(this.own(new PlaneGeometry(5, 1.875)), this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)) })), this.root, [this.center(105) + 6, 3.2, -105]);
    this.sponsorBoard.visible = false;
  }

  updateStoryProps(engine) {
    const zhuang = this.character === 'zhuang';
    this.sponsorBoard.visible = zhuang;
    this.spell.visible = zhuang && (engine.gasTime > 0 || engine.flying);
    this.spell.position.y = .18; this.spell.rotation.y = this.time * (engine.flying ? 5 : 2);
    this.spell.scale.setScalar((engine.flying ? 1.4 : 1) + Math.sin(this.time * 12) * .08);
    this.chairWheels.forEach(wheel => { wheel.position.y = engine.flying ? .6 : .12; });
    this.airSigns?.forEach((mesh, i) => {
      if (engine.airHit.has(i)) {
        this.signHitAt[i] ??= this.time;
        const t = this.time - this.signHitAt[i];
        mesh.rotation.z = Math.min(1.5, t * 3) * (i % 2 ? -1 : 1);
        mesh.position.y = this.config.airHazards[i].height - t * 2;
        mesh.visible = t < 1.4;
      } else { mesh.visible = true; mesh.rotation.z = 0; mesh.position.y = this.config.airHazards[i].height; }
    });
    this.roadSigns?.forEach((mesh, i) => { mesh.rotation.z = engine.groundHit.has(i) ? .9 : 0; });
  }

  buildDragonHazards() {
    this.airSigns = []; this.roadSigns = []; this.signHitAt = [];
    if (!this.config.airHazards) return;
    const box = this.own(new BoxGeometry(1, 1, 1)), dark = this.material(0x294b45), gold = this.material(0xe5c47d);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = '#ebd69b18'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#e8d391cc'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 506, 122);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(512, 128); ctx.moveTo(512, 0); ctx.lineTo(0, 128); ctx.stroke();
    ctx.fillStyle = '#e8d391cc'; ctx.font = 'bold 80px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 256, 93);
    const material = this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)), transparent: true, depthWrite: false }));
    const airTags = new Map();
    for (const item of this.config.airHazards) {
      const root = new Group(); root.position.set(this.center(item.s) + item.offset, item.height, -item.s); this.root.add(root);
      this.mesh(this.own(new PlaneGeometry(item.width, item.tall)), material, root);
      this.mesh(box, dark, root, [0, item.tall / 2, 0], [item.width, .16, .18]);
      for (const side of [-1, 1]) this.mesh(box, gold, root, [side * item.width * .46, -item.tall * .4, 0], [.12, item.tall * 1.5, .12]);
      if (!airTags.has(item.name)) {
        const tagCanvas = document.createElement('canvas'); tagCanvas.width = 320; tagCanvas.height = 64;
        const tag = tagCanvas.getContext('2d'); tag.fillStyle = '#213c32'; tag.fillRect(0, 0, 320, 64);
        tag.fillStyle = '#e8d391'; tag.font = 'bold 40px sans-serif'; tag.textAlign = 'center'; tag.fillText(item.name, 160, 47);
        airTags.set(item.name, this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(tagCanvas)) })));
      }
      this.mesh(this.own(new PlaneGeometry(2.6, .52)), airTags.get(item.name), root, [0, item.tall / 2 + .2, .1]);
      this.airSigns.push(root);
    }
    for (const item of this.config.petHazards) {
      const root = new Group(); root.position.set(this.center(item.s) + item.offset, .65, -item.s); this.root.add(root);
      this.mesh(box, dark, root, [0, -.2, 0], [.18, 1.4, .18]);
      const sign = this.mesh(box, gold, root, [0, .4, 0], [1.2, 1.2, .18]); sign.rotation.z = Math.PI / 4;
      this.mesh(box, dark, root, [0, .4, .12], [.2, .65, .08]);
      sign.visible = false;
      const paper = this.material(0xe6dec4), ink = this.material(0x244738);
      if (item.name === '加班打卡機') {
        this.mesh(box, dark, root, [0, .25, 0], [1.2, 1.45, .7]);
        this.mesh(box, gold, root, [0, .48, .37], [.75, .38, .05]);
        this.mesh(box, ink, root, [0, .06, .38], [.65, .08, .05]);
      } else if (item.name === '待辦事項') {
        for (let n = 0; n < 5; n++) this.mesh(box, paper, root, [(n % 2 - .5) * .18, -.2 + n * .19, 0], [1.5, .14, .9]);
      } else if (item.name === '會議邀請' || item.name === '休假申請') {
        this.mesh(box, item.name === '會議邀請' ? paper : gold, root, [0, .25, 0], [1.6, 1.15, .45]);
        this.mesh(box, ink, root, [.35, .9, 0], [.6, .18, .45]);
      } else {
        sign.visible = true;
      }
      const tagCanvas = document.createElement('canvas'); tagCanvas.width = 384; tagCanvas.height = 96;
      const tag = tagCanvas.getContext('2d'); tag.fillStyle = '#203c32'; tag.fillRect(0, 0, 384, 96);
      tag.fillStyle = '#f0dfa6'; tag.font = 'bold 58px sans-serif'; tag.textAlign = 'center'; tag.fillText(item.name, 192, 70);
      this.mesh(this.own(new PlaneGeometry(1.8, .45)), this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(tagCanvas)) })), root, [0, 1.18, .49]);
      this.roadSigns.push(root);
    }
  }

  buildRoad() {
    const c = this.config, half = c.roadHalfWidth;
    const vertices = [], indices = [], marks = [], rail = [], barriers = [], stripes = [];
    const box = this.own(new BoxGeometry(1, 1, 1));
    const segments = Math.ceil((c.length + 70) / 5);
    for (let i = 0; i <= segments; i++) {
      const s = -25 + i * 5, x = this.center(s);
      vertices.push(x - half, .065, -s, x + half, .065, -s);
      const inGap=c.jumps.some(j=>s>j.gapStart&&s<=j.gapEnd);
      if (i&&!inGap) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
      const angle = -Math.atan(this.center(s + .5) - this.center(s - .5));
      if (i % 2 === 0&&!inGap) for (const offset of [-3.5, 3.5]) marks.push({ p: [x + offset, .08, -s], s: [.12, .015, 3], r: [0, angle, 0] });
      if (i % 2 === 0) for (const side of [-1, 1]) rail.push({ p: [x + side * (half + .1), .42, -s], s: [.2, .8, 2], r: [0, angle, 0] });
    }
    const geometry = this.own(new BufferGeometry()); geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(geometry, this.material(0x414f50), this.root);
    this.instances(box, this.material(0xdfdeba), marks);
    this.instances(box, this.material(0xd6be76), rail);
    for(const j of c.jumps){
      this.mesh(box,this.material(0x102d2a),this.root,[this.center((j.gapStart+j.gapEnd)/2),-.02,-(j.gapStart+j.gapEnd)/2],[half*2,.1,j.gapEnd-j.gapStart]);
      const ramp=this.mesh(box,this.material(0xc4b261),this.root,[this.center(j.s),.24,-j.s],[j.width,.4,6]);ramp.rotation.x=.1;
      for(let i=0;i<3;i++)for(const side of [-1,1]){const arrow=this.mesh(box,this.material(0xf5f1c6),this.root,[this.center(j.s)+side*.36,.49,-j.s+1.7-i*1.4],[.12,.03,1]);arrow.rotation.y=side*.7;}
      const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#334735';ctx.fillRect(0,0,384,96);ctx.fillStyle='#fff0ad';ctx.font='bold 38px sans-serif';ctx.textAlign='center';ctx.fillText('↑ 對準跳板・保留速度',192,62);
      this.mesh(this.own(new PlaneGeometry(4,.999)),this.own(new MeshBasicMaterial({map:this.own(new CanvasTexture(canvas))})),this.root,[this.center(j.s-40)+half-1,2.5,-j.s+40]);
    }
    this.obstacleRoot.removeFromParent(); this.obstacleRoot = null;
    for (const obstacle of c.obstacles) {
      const x = this.center(obstacle.s) + obstacle.offset;
      barriers.push({ p: [x, .6, -obstacle.s], s: [obstacle.radius * 1.7, 1.2, .7] });
      if (obstacle.name) {
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 80;
        const ctx = canvas.getContext('2d'); ctx.fillStyle = '#253e33'; ctx.fillRect(0, 0, 320, 80);
        ctx.fillStyle = '#f0dfa8'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(obstacle.name, 160, 58);
        this.mesh(this.own(new PlaneGeometry(1.8, .45)), this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)) })), this.root, [x, 1.35, -obstacle.s + .4]);
      }
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
    let refillMaterial;
    if (c.airHazards) {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 64;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#267ba9'; ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('＋1', 64, 50);
      refillMaterial = this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)) }));
    }
    const blue = this.material(0x73d4f0, { emissive: 0x288bb5, emissiveIntensity: .7 });
    this.pickupMeshes = c.pickups.map(item => {
      const root = new Group(); root.position.set(this.center(item.s) + item.offset, 1.1, -item.s);
      if (refillMaterial) {
        root.userData.cube = this.mesh(box, blue, root, [0, 0, 0], [.65, .75, .65]);
        this.mesh(pickupRing, blue, root);
        root.userData.label = this.mesh(this.own(new PlaneGeometry(1.05, .525)), refillMaterial, root, [0, .72, 0]);
        this.root.add(root); return root;
      }
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
    const smokeMaterial = this.own(new MeshBasicMaterial({ map: this.own(new CanvasTexture(canvas)), transparent: true, depthWrite: false, opacity: this.config.airHazards ? .3 : .7 }));
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
    this.rush = new InstancedMesh(this.own(new BoxGeometry(1, 1, 1)), this.own(new MeshBasicMaterial({ color: 0xffedac, transparent: true, opacity: .85, depthWrite: false })), 16);
    this.rush.frustumCulled = false; this.rush.visible = false; this.root.add(this.rush);
    this.emitter = new Vector3(); this.resetEffects();
  }

  resetEffects() {
    this.encoreReady=false;
    if(this.rope)this.rope.visible=true;
    if(this.opponent?.rope)this.opponent.rope.visible=true;
    if(this.opponent?.badge)this.opponent.badge.visible=true;
    this.petSpin = this.lastFXPetBumps = 0; this.signHitAt = [];
    this.puffIndex = this.trackIndex = this.emitClock = this.trackClock = this.lastFXBumps = 0;
    for (const item of [...this.puffs, ...this.starParticles, ...this.trackParticles]) item.life = 0;
    for (const mesh of [this.smoke, this.stars, this.tracks, this.rush]) mesh.visible = false;
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
    if (engine.isZhuang && engine.petBumps > this.lastFXPetBumps) {
      this.lastFXPetBumps = engine.petBumps;
      const p = engine.pet, power = engine.flying ? 2 : 1;
      this.starParticles.forEach((star, i) => Object.assign(star, { life: 1, x: p.x, y: p.y + .4, z: p.z, vx: Math.cos(i * 2.4) * 3 * power, vy: (2.5 + i % 3) * power, vz: Math.sin(i * 2.4) * 3 * power }));
      for (let i = 0; i < 6; i++) this.puff(p.x, p.y, p.z, power, 0);
    }
    const jet = engine.gasTime > 0 || engine.boost > 0 || engine.flying;
    if (jet) {
      this.emitClock += dt;
      const interval = engine.isZhuang ? .085 : .04;
      while (this.emitClock > interval) {
        this.emitClock -= interval; this.emitter.set(this.puffIndex % 2 ? .8 : -.8, .35, this.character === 'si' ? 2.8 : .6); this.raft.localToWorld(this.emitter);
        this.puff(this.emitter.x, this.emitter.y, this.emitter.z, engine.isZhuang ? engine.gasTime ? .85 : .5 : engine.gasTime ? 2.2 : 1.2, engine.speed);
      }
    }
    if (engine.isDrifting && !engine.flying) {
      this.trackClock += dt;
      while (this.trackClock > .045) {
        this.trackClock -= .045;
        for (const side of [-1, 1]) { this.emitter.set(side * .65, 0, .25); this.raft.localToWorld(this.emitter); Object.assign(this.trackParticles[this.trackIndex++ % 40], { x: this.emitter.x, z: this.emitter.z, angle: this.raft.rotation.y, life: 1 }); }
      }
    }
    this.rush.visible = engine.isZhuang && (engine.gasTime > 0 || engine.boost > 0 || (engine.flying && engine.elapsed - engine.flightStarted < 1));
    if (this.rush.visible) for (let i = 0; i < 16; i++) {
      const phase = (this.time * 2.5 + i / 16) % 1;
      this.emitter.set((i % 2 ? 1 : -1) * (.65 + phase * .7), .15 + (i % 4) * .18, .6 + phase * 6); this.raft.localToWorld(this.emitter);
      this.temp.position.copy(this.emitter); this.temp.quaternion.copy(this.raft.quaternion);
      this.temp.scale.set(.035, .025, .5 + phase * 2); this.temp.updateMatrix(); this.rush.setMatrixAt(i, this.temp.matrix);
    }
    if (this.rush.visible) this.rush.instanceMatrix.needsUpdate = true;
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

  setCharacter(character) {
    const config = character === 'zhuang' ? zhuangRideConfig : rideConfig;
    if (this.config !== config) {
      this.dispose();
      this.config = config; this.center = config.center;
      this.root = new Group(); this.root.visible = false; this.root.name = 'seated-ride-prototype';
      this.resources = new Set(); this.scene.scene.add(this.root); this.build();
    }
    this.character = character; this.profile = rideProfiles[character];
  }
  canAttach(model) {
    if (!model || model.characterId !== this.character) return false;
    this.rider = new SeatedRider(model, this.character === 'si' ? this.brushMount : this.chairMount, this.config.actorHeight, { sideSaddle: this.character === 'si' });
    return this.rider.supported;
  }
  mountRider() {
    const si = this.character === 'si';
    this.brush.visible = si; this.chair.visible = !si;
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
    this.brushSeat.rotation.y = this.chairSeat.rotation.y = Math.PI;
  }
  restoreRider() { this.rider?.restore(); this.rider = null; }

  updateRider(engine, time) {
    const dt = Math.max(0, time - (this.lastTime || 0)); this.lastTime = time;
    const si = this.character === 'si';
    this.raft.position.y = engine.height + this.profile.hover + Math.sin(time * 3) * (si ? .12 : .025);
    const routeHeading = -Math.atan(this.center(engine.progress + .5) - this.center(engine.progress - .5));
    this.raft.rotation.y = routeHeading - engine.heading;
    this.raft.rotation.z = Math.max(-.38, Math.min(.38, -engine.drift * .065 - engine.heading * .2));
    this.raft.rotation.x = si ? -.04 - (engine.boost ? .08 : 0) + engine.hit * .15 : engine.flying ? -.13 + Math.sin(time * 9) * .035 : engine.hit * -.17;
    if (engine.spins > this.lastSpins || engine.bumps > this.lastBumps) {
      if (si || engine.elapsed >= zhuangRace.raceAt) this.seatSpin += Math.PI;
      this.lastSpins = engine.spins; this.lastBumps = engine.bumps;
      this.shotUntil = time + 1.4;
    }
    const seat = si ? this.brushSeat : this.chairSeat;
    const spin = Math.sin(time * 12) * engine.hit * (si ? .4 : .25);
    const takeover = si ? 0 : takeoverBlend(engine.elapsed);
    seat.rotation.y += (Math.PI * (1 - takeover) + spin - seat.rotation.y) * (1 - Math.exp(-dt * 4));
    const flair=engine.prizeClock<engine.flairUntil;
    this.rider.update(time, engine.heading, engine.hit, si ? {jump:engine.jumpHeight(),lookBack:flair&&engine.flair===1?.6:0,wave:flair&&engine.flair===2}: { determined: takeover, magic: engine.gasTime > 0 || engine.flying, story:engine.storyPhase, jump:engine.jumpHeight(),grudge:engine.petGrudge });
    this.brushCharge.visible=si&&engine.gasTime>0;
    this.renderSpeed = engine.speed; this.jetting = engine.boost > 0 || engine.gasTime > 0 || engine.flying;
    for (const flame of this.flames) flame.scale.y = (engine.state === 'playing' ? .9 + Math.sin(time * 34) * .16 + (engine.gasTime ? 3 : engine.boost ? 1.8 : 0) : .4);
    // Base stage writes the rope after this hook; height correction follows in update.
    this.ropeHeight = si ? 1.2 : .35;
    this.warning.rotation.z = Math.sin(time * 16) * engine.hit * .5;
    this.pickupMeshes.forEach((mesh, i) => { mesh.visible = !engine.pickups.has(i); mesh.position.y = 1.1 + (this.config.pickups[i].s >= zhuangRace.flightAt && !si ? zhuangRace.flightHeight : 0) + Math.sin(time * 3 + i) * .14; mesh.rotation.y = si ? time * 1.5 : 0; if (mesh.userData.cube) mesh.userData.cube.rotation.y = time * 1.5; if (mesh.userData.label) mesh.userData.label.quaternion.copy(this.scene.camera.quaternion); });
    const prop = si ? this.inkProp : this.dragonProp;
    animateCompanion(prop,time,{mood:engine.petMood,wave:(!si&&engine.takeoffPending)||flair&&engine.flair===2?1:0,stress:engine.pet.hit+ (engine.gasTime>0 ? .5 : 0),blink:Math.max(0,1-Math.abs(time%(flair?2.3:5)-.15)/.1)});
    if(!si&&engine.takeoffPending)prop.root.rotation.y=Math.sin(time*18)*.25;
    this.petBody.scale.set(.85 + engine.hit * .2, .85 - engine.hit * .25, .85 + engine.hit * .2);
  }

  update(engine, delta) {
    super.update(engine, delta);
    if (!this.active) return;
    const rope = this.rope.geometry.attributes.position;
    const petHeight = engine.pet.y - .6;
    for (let i = 0; i < rope.count; i++) {
      const a = i / (rope.count - 1);
      rope.setY(i, rope.getY(i) + this.ropeHeight + engine.height * (1 - a) + petHeight * a);
      if (engine.isZhuang) rope.setZ(i, engine.z + (engine.pet.z - engine.z) * a);
    }
    rope.needsUpdate = true;
    this.pet.position.y += this.profile.hover + .2;
    if(!engine.isZhuang)this.pet.position.y+=engine.jumpHeight(.25);
    if (engine.isZhuang) {
      this.pet.position.y = engine.pet.y;
      const dt = engine.state === 'playing' ? Math.min(delta, .12) : 0;
      this.petSpin += (engine.pet.tumble - this.petSpin) * (1 - Math.exp(-dt * 10));
      this.dragon.rotation.z = -engine.pet.angle * .5 + this.petSpin;
      this.dragon.rotation.x = engine.flying ? Math.sin(this.time * 13) * engine.pet.hit * .9 : 0;
      const hit = engine.pet.hit;
      this.dragon.scale.set(.85 + hit * .35, .85 - hit * .35, .85 + hit * .2);
      this.pet.rotation.y = Math.atan2(this.scene.camera.position.x - this.pet.position.x, this.scene.camera.position.z - this.pet.position.z);
      this.stamps.forEach((mesh, i) => { if (this.config.stamps[i].s >= zhuangRace.flightAt) mesh.position.y += zhuangRace.flightHeight; });
    }
    this.updateStoryProps(engine);
    this.updateEffects(engine, delta);
    this.opponent?.update(engine);
  }

  updateEncore(engine,delta,{speaker,mood='calm',gesture=0,talking=false}={}){
    if(!this.active)return;
    this.time+=Math.max(0,Math.min(delta,.12));
    const t=this.time,duel=engine.rival.enabled&&this.opponent?.ready;
    if(!this.encoreReady){
      this.encoreReady=true;this.jetting=false;this.spell.visible=false;this.brushCharge.visible=false;
      for(const mesh of [this.smoke,this.stars,this.tracks,this.rush])mesh.visible=false;
      this.rope.visible=false;this.opponent?.rope&&(this.opponent.rope.visible=false);
      this.camera.transition=null;
    }
    const x=this.center(engine.config.length),z=-engine.config.length;
    this.raft.position.set(x-(duel?1.7:0),this.profile.hover+Math.sin(t*1.7)*.025,z);
    this.raft.rotation.set(0,Math.PI,Math.sin(t*1.3)*.012);
    const seat=this.character==='si'?this.brushSeat:this.chairSeat;seat.rotation.y=0;
    const ownTalking=talking&&speaker===this.character;
    this.rider.update(t,0,0,{encore:true,talking:ownTalking,gesture,story:'drag',wave:ownTalking&&gesture===1});
    const hiding=gesture===1&&!talking,exhausted=gesture===0&&engine.petBumps>=4;
    this.pet.position.set(x+(hiding?-(duel?1.7:0)+.75:duel?-.45:1.6),.15+Math.abs(Math.sin(t*2))*.08,z+(hiding?-.4:1.2));
    this.pet.rotation.set(0,0,0);this.petBody.rotation.set(exhausted?-.25:0,0,exhausted?-.65:Math.sin(t*1.9)*.035);this.petBody.scale.setScalar(.85);
    const petId=this.character==='si'?'ink':'dragon',petTalking=talking&&speaker===petId;
    animateCompanion(this.character==='si'?this.inkProp:this.dragonProp,t,{mood:petTalking?mood:exhausted?'dead':'calm',wave:petTalking?1:0,stress:petTalking&&mood==='panic'?.5:0,blink:Math.max(0,1-Math.abs(t%4.7-.12)/.1)});
    if(duel){
      const o=this.opponent;o.root.visible=true;o.root.position.set(x+1.25,.95+Math.sin(t*1.7+2)*.04,z-.7);o.root.rotation.set(0,0,0);
      o.badge.visible=false;this.brushSeat.rotation.y=0;
      o.rig.update(t,0,0,{encore:true,talking:talking&&speaker==='si',gesture,wave:talking&&speaker==='si'&&gesture===1,lookBack:.4});
      this.inkBody.position.set(-.15,-.75,2.5);this.inkBody.rotation.set(0,0,Math.sin(t*2)*.06);this.inkBody.scale.setScalar(.75);
      animateCompanion(this.inkProp,t,{mood:talking&&speaker==='ink'?mood:'calm',wave:talking&&speaker==='ink'?1:0,blink:Math.max(0,1-Math.abs(t%4.3-.1)/.1)});
    }
    this.frameEncoreCamera(engine);
  }

  frameEncoreCamera(engine){
    const camera=this.scene.camera,rect=this.scene.renderer.domElement.getBoundingClientRect(),landscape=rect.width>rect.height;
    const x=this.center(engine.config.length),z=-engine.config.length;
    camera.fov=landscape?43:46;
    camera.position.set(x+(landscape?4.2:.4),landscape?4.2:4.8,z+(landscape?10.5:15.5));
    // Leave the top for the compact score card and the lower left for portraits.
    camera.lookAt(x+(landscape?4:0),landscape?2.2:3.4,z);camera.updateProjectionMatrix();
  }

  frameCamera(engine, delta = 0) {
    if (!this.active) return;
    if(engine.state==='won'){this.frameEncoreCamera(engine);return;}
    if (engine.isZhuang) { this.frameDrivingCamera(engine, delta); return; }
    const camera = this.scene.camera, rect = this.scene.renderer.domElement.getBoundingClientRect();
    camera.fov = (this.saved.fov || 40) + Math.max(0, Math.min(1, (this.renderSpeed - this.config.speed) / 15)) * 8;
    const landscape = rect.width > rect.height, hover = this.profile.hover;
    const close = this.character === 'si' && this.time < this.shotUntil;
    const angle = Math.atan2(engine.pet.x - engine.x, Math.max(2, engine.pet.z - engine.z)) + .25;
    this.desiredCameraDirection.set(Math.sin(angle) * .86, .5, Math.cos(angle) * .86);
    if (this.firstFrame || !delta) this.cameraDirection.copy(this.desiredCameraDirection);
    else this.cameraDirection.lerp(this.desiredCameraDirection, 1 - Math.exp(-delta * 3)).normalize();
    let index = 0;
    const si = this.character === 'si';
    const petHeight = 0;
    const bounds = [[engine.x, hover + engine.height, engine.z, si ? 1.8 : .95, 3, si ? 3.5 : 1.1]];
    if (!close) bounds.push([engine.pet.x, hover + petHeight + .1, engine.pet.z, 1.1, 2.5, 1.1]);
    for (const [x, y, z, w, h, d] of bounds) {
      for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) this.framePoints[index++].set(x + sx * w, y + sy * h, z + sz * d);
    }
    this.target.set(close ? engine.x : (engine.x + engine.pet.x) * .5, hover + 1.3 + (engine.height + petHeight) * .5, close ? engine.z : (engine.z + engine.pet.z) * .5);
    // Keep the fast Zhuang pair centred. Smoothing an absolute world position
    // trails several metres at racing speed and makes fit-to-bounds zoom out.
    if (this.character === 'zhuang' || this.firstFrame || !delta) this.look.copy(this.target); else this.look.lerp(this.target, 1 - Math.exp(-delta * 6));
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

  frameDrivingCamera(engine, delta = 0) {
    const camera = this.scene.camera, rect = this.scene.renderer.domElement.getBoundingClientRect();
    const landscape = rect.width > rect.height;
    const pace = Math.max(0, Math.min(1, (engine.speed - zhuangRace.introSpeed) / (zhuangRace.flightSpeed - zhuangRace.introSpeed)));
    const fov = 48 + pace * 10 + (engine.gasTime > 0 ? 3 : 0);
    camera.fov = this.firstFrame || !delta ? fov : camera.fov + (fov - camera.fov) * (1 - Math.exp(-delta * 6));
    const slope = (this.center(engine.progress + 15) - this.center(engine.progress - 5)) / 20;
    // Always behind the road's forward tangent. No cut, no 180-degree orbit
    // at takeover: world +X projects right in every phase and every bend.
    this.desiredCameraDirection.set(-slope, 0, 1).normalize();
    if (this.firstFrame || !delta) this.cameraDirection.copy(this.desiredCameraDirection);
    else this.cameraDirection.lerp(this.desiredCameraDirection, 1 - Math.exp(-delta * 5)).normalize();
    this.look.set(engine.x + (engine.pet.x - engine.x) * .5, engine.height + 1.3, engine.z + 2);
    const distance = landscape ? 14 : 17.5;
    camera.position.copy(this.look).addScaledVector(this.cameraDirection, distance);
    camera.position.y += landscape ? 7.5 : 8;
    camera.lookAt(this.look);
    camera.clearViewOffset();
    camera.setViewOffset(rect.width, rect.height, 0, landscape ? 10 : 5, rect.width, rect.height);
    camera.updateProjectionMatrix(); this.firstFrame = false;
  }

  dispose() { this.opponent?.dispose(); this.opponent = null; super.dispose(); }

  detach() {
    const active = this.active, fov = this.saved?.fov;
    super.detach();
    if (active) { this.scene.camera.fov = fov; this.scene.camera.clearViewOffset(); this.scene.camera.updateProjectionMatrix(); }
  }
}
