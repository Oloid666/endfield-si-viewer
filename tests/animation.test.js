import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Box3, Group, Matrix4, Vector3 } from 'three';
import { IdleController } from '../src/viewer/IdleController.js';
import { SceneManager } from '../src/viewer/SceneManager.js';
import { ModelManager } from '../src/viewer/ModelManager.js';
import { FaceController } from '../src/viewer/FaceController.js';
import { GazeController } from '../src/viewer/GazeController.js';
import { loadingStatus } from '../src/ui/loadingStatus.js';
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
    new Box3(new Vector3(-0.5, -1, -0.5), new Vector3(0.5, 1, 0.5)), undefined, viewerConfig.face, viewerConfig.gaze);
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


test('loading status handles compressed totals, unknown sizes and parsing', () => {
  assert.equal(loadingStatus('si.glb',{loaded:50,total:100}),'下載 si.glb… 50%');
  assert.equal(loadingStatus('si.glb',{loaded:100,total:100}),'處理 si.glb 與貼圖…');
  assert.equal(loadingStatus('si.glb',{loaded:200,total:100}),'處理 si.glb 與貼圖…');
  for(const total of [0,-1,NaN,Infinity])assert.equal(loadingStatus('si.glb',{loaded:100,total}),'載入 si.glb 與貼圖…');
  for(const loaded of [-10,0,99.99,100,150,Infinity,NaN]){
    const text=loadingStatus('si.glb',{loaded,total:100});const number=text.match(/(\d+)%/);
    if(number)assert(Number(number[1])>=0&&Number(number[1])<=100);
  }
});

test('giant onion keeps wrist attached, lands, restores scale and releases resources', () => {
  const idle=fixture();const r=idle.reverse;
  assert(idle.playGesture(viewer,'reverse'));
  for(let j=0;j<120;j++){
    idle.update(1/30);
    if(j>30){
      const wrist=r.stage.worldToLocal(idle.arms.R.end.getWorldPosition(new Vector3()));
      assert(wrist.distanceTo(r.hand.position)<1e-5);
      assert(Math.abs(r.actor.scale.x-viewerConfig.idle.reverse.characterScale*r.base.scale.x)<1e-6);
    }
  }
  const before=r.actor.position.clone();idle.stopGesture();
  assert(r.actor.position.equals(before));
  assert.equal(idle.playGesture(viewer,'leek'),false,'cannot interrupt landing');
  idle.update(.1);assert(r.actor.position.distanceTo(before)>1e-4);
  idle.update(1);assert(r.actor.position.equals(r.base.position));assert(r.actor.scale.equals(r.base.scale));
  assert.equal(r.visible,false);assert.equal(r.leek.group.visible,false);
  assert(idle.playGesture(viewer,'reverse'));idle.update(1);
  let freed=0;for(const resource of [r.material,r.faceMaterial,r.limbGeometry,r.sphereGeometry])resource.addEventListener('dispose',()=>freed++);
  idle.dispose();assert.equal(freed,4);assert(r.actor.position.equals(r.base.position));assert(r.actor.scale.equals(r.base.scale));assert.equal(r.host.parent,null);assert.equal(r.ink.parent,null);
});

test('reverse actor has the same pose at 15/30/60fps after entry', () => {
  const states=[15,30,60].map(fps=>{const idle=fixture();idle.playGesture(viewer,'reverse');for(let j=0;j<3*fps;j++)idle.update(1/fps);return {body:pose(idle),position:idle.reverse.actor.position.toArray(),quaternion:idle.reverse.actor.quaternion.toArray()}});
  for(const state of states.slice(1)){close(state.body,states[0].body);assert(state.position.every((v,j)=>Math.abs(v-states[0].position[j])<1e-5));assert(state.quaternion.every((v,j)=>Math.abs(v-states[0].quaternion[j])<1e-5));}
});


test('expression presets blend, clamp strength, widen surprised eyes and return to neutral', () => {
  const face=new FaceController(viewerConfig.face);
  assert.equal(face.setExpression('missing',1),false);
  assert.equal(face.setExpression('angry',NaN),false);
  face.setExpression('angry',3);assert.equal(face.strength,2);
  const before=face.values.browLeftInner;face.update(.03);
  assert(face.values.browLeftInner<before&&face.values.browLeftInner>face.target.browLeftInner);
  face.setExpression('surprised',.8);face.update(2);assert(face.values.lid<0);
  face.setExpression('neutral');face.update(2);
  assert(Object.values(face.values).every(v=>Math.abs(v)<1e-7));
});

test('selected face works while idle is paused, yields to actions and returns after them', () => {
  const idle=fixture();assert(idle.expression&&idle.look);
  const brow=idle.face.find(x=>x.role==='brow'&&x.side==='Left');
  idle.expression.setExpression('angry',1);idle.update(2);
  const expressionOffset=brow.bone.position.clone().sub(brow.rest);assert(expressionOffset.length()>1e-4);
  const neutral=fixture();
  idle.playGesture(viewer,'tsundere');neutral.playGesture(viewer,'tsundere');
  idle.update(2);neutral.update(2);
  const other=neutral.face.find(x=>x.bone.name===brow.bone.name);
  assert(brow.bone.position.distanceTo(other.bone.position)<1e-7,'authored action has face priority');
  idle.update(10);assert(brow.bone.position.clone().sub(brow.rest).distanceTo(expressionOffset)<1e-6);
  const upper=idle.eyelids[0];idle.expression.setExpression('surprised',1);idle.update(2);
  assert(upper.bone.position.distanceTo(upper.rest)>1e-5);
  idle.dispose();assert(upper.bone.position.equals(upper.rest));
});

test('gaze eyes lead the head, respect limits and reject invalid targets', () => {
  const head=new Group();head.updateMatrixWorld(true);
  const look=new GazeController(head,viewerConfig.gaze);
  assert.equal(look.setMode('bad'),false);
  assert.equal(look.setPoint(new Vector3(NaN,0,1)),false);
  look.setMode('point');look.setPoint(new Vector3(3,2,1));look.update(1/60);
  assert(look.angles.eyeYaw>look.angles.headYaw);
  for(let j=0;j<120;j++)look.update(1/60);
  const c=viewerConfig.gaze,a=look.angles;
  assert(Math.abs(a.headYaw)<=c.headYawLimit&&Math.abs(a.eyeYaw)<=c.eyeYawLimit);
  assert(Math.abs(a.headPitch)<=c.headPitchLimit&&Math.abs(a.eyePitch)<=c.eyePitchLimit);
  look.setMode('off');look.update(10);
  assert(Object.values(a).every(v=>Math.abs(v)<1e-10));
});

test('camera gaze follows the viewer and action head motion keeps priority', () => {
  const idle=fixture();idle.look.setMode('camera');
  const origin=idle.head.bone.getWorldPosition(new Vector3());
  idle.update(1,origin.clone().add(new Vector3(2,0,2)));assert(idle.look.angles.headYaw>0);
  idle.update(1,origin.clone().add(new Vector3(-2,0,2)));assert(idle.look.angles.headYaw<0);
  const neutral=fixture();idle.playGesture(viewer,'tsundere');neutral.playGesture(viewer,'tsundere');
  idle.update(2,origin.clone().add(new Vector3(2,0,2)));neutral.update(2);
  close([idle.head.bone.quaternion.toArray()],[neutral.head.bone.quaternion.toArray()]);
});


test('former 0–200% curve is compressed into 0–50%, then bounded dramatic endpoints', () => {
  const face=new FaceController(viewerConfig.face);
  for(const preset of ['angry','proud','shy','surprised']){
    face.setExpression(preset,.25);face.update(4);
    assert(Math.abs(face.values.headRoll)<1e-8);
    const ordinary={...face.values};
    face.setExpression(preset,.5);face.update(4);
    const endpoint=viewerConfig.face.exaggerated[preset];
    for(const [key,value] of Object.entries(endpoint))assert(Math.abs(face.values[key]-value)<1e-8);
    assert(Math.abs(face.values.headRoll)>.05);
    assert(['browLeftInner','browLeftOuter','mouthLeft','mouthRight','lid'].some(key=>Math.abs(face.values[key]-ordinary[key]*2)>1e-5));
    face.setExpression(preset,.375);face.update(4);
    assert(Math.abs(face.values.headRoll-endpoint.headRoll*.5)<1e-8);
  }
  face.setExpression('neutral',2);face.update(4);assert(Object.values(face.values).every(v=>Math.abs(v)<1e-8));
});

test('200% face adds head acting and an enlarged stomp while feet and grip remain grounded', () => {
  const results=[];
  for(const strength of [.5,2]){
    const idle=fixture();idle.expression.setExpression('shy',strength);idle.update(4);
    const selectedHead=idle.head.bone.quaternion.toArray();
    const wristBase=idle.arms.R.end.getWorldPosition(new Vector3());
    idle.playGesture(viewer,'tsundere');idle.update(viewerConfig.idle.gestures.tsundere.duration*.29);
    const right=idle.legs.R.solver.end.getWorldPosition(new Vector3());
    const left=idle.legs.L.solver.end.getWorldPosition(new Vector3());
    assert(left.distanceTo(idle.legs.L.anchor)<1e-5);
    const hips=idle.hips.bone.getWorldPosition(new Vector3());
    for(const [index,side] of ['L','R'].entries()){
      const target=hips.clone().add(new Vector3(...viewerConfig.idle.action.waistHands[index]).multiplyScalar(idle.height));
      assert(idle.arms[side].end.getWorldPosition(new Vector3()).distanceTo(target)<1e-5);
    }
    const lift=(right.y-idle.legs.R.anchor.y)/idle.height;
    results.push(lift);
    assert(lift>.08);
    idle.stopGesture();idle.update(4);
    close([idle.head.bone.quaternion.toArray()],[selectedHead]);
    assert(idle.arms.R.end.getWorldPosition(new Vector3()).distanceTo(wristBase)<1e-5);
  }
  assert(results[1]-results[0]>.03);
});


test('three comic expressions retain the old 50% endpoint, reach distinct new endpoints and reset at zero', () => {
  const face = new FaceController(viewerConfig.face);
  for (const selection of ['angry', 'proud', 'surprised']) {
    face.setExpression(selection, .5); face.update(4);
    for (const [key, value] of Object.entries(viewerConfig.face.exaggerated[selection])) assert(Math.abs(face.values[key]-value)<1e-8);
    face.setExpression(selection, 2); face.update(4);
    for (const [key, value] of Object.entries(viewerConfig.face.dramatic[selection])) assert(Math.abs(face.values[key]-value)<1e-8);
    face.setExpression(selection, 0); face.update(4);
    assert(Object.values(face.values).every(value=>Math.abs(value)<1e-8));
  }
});
