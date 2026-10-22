import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RideEngine } from '../src/game/RideEngine.js';
import { SeatedRider } from '../src/game/SeatedRider.js';
import { rideConfig } from '../src/config/rideConfig.js';
import { bridgePoint, zhuangRace } from '../src/game/ZhuangRaceStory.js';

const advance = (e, seconds, input = {}, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) e.update(1 / fps, input);
};

test('seated vehicles steer with yaw and continue sliding after releasing direction', () => {
  const e = new RideEngine(rideConfig); e.start(); advance(e, .8, { steer: 1 });
  const x = e.offset, heading = e.heading;
  advance(e, .2);
  assert(e.heading > 0 && e.heading < heading); assert(e.offset > x + .2);
  assert(e.velocity > .5); assert(Math.abs(e.heading) <= rideConfig.driving.turn);
});

test('drifting charges boost, releasing brake accelerates, and a tap cannot farm boost', () => {
  const e = new RideEngine(rideConfig); e.start();
  advance(e, .8, { steer: 1, brake: true }); assert(e.charge > .24); assert.equal(e.boost, 0);
  advance(e, .1); assert(e.boost > 0);
  const speed = e.speed; advance(e, .5); assert(e.speed > speed);
  e.start(); advance(e, .1, { steer: 1, brake: true }); advance(e, .1); assert.equal(e.boost, 0);
  e.start(); advance(e, .8, { brake: true }); advance(e, .1); assert.equal(e.boost, 0);
});

test('new driving rules remain frame-rate independent, paused and resettable', () => {
  const run = fps => {
    const e = new RideEngine(rideConfig); e.start();
    advance(e, .8, { steer: 1, brake: true }, fps); advance(e, 1, {}, fps);
    return [e.progress, e.heading, e.offset, e.pet.x, e.boost];
  };
  const reference = run(120);
  for (const fps of [30, 60]) run(fps).forEach((value, i) => assert(Math.abs(value - reference[i]) < 1e-8));
  const e = new RideEngine(rideConfig); e.start(); advance(e, 1, { steer: 1, brake: true }); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 2); assert.equal(JSON.stringify(e), snapshot);
  e.start(); assert.equal(e.boost, 0); assert.equal(e.heading, 0); assert.equal(e.spins, 0); assert.equal(e.charge, 0);
});

test('three drift tiers reward longer controlled drifts instead of short brake taps', () => {
  const e = new RideEngine(); e.start();
  advance(e, .45, { steer: 1, brake: true }); assert.equal(e.driftTier, 1);
  advance(e, .35, { steer: 1, brake: true }); assert.equal(e.driftTier, 2);
  advance(e, .35, { steer: -1, brake: true }); assert.equal(e.driftTier, 3);
  const points = e.driftPoints; advance(e, .02);
  const boost = e.takeEvents().find(event => event.type === 'boost');
  assert.equal(boost?.tier, 3); assert(e.boost > 2); assert(e.driftPoints >= points); assert.equal(e.driftCount, 1);
});

test('gas is a finite item: only active play can use it, and an active jet cannot consume another can', () => {
  const e = new RideEngine(); assert.equal(e.gasLeft, 1); assert(!e.useGas()); e.start();
  assert(e.useGas()); assert.equal(e.gasLeft, 0); assert(!e.useGas());
  advance(e, .5); assert(e.speed > rideConfig.speed + 5); assert(e.speed <= rideConfig.maxSpeed);
  e.pause(); const time = e.gasTime; advance(e, 2); assert.equal(e.gasTime, time); assert(!e.useGas());
  e.start(); assert.equal(e.gasLeft, 1); assert.equal(e.gasTime, 0); assert.equal(e.gasUsed, 0);
});

test('item pickups respect capacity and cannot be collected twice', () => {
  const e = new RideEngine(); e.start();
  const item = rideConfig.pickups[0]; e.progress = item.s; e.offset = item.offset;
  advance(e, .05); assert.equal(e.gasLeft, 2); assert(e.pickups.has(0));
  advance(e, .05); assert.equal(e.gasLeft, 2);
  assert(e.useGas()); advance(e, .05); assert.equal(e.gasLeft, 1);
  const next = rideConfig.pickups[1]; e.progress = next.s; e.offset = next.offset;
  advance(e, .05); assert.equal(e.gasLeft, 2);
  e.start(); assert.equal(e.pickups.size, 0);
});

test('collisions stop physics briefly, cancel jets, debounce hits and leave a recoverable vehicle', () => {
  const e = new RideEngine(); e.start(); e.useGas();
  const speed = e.speed; assert(e.bump('護欄', 1));
  assert(e.speed < speed); assert.equal(e.gasTime, 0); assert(e.hitStop > 0);
  const progress = e.progress; advance(e, .03); assert.equal(e.progress, progress);
  assert(!e.bump('護欄')); assert.equal(e.bumps, 1);
  advance(e, 1.2); assert(e.progress > progress); assert.equal(e.hitStop, 0);
  assert(e.bump('路障')); assert.equal(e.bumps, 2);
});

test('900 metre course covers all sectors, finishes without input and bounds a high-speed follower', () => {
  const e = new RideEngine(); e.start();
  let maxSpeed = 0;
  for (let i = 0; i < 100 * 60 && e.state === 'playing'; i++) {
    if (i % 600 === 0) e.useGas();
    e.update(1 / 60);
    maxSpeed = Math.max(maxSpeed, e.speed);
    const length = Math.hypot(e.pet.x - e.x, e.pet.z - e.z);
    assert(Number.isFinite(length)); assert(length <= rideConfig.maxRopeLength + 1e-8);
    assert(Math.abs(e.offset) <= rideConfig.edge + 1e-8);
  }
  assert.equal(e.state, 'won'); assert.equal(e.progress, 900); assert.equal(e.sector, 2);
  assert(maxSpeed > 25); assert(maxSpeed <= rideConfig.maxSpeed); assert.equal(e.topSpeed, maxSpeed);
  const snapshot = JSON.stringify(e); advance(e, 2); assert.equal(JSON.stringify(e), snapshot);
});

const zhuangEngine = () => { const e = new RideEngine(); e.setCharacter('zhuang'); e.start(); return e; };

test('Zhuang starts reluctantly behind Dragon Bubble, reads the sponsor, then actually exchanges the lead', () => {
  const e = new RideEngine({ ...rideConfig, obstacles: [] }); e.setCharacter('zhuang'); e.start();
  assert(e.pet.z < e.z); assert(!e.useGas());
  advance(e, 3.9); assert.equal(e.storyPhase, 'drag'); assert(e.speed < 13);
  advance(e, .2); assert.equal(e.storyPhase, 'sponsor'); assert(!e.useGas());
  advance(e, 3.5); assert(e.speed < 7);
  advance(e, 1.4); assert.equal(e.storyPhase, 'takeover'); assert(e.pet.x > e.x + 3);
  advance(e, 1.2); assert.equal(e.storyPhase, 'race'); assert(e.pet.z > e.z); assert(e.speed > 23);
  assert.deepEqual(e.takeEvents().filter(x => x.type === 'story').map(x => x.phase), ['drag', 'sponsor', 'takeover', 'race']);
});

test('Zhuang magic unlocks after taking control, costs charges, freezes while paused, and accelerates beyond normal cruise', () => {
  const e = zhuangEngine(); assert.equal(e.gasLeft, 2); advance(e, 10.1);
  assert(e.useGas()); assert.equal(e.gasLeft, 1); assert(!e.useGas());
  advance(e, .8); assert(e.speed > 30); assert(e.speed <= zhuangRace.maxSpeed);
  e.pause(); const snapshot = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), snapshot); assert(!e.useGas());
  e.resume(); advance(e, .1); assert(e.gasTime > 0);
});

test('story timing and exchanging positions freeze on pause, replay resets and switching to Si removes story rules', () => {
  const e = zhuangEngine(); advance(e, 8.8); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 10); assert.equal(JSON.stringify(e), snapshot);
  e.resume(); advance(e, 1.4); assert.equal(e.storyPhase, 'race');
  e.start(); assert.equal(e.storyPhase, 'drag'); assert.equal(e.progress, 0); assert(e.pet.z < e.z); assert.equal(e.gasLeft, 2);
  e.setCharacter('si'); e.start(); assert.equal(e.storyPhase, null); assert(e.pet.z > e.z); assert.equal(e.gasLeft, 1); assert(e.useGas());
});

test('Xiran shortcut is a raised straight path, captures entry offset without a jump, and bypasses ground hazards', () => {
  const e = zhuangEngine(); advance(e, 10.1);
  e.progress = zhuangRace.bridgeAt; e.offset = 5; const entryX = e.x;
  e.update(1 / 120, { steer: 1, brake: true });
  assert.equal(e.storyPhase, 'bridge'); assert(Math.abs(e.x - entryX) < .2); assert.equal(e.bridgeOffset, 5);
  e.progress = 830; const expected = bridgePoint(830, 5);
  assert.equal(e.x, expected.x); assert(e.height > 4); assert.equal(e.height, expected.y);
  e.offset = 0; e.progress = 790; const bumps = e.bumps;
  advance(e, .25, { steer: 1, brake: true }); assert.equal(e.bumps, bumps); assert(!e.braking);
  advance(e, 5); assert.equal(e.state, 'won'); assert.equal(e.storyPhase, 'finish'); assert.equal(e.height, 0);
  assert.equal(e.x, rideConfig.center(rideConfig.length));
});

test('Zhuang story completes with finite positions, a bounded tether and all beats in order without player input', () => {
  const run = fps => {
    const e = zhuangEngine(), beats = []; let highest = 0;
    for (let i = 0; i < fps * 100 && e.state === 'playing'; i++) {
      e.update(1 / fps); highest = Math.max(highest, e.height);
      beats.push(...e.takeEvents().filter(x => x.type === 'story').map(x => x.phase));
      assert(Number.isFinite(e.x + e.z + e.height));
      assert(Math.hypot(e.pet.x - e.x, e.pet.z - e.z) <= rideConfig.maxRopeLength + 1e-8);
      assert(e.speed <= zhuangRace.maxSpeed);
    }
    assert.equal(e.state, 'won'); assert(highest > 4.4);
    assert.deepEqual(beats, ['drag', 'sponsor', 'takeover', 'race', 'bridge']);
    const snapshot = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), snapshot);
    return [e.elapsed, e.progress, e.x];
  };
  const reference = run(120);
  for (const fps of [30, 60]) run(fps).forEach((value, i) => assert(Math.abs(value - reference[i]) < 1e-8));
});

// Decode real supplied skeletons without images or a WebGL context. Materials
// are omitted only in this test document; source GLB bytes are never modified.
async function sourceModel(id) {
  const file = id === 'si' ? 'si' : 'zhuang-fangyi';
  const source = readFileSync(new URL(`../public/models/${file}.glb`, import.meta.url));
  const length = source.readUInt32LE(12), json = JSON.parse(source.subarray(20, 20 + length));
  const binaryOffset = 20 + length, binaryLength = source.readUInt32LE(binaryOffset);
  json.buffers[0].uri = `data:application/octet-stream;base64,${source.subarray(binaryOffset + 8, binaryOffset + 8 + binaryLength).toString('base64')}`;
  json.materials = (json.materials || []).map(() => ({})); json.images = []; json.textures = [];
  globalThis.ProgressEvent ??= class { constructor(type, values) { this.type = type; Object.assign(this, values); } };
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  const group = new Group(); group.add(gltf.scene); group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(group, true);
  const idle = { height: bounds.max.y - bounds.min.y, supported: false, playing: true, stopGesture() {}, setPlaying(value) { this.playing = value; } };
  return { gltf, group, idle, characterId: id };
}

for (const id of ['si', 'zhuang']) test(`${id} source skeleton supports a seated pose and restores every changed joint`, async () => {
  const model = await sourceModel(id), mount = new Group(), rig = new SeatedRider(model, mount, rideConfig.actorHeight);
  assert(rig.supported); assert(rig.attach()); rig.update(1, .6, .2);
  const pelvis = mount.worldToLocal(rig.nodes.pelvis.getWorldPosition(new Vector3()));
  assert(pelvis.length() < .03, 'pelvis stays aligned with seat');
  for (const side of ['L', 'R']) {
    const hip = mount.worldToLocal(rig.nodes[`thigh${side}`].getWorldPosition(new Vector3()));
    const knee = mount.worldToLocal(rig.nodes[`knee${side}`].getWorldPosition(new Vector3()));
    const foot = mount.worldToLocal(rig.nodes[`foot${side}`].getWorldPosition(new Vector3()));
    assert(knee.z < hip.z - .2, 'bent thigh extends toward vehicle front');
    assert(foot.y < knee.y - .2, 'lower leg drops below knee');
    const wrist = mount.worldToLocal(rig.nodes[`wrist${side}`].getWorldPosition(new Vector3()));
    const grip = new Vector3(side === 'L' ? .35 : -.35, .3, -.57);
    assert(wrist.distanceTo(grip) < .2, 'hand reaches toward the seat grip');
  }
  if (id === 'zhuang') {
    rig.update(10, .2, 0, { determined: 1, magic: true });
    const wrist = mount.worldToLocal(rig.nodes.wristR.getWorldPosition(new Vector3()));
    assert(wrist.y > .6 && wrist.z < -.3, `spell hand lifts above the armrest and reaches forward: ${wrist.toArray()}`);
    for (const { bone } of rig.bones) assert(bone.quaternion.toArray().every(Number.isFinite));
  }
  rig.restore();
  for (const { bone, p, q, s } of rig.bones) { assert(bone.position.equals(p)); assert(bone.quaternion.equals(q)); assert(bone.scale.equals(s)); }
  model.gltf.scene.traverse(node => { node.geometry?.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose(); });
});
