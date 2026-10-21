import test from 'node:test';
import assert from 'node:assert/strict';
import { EscapeEngine } from '../src/game/EscapeEngine.js';
import { escapeLevels } from '../src/config/escapeConfig.js';
import { GuaguaActor } from '../src/game/GuaguaActor.js';
import { Vector3 } from 'three';

const routes={push:['r','c','r','c','r','r','r','c','r','c','r','r','r','r'],cover:['r','c','r','r','c','r','r','r','r','r'],rope:['r','u','u','u','r','r','r','r','r','r','r','r'],build:['r','p','r','p','r','r','r','p','r','p','r','p','r','r','r']};
function action(e,a){e.update(.3);if(a==='r')return e.move(1);if(a==='l')return e.move(-1);if(a==='c')e.toggleCarry();if(a==='u')return e.climb();if(a==='p')return e.place();}
function resume(e){e.chooseAnswer('honest');e.finishCall();}
function fresh(id){const e=new EscapeEngine(escapeLevels.find(c=>c.id===id));e.start();return e;}

for(const c of escapeLevels)test(`${c.id}: authored route wins with its intended mechanic and a paused check-in`,()=>{
  const e=fresh(c.id);let calls=0;
  for(const a of routes[c.id]){action(e,a);if(e.state==='call'){calls++;const time=e.elapsed;e.update(100);assert.equal(e.elapsed,time);resume(e);}}
  assert.equal(e.state,'won');assert.equal(calls,1);assert.equal(e.player.x,c.exit.x);assert.equal(e.player.y,c.exit.y);
  if(c.id==='build'){assert.equal(e.buildCount,5);assert.equal(e.inventory,2);}
  const snapshot=e.snapshot();e.update(100);assert.deepEqual(e.snapshot(),snapshot);assert.equal(e.move(-1),null);
});
test('corrosion route blocks walking and moving the cover away but allows standing on it',()=>{
  const e=fresh('cover');e.player={x:3,y:1,facing:1};assert.equal(action(e,'r').kind,'blocked');
  e.blocks.find(b=>b.kind==='crate').x=4;e.carry=true;assert.equal(action(e,'r').kind,'blocked');assert.equal(e.blockAt(4,1).kind,'crate');
  e.carry=false;assert.equal(action(e,'r').kind,'climb');assert.equal(e.player.y,2);
});
test('rope supports a suspended penguin, down movement, boundaries and jet exposure',()=>{
  const e=fresh('rope');assert.equal(e.climb().kind,'blocked');action(e,'r');action(e,'u');const y=e.player.y;
  e.update(.1);assert.equal(e.player.y,y);e.update(.3);assert.equal(e.climb(-1).kind,'rope');assert.equal(e.player.y,1);
  e.update(.3);assert.equal(e.climb(-1).kind,'blocked');e.player.y=2;e.clock=1.1;e.corruption=99;e.update(.1);assert.equal(e.state,'lost');assert(e.reason.includes('噴流'));
});
test('pause, phone and hidden-time equivalent do not consume rope hazard or deadline',()=>{
  const e=fresh('rope');e.update(100);assert.equal(e.elapsed,0);action(e,'r');e.pause();const snapshot=e.snapshot(),clock=e.clock;
  e.update(100);assert.equal(e.clock,clock);assert.deepEqual(e.snapshot(),snapshot);assert.equal(e.climb(),null);e.resume();assert.equal(e.state,'playing');
});
test('retracting platform returns, but never spawns inside the player',()=>{
  const e=fresh('rope');for(const a of routes.rope.slice(0,8))action(e,a);assert.equal(e.state,'call');resume(e);
  e.update(2.7);assert.equal(e.blockAt(5,5),undefined);assert.equal(e.player.y,5);e.update(3.2);assert.equal(e.blockAt(5,5),undefined);
  action(e,'r');e.update(.1);assert.equal(e.blockAt(5,5)?.kind,'fragile');assert.equal(e.player.y,6);
});
test('building places bridges and stairs, reclaims only owned blocks, and undo restores inventory',()=>{
  const e=fresh('build');action(e,'r');assert.equal(action(e,'p').kind,'build');assert.equal(e.inventory,6);
  e.update(.3);assert.equal(e.reclaim().kind,'reclaim');assert.equal(e.inventory,7);e.update(.3);assert(e.undo());assert.equal(e.inventory,6);assert.equal(e.blockAt(2,0)?.kind,'built');
  e.buildRise=1;assert.equal(action(e,'p').kind,'build');assert.equal(e.blockAt(2,1)?.kind,'built');
  e.buildRise=0;e.update(.3);assert.equal(e.reclaim().kind,'blocked','cannot remove a support from below another block');
  action(e,'l');e.update(.3);assert.equal(e.reclaim().kind,'blocked','fixed level blocks cannot be mined');
});
test('building cannot duplicate materials, overlap blocks, place out of bounds or walk over a void',()=>{
  const e=fresh('build');action(e,'r');assert.equal(action(e,'r').kind,'blocked');assert.equal(e.player.facing,1);
  action(e,'p');const stock=e.inventory;assert.equal(action(e,'p').kind,'blocked');assert.equal(e.inventory,stock);
  e.inventory=0;e.player.x=2;assert.equal(action(e,'p').kind,'blocked');e.inventory=7;e.player.x=0;e.player.facing=-1;assert(!e.canPlace());
});
test('timeout loses cleanly and replay resets material, corruption, calls and construction',()=>{
  const e=fresh('build');action(e,'r');action(e,'p');e.update(90);assert.equal(e.state,'lost');assert(e.reason.includes('莊方宜'));
  e.start();assert.equal(e.inventory,7);assert.equal(e.buildCount,0);assert.equal(e.corruption,0);assert.equal(e.called,false);assert.equal(e.history.length,0);
});
test('penguin actor reacts without a GLB and disposes its owned geometry/materials once',()=>{
  const actor=new GuaguaActor();actor.update(new Vector3(1,2,0),1,2,.8,'rope','playing');assert.equal(actor.root.position.y,2);assert(Math.abs(actor.wings[0].rotation.x)>1);
  let disposed=0;for(const resource of [actor.sphere,actor.beakGeometry,...actor.materials])resource.addEventListener('dispose',()=>disposed++);
  actor.dispose();assert.equal(disposed,6);assert.equal(actor.root.parent,null);
});
