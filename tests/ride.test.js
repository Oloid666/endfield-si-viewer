import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Group, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RideEngine } from '../src/game/RideEngine.js';
import { SeatedRider } from '../src/game/SeatedRider.js';
import { rideConfig, zhuangRideConfig, rivalRideConfig } from '../src/config/rideConfig.js';
import { zhuangRace, openingDialogue, impactLines } from '../src/game/ZhuangRaceStory.js';
import { RideStage } from '../src/game/RideStage.js';
import { ZhuangIdleController } from '../src/viewer/ZhuangIdleController.js';
import { dialogueParts } from '../src/ui/RaceDialogue.js';

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

test('opening story immediately speaks, gives seven seconds of driving, then reveals the prize on a straight', () => {
  const e = zhuangEngine(); assert(e.pet.z < e.z); assert(!e.useGas());
  advance(e, .5, { steer: -1 }); assert(e.offset < -.2, 'intro accepts steering');
  e.start(); advance(e, 6.9); assert.equal(e.storyPhase, 'drag'); assert.equal(e.speed, zhuangRace.introSpeed);
  advance(e, .2); assert.equal(e.storyPhase, 'sponsor'); assert(!e.useGas()); assert(e.speed > 13);
  advance(e, 3.9); assert.equal(e.storyPhase, 'takeover'); assert(e.pet.x > e.x + 2.5);
  advance(e, 1.3); assert.equal(e.storyPhase, 'race'); assert(e.pet.z > e.z); assert(e.speed > 30);
  assert.deepEqual(e.takeEvents().filter(x => x.type === 'story').map(x => x.phase), ['drag', 'sponsor', 'takeover', 'race']);
});

test('Zhuang magic unlocks after takeover, costs one charge, accelerates and freezes on pause', () => {
  const e = zhuangEngine(); assert.equal(e.gasLeft, 2); advance(e, 12.1);
  assert(e.useGas()); assert.equal(e.gasLeft, 1); assert(!e.useGas());
  advance(e, .8); assert(e.speed > 40); assert(e.speed <= zhuangRace.maxSpeed);
  e.pause(); const snapshot = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), snapshot); assert(!e.useGas());
  e.resume(); advance(e, .1); assert(e.gasTime > 0);
});

test('holding direction drifts without a brake button and releasing direction earns an exit boost', () => {
  const e = zhuangEngine(); advance(e, 13);
  advance(e, .8, { steer: 1 }); assert(e.isDrifting); assert(e.charge > .28);
  advance(e, .05); assert(e.boost > 0); assert(e.driftCount > 0);
  e.start(); advance(e, 13); advance(e, .1, { steer: 1 }); advance(e, .1); assert.equal(e.boost, 0);
});

test('story and role exchange freeze on pause; replay resets the entire course and switching to Si restores its config', () => {
  const e = zhuangEngine(); advance(e, 10.8); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 10); assert.equal(JSON.stringify(e), snapshot);
  e.resume(); advance(e, 1.4); assert.equal(e.storyPhase, 'race');
  e.start(); assert.equal(e.storyPhase, 'drag'); assert.equal(e.progress, 0); assert(e.pet.z < e.z); assert.equal(e.gasLeft, 2);
  assert.equal(e.petBumps, 0); assert.equal(e.airHit.size, 0); assert.equal(e.height, 0);
  e.setCharacter('si'); e.start(); assert.equal(e.config, rideConfig); assert.equal(e.storyPhase, null);
  assert(e.pet.z > e.z); assert.equal(e.gasLeft, 1); assert(e.useGas());
});

test('takeoff waits for the player in slow motion, works with no charges, then lifts and still accepts steering', () => {
  const e = zhuangEngine(); advance(e, 13); e.progress = zhuangRace.flightAt;
  advance(e, .1); assert.equal(e.storyPhase, 'takeoff'); assert(e.takeoffPending); assert(!e.flying); assert.equal(e.height, 0);
  const p = e.progress, countdown = e.prizeRemaining; advance(e, 2);
  assert(e.progress - p < 18, 'world advances at 18% speed');
  assert(countdown - e.prizeRemaining < .4, 'prize countdown slows too');
  e.gasLeft = 0; assert(e.requestTakeoff()); assert(!e.takeoffPending); assert(!e.requestTakeoff()); assert.equal(e.gasLeft, 0);
  advance(e, 2.5); assert.equal(e.height, 6); assert(e.speed > 55);
  const offset = e.offset; advance(e, .3, { steer: -1 }); assert(e.offset < offset);
  advance(e, .8, { steer: 1 }); assert(e.velocity > 0);
  e.pause(); const snapshot = JSON.stringify(e); advance(e, 2); assert.equal(JSON.stringify(e), snapshot);
  e.start(); assert(!e.flying); assert.equal(e.height, 0); assert.equal(e.flightStarted, null); assert.equal(e.prizeDeadline, null);
});

test('companion collisions are independent, debounced and more exaggerated in flight', () => {
  const e = zhuangEngine(); advance(e, 13); const speed = e.speed, progress = e.progress;
  assert(e.petBump('路邊路牌', 1)); assert.equal(e.speed, speed); assert.equal(e.progress, progress); assert.equal(e.bumps, 0);
  assert.equal(e.petGroundBumps, 1); assert(!e.petBump('路牌', 1)); const groundSpin = e.pet.tumble;
  advance(e, 1); e.progress = zhuangRace.flightAt; advance(e, .1); e.requestTakeoff(); assert(e.flying);
  assert(e.petBump('空中招牌', -1)); assert.equal(e.petAirBumps, 1);
  assert.equal(e.pet.tumble - groundSpin, Math.PI * 4); assert(e.pet.hit > .9);
  e.start(); assert.equal(e.petBumps, 0); assert.equal(e.pet.tumble, 0); assert.equal(e.groundHit.size, 0);
});

test('80-second course has distinct speed stages, visible collision contacts and frame-rate independent results', () => {
  const run = fps => {
    const e = zhuangEngine(), beats = []; let highest = 0, raceSpeed = 0, flightSpeed = 0;
    for (let i = 0; i < fps * 130 && e.state === 'playing'; i++) {
      if (e.takeoffPending) e.requestTakeoff();
      e.update(1 / fps); highest = Math.max(highest, e.height);
      if (e.storyPhase === 'race') raceSpeed = Math.max(raceSpeed, e.speed);
      if (e.flying) flightSpeed = Math.max(flightSpeed, e.speed);
      beats.push(...e.takeEvents().filter(x => x.type === 'story').map(x => x.phase));
      assert(Number.isFinite(e.x + e.z + e.height + e.pet.y));
      assert(Math.hypot(e.pet.x - e.x, e.pet.z - e.z, e.pet.y - e.height) <= zhuangRideConfig.maxRopeLength + 1e-8);
      assert(e.speed <= zhuangRace.maxSpeed);
    }
    assert.equal(e.state, 'won'); assert.equal(highest, 6); assert(e.elapsed > 60 && e.elapsed < 90);
    assert(raceSpeed > zhuangRace.introSpeed * 2.4); assert(flightSpeed > raceSpeed * 1.5);
    assert(e.petGroundBumps > 0 && e.petAirBumps > 0);
    assert(e.petAirBumps / (e.elapsed - e.flightStarted) > e.petGroundBumps / (e.flightStarted - zhuangRace.raceAt), 'flying has more frequent contacts');
    assert(e.airHit.size > 0 && e.groundHit.size > 0, 'counts come from real scene hazards');
    assert.deepEqual(beats, ['drag', 'sponsor', 'takeover', 'race', 'impatient', 'takeoff', 'flight']);
    const snapshot = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), snapshot);
    return [e.elapsed, e.progress, e.x, e.petBumps];
  };
  const reference = run(120);
  for (const fps of [30, 60]) run(fps).forEach((value, i) => assert(Math.abs(value - reference[i]) < 1e-8));
});

test('countersteering the bends reduces guardrail impacts instead of automatically following every curve', () => {
  const run = controlled => {
    const e = zhuangEngine();
    while (e.state === 'playing' && e.elapsed < 120) {
      const steer = controlled ? Math.max(-1, Math.min(1, -e.offset * .12 - e.velocity * .13)) : 0;
      if (e.takeoffPending) e.requestTakeoff();
      e.update(1 / 120, { steer }); e.takeEvents();
    }
    return { bumps: e.bumps, time: e.elapsed };
  };
  const idle = run(false), driven = run(true);
  assert(idle.bumps >= 4); assert(driven.bumps < idle.bumps); assert(driven.time < idle.time);
});

test('rear chase camera preserves screen left/right in both orientations, during takeover and along every bend', () => {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const camera = new PerspectiveCamera(48, width / height, .1, 150);
    const stage = { scene: { camera, renderer: { domElement: { getBoundingClientRect: () => ({ width, height }) } } }, center: zhuangRideConfig.center, firstFrame: true, cameraDirection: new Vector3(), desiredCameraDirection: new Vector3(), look: new Vector3() };
    const e = zhuangEngine();
    for (const elapsed of [0, 24.9, 25.1, 26, 27.1, 70]) for (const progress of [0, 320, 500, 750, 1100, 1550, 1950, 2300]) {
      e.elapsed = elapsed; e.progress = progress; e.pet.x = e.x; e.pet.z = e.z + 3;
      RideStage.prototype.frameDrivingCamera.call(stage, e, 1 / 60); camera.updateMatrixWorld();
      const left = new Vector3(e.x - 1, e.height + 1, e.z).project(camera);
      const right = new Vector3(e.x + 1, e.height + 1, e.z).project(camera);
      assert(left.x < right.x, 'left cannot reverse when the character changes');
      assert(camera.position.z > e.z, 'camera always follows from behind');
    }
  }
});

test('a swinging dragon stays within the mobile view without reversing or pulling the chase camera far away', () => {
  const camera = new PerspectiveCamera(48, 390 / 844, .1, 150);
  const stage = { scene: { camera, renderer: { domElement: { getBoundingClientRect: () => ({ width: 390, height: 844 }) } } }, center: zhuangRideConfig.center, firstFrame: true, cameraDirection: new Vector3(), desiredCameraDirection: new Vector3(), look: new Vector3() };
  const e = zhuangEngine();
  while (e.state === 'playing') {
    if (e.takeoffPending) e.requestTakeoff();
    e.update(1 / 60, { steer: Math.sin(e.elapsed) });
    RideStage.prototype.frameDrivingCamera.call(stage, e, 1 / 60); camera.updateMatrixWorld();
    for (const side of [-1, 1]) {
      const edge = new Vector3(e.pet.x + side * .8, e.pet.y + .5, e.pet.z).project(camera);
      assert(Math.abs(edge.x) < .98, 'face and hit reaction remain on screen');
    }
    assert(camera.position.distanceTo(stage.look) < 20, 'bounded zoom keeps the rider readable');
    e.takeEvents();
  }
});

test('opening lines tell the story immediately, stay short, and collision objects have matching jokes', () => {
  assert.equal(openingDialogue[0].at, 0); assert.match(openingDialogue[0].line, /阿莊/);
  assert(openingDialogue.every(item => item.line.length < 27));
  for (const item of [...zhuangRideConfig.obstacles, ...zhuangRideConfig.petHazards, ...zhuangRideConfig.airHazards]) assert(impactLines[item.name]);
  assert.equal(zhuangRideConfig.stamps.length, 0, 'no unexplained collectible rings');
});

test('optional Si opponent progresses independently, freezes with the race, and can win or lose', () => {
  const run = (delay, opponent = true) => {
    const e = zhuangEngine(); e.setOpponent(opponent); let pendingAt;
    while (e.state === 'playing' && e.elapsed < 170) {
      const before = e.rival.progress;
      e.update(1 / 120);
      assert(e.rival.progress >= before); assert(e.rival.speed <= rivalRideConfig.maxSpeed);
      if (e.takeoffPending) { pendingAt ??= e.elapsed; if (e.elapsed - pendingAt >= delay) e.requestTakeoff(); }
      e.takeEvents();
    }
    return e;
  };
  assert.equal(run(0).outcome, 'rival', 'automatic takeoff alone no longer wins'); assert.equal(run(60).outcome, 'rival'); assert.equal(run(60, false).outcome, 'late');
  const e = zhuangEngine(); e.setOpponent(true); advance(e, 15); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), snapshot);
  e.start(); assert.equal(e.rival.progress, 0); assert(e.rival.enabled);
  e.setOpponent(false); assert(!e.rival.enabled); e.resume(); advance(e, 1); assert.equal(e.rival.progress, 0);
});

test('serious Si beats idling and careless boosts, but clean button steering, pickups and drift can win', () => {
  const run = mode => {
    const e = zhuangEngine(); e.setOpponent(true); let steer = 0, nextInput = 0;
    while (e.state === 'playing' && e.elapsed < 120) {
      if (e.takeoffPending) e.requestTakeoff();
      if (mode !== 'idle' && e.elapsed >= zhuangRace.raceAt) e.useGas();
      if (mode === 'skill' && e.elapsed >= nextInput) {
        const correction = -e.offset * .17 - e.velocity * .18 + e.curvature(e.progress) * e.speed * .75;
        steer = Math.abs(correction) > .08 ? Math.sign(correction) : 0;
        nextInput = e.elapsed + .18; // held left/right buttons, no analogue input or frame-perfect steering
      }
      e.update(1 / 120, { steer }); e.takeEvents();
    }
    return e;
  };
  const idle = run('idle'), careless = run('boost'), skill = run('skill');
  assert.equal(idle.outcome, 'rival'); assert.equal(careless.outcome, 'rival');
  assert.equal(skill.outcome, 'player'); assert.equal(skill.bumps, 0);
  assert(skill.pickups.size >= 4 && skill.driftCount >= 3);
  assert(skill.prizeClock < idle.rival.finishTime - 2, 'winning has room beyond one frame');
  assert(Math.abs(idle.rival.finishTime - careless.rival.finishTime) < 1e-8, 'AI pace is independent of player mistakes');
});

test('Si plans corners and finite bursts; passing reactions have cooldowns and freeze/reset with play', () => {
  const e = zhuangEngine(); e.setOpponent(true); advance(e, 13.1);
  assert(e.rival.windup > 0); assert.equal(e.rival.burst,0); advance(e,.8);
  assert(e.rival.burst > 0); assert(e.rival.bursts === 1);
  e.takeEvents(); const r = e.rival;
  r.progress = e.progress - 10; r.lead = 1; r.nextQuip = 0;
  e.update(1 / 120); assert(e.takeEvents().some(event => event.action === 'passed'));
  assert.equal(r.reaction, 'passed'); assert(r.reactionUntil > r.clock);
  r.progress = e.progress + 10; e.update(1 / 120);
  assert(!e.takeEvents().some(event => ['pass', 'near'].includes(event.action)), 'nearby crossings cannot spam taunts');
  assert.equal(r.reaction, 'pass', 'visual response still plays during subtitle cooldown');
  assert(r.reactionUntil > r.clock);
  r.nextQuip = 0; r.lead = -1; e.update(1 / 120);
  assert(e.takeEvents().some(event => event.action === 'pass'));
  e.pause(); const snapshot = JSON.stringify(r); advance(e, 5); assert.equal(JSON.stringify(r), snapshot);
  e.start(); assert.equal(e.rival.bursts, 0); assert.equal(e.rival.reaction, null);
  e.rival.progress = 330; e.elapsed = e.rival.clock = 20; e.rival.nextBurst = 0;
  e.update(1 / 120); assert(e.rival.cornering); assert.equal(e.rival.burst, 0, 'no straight-line burst before a corner');
});

test('slow-motion decision and AI simulation are consistent at 30, 60 and 120 Hz', () => {
  const run = fps => {
    const e = zhuangEngine(); e.setOpponent(true); let pendingAt;
    while (e.state === 'playing' && e.elapsed < 130) {
      if (e.takeoffPending) { pendingAt ??= e.elapsed; if (e.elapsed - pendingAt >= 4 - 1e-8) e.requestTakeoff(); }
      e.update(1 / fps); e.takeEvents();
    }
    return e;
  };
  // Decision button is pressed on a rendered frame, so allow one frame's input
  // quantisation. Physics and timers still run at the shared 120 Hz fixed step.
  const reference = run(120);
  for (const fps of [30, 60]) { const e = run(fps); assert.equal(e.outcome, reference.outcome); assert(Math.abs(e.prizeClock - reference.prizeClock) < .08); assert(Math.abs(e.rival.progress - reference.rival.progress) < 4); }
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
  const model = await sourceModel(id), mount = new Group(), rig = new SeatedRider(model, mount, id === 'zhuang' ? zhuangRideConfig.actorHeight : rideConfig.actorHeight);
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

test('Si side-saddle bends both legs to one side, reaches the brush and can wave without moving the pelvis', async () => {
  const model = await sourceModel('si'), mount = new Group();
  const rig = new SeatedRider(model, mount, 2.6, { sideSaddle: true });
  assert(rig.attach()); rig.update(1, .2, 0);
  const knees = ['L', 'R'].map(side => mount.worldToLocal(rig.nodes[`knee${side}`].getWorldPosition(new Vector3())));
  assert(knees.every(knee => knee.x < -.2), `both knees sit beside shaft: ${knees.map(v => v.toArray())}`);
  for (const side of ['L', 'R']) {
    const knee = mount.worldToLocal(rig.nodes[`knee${side}`].getWorldPosition(new Vector3()));
    const foot = mount.worldToLocal(rig.nodes[`foot${side}`].getWorldPosition(new Vector3()));
    assert(foot.y < knee.y - .2);
  }
  for (let i = 0; i < 30; i++) rig.update(1.1 + i / 60, -.3, 0, { wave: true, lookBack: 1 });
  const wrist = mount.worldToLocal(rig.nodes.wristR.getWorldPosition(new Vector3()));
  assert(wrist.y > .65, `passing salute is visibly raised: ${wrist.toArray()}`);
  assert(mount.worldToLocal(rig.nodes.pelvis.getWorldPosition(new Vector3())).length() < .04);
  for (const { bone } of rig.bones) assert(bone.quaternion.toArray().every(Number.isFinite));
  rig.restore();
  for (const { bone, p, q, s } of rig.bones) { assert(bone.position.equals(p)); assert(bone.quaternion.equals(q)); assert(bone.scale.equals(s)); }
  model.gltf.scene.traverse(node => { node.geometry?.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.dispose(); });
});

test('jump boards launch automatically, trailer follows late, and a missed board recovers with one penalty', () => {
  for(const character of ['si','zhuang']){
    const setup=offset=>{const e=new RideEngine();e.setCharacter(character);e.start();const j=e.config.jumps[0];e.progress=j.s-1;e.elapsed=e.prizeClock=13;e.speed=j.minSpeed+5;e.offset=offset;return e;};
    const e=setup(0),j=e.config.jumps[0];
    advance(e,.12);assert(e.jump,'board starts jump');assert(e.height>0);assert(e.jumpHeight(.25)===0,'pet stays behind initially');
    let peak=0;for(let i=0;i<4*120;i++){e.update(1/120);peak=Math.max(peak,e.height);e.takeEvents();}
    assert(peak>2);assert.equal(e.jumpWins,1);assert.equal(e.jumpFails,0);assert.equal(e.jump,null);
    const missed=setup(j.width/2+.7);advance(missed,4);assert.equal(missed.jumpFails,1);assert.equal(missed.jumpWins,0);assert.equal(missed.state,'playing');assert(missed.progress>j.gapEnd);assert(missed.petGrudge>0);
    missed.start();assert.equal(missed.jumpWins,0);assert.equal(missed.jumpFails,0);assert.equal(missed.jumpTried.size,0);
  }
});

test('trailer remembers impacts, pauses with the race, forgives clean driving and resets on replay', () => {
  const e=zhuangEngine();
  for(let i=0;i<3;i++){assert(e.petBump('測試柱',1));advance(e,.8);}
  assert.equal(e.petGrudge,3);assert.equal(e.petMood,'angry');assert(e.takeEvents().some(x=>x.type==='grudge'));
  e.pause();const snapshot=JSON.stringify(e);advance(e,12);assert.equal(JSON.stringify(e),snapshot);
  e.resume();advance(e,9);assert(e.petGrudge<3);assert(e.takeEvents().some(x=>x.type==='grudge-calm'));
  e.start();assert.equal(e.petGrudge,0);assert.equal(e.petMood,'calm');
});

test('finish-straight dialogue reflects the actual gap and does not repeat the same band every frame',()=>{
  for(const [gap,band] of [[50,'behind'],[-50,'ahead'],[0,'close']]){
    const e=zhuangEngine();e.setOpponent(true);e.elapsed=e.prizeClock=40;e.flightStarted=38;e.progress=2250;e.rival.progress=e.progress+gap;e.rival.clock=40;
    e.update(1/120);const event=e.takeEvents().find(x=>x.type==='gap');assert.equal(event?.band,band);
    advance(e,.5);assert(!e.takeEvents().some(x=>x.type==='gap'));
    e.start();assert.equal(e.lastGapBand,null);
  }
});


test('dialogue splits speakers into individual portraits and resolves comic moods',()=>{
  const parts=dialogueParts('莊：妳先鬆手。祀：妳先收筆。');
  assert.deepEqual(parts.map(x=>x.speaker),['zhuang','si']);
  assert.equal(dialogueParts('龍泡泡：等等！！')[0].mood,'panic');
  assert.equal(dialogueParts('小聰明：三次了！')[0].speaker,'ink');
  assert.equal(dialogueParts('廣播：冠軍獎品！','zhuang')[0].speaker,'system');
  assert.equal(dialogueParts('祀：領墨水。','si','dead')[0].mood,'dead');
});

test('grudge belongs to the player companion and is resolved per speaker, not shared with the opponent',()=>{
  assert.equal(dialogueParts('小聰明：讓路！','zhuang',null,5)[0].mood,'calm');
  assert.equal(dialogueParts('龍泡泡：我有記。','zhuang',null,3)[0].mood,'angry');
  assert.equal(dialogueParts('小聰明：我有記。','si',null,5)[0].mood,'dead');
  const parts=dialogueParts('莊：借過。龍泡泡：又是我。','zhuang',null,5);
  assert.equal(parts[0].mood,'smug');assert.equal(parts[1].mood,'dead');
  assert.equal(dialogueParts('龍泡泡：還好。','zhuang','panic',5)[0].mood,'panic');
});

test('Zhuang display uses the supplied rig, blinks, has a dragon, pauses and releases only its own props',async()=>{
  const model=await sourceModel('zhuang'),scene=new Group(),bounds=new Box3().setFromObject(model.group,true);
  const previous=globalThis.document;
  const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
  globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>context})};
  let idle;
  try{
    idle=new ZhuangIdleController(model.gltf,bounds,scene);assert(idle.supported);assert.equal(idle.eyelids.length,12);
    idle.setCompanionVisible(true);assert(idle.display.visible);const initial=idle.head.bone.quaternion.clone();
    for(let i=0;i<10*120;i++)idle.update(1/120,new Vector3(0,0,4));
    assert(!idle.head.bone.quaternion.equals(initial));assert.equal(idle.dragon.kind,'dragon');
    for(const p of Object.values(idle.poses))assert(p.bone.quaternion.toArray().every(Number.isFinite));
    idle.setBlink(1);assert(idle.eyelids.some(p=>!p.bone.position.equals(p.rest)));
    idle.setPlaying(false);const t=idle.time,q=idle.head.bone.quaternion.clone();idle.update(2);assert.equal(idle.time,t);assert(idle.head.bone.quaternion.equals(q));
    let released=0;for(const r of idle.resources)r.addEventListener('dispose',()=>released++);const count=idle.resources.size;
    idle.dispose();assert.equal(released,count);assert.equal(scene.children.length,0);assert.equal(idle.resources.size,0);
    for(const p of Object.values(idle.poses))assert(p.bone.quaternion.equals(p.q));
  }finally{globalThis.document=previous;}
  model.gltf.scene.traverse(node=>{node.geometry?.dispose();for(const m of Array.isArray(node.material)?node.material:[node.material])m?.dispose();});
});
