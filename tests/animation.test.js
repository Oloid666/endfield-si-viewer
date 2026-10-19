import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Box3, Group, Matrix4, Vector3 } from 'three';
import { IdleController } from '../src/viewer/IdleController.js';
import { SceneManager } from '../src/viewer/SceneManager.js';
import { ModelManager } from '../src/viewer/ModelManager.js';
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

for (const kind of ['tsundere']) {
  test(`${kind}: waist reach, stomp and natural endpoint`, () => {
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
    assert(distance(samples[7][wrist], base[wrist]) < 0.02);
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
  idle.playGesture(viewer, 'tsundere');
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

test('hands reach the waist and the support foot stays planted during a stomp', () => {
  const idle = fixture();
  idle.playGesture(viewer, 'tsundere');
  idle.update(viewerConfig.idle.gestures.tsundere.duration * .29);
  const hips = idle.hips.bone.getWorldPosition(new Vector3());
  for (const [j,side] of ['L','R'].entries()) {
    const hand = idle.arms[side].end.getWorldPosition(new Vector3()).sub(hips).divideScalar(idle.height);
    assert(hand.distanceTo(new Vector3(...viewerConfig.idle.action.waistHands[j])) < .006);
  }
  const support = idle.legs.L.solver.end.getWorldPosition(new Vector3());
  const raised = idle.legs.R.solver.end.getWorldPosition(new Vector3());
  assert(support.distanceTo(idle.legs.L.anchor) < .00001);
  assert(raised.y - idle.legs.R.anchor.y > idle.height*.04);
  idle.update(viewerConfig.idle.gestures.tsundere.duration * .07);
  assert(idle.legs.R.solver.end.getWorldPosition(new Vector3()).distanceTo(idle.legs.R.anchor) < .00001);
});

test('animated feet are skin-weighted deformation bones, not unweighted controls', () => {
  const bytes=readFileSync(new URL('../public/models/si.glb',import.meta.url));
  const jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength));
  const wanted=new Set([viewerConfig.idle.bodyNodes.footL,viewerConfig.idle.bodyNodes.footR]);
  const counts=new Map([...wanted].map(node=>[node,0]));
  const read=(accessor,index,component)=>{
    const a=gltf.accessors[accessor],view=gltf.bufferViews[a.bufferView];
    const size={5121:1,5123:2,5126:4}[a.componentType];
    const offset=28+jsonLength+(view.byteOffset||0)+(a.byteOffset||0)+index*(view.byteStride||size*4)+component*size;
    return a.componentType===5121?bytes.readUInt8(offset):a.componentType===5123?bytes.readUInt16LE(offset):bytes.readFloatLE(offset);
  };
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
    const attrs=primitive.attributes;if(attrs.JOINTS_0===undefined)continue;
    for(let i=0;i<gltf.accessors[attrs.JOINTS_0].count;i++)for(let j=0;j<4;j++){
      const node=gltf.skins[0].joints[read(attrs.JOINTS_0,i,j)];
      if(wanted.has(node)&&read(attrs.WEIGHTS_0,i,j)>.7)counts.set(node,counts.get(node)+1);
    }
  }
  for(const count of counts.values())assert(count>100);
});

test('leek loops, can stop while idle is paused, and disposes its GPU resources', () => {
  const idle = fixture();
  const base = pose(idle);
  assert(idle.playGesture(viewer,'leek'));
  idle.update(4);
  assert.equal(idle.gestureKind,'leek');
  assert.notEqual(idle.gestureTime,null);
  assert(idle.leek.group.visible && idle.leek.trail.visible);
  const grip=idle.arms.R.end.getWorldPosition(new Vector3());
  const prop=idle.leek.group.getWorldPosition(new Vector3());
  assert(grip.distanceTo(prop)<idle.height*.06,'prop stays in the hand');
  const before=pose(idle);
  assert(idle.stopGesture());
  close(pose(idle),before);
  idle.update(1);
  close(pose(idle),base);
  assert.equal(idle.leek.group.visible,false);
  assert.equal(idle.leek.trail.visible,false);
  assert.equal(idle.stopGesture(),false);
  const resources=[...idle.leek.geometries,...idle.leek.materials,idle.leek.trailGeometry,idle.leek.trailMaterial];
  let disposed=0;
  for(const resource of resources) resource.addEventListener('dispose',()=>disposed++);
  idle.dispose();
  assert.equal(disposed,resources.length);
  assert.equal(idle.leek.group.parent,null);
  assert.equal(idle.leek.trail.parent,null);
});

test('leek maintains body pose at the same elapsed time at 15/30/60fps', () => {
  const poses=[15,30,60].map(fps=>{
    const idle=fixture();idle.playGesture(viewer,'leek');
    for(let j=0;j<3*fps;j++)idle.update(1/fps);
    return pose(idle);
  });
  close(poses[0],poses[1]);close(poses[0],poses[2]);
});

test('unsupported uploaded rig safely skips animation and disposes', () => {
  const idle = new IdleController({ scene: new Group() }, viewerConfig.idle);
  assert.equal(idle.supported, false);
  assert.equal(idle.playGesture(viewer, 'tsundere'), false);
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


test('shoe preset uses ankle center, the model floor and a static fallback', () => {
  const manager = new ModelManager(new Group(), viewerConfig);
  assert.equal(manager.getShoeBounds(), null);
  manager.current = {
    bounds: new Box3(new Vector3(-1,-2,-1),new Vector3(1,2,1)),
    idle: { legs: { L: {anchor:new Vector3(.2,-1.8,.3)}, R:{anchor:new Vector3(-.2,-1.8,.3)} } },
  };
  const shoe=manager.getShoeBounds();const center=shoe.getCenter(new Vector3());
  assert(Math.abs(center.x)<1e-8&&Math.abs(center.z-.3)<1e-8);
  assert.equal(shoe.min.y,-2);
  assert.equal(shoe.max.y,-2+4*viewerConfig.camera.shoes.heightFactor);
  manager.current.idle={};
  assert(manager.getShoeBounds().getCenter(new Vector3()).z===0);
});
