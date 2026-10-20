// Reuse Si's existing dance and giant-leek grip; no second renderer or physics.
export class GameStage {
  constructor(models,config=null){this.models=models;this.config=config;this.active=false;}
  start(cameraPosition){
    const idle=this.models.current?.idle;
    if(!idle?.leek||idle.gestureTime!==null||idle.reverse.landing||idle.transition)return false;
    if(!idle.playGesture(cameraPosition,'leek'))return false;
    this.idle=idle;this.savedPlaying=idle.playing;this.active=true;
    this.tempoScale=this.config?idle.config.action.leekCycle/(120/this.config.bpm):1;
    idle.expression?.setExpression('neutral',0);idle.gameClock=0;idle.gameTakeover=false;
    return true;
  }
  prepare(elapsed,phase){
    if(!this.active)return;
    this.idle.gameClock=Math.max(0,elapsed)*this.tempoScale;this.idle.gameTakeover=phase==='reverse';
    this.idle.gameAccent=this.lastHit?(this.lastHit.side==='left'?-1:1)*Math.exp(-Math.max(0,elapsed-this.lastHit.time)*8):0;
  }
  hit(side,result,time){if(this.active)this.lastHit={side,result,time};}
  afterUpdate(delta,elapsed,phase){
    if(!this.active||phase!=='reverse')return;
    const r=this.idle.reverse,c=r.config;if(!r.active)r.start();
    // Repeat the safe, fully attached middle of the authored first swing.
    const span=this.config?120/this.config.bpm:c.cycle;
    const t=c.beats.swing+.5+(Math.max(0,elapsed)%span)/span*c.cycle;
    r.update(t,delta);
  }
  stop(){
    if(!this.active)return;
    const idle=this.idle;idle.gameClock=null;idle.gameTakeover=false;idle.gameAccent=0;this.lastHit=null;idle.stopGesture();
    this.active=false;
  }
}
