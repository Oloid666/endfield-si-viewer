import { ClimbEngine } from './ClimbEngine.js';

export class ClimbGame {
  constructor(root, stage, config, hooks) {
    this.root=root;this.stage=stage;this.config=config;this.hooks=hooks;
    this.engine=new ClimbEngine(config);this.active=false;this.ready=false;this.messageUntil=0;
    root.innerHTML=`
      <div class="climb-hud"><div><small>遊戲區 / 查勤爬塔 · 原型</small><h2>管理員，你人呢？</h2></div><button id="climb-pause" disabled>Ⅱ 暫停</button></div>
      <div class="climb-meters"><span id="climb-time">教學中 · 廢液尚未上升</span><span id="climb-height">接駁口 ↑</span><label>被發現 <meter id="climb-exposure" min="0" max="100" value="0"></meter></label></div>
      <p id="climb-line" role="status" aria-live="polite"></p>
      <div class="climb-controls"><p id="climb-hint"></p><div class="climb-buttons"><button data-climb="left" aria-label="向左移動或攀爬">←<small>A / ←</small></button><button id="climb-carry" data-climb="carry" aria-pressed="false">搬箱：關<small>空白鍵切換</small></button><button data-climb="right" aria-label="向右移動或攀爬">→<small>D / →</small></button><button id="climb-undo" data-climb="undo">↶<small>Z 退一步</small></button></div></div>
      <section id="climb-card" class="climb-card"><small>祀不宜遲 · 第一關</small><h3 id="climb-card-title">來得及回帝江號嗎？</h3><p id="climb-description">你偷溜來找祀，回程電梯卻停了。操作祀推拉亮框息壤、搭階梯，趕到右上方接駁口。前段不計時，通過第一面高牆才開始。</p><p id="climb-result" hidden></p><div class="actions"><button id="climb-start" disabled>正在準備祀…</button><button id="climb-exit">節奏甩蔥</button><button id="climb-view">返回看模型</button></div><details><summary>操作、規則與素材</summary><p>← → 移動，遇到一格高台自動攀爬。「搬箱」開啟後用方向鍵推拉，關閉後才能踩箱子。橘色方塊踩過 2.8 秒會塌；↶ 可退一步，但不倒退時間。</p><p>泡泡龍目前是原創簡模代替物，非官方模型。故事、查勤、廢液與關卡均為同人設定。<a href="https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7" target="_blank" rel="noopener noreferrer">祀模型</a>及<a href="https://sketchfab.com/3d-models/zhuang-fangyi-arknights-endfield-51d669eb7ef94cb49aeeaf2d9541d9de" target="_blank" rel="noopener noreferrer">莊方宜模型截圖</a>：Abcxyz51，<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。頭像取自本站模型渲染，原 GLB 未改動。</p></details></section>
      <section id="climb-call" class="climb-card" role="dialog" aria-modal="true" aria-labelledby="climb-call-title" hidden><small>通訊接入 · 已暫停關卡</small><div class="climb-caller"><img src="${import.meta.env.BASE_URL}images/zhuang-call.png" width="60" height="76" loading="lazy" alt="莊方宜模型截圖"><div><h3 id="climb-call-title">莊方宜</h3><p>「你在哪？怎麼還沒回來？」</p></div></div><div id="climb-answers"><button data-answer="honest">跟祀一起回去。</button><button data-answer="work">正在工業現場考察。</button></div><p id="climb-reply" hidden></p><button id="climb-continue" hidden>先回去，其他等等再說 →</button></section>`;
    this.$=selector=>root.querySelector(selector);
    this.onClick=event=>{
      const button=event.target.closest('[data-climb]');
      if(button)this.input(button.dataset.climb);
      const answer=event.target.closest('[data-answer]');
      if(answer)this.answer(answer.dataset.answer);
    };
    root.addEventListener('click',this.onClick);
    this.$('#climb-start').addEventListener('click',()=>this.start());
    this.$('#climb-pause').addEventListener('click',()=>this.pause());
    this.$('#climb-exit').addEventListener('click',()=>hooks.exit());
    this.$('#climb-view').addEventListener('click',()=>hooks.view());
    this.$('#climb-continue').addEventListener('click',()=>{this.engine.finishCall();this.$('#climb-call').hidden=true;this.message('佩利卡：接駁即將出發。管理員，請準時。',4);this.render();this.$('[data-climb="right"]').focus({preventScroll:true});});
    this.onKey=event=>{
      if(!this.active||event.repeat||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
      const actions={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'carry',KeyZ:'undo'};
      // Native button Space/Enter activation stays native; do not also toggle carry.
      if(event.target.tagName==='BUTTON'&&['Space','Enter'].includes(event.code))return;
      if(event.code==='Escape'){event.preventDefault();this.pause();return;}
      if(actions[event.code]){event.preventDefault();this.input(actions[event.code]);}
      if(event.code==='Tab'&&this.engine.state==='call'){
        const buttons=[...this.$('#climb-call').querySelectorAll('button')].filter(b=>!b.hidden&&!b.parentElement.hidden);
        const first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    this.onHidden=()=>{if(document.hidden)this.pause();};
    document.addEventListener('keydown',this.onKey);document.addEventListener('visibilitychange',this.onHidden);
  }
  get state(){return this.engine.state;}
  enter(){this.active=true;this.root.hidden=false;this.engine.reset();this.messageUntil=0;this.$('#climb-call').hidden=true;this.render();}
  setReady(ready){
    this.ready=ready;
    if(this.active&&!ready){this.engine.pause();this.stage.detach();}
    if(this.active&&ready&&!this.stage.active)this.ready=this.stage.attach();
    this.render();
  }
  start(){
    if(!this.active||!this.ready)return;
    if(this.state==='paused')this.engine.resume();
    else{this.engine.start();this.stage.move(null,this.engine);this.message('佩利卡：接駁準備中。管理員，您應該已經在回程了？',5);}
    this.render();this.$('#climb-start').blur();
  }
  pause(){if(this.active&&this.engine.pause())this.render();}
  input(action){
    if(!this.active||!this.ready||this.state!=='playing')return;
    if(action==='carry'){this.engine.toggleCarry();this.message(this.engine.carry?'搬箱已開：← → 推拉；再按一次關閉，才能踩上箱子。':'搬箱已關：← → 移動與攀爬。',3);}
    else if(action==='undo'){if(this.engine.undo()){this.stage.move(null,this.engine);this.message('撤回剛才那件祀。時間沒有倒退。',2);}}
    else{
      const result=this.engine.move(action==='left'?-1:1);
      if(result?.kind==='blocked')this.message(result.message,4);
      else if(result){this.stage.move(result,this.engine);if(result.kind==='push'||result.kind==='pull')this.message('祀：搬完這塊，就能上去了。記得關掉搬箱。',3);}
    }
    this.render();
  }
  answer(choice){
    if(!this.engine.chooseAnswer(choice))return;
    this.$('#climb-answers').hidden=true;this.$('#climb-reply').hidden=false;this.$('#climb-continue').hidden=false;
    this.$('#climb-reply').textContent=choice==='honest'?'祀：「管理員，這塊往哪裡推？」\n莊方宜：「……你們慢慢搬。回來再談。」':'管理員：「正在檢查設備。」\n祀：「管理員，廢液快淹上來了！」\n莊方宜：「考察得挺深入。回來開鏡頭。」';
    this.$('#climb-continue').focus({preventScroll:true});
  }
  message(text,seconds=3){this.$('#climb-line').textContent=text;this.messageUntil=this.engine.clock+seconds;}
  render(){
    if(!this.active)return;
    const e=this.engine,state=e.state;this.root.dataset.state=state;
    const card=this.$('#climb-card');card.hidden=['playing','call'].includes(state);
    this.$('#climb-pause').disabled=state!=='playing';
    for(const button of this.root.querySelectorAll('[data-climb]'))button.disabled=state!=='playing'||!this.ready;
    this.$('#climb-undo').disabled=state!=='playing'||!e.history.length;
    this.$('#climb-carry').setAttribute('aria-pressed',String(e.carry));
    this.$('#climb-carry').firstChild.textContent=`搬箱：${e.carry?'開':'關'}`;
    this.$('#climb-start').disabled=!this.ready;
    this.$('#climb-start').textContent=!this.ready?'正在準備祀…':state==='paused'?'繼續回去':state==='won'||state==='lost'?'再爬一次':'祀不宜遲 · 開始';
    this.$('#climb-description').hidden=['won','lost'].includes(state);
    this.$('#climb-card-title').textContent=state==='paused'?'暫停：先想好下一步':state==='won'?'祀裡逃生 · 趕上接駁！':state==='lost'?'管理員，找到你了。':'來得及回帝江號嗎？';
    this.$('#climb-result').hidden=!['won','lost'].includes(state);
    if(state==='won')this.$('#climb-result').textContent=`${e.moves} 步 · 搬箱 ${e.pushes} 次 · 倒退 ${e.undos} 次\n剩餘 ${Math.ceil(e.remaining)} 秒\n\n佩利卡：「歡迎回來。」\n莊方宜：「現在，開鏡頭。」\n管理員：「……訊號不太好。」`;
    if(state==='lost')this.$('#climb-result').textContent=`${e.reason}\n\n沒祀，再來。先推箱搭階梯，別忘了關搬箱。`;
    if(state==='call'&&this.$('#climb-call').hidden){
      this.$('#climb-call').hidden=false;this.$('#climb-answers').hidden=false;this.$('#climb-reply').hidden=true;this.$('#climb-continue').hidden=true;
      this.$('[data-answer="honest"]').focus({preventScroll:true});
    }
    this.$('#climb-hint').textContent=e.hint;
  }
  update(delta){
    if(!this.active)return;
    const before=this.state;this.engine.update(delta);
    if(before!==this.state)this.render();
    this.stage.update(this.engine,delta);
    const e=this.engine;
    this.$('#climb-time').textContent=e.called?`回船倒數 ${Math.ceil(e.remaining)} 秒 · 廢液上升中`:'教學中 · 廢液尚未上升';
    this.$('#climb-height').textContent=`高度 ${e.player.y} / ${this.config.exit.y}`;
    this.$('#climb-exposure').value=e.exposure;
    this.root.dataset.search=e.visibleToPatrol?'danger':e.patrol.phase;
    if(this.state==='playing'&&e.clock>=this.messageUntil){
      this.$('#climb-line').textContent=e.visibleToPatrol?'被看見了！快移動，或躲到息壤後面。':e.called&&e.player.x<8?`泡泡龍：${e.patrol.phase==='warning'?'準備掃描…':e.patrol.phase==='scan'?'正在掃描，息壤能擋視線。':'暫停搜尋，趁現在。'}`:'祀：管理員，跟上。往右上方走。';
    }
  }
  leave(){this.active=false;this.root.hidden=true;this.$('#climb-call').hidden=true;this.stage.detach();}
  dispose(){this.leave();this.root.removeEventListener('click',this.onClick);document.removeEventListener('keydown',this.onKey);document.removeEventListener('visibilitychange',this.onHidden);this.stage.dispose();}
}
