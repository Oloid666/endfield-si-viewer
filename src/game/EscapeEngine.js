import { ClimbEngine } from './ClimbEngine.js';

// Shared grid collision/undo; each small level adds just one independent rule.
export class EscapeEngine extends ClimbEngine {
  reset(){
    super.reset();this.inventory=this.config.stock;this.buildRise=0;this.builtSerial=0;
    this.buildCount=0;this.corruption=0;this.retracted=[];
  }
  snapshot(){return {...super.snapshot(),inventory:this.inventory,buildRise:this.buildRise,retracted:this.retracted.map(b=>({...b}))};}
  restore(s){super.restore(s);this.inventory=s.inventory;this.buildRise=s.buildRise;this.retracted=s.retracted.map(b=>({...b}));}
  get waste(){return -10;}
  get patrol(){return {...super.patrol,phase:'rest'};}
  get jetPhase(){const t=this.clock%this.config.jet.period;return t<this.config.jet.warning?'warning':t<this.config.jet.warning+this.config.jet.active?'active':'rest';}
  get inJet(){return this.jetPhase==='active'&&this.config.hazards.some(h=>h.kind==='jet'&&h.x===this.player.x&&Math.abs(h.y-this.player.y)<.6);}
  get onRope(){const r=this.config.rope;return !!r&&this.player.x===r.x&&this.player.y>=r.bottom&&this.player.y<=r.top;}
  get ready(){return this.state==='playing'&&this.clock-this.lastMoveAt>=this.config.moveSeconds;}
  move(direction){
    if(!this.ready||![-1,1].includes(direction))return null;
    this.player.facing=direction;
    const x=this.player.x+direction,front=this.blockAt(x,this.player.y);
    const feet=this.carry&&front?.kind==='crate'?this.player.y:this.standingAt(x,this.player.y+1);
    if(this.config.hazards.some(h=>h.kind==='floor'&&h.x===x&&h.y===feet))
      return {kind:'blocked',message:'侵蝕擋住了！把亮框息壤推到上面，再關搬箱踩過去。'};
    return super.move(direction);
  }
  record(before,kind){
    this.history.push(before);if(this.history.length>32)this.history.shift();this.moves++;this.lastMoveAt=this.clock;
    this.lastAction={kind,from:before.player,to:{...this.player},at:this.clock};
    return this.lastAction;
  }
  climb(direction=1){
    if(!this.ready)return null;
    if(!this.onRope)return {kind:'blocked',message:'先走到繩索旁，再按 ↑ 爬繩。'};
    const r=this.config.rope,y=this.player.y+direction;
    if(y<r.bottom||y>r.top||!this.clearAt(this.player.x,y))return {kind:'blocked',message:direction>0?'到繩索頂了，按 → 到平台。':'已經回到繩索底部。'};
    const before=this.snapshot();this.player.y=y;return this.record(before,'rope');
  }
  get buildTarget(){return {x:this.player.x+this.player.facing,y:this.player.y-1+this.buildRise};}
  canPlace(){
    const t=this.buildTarget;
    return this.config.id==='build'&&this.inventory>0&&t.x>=0&&t.x<this.config.width&&t.y>=0&&t.y<10&&!this.blockAt(t.x,t.y)
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
    if(!this.ready||this.config.id!=='build')return null;
    const t=this.buildTarget,b=this.blockAt(t.x,t.y);
    if(b?.kind!=='built'||this.blockAt(t.x,t.y+1))return {kind:'blocked',message:'只能回收前方自己放的方塊；上面有方塊時要先拆上層。'};
    const before=this.snapshot();this.blocks=this.blocks.filter(block=>block!==b);this.inventory++;
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
