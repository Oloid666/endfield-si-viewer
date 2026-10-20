// Pure clock-based judgement. Rendering rate never decides whether an input hits.
export class RhythmEngine {
  constructor(config){this.config=config;this.reset();}
  reset(){this.state='idle';this.notes=[];this.elapsed=0;this.score=0;this.combo=0;this.maxCombo=0;this.perfect=0;this.good=0;this.miss=0;this.strays=0;}
  start(now){
    this.reset();const c=this.config;this.period=60/c.bpm;this.origin=now+c.countInBeats*this.period;
    this.notes=Array.from({length:c.noteCount},(_,i)=>({time:i*this.period,side:c.pattern[i%c.pattern.length],judgement:null}));
    this.state='playing';this.elapsed=now-this.origin;
  }
  update(now){
    if(this.state!=='playing')return;
    this.elapsed=now-this.origin;
    for(const note of this.notes)if(!note.judgement&&this.elapsed-note.time>this.config.goodWindow){note.judgement='miss';this.miss++;this.combo=0;}
    if(this.elapsed>=this.notes.at(-1).time+this.config.goodWindow+.5)this.state='results';
  }
  hit(side,now){
    if(this.state!=='playing'||!['left','right'].includes(side))return null;
    this.update(now);if(this.state!=='playing'||this.elapsed<-.2)return null;
    const nearby=this.notes.filter(note=>!note.judgement&&Math.abs(note.time-this.elapsed)<=this.config.goodWindow);
    const note=nearby.sort((a,b)=>Math.abs(a.time-this.elapsed)-Math.abs(b.time-this.elapsed))[0];
    if(!note){this.combo=0;this.strays++;return 'empty';}
    if(note.side!==side){note.judgement='miss';this.miss++;this.combo=0;return 'miss';}
    const perfect=Math.abs(note.time-this.elapsed)<=this.config.perfectWindow;
    note.judgement=perfect?'perfect':'good';this[note.judgement]++;this.score+=perfect?this.config.perfectScore:this.config.goodScore;
    this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);return note.judgement;
  }
  pause(now){if(this.state!=='playing')return;this.update(now);if(this.state==='playing'){this.pausedAt=now;this.state='paused';}}
  resume(now){if(this.state!=='paused')return;this.origin+=now-this.pausedAt;this.state='playing';}
  get phase(){return this.elapsed>=this.config.reverseAt*(this.period||60/this.config.bpm)?'reverse':'leek';}
  get stats(){
    const accuracy=this.score/(this.config.noteCount*this.config.perfectScore);
    return {score:this.score,maxCombo:this.maxCombo,perfect:this.perfect,good:this.good,miss:this.miss,strays:this.strays,accuracy,
      grade:accuracy>=.9?'S':accuracy>=.75?'A':accuracy>=.5?'B':'蔥控管理員'};
  }
}
