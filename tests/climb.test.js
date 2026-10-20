import test from 'node:test';
import assert from 'node:assert/strict';
import { ClimbEngine } from '../src/game/ClimbEngine.js';

const move=(e,d=1)=>{e.update(.4);return e.move(d);};
function reachCall(e){move(e);e.toggleCarry();move(e);e.toggleCarry();move(e);move(e);}
function resume(e){e.chooseAnswer('honest');e.finishCall();}

test('authored route is solvable with two crate moves and a once-only call',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);assert.equal(e.state,'call');assert.equal(e.elapsed,0);
  resume(e);move(e);e.toggleCarry();assert.equal(move(e).kind,'push');e.toggleCarry();
  for(let i=0;i<6;i++)move(e);
  assert.equal(e.state,'won');assert.equal(e.pushes,2);assert.deepEqual([e.player.x,e.player.y],[12,8]);
  const snapshot=e.snapshot();assert.equal(e.move(-1),null);e.update(100);assert.deepEqual(e.snapshot(),snapshot);
});
test('a two-block wall cannot be climbed without repositioning the first crate',()=>{
  const e=new ClimbEngine();e.start();move(e);move(e);move(e);
  assert.equal(move(e).kind,'blocked');assert.equal(e.player.x,3);
  assert.equal(e.clearAt(4,1),false);assert.equal(e.standingAt(4,2),null);
});
test('pulling preserves support and undo restores geometry without rewinding time',()=>{
  const e=new ClimbEngine();e.start();move(e);
  e.toggleCarry();const before=e.snapshot();assert.equal(move(e,-1).kind,'pull');
  assert.equal(e.blocks.find(b=>b.id==='step-a').x,1);
  e.update(.4);const clock=e.clock;assert(e.undo());assert.deepEqual(e.snapshot(),before);assert.equal(e.clock,clock);
  assert.equal(e.undos,1);
});
test('blocked push changes neither history nor crate geometry, and rapid input is rejected',()=>{
  const e=new ClimbEngine();e.start();move(e);e.toggleCarry();move(e);
  assert.equal(e.move(1),null);e.update(.4);const before=e.snapshot(),length=e.history.length;
  assert.equal(e.move(1).kind,'blocked');assert.deepEqual(e.snapshot(),before);assert.equal(e.history.length,length);
});
test('tutorial waits indefinitely, phone and manual pause freeze waste, patrol and cracks',()=>{
  const e=new ClimbEngine();e.start();e.update(1000);assert.equal(e.elapsed,0);assert.equal(e.state,'playing');
  reachCall(e);const clock=e.clock,waste=e.waste,patrol=e.patrol;
  e.update(100);assert.equal(e.clock,clock);assert.equal(e.waste,waste);assert.deepEqual(e.patrol,patrol);assert.equal(e.move(1),null);
  assert(!e.chooseAnswer('invalid'));e.finishCall();assert.equal(e.state,'call');resume(e);e.update(1);e.pause();
  const elapsed=e.elapsed;e.update(100);assert.equal(e.elapsed,elapsed);e.resume();e.update(1);assert.equal(e.elapsed,elapsed+1);
});
test('an opaque crate blocks patrol vision; leaving cover builds exposure and returning decays it',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);resume(e);move(e);e.elapsed=2;
  assert.equal(e.patrol.phase,'scan');assert.equal(e.visibleToPatrol,false);
  e.blocks=e.blocks.filter(b=>b.id!=='step-b');assert.equal(e.visibleToPatrol,true);e.update(.5);assert(e.exposure>0);
  e.blocks.push({id:'cover',x:6,y:3,kind:'crate',crack:null});const exposure=e.exposure;e.update(.1);assert(e.exposure<exposure);
});
test('discovery and waste independently end the round; restart clears all state',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);resume(e);e.player.x=6;e.blocks=e.blocks.filter(b=>b.id!=='step-b');e.elapsed=1.7;e.exposure=99;e.update(.1);
  assert.equal(e.state,'lost');assert(e.reason.includes('泡泡龍'));
  e.start();reachCall(e);resume(e);e.update(81);assert.equal(e.state,'lost');assert(e.reason.includes('廢液'));
  e.start();assert.equal(e.state,'playing');assert.equal(e.called,false);assert.equal(e.exposure,0);assert.equal(e.history.length,0);assert.equal(e.carry,false);
});
test('fragile step collapses after its warning and undo can recover the route',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);resume(e);move(e);e.toggleCarry();move(e);e.toggleCarry();move(e);move(e);move(e);
  assert.equal(e.player.x,9);assert.equal(e.player.y,6);e.update(2.9);
  assert.equal(e.blockAt(9,5),undefined);assert.equal(e.player.y,5);assert.equal(move(e).kind,'blocked');
  assert(e.undo());assert(e.blockAt(9,5));assert.equal(e.player.x,8);assert.equal(move(e).kind,'climb');
});
test('undo across the phone trigger never repeats the call or resets the deadline',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);resume(e);e.update(1);assert(e.undo());
  const elapsed=e.elapsed;move(e);assert.equal(e.state,'playing');assert(e.elapsed>elapsed);assert.equal(e.called,true);
});

test('the first input after a frozen phone conversation is accepted immediately',()=>{
  const e=new ClimbEngine();e.start();reachCall(e);e.update(100);resume(e);
  assert.equal(e.move(1).kind,'walk');assert.equal(e.player.x,5);
});
