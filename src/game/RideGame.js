import { RaftGame } from './RaftGame.js';
import { RideEngine } from './RideEngine.js';
import { rideConfig, rideProfiles } from '../config/rideConfig.js';
import { zhuangBeats } from './ZhuangRaceStory.js';

// Reuse held-touch controls and pause lifecycle; keep a distinct DOM / menu entry.
export class RideGame extends RaftGame {
  constructor(root, stage, hooks) {
    super(root, stage, hooks);
    root.innerHTML = root.innerHTML.replaceAll('id="raft-', 'id="ride-');
    this.$ = selector => root.querySelector(selector.replaceAll('#raft-', '#ride-'));
    this.engine = new RideEngine(rideConfig);
    this.character = new URLSearchParams(location.search).get('rider') === 'zhuang' ? 'zhuang' : 'si';
    this.$('#ride-card > small').textContent = `${rideConfig.length}m 寬路甩尾 · 三段路線`;
    this.$('#ride-card').insertAdjacentHTML('afterbegin', `<div class="ride-picker" role="group" aria-label="選擇坐騎"><button data-rider="si">祀 · 迷你帝江號</button><button data-rider="zhuang">莊芳宜 · 辦公椅</button></div>`);
    this.$('#ride-card .hint').innerHTML = '方向＋煞車：蓄甩尾Ⅰ／Ⅱ／Ⅲ，放開噴射<br>氣態息壤／E：道具噴射，最多帶兩罐<br>撞車會減速；暫停可換角色';
    this.$('#ride-card details p').innerHTML = '<a id="ride-source" target="_blank" rel="noopener noreferrer">人物模型 · Abcxyz51</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。迷你帝江號、辦公椅與跟班均為本站二創簡模；坐姿允許衣物穿模。';
    this.$('[data-raft="brake"]').innerHTML = '煞車<small>甩尾／放開加速</small>';
    root.querySelector('.raft-controls').insertAdjacentHTML('beforeend', '<button id="ride-gas">息壤噴射<small id="ride-gas-count">E · 1 罐</small></button>');
    root.querySelector('.raft-controls').setAttribute('aria-label', '坐騎駕駛操作');
    root.querySelector('.raft-meters').insertAdjacentHTML('afterend', '<div class="ride-drift"><label for="ride-drift-meter" id="ride-drift-label">方向＋煞車，開始甩尾</label><meter id="ride-drift-meter" min="0" max="1" value="0"></meter></div>');
    root.insertAdjacentHTML('afterbegin', '<div class="ride-vfx" aria-hidden="true"></div>');
    root.querySelector('.raft-hud small').textContent = '工業便道 · 坐著也能失控';
    this.$('#ride-line').insertAdjacentHTML('beforebegin', '<div id="ride-comic" aria-live="polite" hidden><small id="ride-comic-tag"></small><strong id="ride-comic-text"></strong></div>');
    root.insertAdjacentHTML('beforeend', '<div id="ride-story" role="status" hidden><strong id="ride-story-title"></strong><p id="ride-story-line"></p></div>');
    root.removeEventListener('click', this.onClick);
    this.onClick = event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.rider && button.dataset.rider !== this.character) hooks.character(button.dataset.rider);
      if (button.id === 'ride-start') this.start();
      if (button.id === 'ride-restart') this.start(true);
      if (button.id === 'ride-pause') this.pause();
      if (button.id === 'ride-exit') hooks.exit();
      if (button.id === 'ride-gas') { this.engine.useGas(); this.updateMeters(); }
    };
    root.addEventListener('click', this.onClick);
    this.onGasKey = event => { if (this.active && event.code === 'KeyE' && !event.repeat && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) { event.preventDefault(); this.engine.useGas(); this.updateMeters(); } };
    document.addEventListener('keydown', this.onGasKey);
  }

  get profile() { return rideProfiles[this.character]; }
  enter() { this.engine.setCharacter(this.character); this.stage.setCharacter(this.character); super.enter(); this.comicUntil = this.storyUntil = 0; this.$('#ride-comic').hidden = this.$('#ride-story').hidden = true; this.message(this.profile.start); }
  start(restart = false) {
    const resume = this.engine.state === 'paused' && !restart;
    super.start(restart);
    if (!this.ready) return;
    if (!resume) {
      this.stage.lastTime = this.stage.lastSpins = this.stage.lastBumps = this.stage.seatSpin = 0;
      this.stage.shotUntil = 0;
      this.stage.resetEffects();
      this.stage.shipSeat.rotation.y = this.stage.chairSeat.rotation.y = Math.PI;
      this.$('#ride-comic').hidden = true; this.comicUntil = 0;
      this.$('#ride-story').hidden = true; this.storyUntil = 0;
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
    this.$('#ride-gas').firstChild.textContent = e.isZhuang ? '法術加速' : '息壤噴射';
    this.$('#ride-card .hint').innerHTML = e.isZhuang ? '開場龍泡泡領跑；看到贊助公告後，莊芳宜接管<br>法術加速／E：消耗 1 次，拾取息壤可補充，最多 2 次<br>最後自動架橋通行；暫停、重來皆可重看短劇' : '方向＋煞車：蓄甩尾Ⅰ／Ⅱ／Ⅲ，放開噴射<br>氣態息壤／E：道具噴射，最多帶兩罐<br>撞車會減速；暫停可換角色';
    if (e.state === 'won') {
      if (e.isZhuang) this.$('#ride-title').textContent = zhuangBeats.finish.title;
      this.$('#ride-result').textContent = `${e.elapsed.toFixed(1)} 秒 · 最高 ${(e.topSpeed * 3.6).toFixed(0)} km/h\n甩尾 ${Math.floor(e.driftPoints)} 分／噴射 ${e.driftCount} 次\n墨印 ${e.ink.size}/${e.config.stamps.length} · 碰撞 ${e.bumps} 次 · ${e.isZhuang ? '施法' : '息壤'} ${e.gasUsed} ${e.isZhuang ? '次' : '罐'}\n${p.finish}${e.isZhuang ? '\n＊原創短劇冠軍；尚未加入對手 AI。' : ''}`;
    }
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
    this.$('#ride-score').textContent = `墨印 ${e.ink.size}/${e.config.stamps.length} · 甩尾 ${Math.floor(e.driftPoints)}`;
    this.$('#ride-speed').textContent = `${e.gasTime ? e.isZhuang ? '法術 ' : '息壤 ' : e.boost ? '噴射 ' : ''}${(e.speed * 3.6).toFixed(0)} km/h`;
    this.root.querySelector('.raft-hud small').textContent = `${e.config.sectors[e.sector].name} · ${Math.floor(e.progress)}/${e.config.length}m`;
    this.$('#ride-drift-meter').value = e.charge;
    const tiers = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'];
    this.$('#ride-drift-label').textContent = e.isDrifting ? `甩尾 ${tiers[e.driftTier] || '蓄力中'} · ${e.driftTier ? '放開煞車噴射！' : '繼續壓彎'}` : e.boost ? '甩尾噴射中！' : '方向＋煞車，蓄甩尾放開噴射';
    this.root.dataset.tier = String(e.driftTier); this.root.dataset.impact = String(e.hit > .25); this.root.dataset.gas = String(e.gasTime > 0);
    this.root.dataset.story = e.storyPhase || '';
    const locked = e.isZhuang && !['race', 'bridge'].includes(e.storyPhase);
    this.$('#ride-gas-count').textContent = e.state === 'won' ? '已完賽' : locked ? '接管後解鎖' : e.gasTime ? `${e.isZhuang ? '施法' : '噴射'}中 · ${e.gasLeft}` : `E · ${e.gasLeft} ${e.isZhuang ? '次' : '罐'}`;
    this.$('#ride-gas').setAttribute('aria-label', `${e.isZhuang ? '法術加速' : '氣態息壤噴射'}，剩餘 ${e.gasLeft} ${e.isZhuang ? '次' : '罐'}`);
    this.$('#ride-gas').disabled = !this.ready || e.state !== 'playing' || !e.gasLeft || e.gasTime > 0 || locked;
    if (e.isZhuang && e.onBridge) this.root.querySelector('.raft-hud small').textContent = `息壤橋 · 自動通行 · ${Math.floor(e.progress)}/900m`;
    if (e.isZhuang) {
      for (const button of this.root.querySelectorAll('[data-raft]')) button.disabled = e.state !== 'playing' || e.onBridge;
      if (e.onBridge) this.$('#ride-drift-label').textContent = '息壤橋自動通行 · 法術仍可加速';
    }
  }
  update(delta) {
    if (!this.active) return;
    const e = this.engine, before = e.state, p = this.profile;
    e.update(delta, this.input); this.stage.update(e, delta);
    const events = e.takeEvents();
    for (const event of events) {
      if (event.type === 'story') {
        const beat = zhuangBeats[event.phase];
        this.$('#ride-story-title').textContent = beat.title; this.$('#ride-story-line').textContent = beat.line;
        this.$('#ride-story').hidden = false; this.storyUntil = e.elapsed + (event.phase === 'takeover' ? 2 : 4);
        this.message(beat.caption);
      }
      else if (event.type === 'boost') { this.message(p.boost); this.comic(`甩尾 ${['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][event.tier]} · 工業集成噴射`, this.character === 'si' ? '未核准起飛' : '椅動辦公：加速'); }
      else if (event.type === 'gas') { this.message(this.character === 'si' ? '祀：加一點氣態息壤。　小聰明：你把理智也氣化了？！' : '莊芳宜：借過。　龍泡泡：我不是法術彈藥！！'); this.comic(e.isZhuang ? '法術加速' : '氣態息壤噴射', e.isZhuang ? '獎品，我拿定了' : '氣態息壤，固態嘴硬'); }
      else if (event.type === 'pickup') { this.message(e.isZhuang ? '系統：息壤補充，施法次數 ＋1。' : '系統：拾取氣態息壤。剩餘理智：不負責保管。'); this.comic('道具補充', e.isZhuang ? '法術 ＋1' : '噴射罐 ＋1'); }
      else if (event.type === 'spin') { this.message(p.spin); this.comic('三級大甩尾', this.character === 'si' ? '誰在開誰？！' : '座椅：我先轉了'); }
      else if (event.type === 'ink') this.message(`系統：墨印已簽收。　${p.companion}：先簽收我！！`);
      else if (event.type === 'sector') { const s = e.config.sectors[event.sector]; this.message(s.caption); this.comic(`第 ${event.sector + 1} 路段`, s.name); }
      else if (event.type === 'finish') this.message(p.finish);
      else if (event.type === 'collision') { this.message(p.bump); this.comic(`咚！撞到${event.kind}`, this.character === 'si' ? '帝江號 → 抵牆號' : '人還在上班，椅子已離職'); }
    }
    if (!events.length && e.state === 'playing' && e.elapsed > (this.messageUntil || 0)) this.message(p.idle[Math.floor(e.elapsed / 5) % p.idle.length]);
    if (e.elapsed >= (this.comicUntil || 0)) this.$('#ride-comic').hidden = true;
    this.$('#ride-story').hidden = !e.isZhuang || e.elapsed >= (this.storyUntil || 0) || e.state === 'won';
    if (e.isZhuang && e.elapsed < this.storyUntil) this.$('#ride-comic').hidden = true;
    this.updateMeters();
    this.root.dataset.boost = String(e.boost > 0 || e.gasTime > 0);
    if (before !== e.state) { this.clearInput(); this.render(); }
  }
  dispose() { document.removeEventListener('keydown', this.onGasKey); super.dispose(); }
}
