import { RaftGame } from './RaftGame.js';
import { RaftEngine } from './RaftEngine.js';
import { rideConfig, rideProfiles } from '../config/rideConfig.js';

// Reuse held-touch controls and pause lifecycle; keep a distinct DOM / menu entry.
export class RideGame extends RaftGame {
  constructor(root, stage, hooks) {
    super(root, stage, hooks);
    root.innerHTML = root.innerHTML.replaceAll('id="raft-', 'id="ride-');
    this.$ = selector => root.querySelector(selector.replaceAll('#raft-', '#ride-'));
    this.engine = new RaftEngine(rideConfig);
    this.character = new URLSearchParams(location.search).get('rider') === 'zhuang' ? 'zhuang' : 'si';
    this.$('#ride-card > small').textContent = '坐騎失控試作 · 約 25 秒';
    this.$('#ride-card').insertAdjacentHTML('afterbegin', `<div class="ride-picker" role="group" aria-label="選擇坐騎"><button data-rider="si">祀 · 迷你帝江號</button><button data-rider="zhuang">莊芳宜 · 辦公椅</button></div>`);
    this.$('#ride-card .hint').innerHTML = '按住左右轉向 · 同時按煞車甩尾<br>鬆開煞車加速 · 暫停可換角色';
    this.$('#ride-card details p').innerHTML = '<a id="ride-source" target="_blank" rel="noopener noreferrer">人物模型 · Abcxyz51</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。迷你帝江號、辦公椅與跟班均為本站二創簡模；坐姿允許衣物穿模。';
    this.$('[data-raft="brake"]').innerHTML = '煞車<small>甩尾／放開加速</small>';
    root.querySelector('.raft-hud small').textContent = '工業便道 · 坐著也能失控';
    this.$('#ride-line').insertAdjacentHTML('beforebegin', '<div id="ride-comic" aria-live="polite" hidden><small id="ride-comic-tag"></small><strong id="ride-comic-text"></strong></div>');
    root.removeEventListener('click', this.onClick);
    this.onClick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.rider && button.dataset.rider !== this.character) hooks.character(button.dataset.rider);
      if (button.id === 'ride-start') this.start();
      if (button.id === 'ride-restart') this.start(true);
      if (button.id === 'ride-pause') this.pause();
      if (button.id === 'ride-exit') hooks.exit();
    };
    root.addEventListener('click', this.onClick);
  }

  get profile() { return rideProfiles[this.character]; }
  enter() { this.stage.setCharacter(this.character); super.enter(); this.comicUntil = 0; this.$('#ride-comic').hidden = true; this.message(this.profile.start); }
  start(restart = false) {
    const resume = this.engine.state === 'paused' && !restart;
    super.start(restart);
    if (!this.ready) return;
    if (!resume) {
      this.stage.lastTime = this.stage.lastSpins = this.stage.lastBumps = this.stage.seatSpin = 0;
      this.stage.shotUntil = 0;
      this.stage.shipSeat.rotation.y = this.stage.chairSeat.rotation.y = Math.PI;
      this.$('#ride-comic').hidden = true; this.comicUntil = 0;
      this.message(this.profile.start);
    }
  }
  render() {
    super.render();
    if (!this.active) return;
    const e = this.engine, p = this.profile;
    this.root.dataset.rider = this.character;
    this.root.querySelector('.raft-hud h2').textContent = `${p.name} · ${p.vehicle}`;
    this.$('#ride-title').textContent = e.state === 'paused' ? '先停一下，也可以換車。' : e.state === 'won' ? '系統：已抵達，請停止辦公。' : p.title;
    this.$('#ride-description').textContent = p.intro;
    this.$('#ride-start').textContent = !this.ready ? `正在準備${p.name}…` : e.state === 'paused' ? '繼續失控' : e.state === 'won' ? '再失控一次' : '坐穩 · 出發';
    this.$('#ride-source').href = p.source;
    this.$('#ride-source').textContent = `${p.name}模型 · Abcxyz51`;
    if (e.state === 'won') this.$('#ride-result').textContent = `${e.elapsed.toFixed(1)} 秒 · 墨印 ${e.ink.size}/${e.config.stamps.length} · 碰撞 ${e.bumps} 次\n${p.finish}`;
    for (const button of this.root.querySelectorAll('[data-rider]')) button.setAttribute('aria-pressed', String(button.dataset.rider === this.character));
  }

  comic(tag, text) {
    this.$('#ride-comic-tag').textContent = tag; this.$('#ride-comic-text').textContent = text;
    this.$('#ride-comic').hidden = false; this.comicUntil = this.engine.elapsed + 2;
  }
  updateMeters() {
    super.updateMeters();
    const e = this.engine;
    this.$('#ride-distance').textContent = `便道 ${Math.floor(e.progress / e.config.length * 100)}%`;
    this.$('#ride-speed').textContent = e.boost > 0 ? `噴射 ${(e.speed * 3.6).toFixed(0)} km/h` : this.input?.brake && e.charge > .24 ? '甩尾蓄力 · 放開加速' : `${(e.speed * 3.6).toFixed(0)} km/h`;
  }
  update(delta) {
    if (!this.active) return;
    const e = this.engine, before = e.state, p = this.profile;
    e.update(delta, this.input); this.stage.update(e, delta);
    if (e.event) {
      if (e.event === 'boost') { this.message(p.boost); this.comic('工業集成系統', this.character === 'si' ? '未核准起飛' : '椅動辦公：加速'); }
      else if (e.event === 'spin') { this.message(p.spin); this.comic('方向不重要，態度要端正', this.character === 'si' ? '誰在開誰？！' : '座椅：我先轉了'); }
      else if (e.event === 'ink') this.message(`系統：墨印已簽收。　${p.companion}：先簽收我！！`);
      else if (e.event === 'finish') this.message(p.finish);
      else { this.message(p.bump); this.comic('碰撞檢測', this.character === 'si' ? '帝江號 → 抵牆號' : '人還在上班，椅子已離職'); }
      e.event = null;
    } else if (e.state === 'playing' && e.elapsed > (this.messageUntil || 0)) this.message(p.idle[Math.floor(e.elapsed / 5) % p.idle.length]);
    if (e.elapsed >= (this.comicUntil || 0)) this.$('#ride-comic').hidden = true;
    this.updateMeters();
    this.root.dataset.boost = String(e.boost > 0);
    if (before !== e.state) { this.clearInput(); this.render(); }
  }
}
