import test from 'node:test';
import assert from 'node:assert/strict';
import { EscapeEngine } from '../src/game/EscapeEngine.js';
import { escapeLevels } from '../src/config/escapeConfig.js';
import { GuaguaActor } from '../src/game/GuaguaActor.js';
import { Vector3 } from 'three';
import { escapeRoutes as routes } from './escapeRoutes.js';
import { unlockAudio } from '../src/game/unlockAudio.js';

function action(e,a){e.update(.3);if(a==='r')return e.move(1);if(a==='l')return e.move(-1);if(a==='c')e.toggleCarry();if(a==='u')return e.climb();if(a==='d')return e.climb(-1);if(a==='p')return e.place();if(a==='t')e.player.facing*=-1;if(a==='k')return e.reclaim();}
function resume(e){e.chooseAnswer('honest');e.finishCall();}
function fresh(id){const e=new EscapeEngine(escapeLevels.find(c=>c.id===id));e.start();return e;}

for(const c of escapeLevels)test(`${c.id}: authored route wins; any check-in pauses play`,()=>{
  const e=fresh(c.id);let calls=0;
  for(const a of routes[c.id]){let result=action(e,a);for(let i=0;result?.kind==='blocked'&&a==='u'&&i<20;i++)result=action(e,a);if(e.state==='call'){calls++;const time=e.elapsed;e.update(100);assert.equal(e.elapsed,time);resume(e);}}
  assert.equal(e.state,'won');assert.equal(calls,Number(Number.isFinite(c.callAt)));assert.equal(e.player.x,c.exit.x);assert.equal(e.player.y,c.exit.y);
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

test('pressure gate opens only for a crate on its plate and undo restores the closed gate',()=>{
 const e=fresh('plate');assert(e.blockAt(6,1));action(e,'r');action(e,'c');action(e,'r');assert(e.gateOpen);assert.equal(e.blockAt(6,1),undefined);
 e.update(.3);assert(e.undo());assert(!e.gateOpen);assert.equal(e.blockAt(6,1)?.kind,'gate');
 e.player={x:3,y:1,facing:1};e.syncGates();assert(!e.gateOpen,'a lightweight penguin is not a crate');
 e.blocks.find(b=>b.kind==='crate').x=5;e.player={x:4,y:1,facing:1};e.carry=false;e.syncGates();
 assert.equal(action(e,'r').kind,'climb');assert.equal(action(e,'r').kind,'blocked','one crate cannot bypass the closed gate');
});
test('limited recycling quota is consumed, enforced, restored by undo and reset on replay',()=>{
 const e=fresh('ration');action(e,'r');action(e,'p');e.update(.3);assert.equal(e.reclaim().kind,'reclaim');assert.equal(e.remainingReclaims,1);
 action(e,'p');e.update(.3);assert.equal(e.reclaim().kind,'reclaim');assert.equal(e.remainingReclaims,0);
 action(e,'p');e.update(.3);assert.equal(e.reclaim().kind,'blocked');e.update(.3);assert(e.undo());assert.equal(e.remainingReclaims,0);
 e.update(.3);assert(e.undo());assert.equal(e.remainingReclaims,1);e.start();assert.equal(e.inventory,3);assert.equal(e.remainingReclaims,2);
});
test('staggered jets have distinct phases and hard mode blocks climbing into an active jet',()=>{
 const e=fresh('jets');action(e,'r');e.clock=1;e.lastMoveAt=-Infinity;
 assert.notEqual(e.hazardPhase(e.config.hazards[0]),e.hazardPhase(e.config.hazards[1]));
 assert.equal(e.climb().kind,'blocked');assert.equal(e.player.y,1);
 e.clock=3;e.lastMoveAt=-Infinity;assert.equal(e.climb().kind,'rope');
});
test('a wrong push creates a genuine structural dead end, with undo and restart recovery',()=>{
 const e=fresh('pit');action(e,'c');action(e,'l');action(e,'l');assert(e.deadlockHint.includes('低槽'));
 const sunk=e.snapshot();
 // Explore every reachable position/carry/crate state, excluding undo/restart.
 // This proves the authored mistake cannot still reach the exit by normal moves.
 const queue=[sunk],visited=new Set();let solved=false;
 for(let i=0;i<queue.length;i++){
   const s=queue[i],key=JSON.stringify([s.player.x,s.player.y,s.carry,s.blocks.filter(b=>b.kind==='crate').map(b=>[b.x,b.y])]);
   if(visited.has(key))continue;visited.add(key);
   for(const a of ['r','l','c']){
     const branch=fresh('pit');branch.restore(s);branch.called=true;branch.clock=100;branch.lastMoveAt=-Infinity;
     action(branch,a);if(branch.state==='won')solved=true;else queue.push(branch.snapshot());
   }
   assert(visited.size<1000,'finite small puzzle search');
 }
 assert(visited.size>1);assert.equal(solved,false);
 e.update(.3);assert(e.undo());assert.equal(e.deadlockHint,'');e.start();assert.equal(e.blocks.find(b=>b.id==='critical').x,3);assert.equal(e.blocks.find(b=>b.id==='critical').y,2);
});
test('audio unlock is bounded when Safari resume never settles, rejects or is absent',async()=>{
 assert.equal(await unlockAudio({state:'suspended',resume:()=>new Promise(()=>{})},15),false);
 assert.equal(await unlockAudio({state:'suspended',resume:()=>Promise.reject(new Error('blocked'))},15),false);
 assert.equal(await unlockAudio(null,15),false);
 const audio={state:'suspended',resume(){this.state='running';return Promise.resolve();}};assert.equal(await unlockAudio(audio,15),true);
});

test('warehouse exit requires the designated cargo, not just the penguin or another box',()=>{
 const e=fresh('warehouse');e.player={x:9,y:4,facing:1};action(e,'r');assert.equal(e.state,'playing');assert.equal(e.goals[0].done,false);
 const cargo=e.blocks.find(b=>b.id==='cargo');cargo.x=9;cargo.y=4;action(e,'l');action(e,'r');assert.equal(e.state,'won');
});
test('vault pickup seals the upper route; undo restores the item and open route, replay clears all goals',()=>{
 const e=fresh('vault');assert(!e.blockAt(6,5));e.player={x:7,y:5,facing:1};action(e,'r');
 assert.deepEqual(e.collected,['file']);assert.equal(e.blockAt(6,5)?.kind,'gate');assert(e.deadlockHint.includes('回程'));
 e.update(.3);assert(e.undo());assert.deepEqual(e.collected,[]);assert(!e.blockAt(6,5));
 e.player={x:10,y:2,facing:1};action(e,'d');assert(e.collected.includes('receipt'),'descending also collects the item');
 e.start();assert.deepEqual(e.collected,[]);assert(!e.blockAt(6,5));assert(e.goals.every(g=>!g.done));
});
test('both ropes support sideways entry without a free climb and allow independent descent',()=>{
 const e=fresh('vault');action(e,'r');assert.equal(e.player.y,1);assert(e.onRope);
 e.player={x:9,y:5,facing:1};action(e,'r');assert.equal(e.player.y,5);assert(e.onRope);action(e,'d');assert.equal(e.player.y,4);
 e.update(.4);assert.equal(e.player.y,4);assert.equal(e.player.x,10);
});
test('unloading opens the gate only with the electric box; a premature bridge prevents the delivery',()=>{
 const e=fresh('unload');for(const a of routes.unload.slice(0,6))action(e,a);
 assert.equal(e.blocks.find(b=>b.id==='weight').y,1);assert(e.gateOpen);assert.equal(e.blocks.find(b=>b.id==='stair').y,4);
 e.start();for(const a of 'r r r r r p'.split(' '))action(e,a);
 assert(e.deadlockHint.includes('橋蓋早'));assert.equal(e.remainingReclaims,0);assert.equal(e.inventory,0);
 e.update(.3);assert(e.undo());assert.equal(e.deadlockHint,'');assert.equal(e.inventory,1);
 e.blocks.find(b=>b.id==='stair').x=7;e.blocks.find(b=>b.id==='stair').y=1;e.syncGates();assert(!e.gateOpen,'the wrong box cannot power this gate');
});

// Exhaustively check authored traps, including climbing, turning, placing,
// pulling and collecting. Hints alone are not proof of a real puzzle dead end.
function canEscapeWithoutUndo(engine){
 const queue=[engine.snapshot()],seen=new Set();
 for(let i=0;i<queue.length;i++){
  const s=queue[i],key=JSON.stringify([s.player,s.carry,s.inventory,s.reclaimsUsed,s.collected,
    s.blocks.filter(b=>['crate','built'].includes(b.kind)).map(b=>[b.id,b.x,b.y])]);
  if(seen.has(key))continue;seen.add(key);assert(seen.size<20000,'bounded authored puzzle');
  for(const a of ['r','l','c','u','d',...(engine.config.stock?['p','k','t']:[])]){
   const e=new EscapeEngine(engine.config);e.start();e.restore(s);e.called=true;action(e,a);
   if(e.state==='won')return true;queue.push(e.snapshot());
  }
 }
 return false;
}
test('taking the file without paving a return path is an actual dead end',()=>{
 const e=fresh('vault');for(const a of 'r u u u u r r r r r r r'.split(' '))action(e,a);
 assert(e.collected.includes('file'));assert(e.deadlockHint);assert.equal(canEscapeWithoutUndo(e),false);
 e.start();for(const a of routes.vault)action(e,a);assert.equal(e.state,'won');
});
test('building before unloading is an actual dead end, not just a warning',()=>{
 const e=fresh('unload');for(const a of 'r r r r r p'.split(' '))action(e,a);
 assert(e.deadlockHint);assert.equal(canEscapeWithoutUndo(e),false);
 e.start();for(const a of routes.unload)action(e,a);assert.equal(e.state,'won');
});
