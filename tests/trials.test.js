import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { TrialEngine } from '../src/game/TrialEngine.js';
import { raceTrials } from '../src/config/raceTrials.js';
import { RaceEncore } from '../src/game/RaceEncore.js';
import { RideEngine } from '../src/game/RideEngine.js';
import { RideStage } from '../src/game/RideStage.js';

function engine(id){const t=raceTrials[id],e=new TrialEngine(t.config,()=>.3);e.setCharacter(t.character);e.start();return e;}
function run(id,skilled=true,fps=120){
  const e=engine(id);let steering=0,next=0;
  for(let frame=0;frame<fps*90&&e.state==='playing';frame++){
    if(skilled&&id==='wuling'&&e.powerReady)e.useGas();
    if(skilled&&id==='dijiang'&&e.nextFeature&&e.nextFeature.s-e.progress<12&&e.powerReady)e.useGas();
    if(skilled&&e.elapsed>=next){const target=id==='valley'?(e.nextFeature?.offset||0):0,c=(target-e.offset)*.3-e.velocity*.27+e.curvature(e.progress)*e.speed*.75;steering=Math.abs(c)>.1?Math.sign(c):0;next=e.elapsed+.08;}
    e.update(1/fps,{steer:skilled?steering:0});e.takeEvents();
  }
  return e;
}

test('three trial courses have distinct rules, palette, stories and fixed casts without the original race script',()=>{
  assert.equal(Object.keys(raceTrials).length,3);assert.equal(new Set(Object.values(raceTrials).map(t=>t.type)).size,3);
  assert.equal(new Set(Object.values(raceTrials).map(t=>t.sky)).size,3);
  for(const id of Object.keys(raceTrials)){
    const e=engine(id);assert.equal(e.config,raceTrials[id].config);assert.equal(e.storyRace,false);assert.equal(e.timeScale,1);assert.equal(e.flying,false);
    e.setOpponent(true);assert.equal(e.rival.enabled,false);assert(!e.requestTakeoff());
  }
});

for(const id of Object.keys(raceTrials))test(`${id}: real steering and timed powers can pass; idling fails; replay and pause are clean`,()=>{
  const win=run(id);assert.equal(win.state,'won');assert(win.trialSucceeded);assert.equal(win.outcome,'player');assert(win.elapsed<raceTrials[id].limit);
  const lost=run(id,false);assert.equal(lost.state,'won');assert(!lost.trialSucceeded);assert.equal(lost.outcome,'late');
  win.start();assert.equal(win.powerUses,0);assert.equal(win.misses,0);assert.equal(win.built.size,0);assert.equal(win.cargo.size,0);assert.equal(win.resolved.size,0);
  win.pause();const frozen=JSON.stringify(win);win.update(30,{steer:1});assert.equal(JSON.stringify(win),frozen);assert(!win.useGas());
});

test('manual bridges reject early taps, use exactly one charge, and an uncovered gap penalizes only once',()=>{
  const e=engine('wuling');assert(!e.useGas());assert.equal(e.bridgeCharges,3);
  e.progress=180;assert(e.useGas());assert.equal(e.bridgeCharges,2);assert(!e.useGas());assert.equal(e.built.size,1);
  const missed=engine('wuling');missed.progress=219.9;missed.update(.1);assert.equal(missed.misses,1);assert(missed.height<0);
  for(let n=0;n<120;n++)missed.update(1/120);assert.equal(missed.misses,1);assert.equal(missed.fallTime,0);
});

test('conveyor reversal changes physical drift, has a cooldown, and only the follower signs for cargo',()=>{
  const forward=engine('valley'),reverse=engine('valley');
  forward.progress=reverse.progress=270;assert(reverse.useGas());assert(!reverse.useGas());assert.equal(reverse.beltSign,-1);
  for(let n=0;n<60;n++){forward.update(1/120);reverse.update(1/120);}
  assert(forward.offset>reverse.offset+1);
  const e=engine('valley');e.progress=180;e.offset=0;e.pet.x=50;e.pet.z=-180;e.update(1/120);assert.equal(e.cargo.size,0,'the rider alone is not the collector');
  e.pet.x=e.config.center(180);e.pet.z=-180;e.pet.vx=e.pet.vz=0;e.update(1/120);assert(e.cargo.has(0));const collected=e.cargo.size;
  e.update(.1);assert.equal(e.cargo.size,collected);
});

test('phase gates accept the visible green lane or a timed power, and charge mistakes once per gate',()=>{
  const safe=engine('dijiang');safe.progress=179.9;safe.offset=-4;safe.update(1/120);assert.equal(safe.cleared,1);assert.equal(safe.powerUses,0);
  const phase=engine('dijiang');phase.progress=179.9;phase.offset=4;assert(phase.useGas());phase.update(1/120);assert.equal(phase.cleared,1);assert.equal(phase.misses,0);assert(!phase.useGas());
  const wrong=engine('dijiang');wrong.progress=179.9;wrong.offset=4;wrong.update(.1);assert.equal(wrong.misses,1);wrong.update(.1);assert.equal(wrong.misses,1);
});

test('trial fixed-step physics is stable at 30, 60 and 120 Hz, including deadlines and bad delta input',()=>{
  for(const id of Object.keys(raceTrials)){
    const outcomes=[30,60,120].map(fps=>run(id,false,fps));
    for(const e of outcomes){assert.equal(e.misses,outcomes[0].misses);assert.equal(e.cleared,outcomes[0].cleared);assert(Math.abs(e.elapsed-outcomes[0].elapsed)<.02);}
    const e=engine(id),snapshot=JSON.stringify(e);for(const delta of [NaN,Infinity,-1,0])e.update(delta);assert.equal(JSON.stringify(e),snapshot);
  }
});

test('the winner speaks first, focus waits for the complete opening and then pulls back; late arrivals do not celebrate',()=>{
  const e=new RideEngine();e.setCharacter('zhuang');e.setOpponent(true);e.outcome='rival';
  const encore=new RaceEncore(()=>.4);encore.start(e,'zhuang');assert.equal(encore.winner,'si');assert.match(encore.update(0,e,'zhuang'),/^祀：/);encore.restAfter(11.1);
  encore.reply('dragon','龍泡泡：稍後再說。');
  for(let n=0;n<90;n++)encore.update(.12,e,'zhuang');assert.equal(encore.focus,1);assert.equal(encore.current.id,'winner-opening');
  for(let n=0;n<15;n++)encore.update(.12,e,'zhuang');assert.equal(encore.focus,0);
  e.outcome='late';encore.start(e,'zhuang');assert.equal(encore.winner,null);assert.equal(encore.focus,0);
  for(const id of Object.keys(raceTrials)){const won=run(id);encore.start(won,won.character);assert.equal(encore.update(0,won,won.character),raceTrials[id].endingWin);}
});

test('ending camera fits the four actors below the score, above subtitles, with a distinct winner close-up',()=>{
  for(const [width,height,top,bottom,right]of [[390,844,275,640,374],[390,700,265,500,374],[844,390,118,260,410]]){
    const camera=new PerspectiveCamera(44,width/height,.1,150),head=new Group();head.position.set(1.6,3.2,-950);
    const scene={camera,renderer:{domElement:{getBoundingClientRect:()=>({width,height})}}};
    const stage={scene,character:'zhuang',center:()=>0,look:new Vector3(),target:new Vector3(),screenPoint:new Vector3(),opponent:{ready:true,rig:{nodes:{head}}},encoreLayoutReader:()=>({left:16,right,top,bottom}),encoreShot:{winner:'si',focus:0}};
    const e=engine('dijiang');e.rival.enabled=true;
    RideStage.prototype.frameEncoreCamera.call(stage,e);camera.updateMatrixWorld();const wide=camera.position.clone();
    const projected=head.position.clone().project(camera),screenY=(1-projected.y)*height/2;assert(screenY>top&&screenY<bottom);
    stage.encoreShot.focus=1;RideStage.prototype.frameEncoreCamera.call(stage,e);camera.updateMatrixWorld();
    const close=head.position.clone().project(camera),closeY=(1-close.y)*height/2;assert(closeY>top&&closeY<bottom);assert(camera.position.distanceTo(head.position)<wide.distanceTo(head.position));
  }
});
