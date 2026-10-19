import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Box3, Group, Matrix4, Vector3 } from 'three';
import { IdleController } from '../src/viewer/IdleController.js';
import { SceneManager } from '../src/viewer/SceneManager.js';
import { viewerConfig } from '../src/config/viewerConfig.js';

// Reconstruct the supplied asset's actual node hierarchy without decoding images
// or requiring WebGL. Browser checks separately exercise the skinned meshes/UI.
function fixture() {
  const bytes = readFileSync(new URL('../public/models/si.glb', import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const joints = new Set(gltf.skins.flatMap((skin) => skin.joints));
  const associations = new Map();
  const nodes = gltf.nodes.map((node, index) => {
    const object = joints.has(index) ? new Bone() : new Group();
    object.name = node.name || '';
    if (node.matrix) new Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    associations.set(object, { nodes: index });
    return object;
  });
  gltf.nodes.forEach((node, i) => node.children?.forEach((child) => nodes[i].add(nodes[child])));
  const scene = new Group();
  for (const root of gltf.scenes[gltf.scene || 0].nodes) scene.add(nodes[root]);
  scene.updateMatrixWorld(true);
  const idle = new IdleController({ scene, parser: { associations } }, viewerConfig.idle,
    new Box3(new Vector3(-0.5, -1, -0.5), new Vector3(0.5, 1, 0.5)));
  idle.setPlaying(false);
  idle.update(1);
  return idle;
}
const pose = (idle) => idle.body.map(({ pose }) => pose.bone.quaternion.toArray());
const close = (a, b) => assert(a.every((q, i) => q.every((v, j) => Math.abs(v - b[i][j]) < 1e-6)));
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const viewer = new Vector3(0, 0, 4);

for (const kind of ['cold', 'shy']) {
  test(`${kind}: anticipation precedes wrist, no frozen body, returns to natural stance`, () => {
    const idle = fixture();
    assert(idle.supported && idle.head);
    const base = pose(idle);
    assert(idle.playGesture(viewer, kind));
    assert.equal(idle.playGesture(viewer, kind), false);
    const samples = [];
    for (let i = 0; i <= 100; i++) {
      idle.update(i ? viewerConfig.idle.gestures[kind].duration / 100 : 0);
      samples.push(pose(idle));
    }
    const spine = idle.body.findIndex((part) => part.name === 'spine');
    const wrist = idle.body.findIndex((part) => part.name === 'wristR');
    assert(distance(samples[7][spine], base[spine]) > 0.001);
    assert(distance(samples[7][wrist], base[wrist]) < 0.001);
    let consecutiveStill = 0;
    for (let i = 2; i < 99; i++) {
      const motion = samples[i].reduce((sum, q, j) => sum + distance(q, samples[i - 1][j]), 0);
      consecutiveStill = motion < 1e-5 ? consecutiveStill + 1 : 0;
      assert(consecutiveStill < 3, 'whole body should not hold unchanged');
    }
    idle.update(0.01);
    assert.equal(idle.gestureTime, null);
    close(pose(idle), base);
  });

  test(`${kind}: identical body pose at the same elapsed time at 15/30/60fps`, () => {
    const poses = [15, 30, 60].map((fps) => {
      const idle = fixture();
      idle.playGesture(viewer, kind);
      for (let i = 0; i < 3 * fps; i++) idle.update(1 / fps);
      return pose(idle);
    });
    close(poses[0], poses[1]);
    close(poses[0], poses[2]);
  });
}

test('cancellation blends to natural stance and disposal restores the asset', () => {
  const idle = fixture();
  const base = pose(idle);
  idle.playGesture(viewer, 'shy');
  idle.update(2);
  const before = pose(idle);
  idle.setPlaying(false);
  close(pose(idle), before);
  idle.update(0.03);
  const partial = pose(idle);
  assert(partial.some((q, i) => distance(q, before[i]) > 1e-5));
  assert(partial.some((q, i) => distance(q, base[i]) > 1e-5));
  idle.update(1);
  close(pose(idle), base);
  idle.dispose();
  for (const { pose } of idle.body) assert.deepEqual(pose.bone.quaternion.toArray(), pose.quaternion.toArray());
  assert(idle.hips.bone.position.equals(idle.hips.rest));
});

test('unsupported uploaded rig safely skips animation and disposes', () => {
  const idle = new IdleController({ scene: new Group() }, viewerConfig.idle);
  assert.equal(idle.supported, false);
  assert.equal(idle.playGesture(viewer, 'shy'), false);
  idle.update(1);
  idle.setPlaying(false);
  idle.dispose();
});

test('render clock preserves low-fps elapsed time and ignores hidden-tab time', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { hidden: false };
  try {
    let tick;
    const deltas = [];
    SceneManager.prototype.start.call({
      stop() {}, render() {}, renderer: { setAnimationLoop(callback) { tick = callback; } },
    }, (delta) => deltas.push(delta));
    tick(0); tick(100);
    assert.equal(deltas[1], 0.1);
    document.hidden = true; tick(5000);
    document.hidden = false; tick(9000); tick(9020);
    assert.deepEqual(deltas, [0, 0.1, 0, 0.02]);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
