import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Box3, BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { ClimbStage } from '../src/game/ClimbStage.js';
import { ClimbEngine } from '../src/game/ClimbEngine.js';
import { climbConfig } from '../src/config/climbConfig.js';
import { CameraController } from '../src/viewer/CameraController.js';
import { PhotographyController } from '../src/viewer/PhotographyController.js';
import { ViewerDialogue, expressionBand } from '../src/ui/ViewerDialogue.js';
import { reverseBeat } from '../src/viewer/actionTimeline.js';
import { ActionPanel } from '../src/ui/ActionPanel.js';
import { GameStage } from '../src/game/GameStage.js';
import { IdleController } from '../src/viewer/IdleController.js';
import { SceneManager } from '../src/viewer/SceneManager.js';
import { ModelManager } from '../src/viewer/ModelManager.js';
import { FaceController } from '../src/viewer/FaceController.js';
import { GazeController } from '../src/viewer/GazeController.js';
import { loadingStatus } from '../src/ui/loadingStatus.js';
import { viewerConfig } from '../src/config/viewerConfig.js';

// Reconstruct the supplied asset's actual node hierarchy without decoding images
// or requiring WebGL. Browser checks separately exercise the skinned meshes/UI.
function fixture(file = 'si.glb') {
  const bytes = readFileSync(new URL(`../public/models/${file}`, import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const joints = new Set(gltf.skins.flatMap((skin) => skin.joints));
  const associations = new Map();
  const nodes = gltf.nodes.map((node, index) => {
    const object = joints.has(index) ? new Bone() : new Group();
    object.name = node.name || ''; object.userData.gltfIndex=index;
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
    new Box3(new Vector3(-0.5, -1, -0.5), new Vector3(0.5, 1, 0.5)), undefined, viewerConfig.face, viewerConfig.gaze, viewerConfig.interactions.photography);
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
    assert(distance(samples[20][wrist], base[wrist]) > 0.02);
    assert(distance(samples[52][spine],samples[66][spine])>.01,'caught reaction changes posture');
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
  idle.update(viewerConfig.idle.gestures.tsundere.duration * .71);
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
  assert(idle.legs.L.solver.end.getWorldPosition(new Vector3()).distanceTo(idle.legs.L.anchor) < .00001);
  assert(idle.legs.R.solver.end.getWorldPosition(new Vector3()).y > idle.legs.R.anchor.y,'cartoon aftershock lifts the free foot');
  idle.update(viewerConfig.idle.gestures.tsundere.duration * .15);
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

test('leek story plays, can stop while idle is paused, and disposes its GPU resources', () => {
  const idle = fixture();
  const base = pose(idle);
  assert(idle.playGesture(viewer,'leek'));
  idle.update(viewerConfig.idle.leekStory.beats.dance+1);
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
  for(let j=0;j<240;j++){
    idle.update(1/30);
    if(j>185){
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
    idle.playGesture(viewer,'tsundere');idle.update(viewerConfig.idle.gestures.tsundere.duration*.71);
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

test('all three short plays finish automatically, restore the actor and release pooled ink resources', () => {
  for(const kind of ['tsundere','leek','reverse']){
    const idle=fixture(),r=idle.reverse;
    const base=pose(idle);idle.playGesture(viewer,kind);
    const duration=viewerConfig.idle.gestures[kind].duration;
    for(let i=0;i<Math.ceil((duration+1)*30);i++){idle.update(1/30);if(idle.reverseChoice==='pending')idle.chooseReverse('extend');}
    assert.equal(idle.gestureTime,null,kind);assert.equal(r.active,false);assert.equal(r.landing,null);
    assert(r.actor.position.equals(r.base.position));assert(r.actor.scale.equals(r.base.scale));
    assert.equal(idle.leek.group.visible,false);assert.equal(r.leek.group.visible,false);
    assert.equal(idle.inkStage.root.visible,false);close(pose(idle),base);
    let freed=0;
    for(const resource of [idle.inkStage.material,idle.inkStage.ringMaterial,idle.inkStage.plane,idle.inkStage.ringGeometry])resource.addEventListener('dispose',()=>freed++);
    idle.dispose();assert.equal(freed,4);assert.equal(idle.inkStage.root.parent,null);
  }
});

test('reverse story has a grounded fake ending, second grab, windmill and exact cancellation at every beat', () => {
  for(const seconds of [1,4.5,7.5,10.2,13.7,18.6]){
    const idle=fixture();idle.playGesture(viewer,'reverse');
    for(let t=0;t<seconds-1e-8;t+=.05){idle.update(Math.min(.05,seconds-t));if(idle.reverseChoice==='pending')idle.chooseReverse('extend');}
    const r=idle.reverse;
    assert.equal(r.segments.length,8,'four two-segment ink limbs');
    if(seconds===10.2){assert(r.actor.position.distanceTo(r.base.position)<1e-8);assert(r.actor.scale.distanceTo(r.base.scale)<1e-8);}
    if(seconds===7.5||seconds===13.7){
      const wrist=r.stage.worldToLocal(idle.arms.R.end.getWorldPosition(new Vector3()));
      assert(wrist.distanceTo(r.hand.position)<1e-5);assert(r.beat.attached>.99);
    }
    idle.stopGesture();idle.update(1);
    assert(r.actor.position.equals(r.base.position));assert(r.actor.scale.equals(r.base.scale));assert.equal(r.visible,false);
    idle.dispose();
  }
});

test('small onion opens its eyes only for the punchline, then hides them on replay', () => {
  const idle=fixture();idle.playGesture(viewer,'leek');idle.update(8);
  assert.equal(idle.leek.face.visible,false);idle.update(viewerConfig.idle.leekStory.beats.peek+.4-8);assert.equal(idle.leek.face.visible,true);
  idle.stopGesture();idle.update(1);assert.equal(idle.leek.face.visible,false);
  idle.playGesture(viewer,'leek');idle.update(.7);assert.equal(idle.leek.face.visible,false);idle.dispose();
});

test('onion variants keep three crown tufts, a bent stem and a face attached to the stem', () => {
  const idle=fixture(),held=idle.leek,giant=idle.reverse.leek;
  assert.equal(held.variant,'held');assert.equal(giant.variant,'giant');
  assert(giant.design.radius>held.design.radius);
  assert.equal(held.geometries[1].getAttribute('position').count,66,'three 22-vertex tufts in a single mesh');
  assert(held.stemBend(.9)>held.stemBend(.3));
  const positions=giant.faceGeometry.getAttribute('position');
  for(let i=0;i<positions.count;i++){
    const t=positions.getY(i)/giant.config.stemLength+.15;
    const dx=positions.getX(i)-giant.stemBend(t),z=positions.getZ(i);
    assert(Math.abs(Math.hypot(dx,z)-giant.stemRadius(t)-.00035)<1e-7,'face follows stem surface');
  }
  assert.equal(idle.reverse.facePaper,undefined,'no floating face mask');
  giant.setFace('serious');held.setFace('peek');
  const atlasUV=giant.faceGeometry.getAttribute('uv');
  assert(atlasUV.getX(0)>=.25&&atlasUV.getX(16)<=.5,'each prop changes its own atlas UVs');
  held.setFace('dead');assert.equal(giant.expression,'serious');idle.dispose();
});

test('chorus uses three fixed dancers, a late beat, shared maps, and clears completely after stop', () => {
  const idle=fixture(),chorus=idle.chorus;
  assert.equal(chorus.entries.length,3);
  for(const {prop} of chorus.entries){assert.equal(prop.variant,'dancer');assert.equal(prop.assets,idle.leek.assets);}
  idle.playGesture(viewer,'leek');idle.update(7.2);
  assert(chorus.entries.every(({prop})=>prop.group.visible));
  assert(Math.abs(chorus.entries[0].prop.tilt-chorus.entries[2].prop.tilt)>.01,'last dancer lags the beat');
  idle.update(viewerConfig.idle.leekStory.beats.peek+.2-7.2);assert.equal(idle.leek.expression,'peek');
  idle.update(.7);assert.equal(idle.leek.expression,'dead');
  idle.stopGesture();idle.update(1);assert(chorus.entries.every(({prop})=>!prop.group.visible));
  const hosts=chorus.entries.map(({host})=>host);idle.dispose();assert(hosts.every(host=>host.parent===null));
});


test('shoe cycle has three distinct magnifications, retains a manual level, and restores full body', () => {
  const doc={addEventListener(){},removeEventListener(){}};
  const element={style:{},addEventListener(){},removeEventListener(){},getRootNode:()=>doc,clientWidth:390,clientHeight:844};
  const camera=new PerspectiveCamera(40,390/844,.01,100);
  const controller=new CameraController(camera,element,viewerConfig);
  const manager=new ModelManager(new Group(),viewerConfig);
  manager.current={bounds:new Box3(new Vector3(-.5,-1,-.5),new Vector3(.5,1,.5)),idle:{legs:{L:{anchor:new Vector3(.1,-.9,.05)},R:{anchor:new Vector3(-.1,-.9,.05)}}}};
  controller.setModel(manager.current.bounds,manager.getShoePresets());
  const distances=[];
  for(let i=1;i<=3;i++){assert.equal(controller.advanceShoeView(),i);controller.update(1);distances.push(camera.position.distanceTo(controller.controls.target));}
  assert(distances[1]<distances[0]*.8);assert(distances[2]<distances[1]*.85);
  controller.controls.dispatchEvent({type:'start'});assert.equal(controller.shoeLevel,3);assert.equal(controller.shoeOrbitActive,false);
  assert.equal(controller.advanceShoeView(),0);controller.update(1);
  assert.equal(controller.shoeOrbitActive,false);assert(controller.bounds.equals(manager.current.bounds));
  controller.dispose();
});

test('panel auto-fold waits for settling and user toggles override automatic restoration', () => {
  const original=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn();
  try{
    const panel={scrollTop:140,dataset:{expanded:'true'}},setExpanded=value=>{panel.dataset.expanded=String(value);};
    const control=new ActionPanel(panel,setExpanded);control.start();assert.equal(panel.dataset.expanded,'false');
    control.update(true);assert.equal(panel.dataset.expanded,'false');panel.scrollTop=0;control.update(false);
    assert.equal(panel.dataset.expanded,'true');assert.equal(panel.scrollTop,140);
    control.start();control.manualToggle();control.update(false);assert.equal(panel.dataset.expanded,'false');
  }finally{if(original)globalThis.requestAnimationFrame=original;else delete globalThis.requestAnimationFrame;}
});

test('paint strokes stay in world space and the visible brush tip meets the sampled stroke', () => {
  for(const kind of ['leek','reverse']){
    const idle=fixture();idle.playGesture(viewer,kind);let count=0;
    for(const time of [.9,1.4,2,2.5]){
      idle.update(time-(idle.gestureTime||0));const drawing=idle.drawing;
      assert(drawing.brush.visible);
      const actual=drawing.brush.localToWorld(new Vector3(0,viewerConfig.idle.drawing.brushLength*idle.height,0));
      const target=drawing.tipAt(kind,time,new Vector3());assert(actual.distanceTo(target)<1e-6,'tip and ink share a path');
      const origin=drawing.root.getWorldPosition(new Vector3());assert(origin.distanceTo(drawing.origin(kind,new Vector3()))<1e-6,'drawing is anchored');
      const next=drawing.sketches[kind].geometry.drawRange.count;assert(next>=count);count=next;
    }
    idle.stopGesture();idle.update(1);assert.equal(idle.drawing.brush.visible,false);assert.equal(idle.drawing.root.visible,false);assert.equal(idle.drawing.preview.group.visible,false);idle.dispose();
  }
});

test('giant interrupts a half-painted onion and holds the 1.5 second stare before grabbing', () => {
  const idle=fixture(),c=viewerConfig.idle.reverse;assert.equal(c.beats.grab-c.beats.stare,1.5);
  idle.playGesture(viewer,'reverse');idle.update(c.beats.stare+.05);
  const count=idle.drawing.sketches.reverse.geometry.drawRange.count,head=idle.head.bone.quaternion.clone();
  assert(count>0&&count<idle.drawing.sketches.reverse.geometry.index.count);
  idle.update(1.3);assert.equal(idle.drawing.sketches.reverse.geometry.drawRange.count,count);
  assert(head.angleTo(idle.head.bone.quaternion)<1e-6);assert.equal(idle.reverse.beat.attached,0);
  idle.stopGesture();idle.update(1);idle.dispose();
});

test('stopping before the giant is born never flashes its solid body', () => {
  const idle=fixture();idle.playGesture(viewer,'reverse');idle.update(1.2);idle.stopGesture();idle.update(.05);
  assert(idle.reverse.leek.materials.every(material=>material.opacity===0));idle.update(1);idle.dispose();
});


test('small sketch hands over a single solid onion without overlapping copies', () => {
  const idle=fixture();idle.playGesture(viewer,'leek');idle.update(3.7);
  assert(idle.drawing.preview.group.visible);assert.equal(idle.leek.group.visible,false);
  idle.update(.5);assert.equal(idle.drawing.preview.group.visible,false);assert(idle.leek.group.visible);assert.equal(idle.leek.alpha,1);
  idle.stopGesture();idle.update(1);idle.dispose();
});


test('leek dance contains two complete eight-beat phrases', () => {
  const c=viewerConfig.idle;assert(Math.abs((c.leekStory.beats.pose-c.leekStory.beats.dance)/(c.action.leekCycle/2)-16)<1e-8);
  assert.equal(c.leekStory.beats.big,c.leekStory.beats.dance+8*c.action.leekCycle/2);
});

test('reverse waits indefinitely at the choice with a frozen rig, and cancellation clears the choice', () => {
  const idle=fixture();idle.playGesture(viewer,'reverse');idle.update(30);
  assert.equal(idle.gestureTime,viewerConfig.idle.reverse.choiceAt);assert.equal(idle.reverseChoice,'pending');
  const snapshot=pose(idle),actor=idle.reverse.actor.matrixWorld.clone(),clock=idle.time;
  for(let i=0;i<120;i++)idle.update(.5,viewer);
  close(pose(idle),snapshot);assert.equal(idle.time,clock);assert(idle.reverse.actor.matrixWorld.equals(actor));
  assert.equal(idle.chooseReverse('invalid'),false);idle.stopGesture();idle.update(1);
  assert.equal(idle.reverseChoice,null);assert.equal(idle.gestureTime,null);assert.equal(idle.reverse.visible,false);idle.dispose();
});

test('rescue actually skips the windmill and the second branch resumes after a longer fake ending', () => {
  for(const choice of ['rescue','extend']){
    const idle=fixture();idle.playGesture(viewer,'reverse');idle.update(10);
    assert(idle.chooseReverse(choice));assert.equal(idle.chooseReverse(choice),false);
    if(choice==='rescue'){
      assert.equal(idle.gestureTime,null);assert.equal(idle.rescueTime,0);
      for(let i=0;i<100;i++){idle.update(.05);assert(!idle.reverse.beat.second);}
      assert.equal(idle.rescueTime,null);assert(idle.reverse.actor.scale.equals(idle.reverse.base.scale));
    }else{
      assert(viewerConfig.idle.reverse.beats.windmill-viewerConfig.idle.reverse.beats.rest>=2);
      idle.update(1.5);assert.equal(idle.reverse.beat.second,0);idle.update(1);
      assert(idle.reverse.beat.second>0);assert(idle.inkStage.tornado.visible);
      idle.stopGesture();idle.update(1);assert(!idle.inkStage.root.visible);
    }
    idle.dispose();
  }
});

test('windmill completes four revolutions and all additional GPU resources are disposed', () => {
  const c=viewerConfig.idle.reverse;
  assert.equal(reverseBeat(c.beats.return,c).angle,Math.PI*8);
  const idle=fixture(),stage=idle.inkStage;assert.equal(stage.windRings.length,6);
  let freed=0;for(const r of [stage.tornadoMaterial,stage.tornadoGeometry])r.addEventListener('dispose',()=>freed++);
  idle.dispose();assert.equal(freed,2);assert.equal(stage.root.parent,null);
});

test('four expression bands have exact 50/100/150/200 boundaries and independent A/B rotations', () => {
  assert.deepEqual([0,.01,.5,.51,1,1.01,1.5,1.51,2,4,NaN].map(expressionBand),[-1,0,0,1,1,2,2,3,3,3,-1]);
  const original=globalThis.document;
  globalThis.document={createElement:()=>({hidden:false,append(){},setAttribute(){},remove(){},dataset:{}})};
  try{
    const d=new ViewerDialogue({append(){}},viewerConfig.interactions.dialogue);
    for(const selection of ['angry','proud','surprised'])for(const strength of [.5,1,1.5,2]){
      d.expression(selection,strength);const a=d.session.line;
      d.expression(selection,strength);const b=d.session.line;assert.notEqual(a,b);
      d.expression(selection,strength);assert.equal(d.session.line,a);
    }
    d.expression('angry',0);assert.equal(d.session,null);
    d.expression('proud',2);d.update(5);assert.equal(d.result.textContent,'申請駁回');assert.equal(d.speech.textContent,'……誰問你了。');
    d.expression('surprised',2);d.update(5);assert.equal(d.result.textContent,'協議已更新：現在有了。');assert.equal(d.speech.textContent,'……你改的？');
    d.expression('angry',2);d.update(1,true);assert.equal(d.session,null);d.dispose();
  }finally{if(original)globalThis.document=original;else delete globalThis.document;}
});

test('photography responds to actual framing, cancels dwell on movement and triggers only once per visit', () => {
  let lines=0;const photo=new PhotographyController(viewerConfig.interactions.photography,()=>{lines++;});
  const camera=new PerspectiveCamera(),anchor={position:new Vector3(),height:2},target=new Vector3();camera.position.set(0,0,1);
  const tick=(n,moving=false)=>{for(let i=0;i<n;i++)photo.update(.1,camera,target,anchor,false,moving);};
  tick(30);assert.equal(lines,0);assert(photo.lean>.99);
  tick(20,true);assert.equal(photo.dwell,0);tick(41);assert.equal(lines,1);tick(100);assert.equal(lines,1);
  camera.position.z=4;tick(1);assert(!photo.close);assert.equal(photo.dwell,0);
  camera.position.z=1;tick(42);assert.equal(lines,2);
  photo.update(1,camera,target,anchor,true);assert.equal(photo.lean,0);assert.equal(photo.spoken,false);
});

test('close-up lean keeps both feet planted and yields to the authored action', () => {
  const idle=fixture(),base=idle.spine.bone.quaternion.clone();idle.photoLean=1;idle.update(1,viewer);
  assert(idle.spine.bone.quaternion.angleTo(base)>.08);
  for(const {solver,anchor} of Object.values(idle.legs))assert(solver.end.getWorldPosition(new Vector3()).distanceTo(anchor)<1e-5);
  const other=fixture();idle.playGesture(viewer,'tsundere');other.playGesture(viewer,'tsundere');idle.update(2);other.update(2);close(pose(idle),pose(other));idle.dispose();other.dispose();
});

test('back view travels around the model and gaze keeps its shoulder through the rear seam', () => {
  const doc={addEventListener(){},removeEventListener(){}},element={style:{},addEventListener(){},removeEventListener(){},getRootNode:()=>doc,clientWidth:390,clientHeight:844};
  const camera=new PerspectiveCamera(40,390/844,.01,100),controller=new CameraController(camera,element,viewerConfig);
  const bounds=new Box3(new Vector3(-.5,-1,-.5),new Vector3(.5,1,.5));controller.setModel(bounds,[]);
  const start=camera.position.clone();controller.showBack();controller.update(.55);
  assert(camera.position.distanceTo(controller.controls.target)>1,'does not pass through the actor');assert(Math.abs(camera.position.x)>.5);
  controller.update(.6);assert(camera.position.z<0);assert(Math.abs(camera.position.z+start.z)<1e-6);
  const head=new Group();head.updateMatrixWorld(true);const gaze=new GazeController(head,viewerConfig.gaze);gaze.setMode('camera');
  gaze.update(1,new Vector3(.2,0,-1));const before=gaze.angles.headYaw;gaze.update(.01,new Vector3(-.01,0,-1));assert(before*gaze.angles.headYaw>0);
  assert(Math.abs(gaze.angles.headYaw)<=viewerConfig.gaze.rearHeadYawLimit);assert(gaze.angles.headYaw>.5);controller.dispose();
});


test('rejected pride visibly loses its smile and restores the selected expression after the payoff', () => {
  const idle=fixture();idle.expression.setExpression('proud',2);idle.update(4);
  const mouth=idle.face.find(x=>x.role==='mouth'&&x.side==='Right'),offset=mouth.bone.position.distanceTo(mouth.rest);
  idle.dialogueReaction={selection:'proud'};idle.update(1);
  assert(mouth.bone.position.distanceTo(mouth.rest)<offset*.2);assert(idle.eyelids[0].bone.position.equals(idle.eyelids[0].rest));
  idle.dialogueReaction=null;idle.update(1);assert(Math.abs(mouth.bone.position.distanceTo(mouth.rest)-offset)<1e-8);idle.dispose();
});


test('game dance loops beyond the authored short without triggering its ending or a choice',()=>{
 const idle=fixture(),stage=new GameStage({current:{idle}});assert(stage.start(viewer));
 for(let t=0;t<65;t+=.1){stage.prepare(t,'leek');idle.update(.1,viewer);stage.afterUpdate(.1,t,'leek');assert(idle.gestureTime!==null);assert.equal(idle.reverseChoice,null);}
 stage.stop();idle.update(1);assert.equal(idle.gestureTime,null);assert.equal(idle.gameClock,null);assert(!idle.leek.group.visible);idle.dispose();
});
test('game takeover uses the actual wrist grip and fully restores the actor when leaving',()=>{
 const idle=fixture(),stage=new GameStage({current:{idle}});assert(stage.start(viewer));
 stage.prepare(14,'reverse');idle.update(1,viewer);stage.afterUpdate(.1,14,'reverse');
 const r=idle.reverse,wrist=r.stage.worldToLocal(idle.arms.R.end.getWorldPosition(new Vector3()));
 assert(wrist.distanceTo(r.hand.position)<1e-5);assert(r.active);assert(r.ink.visible);assert.equal(idle.reverseChoice,null);
 stage.stop();idle.update(1);assert(r.actor.position.equals(r.base.position));assert(r.actor.scale.equals(r.base.scale));assert(!r.active&&!r.visible);idle.dispose();
});
test('Zhuang view anchors enable close-up and three shoe presets without applying Si animation',()=>{
 const idle=fixture('zhuang-fangyi.glb');assert.equal(idle.supported,false);assert.equal(idle.head,undefined);
 const byNode=id=>{let found;idle.root.traverse(node=>{if(node.userData.gltfIndex===id)found=node;});return found;};
 const manager=new ModelManager(new Group(),viewerConfig);manager.current={idle,bounds:new Box3(new Vector3(-.5,-1,-.5),new Vector3(.5,1,.5)),viewAnchors:{head:byNode(83),feet:[byNode(57),byNode(35)]}};
 assert(manager.getGazeAnchor().position.equals(byNode(83).getWorldPosition(new Vector3())));assert(manager.getFaceBounds());
 const shoes=manager.getShoePresets();assert.equal(shoes.length,3);assert(shoes[0].getSize(new Vector3()).length()>shoes[1].getSize(new Vector3()).length());assert(shoes[1].getSize(new Vector3()).length()>shoes[2].getSize(new Vector3()).length());
 idle.dispose();
});

test('climb stage preserves an off-center asset floor through scaling/rotation and restores the viewer',()=>{
 const idle=fixture(),group=new Group(),probe=new Mesh(new BoxGeometry(1,2,1),new MeshBasicMaterial());
 probe.position.set(2,6,.4);group.position.set(-2,-6,-.4);group.add(idle.root,probe);
 const model={group,idle},world=new Group();world.add(group);
 const scene={scene:world,camera:new PerspectiveCamera(40,390/844,.01,100),renderer:{domElement:{getBoundingClientRect:()=>({width:390,height:844})}}};
 const controller={controls:{enabled:true},stopShoeOrbit(){}};
 const stage=new ClimbStage(scene,controller,{current:model},climbConfig),engine=new ClimbEngine();
 const original=group.position.clone();assert(stage.attach());stage.update(engine,0);world.updateMatrixWorld(true);
 assert(Math.abs(new Box3().setFromObject(probe).min.y-engine.player.y)<1e-6,'feet remain on the platform, not above it');
 stage.detach();assert(group.position.equals(original));assert(group.scale.equals(new Vector3(1,1,1)));assert(!stage.root.visible);
 assert(stage.attach());stage.update(engine,0);let disposed=0;for(const g of stage.geometries)g.addEventListener('dispose',()=>disposed++);
 stage.dispose();assert.equal(disposed,stage.geometries.length);assert(!stage.root.parent);idle.dispose();probe.geometry.dispose();probe.material.dispose();
});
