import { RhythmEngine } from './RhythmEngine.js';
import { unlockAudio } from './unlockAudio.js';

export class RhythmGame {
  constructor(root,config,hooks){
    this.root=root;this.config=config;this.hooks=hooks;this.engine=new RhythmEngine(config);this.ready=false;this.active=false;this.audioEnabled=true;this.sounds=new Set();this.token=0;
    root.innerHTML=`<div class="game-hud"><div><small>危機合約 · 禁止停手</small><h2>甩蔥</h2></div><p>分數 <b id="game-score">0</b><br>連擊 <b id="game-combo">0</b></p><button id="game-pause" hidden>Ⅱ 暫停</button></div>
      <p id="game-phase">祀先甩蔥，蔥再甩祀。</p><p id="game-feedback" role="status"></p><p id="game-audio-status" hidden></p>
      <div id="game-chart" hidden><div class="game-lane left"><span>左</span></div><div class="game-lane right"><span>右</span></div><div class="game-hitline">判定線</div></div>
      <div id="game-pads" hidden><button data-pad="left">← 左甩 <small>F / ←</small></button><button data-pad="right">右甩 → <small>J / →</small></button></div>
      <div id="game-card"><small>節奏甩蔥 · 可玩原型</small><h3 id="game-card-title">節奏甩蔥</h3><p id="game-instructions">箭頭落到判定線時，按對應的左／右鍵。中場蔥會接管；按鍵規則不變。約 30 秒，自製節拍。</p><div id="game-result" hidden></div><div class="actions"><button id="game-start" disabled>正在準備祀…</button><button id="game-sound" aria-pressed="true">音效：開</button><button id="game-exit">返回遊戲選單</button></div></div>`;
    this.$=selector=>root.querySelector(selector);
    this.notes=Array.from({length:10},()=>{const note=document.createElement('b');note.className='game-note';note.hidden=true;this.$('#game-chart').append(note);return note;});
    this.onStart=()=>this.start();this.$('#game-start').addEventListener('click',this.onStart);
    this.onPause=()=>this.pause();this.$('#game-pause').addEventListener('click',this.onPause);
    this.onExit=()=>hooks.exit();this.$('#game-exit').addEventListener('click',this.onExit);
    this.onSound=()=>{this.audioEnabled=!this.audioEnabled;this.$('#game-sound').textContent=`音效：${this.audioEnabled?'開':'關'}`;this.$('#game-sound').setAttribute('aria-pressed',String(this.audioEnabled));if(!this.audioEnabled)this.stopSounds();};
    this.$('#game-sound').addEventListener('click',this.onSound);
    this.onPad=event=>{const button=event.target.closest('[data-pad]');if(!button)return;if(event.type==='click'&&event.detail!==0)return;event.preventDefault();this.input(button.dataset.pad);};
    this.$('#game-pads').addEventListener('pointerdown',this.onPad);this.$('#game-pads').addEventListener('click',this.onPad);
    this.onKey=event=>{if(!this.active||event.repeat)return;const side=['ArrowLeft','KeyF'].includes(event.code)?'left':['ArrowRight','KeyJ'].includes(event.code)?'right':null;if(side){event.preventDefault();this.input(side);}};
    this.onHidden=()=>{if(document.hidden)this.pause();};
    document.addEventListener('keydown',this.onKey);document.addEventListener('visibilitychange',this.onHidden);
  }
  get state(){return this.engine.state;}
  get running(){return this.active&&['playing','paused'].includes(this.state);}
  now(){return this.useAudio?this.audio.currentTime:performance.now()/1000;}
  enter(){this.active=true;this.root.hidden=false;this.root.dataset.state='idle';this.engine.reset();this.$('#game-score').textContent='0';this.$('#game-combo').textContent='0';this.$('#game-phase').textContent='祀先甩蔥，蔥再甩祀。';this.showLobby();}
  setReady(ready){this.ready=ready;if(['idle','results'].includes(this.state)){this.$('#game-start').disabled=!ready;this.$('#game-start').textContent=ready?(this.state==='results'?'再甩一次':'開始挑戰'):(this.state==='results'?'角色復位中…':'正在準備祀…');}}
  showLobby(){
    this.$('#game-card').hidden=false;this.$('#game-card-title').textContent='節奏甩蔥';this.$('#game-result').hidden=true;this.$('#game-instructions').hidden=false;this.$('#game-audio-status').hidden=true;
    this.$('#game-chart').hidden=true;this.$('#game-pads').hidden=true;this.$('#game-pause').hidden=true;this.$('#game-feedback').textContent='';this.setReady(this.ready);
  }
  async start(){
    if(!this.active||!this.ready||this.starting)return;
    this.starting=true;const token=++this.token;
    try{
      try{if(!this.audio){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio)this.audio=new Audio();}this.useAudio=await unlockAudio(this.audio);}catch{this.useAudio=false;}
      if(!this.active||token!==this.token)return;
      this.$('#game-audio-status').hidden=this.useAudio;this.$('#game-audio-status').textContent='音訊未就緒，已先開始無聲挑戰。';
      if(this.state==='paused')this.engine.resume(this.now());
      else{
        if(!this.hooks.start()){this.$('#game-start').textContent='角色復位中，再按一次';return;}
        this.engine.start(this.now());
        this.lastMiss=0;
      }
      this.nextTick=Math.max(0,Math.ceil((this.now()-this.engine.origin)/(60/this.config.bpm))+this.config.countInBeats);
      this.$('#game-card').hidden=true;this.$('#game-chart').hidden=false;this.$('#game-pads').hidden=false;this.$('#game-pause').hidden=false;
      this.root.dataset.state='playing';this.feedback=null;this.$('#game-feedback').textContent='';
    }finally{if(token===this.token)this.starting=false;}
  }
  pause(){
    if(!this.active||this.state!=='playing')return;
    this.engine.pause(this.now());
    if(this.state==='results'){this.finish();return;}
    this.stopSounds();void this.audio?.suspend().catch(()=>{});
    this.root.dataset.state='paused';this.$('#game-card').hidden=false;this.$('#game-card-title').textContent='先喘一口氣';this.$('#game-start').textContent='繼續挑戰';this.$('#game-result').hidden=true;this.$('#game-instructions').hidden=false;this.$('#game-pause').hidden=true;
  }
  input(side){
    const result=this.engine.hit(side,this.now());if(!result)return;
    this.feedback={result,at:this.engine.elapsed};
    this.lastMiss=this.engine.miss;
    const labels={perfect:'PERFECT',good:'GOOD',miss:'按反啦！',empty:'還沒到拍點！'};
    this.$('#game-feedback').textContent=labels[result];this.$('#game-feedback').dataset.result=result;
    this.hooks.hit?.(side,result,this.engine.elapsed);
  }
  scheduleAudio(){
    if(!this.useAudio||!this.audioEnabled)return;
    const period=60/this.config.bpm,now=this.audio.currentTime;
    while(this.nextTick<this.config.countInBeats+this.config.noteCount){
      const target=this.engine.origin+(this.nextTick-this.config.countInBeats)*period;
      if(target>now+this.config.audioLookAhead)break;
      if(target>=now-.06){
        const oscillator=this.audio.createOscillator(),gain=this.audio.createGain(),time=Math.max(now,target);
        oscillator.type='sine';oscillator.frequency.setValueAtTime(this.nextTick%4===0?680:440,time);
        gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.12,time+.004);gain.gain.exponentialRampToValueAtTime(.0001,time+.065);
        oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.start(time);oscillator.stop(time+.075);
        this.sounds.add(oscillator);oscillator.onended=()=>{this.sounds.delete(oscillator);oscillator.disconnect();gain.disconnect();};
      }
      this.nextTick++;
    }
  }
  update(){
    if(!this.active)return;
    if(this.state==='results'&&this.root.dataset.state!=='results'){this.finish();return;}
    if(this.state==='playing'){
      if(this.useAudio&&this.audio.state!=='running'){this.pause();return;}
      this.engine.update(this.now());this.scheduleAudio();
      if(this.state==='results'){this.finish();return;}
      const time=this.engine.elapsed,period=60/this.config.bpm;
      if(this.engine.miss>this.lastMiss){this.lastMiss=this.engine.miss;this.feedback={result:'miss',at:time};this.$('#game-feedback').textContent='MISS · 蔥：手呢？';this.$('#game-feedback').dataset.result='miss';this.hooks.hit?.('left','miss',time);}
      this.$('#game-phase').textContent=time<0?`準備 ${Math.ceil(-time/period)} · 箭頭到線再按` : this.engine.phase==='reverse'?'蔥權反轉！你現在負責讓祀跟上節拍。':'祀：簡單示範一下。';
      this.$('#game-score').textContent=String(this.engine.score);this.$('#game-combo').textContent=String(this.engine.combo);
      const upcoming=this.engine.notes.filter(note=>!note.judgement&&note.time-time<this.config.previewSeconds&&note.time-time>=-this.config.goodWindow).slice(0,this.notes.length);
      this.notes.forEach((node,i)=>{const note=upcoming[i];node.hidden=!note;if(!note)return;node.dataset.side=note.side;node.textContent=note.side==='left'?'←':'→';node.style.transform=`translateY(${-(note.time-time)/this.config.previewSeconds*155}px)`;});
      if(this.feedback&&time-this.feedback.at>this.config.feedbackSeconds)this.$('#game-feedback').textContent='';
      this.hooks.frame(time,this.engine.phase);
    }
  }
  finish(){
    this.stopSounds();this.hooks.stop();const s=this.engine.stats;
    this.root.dataset.state='results';this.$('#game-card').hidden=false;this.$('#game-card-title').textContent=`評級 ${s.grade}`;this.$('#game-instructions').hidden=true;
    this.$('#game-result').hidden=false;this.$('#game-result').textContent=`${s.score} 分 · 最大連擊 ${s.maxCombo}\nPerfect ${s.perfect} / Good ${s.good} / Miss ${s.miss}\n${s.accuracy>=.75?'祀：哼，算你跟得上。':'大蔥：下次換我當管理員。'}`;
    this.$('#game-start').textContent='再甩一次';this.$('#game-pause').hidden=true;this.$('#game-pads').hidden=true;this.$('#game-chart').hidden=true;
    this.$('#game-score').textContent=String(s.score);this.$('#game-combo').textContent=String(this.engine.combo);
  }
  stopSounds(){for(const oscillator of this.sounds)try{oscillator.stop();}catch{}this.sounds.clear();}
  leave(){++this.token;this.starting=false;if(this.running)this.hooks.stop();this.active=false;this.engine.reset();this.stopSounds();void this.audio?.close().catch(()=>{});this.audio=null;this.useAudio=false;this.root.hidden=true;}
  dispose(){this.leave();document.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onHidden);this.root.remove();}
}
