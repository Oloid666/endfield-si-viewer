import { RaftEngine } from './RaftEngine.js';

export class RaftGame {
  constructor(root, stage, hooks) {
    this.root = root;
    this.stage = stage;
    this.hooks = hooks;
    this.engine = new RaftEngine();
    this.active = this.ready = false;
    this.pointers = new Map();
    this.keys = new Set();
    root.innerHTML = `
      <div class="raft-hud"><div><small>清波寨水道 · 同人試作</small><h2>小聰明，抓穩了。</h2></div><div class="raft-tools"><button id="raft-pause">暫停</button><button id="raft-exit">離開</button></div></div>
      <div class="raft-meters"><span id="raft-distance"></span><span id="raft-score"></span><span id="raft-speed"></span></div>
      <p id="raft-line" role="status" aria-live="polite">祀：我畫的，應該很聰明吧。</p>
      <div class="raft-card" id="raft-card"><small>竹筏拖行 · 約 45 秒</small><h3 id="raft-title">這次不是蔥，是船。</h3><p id="raft-description">祀站竹筏，小聰明在後面喝水。左右避開木樁、接住綠色墨印；急轉會把牠甩出去，煞車能收近繩子。</p><p id="raft-result" hidden></p><div class="actions"><button id="raft-start" disabled>正在準備小蔥…</button><button id="raft-restart">重新出發</button></div><p class="hint">按住左右／方向鍵轉向 · 按住煞車／空白鍵收繩<br>不會沉船，先玩甩尾手感。</p><details><summary>模型與試作說明</summary><p><a href="https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7" target="_blank" rel="noopener noreferrer">Si · Abcxyz51</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。小聰明為黑白幾何簡模，場景為原創簡化示意。</p></details></div>
      <div class="raft-controls" role="group" aria-label="竹筏操作"><button data-raft="left" aria-label="向左轉">◀<small>左轉</small></button><button data-raft="brake">煞車<small>收繩</small></button><button data-raft="right" aria-label="向右轉">▶<small>右轉</small></button></div>`;
    this.$ = selector => root.querySelector(selector);
    this.onClick = event => {
      const id = event.target.closest('button')?.id;
      if (id === 'raft-start') this.start();
      if (id === 'raft-restart') this.start(true);
      if (id === 'raft-pause') this.pause();
      if (id === 'raft-exit') hooks.exit();
    };
    this.onDown = event => {
      const button = event.target.closest('[data-raft]');
      if (!button || !this.active || this.engine.state !== 'playing') return;
      event.preventDefault();
      this.pointers.set(event.pointerId, button.dataset.raft);
      button.setPointerCapture(event.pointerId);
      this.syncInput();
    };
    this.onUp = event => { this.pointers.delete(event.pointerId); this.syncInput(); };
    this.onKey = event => {
      if (!this.active || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.code === 'Escape') { event.preventDefault(); this.pause(); return; }
      if (!['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(event.code)) return;
      if (event.code === 'Space' && event.target.tagName === 'BUTTON' && !event.target.dataset.raft) return;
      event.preventDefault();
      if (this.engine.state === 'playing') this.keys.add(event.code);
      this.syncInput();
    };
    this.onKeyUp = event => { this.keys.delete(event.code); this.syncInput(); };
    this.onHidden = () => { if (document.hidden) this.pause(); };
    this.onBlur = () => this.pause();
    root.addEventListener('click', this.onClick);
    root.addEventListener('pointerdown', this.onDown);
    root.addEventListener('lostpointercapture', this.onUp);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onHidden);
  }

  syncInput() {
    const held = new Set(this.pointers.values());
    const left = held.has('left') || this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const right = held.has('right') || this.keys.has('ArrowRight') || this.keys.has('KeyD');
    this.input = { steer: Number(right) - Number(left), brake: held.has('brake') || this.keys.has('Space') };
    for (const button of this.root.querySelectorAll('[data-raft]')) {
      button.dataset.held = String(button.dataset.raft === 'brake' ? this.input.brake : button.dataset.raft === 'left' ? left : right);
    }
  }

  clearInput() { this.pointers.clear(); this.keys.clear(); this.syncInput(); }
  enter() {
    this.active = true; this.root.hidden = false; this.engine.reset(); this.clearInput();
    this.ready = false; this.render();
  }
  setReady(ready) {
    this.ready = !!ready;
    if (!this.active) return;
    if (!this.ready) { this.pause(); this.stage.detach(); }
    else this.ready = this.stage.attach();
    this.render();
  }
  start(restart = false) {
    if (!this.active || !this.ready) return;
    this.clearInput();
    if (this.engine.state === 'paused' && !restart) this.engine.resume();
    else { this.engine.start(); this.stage.time = 0; this.stage.firstFrame = true; this.message('祀：小聰明，這次真的只是兜風。'); }
    this.render(); this.$('#raft-start').blur(); this.$('#raft-restart').blur();
  }
  pause() { this.clearInput(); if (this.active) { this.engine.pause(); this.render(); } }
  message(text) { this.$('#raft-line').textContent = text; this.messageUntil = this.engine.elapsed + 3.3; }

  render() {
    if (!this.active) return;
    const e = this.engine, state = e.state;
    this.root.dataset.state = state;
    this.$('#raft-card').hidden = state === 'playing';
    this.$('#raft-start').disabled = !this.ready;
    this.$('#raft-start').textContent = !this.ready ? '正在準備小蔥…' : state === 'paused' ? '繼續漂' : state === 'won' ? '再漂一次' : '出發 · 別把牠甩丟';
    this.$('#raft-restart').hidden = state === 'idle' || state === 'won';
    this.$('#raft-restart').disabled = !this.ready;
    this.$('#raft-pause').disabled = state !== 'playing';
    this.$('#raft-title').textContent = state === 'paused' ? '先靠岸，喘口氣。' : state === 'won' ? '人船平安，小聰明不確定。' : '這次不是蔥，是船。';
    this.$('#raft-description').hidden = state === 'won';
    this.$('#raft-result').hidden = state !== 'won';
    if (state === 'won') this.$('#raft-result').textContent = `${e.elapsed.toFixed(1)} 秒到岸 · 墨印 ${e.ink.size}/${e.config.stamps.length} · 碰撞 ${e.bumps} 次\n小聰明：下次你在後面。`;
    for (const button of this.root.querySelectorAll('[data-raft]')) button.disabled = state !== 'playing';
    this.updateMeters();
  }

  updateMeters() {
    const e = this.engine;
    this.$('#raft-distance').textContent = `水道 ${Math.floor(e.progress / e.config.length * 100)}%`;
    this.$('#raft-score').textContent = `墨印 ${e.ink.size}/${e.config.stamps.length} · 碰 ${e.bumps}`;
    this.$('#raft-speed').textContent = `${(e.speed * 3.6).toFixed(0)} km/h`;
  }

  update(delta) {
    if (!this.active) return;
    const e = this.engine, before = e.state;
    e.update(delta, this.input);
    this.stage.update(e, delta);
    if (e.event) {
      if (e.event === 'ink') this.message('祀：收好墨印。小聰明：先收好我！！');
      else if (e.event === 'finish') this.message('小聰明：我不是船外機！！');
      else this.message(`${e.event}：咚！　小聰明：你管這叫聰明駕駛？`);
      e.event = null;
    } else if (e.state === 'playing' && e.elapsed > (this.messageUntil || 0)) {
      if (Math.abs(e.pet.x - e.x) > 2) this.message('小聰明：我在外圈！！我在外圈啊！！');
      else if (this.input.brake) this.message('祀：煞住了。　小聰明：但我還沒煞住！');
      else if (e.elapsed > 4) this.message(['祀：看，清波寨。　小聰明：我只看到水。', '小聰明：名字是小聰明，工作是拖把。', '祀：別怕，我畫的繩子很結實。'][Math.floor(e.elapsed / 9) % 3]);
    }
    this.updateMeters();
    if (before !== e.state) { this.clearInput(); this.render(); }
  }

  leave() { this.clearInput(); this.active = false; this.root.hidden = true; this.stage.detach(); }
  dispose() {
    this.leave(); this.stage.dispose();
    this.root.removeEventListener('click', this.onClick); this.root.removeEventListener('pointerdown', this.onDown); this.root.removeEventListener('lostpointercapture', this.onUp);
    window.removeEventListener('pointerup', this.onUp); window.removeEventListener('pointercancel', this.onUp); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('keydown', this.onKey); document.removeEventListener('keyup', this.onKeyUp); document.removeEventListener('visibilitychange', this.onHidden);
  }
}
