import test from 'node:test';
import assert from 'node:assert/strict';
import {RhythmEngine} from '../src/game/RhythmEngine.js';
import {gameConfig as config} from '../src/config/gameConfig.js';

test('chart gives a four-beat count-in and scores timing against an absolute clock',()=>{
 const game=new RhythmEngine(config);game.start(10);assert.equal(game.notes.length,48);assert(game.elapsed<0);
 assert.equal(game.hit('left',10),null);assert.equal(game.score,0);
 assert.equal(game.hit('left',game.origin),'perfect');assert.equal(game.score,1000);
 assert.equal(game.hit('right',game.origin+game.period+.14),'good');assert.equal(game.score,1600);assert.equal(game.combo,2);
});
test('wrong side, expired notes and button spam cannot create extra points',()=>{
 const game=new RhythmEngine(config);game.start(0);
 assert.equal(game.hit('right',game.origin),'miss');assert.equal(game.score,0);assert.equal(game.miss,1);
 assert.equal(game.hit('left',game.origin),'empty');assert.equal(game.score,0);assert.equal(game.miss,1);
 game.update(game.origin+game.period+config.goodWindow+.01);assert.equal(game.miss,2);
 assert.equal(game.hit('right',game.origin+game.period+.21),'empty');assert.equal(game.score,0);
});
test('pause ignores input, freezes time and resumes without consuming the chart',()=>{
 const game=new RhythmEngine(config);game.start(0);game.hit('left',game.origin);game.pause(game.origin+.2);
 const time=game.elapsed;game.update(100);assert.equal(game.elapsed,time);assert.equal(game.hit('right',100),null);
 game.resume(100);assert.equal(game.hit('right',game.origin+game.period),'perfect');assert.equal(game.combo,2);assert.equal(game.miss,0);
});
test('all notes can be hit, reverse section changes no input rules, and results are bounded',()=>{
 const game=new RhythmEngine(config);game.start(1);
 for(const note of game.notes)assert.equal(game.hit(note.side,game.origin+note.time),'perfect');
 assert.equal(game.phase,'reverse');game.update(game.origin+game.notes.at(-1).time+1);
 assert.equal(game.state,'results');assert.deepEqual(game.stats,{score:48000,maxCombo:48,perfect:48,good:0,miss:0,strays:0,accuracy:1,grade:'S'});
 assert.equal(game.hit('left',100),null);game.start(101);assert.equal(game.score,0);assert(game.notes.every(note=>!note.judgement));
});
test('missing an entire round finishes cleanly and scores zero at different frame rates',()=>{
 for(const fps of [15,30,60]){
  const game=new RhythmEngine(config);game.start(0);
  for(let now=0;now<31;now+=1/fps)game.update(now);
  assert.equal(game.state,'results');assert.equal(game.miss,48);assert.equal(game.score,0);assert.equal(game.stats.grade,'蔥控管理員');
 }
});
