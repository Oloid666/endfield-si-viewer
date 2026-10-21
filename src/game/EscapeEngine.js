import { ClimbEngine } from './ClimbEngine.js';

// Shared grid collision/undo; each small level adds just one independent rule.
export class EscapeEngine extends ClimbEngine {
  reset(){
    super.reset();this.inventory=this.config.stock;this.buildRise=0;this.builtSerial=0;
    this.buildCount=0;this.corruption=0;this.retracted=[];this.reclaimsUsed=0;this.collected=[];
    this.blocks.push(...(this.config.platforms||[]).map((b,i)=>({...b,id:`platform-${i}`,kind:'fixed',crack:null})));
    this.syncGates();
  }
  snapshot(){return {...super.snapshot(),inventory:this.inventory,buildRise:this.buildRise,reclaimsUsed:this.reclaimsUsed,collected:[...this.collected],retracted:this.retracted.map(b=>({...b}))};}
  restore(s){super.restore(s);this.inventory=s.inventory;this.buildRise=s.buildRise;this.reclaimsUsed=s.reclaimsUsed;this.collected=[...(s.collected||[])];this.retracted=s.retracted.map(b=>({...b}));this.syncGates();}
  get waste(){return -10;}
  get patrol(){return {...super.patrol,phase:'rest'};}
  hazardPhase(h={}){const t=(this.clock+(h.offset||0))%this.config.jet.period;return t<this.config.jet.warning?'warning':t<this.config.jet.warning+this.config.jet.active?'active':'rest';}
  get jetPhase(){return this.hazardPhase(this.config.hazards.find(h=>h.kind==='jet'&&h.y>=this.player.y)||{});}
  get inJet(){return this.config.hazards.some(h=>h.kind==='jet'&&this.hazardPhase(h)==='active'&&h.x===this.player.x&&Math.abs(h.y-this.player.y)<.6);}
  get circuits(){return this.config.circuits||(this.config.gates?[{plates:this.config.plates||[],gates:this.config.gates}]:[]);}
  circuitOpen(c){return (c.plates||[]).every(p=>this.blocks.some(b=>b.kind==='crate'&&b.x===p.x&&b.y===p.y&&(!p.crate||b.id===p.crate)))
    &&(c.tokens||[]).every(id=>this.collected.includes(id))&&(c.unlessTokens||[]).every(id=>!this.collected.includes(id));}
  get gateOpen(){return !!this.circuits.length&&this.circuits.every(c=>this.circuitOpen(c));}
  syncGates(){
    this.blocks=this.blocks.filter(b=>b.kind!=='gate');
    for(const [circuit,c] of this.circuits.entries())if(!this.circuitOpen(c))this.blocks.push(...c.gates.map((g,i)=>({...g,id:`gate-${circuit}-${i}`,kind:'gate',crack:null})));
  }
  get goals(){return [
    ...(this.config.pickups||[]).map(p=>({label:p.label,done:this.collected.includes(p.id)})),
    ...(this.config.deliveries||[]).map(p=>({label:p.label,done:this.blocks.some(b=>b.id===p.crate&&b.x===p.x&&b.y===p.y)}))
  ];}
  finishStep(result){
    if(!result||result.kind==='blocked')return result;
    for(const p of this.config.pickups||[])if(p.x===this.player.x&&p.y===this.player.y&&!this.collected.includes(p.id))this.collected.push(p.id);
    this.syncGates();
    const atExit=this.player.x===this.config.exit.x&&this.player.y===this.config.exit.y;
    if(atExit&&this.goals.every(g=>g.done))this.state='won';
    else if(this.state==='won')this.state='playing';
    return result;
  }
  get remainingReclaims(){return (this.config.reclaimLimit??Infinity)-this.reclaimsUsed;}
  get deadlockHint(){
    if(this.config.criticalCrates?.some(c=>this.blocks.find(b=>b.id===c.id)?.y<c.minY))return '關鍵箱子掉進低槽，搬不回原層。請退一步，或按「重來本關」。';
    if(this.config.id==='vault'&&this.collected.includes('file')&&!this.blocks.some(b=>b.id==='cover'&&b.x===5&&b.y===1))return '上層回路已封，地下侵蝕還沒鋪路。先撤回取件，或重來，安排好回程再出發。';
    if(this.config.id==='unload'&&this.blockAt(7,3)?.kind==='built'&&this.blocks.find(b=>b.id==='weight')?.y>1)return '橋蓋早了，電箱落不到地下機關。不能回收這座橋，請退一步或重來。';
    if(this.config.stock&&this.inventory===0&&this.remainingReclaims<=0&&!this.standingAt(this.player.x+1,this.player.y+1))return '材料與回收額度已用完，前面還有斷路。可退一步重新規劃，或重來本關。';
    return '';
  }
  get ropes(){return this.config.ropes||(this.config.rope?[this.config.rope]:[]);}
  ropeAt(x,y){return this.ropes.find(r=>x===r.x&&y>=r.bottom&&y<=r.top);}
  get onRope(){return !!this.ropeAt(this.player.x,this.player.y);}
  standingAt(x,maxFeet){
    const floor=super.standingAt(x,maxFeet),y=this.player?.y;
    // Enter a rope sideways at the current height, without automatically climbing.
    return y<=maxFeet&&this.ropeAt(x,y)&&this.clearAt(x,y)?Math.max(floor??-Infinity,y):floor;
  }
  get ready(){return this.state==='playing'&&this.clock-this.lastMoveAt>=this.config.moveSeconds;}
  move(direction){
    if(!this.ready||![-1,1].includes(direction))return null;
    this.player.facing=direction;
    const x=this.player.x+direction,front=this.blockAt(x,this.player.y);
    const feet=this.carry&&front?.kind==='crate'?this.player.y:this.standingAt(x,this.player.y+1);
    if(this.config.hazards.some(h=>h.kind==='floor'&&h.x===x&&h.y===feet))
      return {kind:'blocked',message:'侵蝕擋住了！把亮框息壤推到上面，再關搬箱踩過去。'};
    return this.finishStep(super.move(direction));
  }
  record(before,kind){
    this.history.push(before);if(this.history.length>32)this.history.shift();this.moves++;this.lastMoveAt=this.clock;
    this.lastAction={kind,from:before.player,to:{...this.player},at:this.clock};
    return this.lastAction;
  }
  climb(direction=1){
    if(!this.ready)return null;
    if(!this.onRope)return {kind:'blocked',message:'先走到繩索旁，再按 ↑ 爬繩。'};
    const r=this.ropeAt(this.player.x,this.player.y),y=this.player.y+direction;
    if(this.config.jetBlocks&&this.config.hazards.some(h=>h.kind==='jet'&&h.x===this.player.x&&h.y===y&&this.hazardPhase(h)==='active'))return {kind:'blocked',message:'噴流正在噴！先在安全高度等紫光停，再按爬繩。'};
    if(y<r.bottom||y>r.top||!this.clearAt(this.player.x,y))return {kind:'blocked',message:direction>0?'到繩索頂了，按 → 到平台。':'已經回到繩索底部。'};
    const before=this.snapshot();this.player.y=y;return this.finishStep(this.record(before,'rope'));
  }
  get buildTarget(){return {x:this.player.x+this.player.facing,y:this.player.y-1+this.buildRise};}
  canPlace(){
    const t=this.buildTarget;
    return this.config.stock>0&&this.inventory>0&&t.x>=0&&t.x<this.config.width&&t.y>=0&&t.y<10&&!this.blockAt(t.x,t.y)
      &&[[t.x-1,t.y],[t.x+1,t.y],[t.x,t.y-1]].some(([x,y])=>this.blockAt(x,y));
  }
  place(){
    if(!this.ready)return null;
    if(!this.canPlace())return {kind:'blocked',message:this.inventory?'這裡不能放。對準旁邊的空格，或切換平橋／階梯。':'材料用完了，可以回收自己放的方塊。'};
    const before=this.snapshot(),t=this.buildTarget;
    this.blocks.push({id:`built-${++this.builtSerial}`,kind:'built',...t,crack:null});this.inventory--;this.buildCount++;
    return this.record(before,'build');
  }
  reclaim(){
    if(!this.ready||!this.config.stock)return null;
    if(this.remainingReclaims<=0)return {kind:'blocked',message:'本關回收額度已用完。可以退一步，或重來本關重新分配。'};
    const t=this.buildTarget,b=this.blockAt(t.x,t.y);
    if(b?.kind!=='built'||this.blockAt(t.x,t.y+1))return {kind:'blocked',message:'只能回收前方自己放的方塊；上面有方塊時要先拆上層。'};
    const before=this.snapshot();this.blocks=this.blocks.filter(block=>block!==b);this.inventory++;this.reclaimsUsed++;
    return this.record(before,'reclaim');
  }
  update(delta){
    if(this.state!=='playing'||!Number.isFinite(delta)||delta<0)return;
    this.clock+=delta;if(this.moves>0)this.elapsed+=delta;
    for(const b of this.blocks)if(b.crack!==null)b.crack+=delta;
    for(const b of this.blocks)if(b.kind==='fragile'&&b.crack>=this.config.fragileSeconds)
      this.retracted.push({...b,crack:null,returnAt:this.clock+this.config.returnSeconds});
    this.blocks=this.blocks.filter(b=>b.kind!=='fragile'||b.crack===null||b.crack<this.config.fragileSeconds);
    this.retracted=this.retracted.filter(b=>{
      const occupied=this.player.x===b.x&&this.player.y<b.y+1&&this.player.y+this.config.actorHeight>b.y;
      if(this.clock>=b.returnAt&&!occupied&&!this.blockAt(b.x,b.y)){const {returnAt,...block}=b;this.blocks.push(block);return false;}return true;
    });
    if(!this.onRope){const floor=this.standingAt(this.player.x,this.player.y);if(floor!==null&&floor<this.player.y)this.player.y=floor;}
    this.corruption=Math.max(0,Math.min(100,this.corruption+delta*(this.inJet?this.config.corruptionRate:-26)));
    if(this.elapsed>=this.config.timeLimit){this.state='lost';this.reason=this.config.caller==='佩利卡'?'佩利卡已經到辦公室了。呱嘎，你人呢？':'莊方宜推開門：人呢？位置發我。';}
    else if(this.corruption>=100){this.state='lost';this.reason='呱嘎被侵蝕噴流攔下了。下次等紫光停，再往上爬。';}
  }
  get hint(){return this.config.hint;}
}
