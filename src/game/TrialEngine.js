import { RideEngine } from './RideEngine.js';

// Three small rule sets share the tested driving clock and follower spring.
// Original race story / opponent rules are disabled through config.trial.
export class TrialEngine extends RideEngine {
  reset(){
    super.reset();
    this.powerCooldown=this.powerTime=this.powerUses=this.misses=this.cleared=this.fallTime=0;
    this.bridgeCharges=3;this.built=new Map();this.resolved=new Set();this.warned=new Set();this.cargo=new Set();this.beltSign=1;
    this.trialSucceeded=false;
  }
  get trial(){return this.config.trial;}
  get nextFeature(){
    const list=this.trial.type==='bridge'?this.trial.gaps:this.trial.type==='cargo'?this.trial.packages:this.trial.gates;
    return list.find((item,i)=>!this.resolved.has(i)&&(item.start??item.s)>=this.progress-12)||null;
  }
  get activeBelt(){return this.trial.belts?.find(b=>this.progress>=b.start&&this.progress<=b.end)||null;}
  get powerReady(){
    if(this.state!=='playing'||this.powerCooldown>0)return false;
    if(this.trial.type==='bridge')return this.bridgeCharges>0&&this.trial.gaps.some((gap,i)=>!this.built.has(i)&&gap.start>this.progress&&gap.start-this.progress<=65);
    return this.trial.type==='cargo'?!!this.activeBelt:true;
  }
  get height(){return this.fallTime>0?-Math.sin((1-this.fallTime/.9)*Math.PI)*1.1:0;}
  useGas(){
    if(!this.powerReady)return false;
    this.powerUses++;
    if(this.trial.type==='bridge'){
      const index=this.trial.gaps.findIndex((gap,i)=>!this.built.has(i)&&gap.start>this.progress&&gap.start-this.progress<=65);
      this.built.set(index,this.prizeClock);this.bridgeCharges--;this.powerTime=.65;this.powerCooldown=.7;
    }else if(this.trial.type==='cargo'){
      this.beltSign*=-1;this.powerTime=.5;this.powerCooldown=3;
    }else{this.powerTime=1.05;this.powerCooldown=3.2;}
    this.emit('trial-power');return true;
  }
  updateJump(){} // Manual bridges and phase gates replace automatic jump boards.
  updatePet(dt,brake){super.updatePet(dt,brake);this.pet.y=1.2+this.height;}
  step(dt,steer,brake){
    this.powerCooldown=Math.max(0,this.powerCooldown-dt);this.powerTime=Math.max(0,this.powerTime-dt);this.fallTime=Math.max(0,this.fallTime-dt);
    const belt=this.activeBelt;
    if(belt)this.offset+=belt.force*this.beltSign*dt;
    super.step(dt,steer,brake);
    const trial=this.trial;
    const features=trial.type==='bridge'?trial.gaps:trial.type==='cargo'?trial.packages:trial.gates;
    features.forEach((item,i)=>{
      if(this.resolved.has(i))return;
      const at=item.start??item.s;
      if(!this.warned.has(i)&&at-this.progress<=65&&at>this.progress){this.warned.add(i);this.emit('trial-warning',{index:i});}
      if(trial.type==='cargo'){
        const near=Math.abs(this.pet.z+item.s)<2.8&&Math.abs(this.pet.x-this.config.center(item.s)-item.offset)<2.4;
        if(near){this.cargo.add(i);this.resolved.add(i);this.cleared++;this.emit('trial-clear',{index:i});}
        else if(this.progress>item.s+15){this.resolved.add(i);this.misses++;this.emit('trial-miss',{index:i});}
        return;
      }
      if(this.progress<at)return;
      this.resolved.add(i);
      const success=trial.type==='bridge'?this.built.has(i):Math.abs(this.offset-item.safe)<2||this.powerTime>0;
      if(success){this.cleared++;this.emit('trial-clear',{index:i});}
      else{this.misses++;if(trial.type==='bridge')this.fallTime=.9;this.bump(trial.type==='bridge'?'施工進度':'空中考勤機');this.emit('trial-miss',{index:i});}
    });
    if(this.elapsed>=trial.limit||this.state==='won'){
      this.trialSucceeded=this.elapsed<=trial.limit&&(trial.type==='bridge'?this.cleared===3:trial.type==='cargo'?this.cargo.size>=4:this.misses<=1);
      this.state='won';this.outcome=this.trialSucceeded?'player':'late';this.isDrifting=false;
    }
  }
}
