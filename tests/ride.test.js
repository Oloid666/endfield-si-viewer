import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RaftEngine } from '../src/game/RaftEngine.js';
import { SeatedRider } from '../src/game/SeatedRider.js';
import { rideConfig } from '../src/config/rideConfig.js';

const advance = (e, seconds, input = {}, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) e.update(1 / fps, input);
};

test('seated vehicles steer with yaw and continue sliding after releasing direction', () => {
  const e = new RaftEngine(rideConfig); e.start(); advance(e, .8, { steer: 1 });
  const x = e.offset, heading = e.heading;
  advance(e, .2);
  assert(e.heading > 0 && e.heading < heading); assert(e.offset > x + .2);
  assert(e.velocity > .5); assert(Math.abs(e.heading) <= rideConfig.driving.turn);
});

test('drifting charges boost, releasing brake accelerates, and a tap cannot farm boost', () => {
  const e = new RaftEngine(rideConfig); e.start();
  advance(e, .8, { steer: 1, brake: true }); assert(e.charge > .24); assert.equal(e.boost, 0);
  advance(e, .1); assert(e.boost > 0);
  const speed = e.speed; advance(e, .5); assert(e.speed > speed);
  e.start(); advance(e, .1, { steer: 1, brake: true }); advance(e, .1); assert.equal(e.boost, 0);
  e.start(); advance(e, .8, { brake: true }); advance(e, .1); assert.equal(e.boost, 0);
});

test('new driving rules remain frame-rate independent, paused and resettable', () => {
  const run = fps => {
    const e = new RaftEngine(rideConfig); e.start();
    advance(e, .8, { steer: 1, brake: true }, fps); advance(e, 1, {}, fps);
    return [e.progress, e.heading, e.offset, e.pet.x, e.boost];
  };
  const reference = run(120);
  for (const fps of [30, 60]) run(fps).forEach((value, i) => assert(Math.abs(value - reference[i]) < 1e-8));
  const e = new RaftEngine(rideConfig); e.start(); advance(e, 1, { steer: 1, brake: true }); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 2); assert.equal(JSON.stringify(e), snapshot);
  e.start(); assert.equal(e.boost, 0); assert.equal(e.heading, 0); assert.equal(e.spins, 0); assert.equal(e.charge, 0);
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
  rig.restore();
  for (const { bone, p, q, s } of rig.bones) { assert(bone.position.equals(p)); assert(bone.quaternion.equals(q)); assert(bone.scale.equals(s)); }
  model.gltf.scene.traverse(node => { node.geometry?.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose(); });
});
