import { escapeLevels } from '../config/escapeConfig.js';
import { EscapeEngine } from './EscapeEngine.js';

export class EscapeGame {
  constructor(root,stage,hooks){
    this.root=root;this.stage=stage;this.hooks=hooks;this.active=false;this.available=true;this.selected=0;this.completed=new Set();this.held=0;
    this.engine=new EscapeEngine(escapeLevels[0]);
    root.innerHTML=`<div class="escape-levels" role="group" aria-label="選擇玩法">${escapeLevels.map((c,i)=>`<button data-level="${i}" aria-pressed="${i===0}">${c.name.split(' ')[0]} ${['推箱','侵蝕','繩索','建造'][i]}</button>`).join('')}</div>
      <div class="escape-hud"><div><small>呱嘎管理員 · 四種試玩</small><h2 id="escape-title"></h2></div><button id="escape-pause">Ⅱ 暫停</button></div>
      <div class="escape-meters"><span id="escape-time"></span><span id="escape-progress"></span><span id="escape-stock"></span><label id="escape-corruption-label" hidden>侵蝕 <meter id="escape-corruption" min="0" max="100" value="0"></meter></label></div>
      <p id="escape-line" role="status" aria-live="polite"></p>
      <div class="escape-controls"><p id="escape-hint"></p><div class="escape-tools"><button data-action="climb" id="escape-up">↑ 爬繩<small>按住 / W</small></button><button data-action="down" id="escape-down">↓ 下繩<small>S / ↓</small></button><button data-action="place" id="escape-place">＋ 放一塊<small>E</small></button><button data-action="reclaim" id="escape-reclaim">－ 回收<small>R</small></button><button data-action="rise" id="escape-rise">平橋<small>Q 切換階梯</small></button></div><div class="escape-buttons"><button data-action="left">←<small>A / ←</small></button><button data-action="carry" id="escape-carry" aria-pressed="false">搬箱：關<small>空白鍵</small></button><button data-action="right">→<small>D / →</small></button><button data-action="undo" id="escape-undo">↶<small>Z 退一步</small></button></div></div>
      <section class="climb-card" id="escape-card"><small id="escape-tag"></small><h3 id="escape-card-title"></h3><p id="escape-description"></p><p id="escape-result" hidden></p><div class="actions"><button id="escape-start">祀不宜遲 · 開始</button><button id="escape-next" hidden>下一種玩法 →</button><button id="escape-exit">返回遊戲區</button></div><details><summary>試作與素材說明</summary><p>呱嘎暫用本站原創企鵝簡模，非既有二創角色模型的精確重現。故事、侵蝕、回縮平台均為同人遊戲規則。只用一個場景與渲染循環。</p><p>莊方宜通訊頭像來自 <a href="https://sketchfab.com/3d-models/zhuang-fangyi-arknights-endfield-51d669eb7ef94cb49aeeaf2d9541d9de" target="_blank" rel="noopener noreferrer">Abcxyz51 的模型</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>），由本站渲染截圖。佩利卡以文字通訊出場。</p></details></section>
      <section class="climb-card" id="escape-call" role="dialog" aria-modal="true" aria-labelledby="escape-caller" hidden><small>通訊接入 · 關卡已暫停</small><div class="climb-caller"><img id="escape-avatar" src="${import.meta.env.BASE_URL}images/zhuang-call.png" loading="lazy" width="60" height="76" alt="莊方宜模型截圖"><span id="escape-letter" hidden>佩</span><div><h3 id="escape-caller"></h3><p id="escape-question"></p></div></div><div id="escape-answers"><button data-answer="honest"></button><button data-answer="work"></button></div><p id="escape-reply" hidden></p><button id="escape-continue" hidden>先趕回去 →</button></section>`;
    this.$=selector=>root.querySelector(selector);
    this.onClick=event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.level!==undefined)this.selectLevel(Number(button.dataset.level));
      if(button.dataset.action&&!['climb','down'].includes(button.dataset.action))this.input(button.dataset.action);
      if(button.dataset.action&&['climb','down'].includes(button.dataset.action)&&event.detail===0)this.input(button.dataset.action);
      if(button.dataset.answer)this.answer(button.dataset.answer);
    };
    this.onPointer=event=>{const b=event.target.closest('[data-action]');if(!b||!['climb','down'].includes(b.dataset.action))return;event.preventDefault();this.held=b.dataset.action==='climb'?1:-1;this.input(b.dataset.action);};
    this.onRelease=()=>{this.held=0;};
    root.addEventListener('click',this.onClick);root.addEventListener('pointerdown',this.onPointer);
    window.addEventListener('pointerup',this.onRelease);window.addEventListener('pointercancel',this.onRelease);window.addEventListener('blur',this.onRelease);
    this.$('#escape-start').addEventListener('click',()=>this.start());this.$('#escape-pause').addEventListener('click',()=>this.pause());
    this.$('#escape-next').addEventListener('click',()=>{this.selectLevel((this.selected+1)%escapeLevels.length);this.start();});
    this.$('#escape-exit').addEventListener('click',()=>hooks.exit());
    this.$('#escape-continue').addEventListener('click',()=>{this.engine.finishCall();this.$('#escape-call').hidden=true;this.message('呱嘎：訊號不好，我先回去再說！',3);this.render();this.$('[data-action="right"]').focus({preventScroll:true});});
    this.onKey=event=>{
      if(!this.active||event.repeat||/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
      if(event.code==='Tab'&&this.state==='call'){
        const buttons=[...this.$('#escape-call').querySelectorAll('button')].filter(b=>!b.hidden&&!b.parentElement.hidden),first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}return;
      }
      if(event.target.tagName==='BUTTON'&&['Space','Enter'].includes(event.code))return;
      const actions={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'carry',KeyZ:'undo',ArrowUp:'climb',KeyW:'climb',ArrowDown:'down',KeyS:'down',KeyE:'place',KeyR:'reclaim',KeyQ:'rise'};
      if(event.code==='Escape'){event.preventDefault();this.pause();return;}
      if(actions[event.code]){event.preventDefault();if(['climb','down'].includes(actions[event.code]))this.held=actions[event.code]==='climb'?1:-1;this.input(actions[event.code]);}
    };
    this.onKeyUp=event=>{if(['ArrowUp','KeyW','ArrowDown','KeyS'].includes(event.code))this.held=0;};
    this.onHidden=()=>{if(document.hidden)this.pause();};
    document.addEventListener('keydown',this.onKey);document.addEventListener('keyup',this.onKeyUp);document.addEventListener('visibilitychange',this.onHidden);
  }
  get state(){return this.engine.state;}
  get config(){return escapeLevels[this.selected];}
  enter(){this.active=true;this.root.hidden=false;this.stage.attach();this.selectLevel(this.selected);}
  selectLevel(index){
    if(!this.active||!escapeLevels[index])return;
    this.selected=index;this.engine=new EscapeEngine(this.config);this.held=0;this.messageUntil=0;
    this.$('#escape-call').hidden=true;this.stage.setLevel(this.config);this.stage.move(null,this.engine);this.stage.frameCamera(true);
    this.message('呱嘎本來去武陵找莊，半路又跑去找小蔥。現在，誰也不能知道。',5);this.render();
  }
  start(){
    if(!this.active||!this.available)return;
    if(this.state==='paused')this.engine.resume();else{this.engine.start();this.stage.move(null,this.engine);this.message(this.config.id==='rope'?'佩利卡：管理員，有份文件需要您簽名。':'祀：莊方宜說她提早到了。管理員，你確定還來得及？',4);}
    this.held=0;this.render();this.$('#escape-start').blur();
  }
  pause(){this.held=0;if(this.active&&this.engine.pause())this.render();}
  setAvailable(value){this.available=value;if(!value)this.pause();this.render();}
  input(action){
    if(!this.active||!this.available||this.state!=='playing')return;
    const e=this.engine;let result;
    if(action==='left'||action==='right')result=e.move(action==='left'?-1:1);
    else if(action==='climb'||action==='down')result=e.climb(action==='climb'?1:-1);
    else if(action==='carry'){e.toggleCarry();this.message(e.carry?'搬箱已開：用左右鍵推拉，再關閉踩上去。':'搬箱已關：左右移動與攀一格。',2);}
    else if(action==='undo'){if(e.undo()){this.stage.move(null,e);this.message('撤回剛才那件祀。查勤倒數沒有倒退。',2);}}
    else if(action==='place')result=e.place();
    else if(action==='reclaim')result=e.reclaim();
    else if(action==='rise'&&this.config.id==='build'){e.buildRise=1-e.buildRise;this.message(e.buildRise?'階梯：在前方高一格放置息壤。':'平橋：延伸腳下這一層。',2);}
    if(result?.kind==='blocked'){this.message(result.message,3);if(action==='climb'||action==='down')this.held=0;}
    else if(result)this.stage.move(result,e);
    if(this.state!=='playing')this.held=0;
    this.render();
  }
  message(text,seconds=3){this.$('#escape-line').textContent=text;this.messageUntil=this.engine.clock+seconds;}
  answer(choice){
    if(!this.engine.chooseAnswer(choice))return;
    this.$('#escape-answers').hidden=true;this.$('#escape-reply').hidden=false;this.$('#escape-continue').hidden=false;
    this.$('#escape-reply').textContent=this.config.replies[choice==='honest'?0:1];this.$('#escape-continue').focus({preventScroll:true});
  }
  render(){
    if(!this.active)return;const e=this.engine,c=this.config,s=this.state;
    this.root.dataset.state=s;this.root.dataset.level=c.id;
    this.$('#escape-title').textContent=c.name;this.$('#escape-tag').textContent=c.tag;
    for(const b of this.root.querySelectorAll('[data-level]')){b.setAttribute('aria-pressed',String(Number(b.dataset.level)===this.selected));b.dataset.complete=String(this.completed.has(Number(b.dataset.level)));}
    this.$('#escape-card').hidden=['playing','call'].includes(s);this.$('#escape-description').textContent=c.intro;this.$('#escape-description').hidden=['won','lost'].includes(s);
    this.$('#escape-card-title').textContent=s==='paused'?'先停一下，想好再走':s==='won'?'祀裡逃生 · 趕回去了！':s==='lost'?'管理員，被發現了。':'管理員，你人呢？';
    this.$('#escape-start').textContent=s==='paused'?'繼續回去':['won','lost'].includes(s)?'同關再試一次':'祀不宜遲 · 開始';
    this.$('#escape-start').disabled=!this.available;this.$('#escape-pause').disabled=s!=='playing';this.$('#escape-next').hidden=s!=='won';
    this.$('#escape-result').hidden=!['won','lost'].includes(s);
    if(s==='won'){this.completed.add(this.selected);this.$('#escape-result').textContent=`${e.moves} 次操作 · 剩餘 ${Math.ceil(e.remaining)} 秒${c.stock?` · 放置 ${e.buildCount} 次`:''}\n\n${c.ending}`;}
    if(s==='lost')this.$('#escape-result').textContent=`${e.reason}\n\n沒祀，再來。可以先不操作，看清楚路再開始。`;
    this.$('#escape-hint').textContent=c.hint;
    this.$('#escape-up').hidden=this.$('#escape-down').hidden=!c.rope;
    for(const id of ['place','reclaim','rise'])this.$(`#escape-${id}`).hidden=c.id!=='build';
    this.$('#escape-carry').hidden=!c.crates.length;this.$('#escape-carry').firstChild.textContent=`搬箱：${e.carry?'開':'關'}`;this.$('#escape-carry').setAttribute('aria-pressed',String(e.carry));
    this.$('#escape-rise').firstChild.textContent=e.buildRise?'階梯':'平橋';
    for(const b of this.root.querySelectorAll('[data-action]'))b.disabled=s!=='playing'||!this.available;
    this.$('#escape-undo').disabled=s!=='playing'||!e.history.length;
    if(s==='call'&&this.$('#escape-call').hidden){
      this.held=0;this.$('#escape-call').hidden=false;this.$('#escape-caller').textContent=c.caller;this.$('#escape-question').textContent=`「${c.call}」`;
      this.$('#escape-avatar').hidden=c.caller!=='莊方宜';this.$('#escape-letter').hidden=c.caller==='莊方宜';
      this.$('#escape-answers').hidden=false;this.$('#escape-reply').hidden=true;this.$('#escape-continue').hidden=true;
      this.$('[data-answer="honest"]').textContent=c.choices[0];this.$('[data-answer="work"]').textContent=c.choices[1];this.$('[data-answer="honest"]').focus({preventScroll:true});
    }
  }
  update(delta){
    if(!this.active)return;
    if(this.held&&this.engine.ready)this.input(this.held===1?'climb':'down');
    const before=this.state;this.engine.update(delta);if(before!==this.state)this.render();
    this.stage.update(this.engine,delta);const e=this.engine;
    this.$('#escape-time').textContent=e.moves?`${this.config.caller==='佩利卡'?'送件':'抵達'}倒數 ${Math.ceil(e.remaining)} 秒`:'先看好路，操作後開始計時';
    this.$('#escape-progress').textContent=`位置 ${e.player.x} · 高度 ${e.player.y}`;
    this.$('#escape-stock').textContent=this.config.stock?`息壤 ${e.inventory} / ${this.config.stock}`:'';
    this.$('#escape-corruption-label').hidden=!this.config.rope;this.$('#escape-corruption').value=e.corruption;
    this.root.dataset.jet=e.jetPhase;
    if(this.state==='playing'&&e.clock>=this.messageUntil)this.$('#escape-line').textContent=this.config.rope?(e.jetPhase==='active'?'侵蝕噴流！避開繩索中段。':e.jetPhase==='warning'?'黃光預警：先看好時機。':'噴流停了，趁現在爬！'):this.config.stock?'呱嘎：路沒有，就自己蓋。先看淡綠色預覽格。':'呱嘎：祀不宜遲，但也不能亂推。';
  }
  leave(){this.held=0;this.active=false;this.root.hidden=true;this.$('#escape-call').hidden=true;this.stage.detach();}
  dispose(){this.leave();this.stage.dispose();this.root.removeEventListener('click',this.onClick);this.root.removeEventListener('pointerdown',this.onPointer);window.removeEventListener('pointerup',this.onRelease);window.removeEventListener('pointercancel',this.onRelease);window.removeEventListener('blur',this.onRelease);document.removeEventListener('keydown',this.onKey);document.removeEventListener('keyup',this.onKeyUp);document.removeEventListener('visibilitychange',this.onHidden);}
}
