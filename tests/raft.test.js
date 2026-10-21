import test from 'node:test';
import assert from 'node:assert/strict';
import { RaftEngine } from '../src/game/RaftEngine.js';
import { raftConfig } from '../src/config/raftConfig.js';

const advance = (engine, seconds, input = {}, fps = 60) => {
  for (let i = 0; i < seconds * fps; i++) engine.update(1 / fps, input);
};

test('a novice can finish the whole course despite collisions, then restart cleanly', () => {
  const e = new RaftEngine();
  advance(e, 1); assert.equal(e.progress, 0);
  e.start(); advance(e, 60);
  assert.equal(e.state, 'won'); assert.equal(e.progress, raftConfig.length);
  assert(e.bumps > 0); assert(e.ink.size > 0);
  const time = e.elapsed; advance(e, 2); assert.equal(e.elapsed, time);
  e.start(); assert.equal(e.state, 'playing'); assert.equal(e.bumps, 0);
  assert.equal(e.ink.size, 0); assert.equal(e.progress, 0);
});

test('fixed-step steering gives the same result at 30, 60 and 120 frames per second', () => {
  const run = fps => {
    const e = new RaftEngine(); e.start();
    advance(e, 2, { steer: 1 }, fps);
    advance(e, 2, { steer: -1, brake: true }, fps);
    advance(e, 3, {}, fps);
    return [e.x, e.progress, e.bumps, e.pet.x, e.pet.z];
  };
  const reference = run(120);
  for (const fps of [30, 60]) run(fps).forEach((v, i) => assert(Math.abs(v - reference[i]) < 1e-8));
});

test('braking slows travel and pulls the companion closer; releasing accelerates again', () => {
  const slow = new RaftEngine(), fast = new RaftEngine(); slow.start(); fast.start();
  advance(slow, 6, { brake: true }); advance(fast, 6);
  assert(slow.progress < fast.progress * .6);
  assert(Math.hypot(slow.pet.x - slow.x, slow.pet.z - slow.z) < Math.hypot(fast.pet.x - fast.x, fast.pet.z - fast.z));
  const speed = slow.speed; advance(slow, 1); assert(slow.speed > speed + 2);
});

test('pause freezes steering, tether, collection and timer, and resume continues', () => {
  const e = new RaftEngine(); e.start(); advance(e, 2, { steer: -1 }); e.pause();
  const snapshot = JSON.stringify(e); advance(e, 2, { steer: 1, brake: true });
  assert.equal(JSON.stringify(e), snapshot);
  e.resume(); advance(e, 1); assert(e.elapsed > 2.9);
});

test('banks bounce safely, collisions are debounced, and rope stays finite and bounded', () => {
  const e = new RaftEngine(); e.start();
  advance(e, 3, { steer: 1 }); assert(e.bumps > 0);
  assert(Math.abs(e.offset) <= raftConfig.edge);
  assert(e.bumps < 4);
  let maxLag = 0;
  for (let i = 0; i < 2400 && e.state === 'playing'; i++) {
    e.update(1 / 60, { steer: Math.sin(i / 50), brake: i % 150 < 30 });
    const length = Math.hypot(e.pet.x - e.x, e.pet.z - e.z);
    assert(Number.isFinite(length)); assert(length <= raftConfig.maxRopeLength + 1e-8);
    maxLag = Math.max(maxLag, Math.abs(e.pet.x - e.x));
  }
  assert(maxLag > 1, 'visible lateral lag, not a rigid follower');
});

test('collectibles only count once; malformed deltas and stalled frames cannot jump the course', () => {
  const e = new RaftEngine(); e.start();
  const stamp = e.config.stamps[0]; e.progress = stamp.s; e.offset = stamp.offset;
  advance(e, .1); assert(e.ink.has(0)); assert.equal(e.ink.size, 1);
  for (const dt of [NaN, Infinity, -1, 0]) e.update(dt, { steer: 1 });
  const before = e.progress; e.update(100);
  assert(e.progress - before < 1); assert.equal(e.ink.size, 1);
});
