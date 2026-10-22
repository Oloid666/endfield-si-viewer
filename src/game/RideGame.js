import { RaftGame } from './RaftGame.js';
import { RideEngine } from './RideEngine.js';
import { rideConfig, rideProfiles } from '../config/rideConfig.js';
import { zhuangBeats, zhuangRace, openingDialogue, siOpeningDialogue, impactLines, rivalLines, gapLines } from './ZhuangRaceStory.js';
import { RaceDialogue } from '../ui/RaceDialogue.js';
import { RaceEncore } from './RaceEncore.js';

// Reuse held-touch controls and pause lifecycle; keep a distinct DOM / menu entry.
export class RideGame extends RaftGame {
  constructor(root, stage, hooks) {
    super(root, stage, hooks);
    root.innerHTML = root.innerHTML.replaceAll('id="raft-', 'id="ride-');
    this.$ = selector => root.querySelector(selector.replaceAll('#raft-', '#ride-'));
    this.engine = new RideEngine(rideConfig);
    this.character = new URLSearchParams(location.search).get('rider') === 'zhuang' ? 'zhuang' : 'si';
    this.opponentEnabled = new URLSearchParams(location.search).get('ai') === '1';
    this.opponentRequest = 0; this.rivalLoading = false; this.openingIndex = -1; this.rivalQuipIndex = 0;
    this.$('#ride-card > small').textContent = `${rideConfig.length}m 寬路甩尾 · 三段路線`;
    this.$('#ride-card').insertAdjacentHTML('afterbegin', `<div class="ride-picker" role="group" aria-label="選擇坐騎"><button data-rider="si">祀 · 側坐毛筆</button><button data-rider="zhuang">莊芳宜 · 辦公椅</button></div>`);
    this.$('#ride-card .actions').insertAdjacentHTML('beforebegin', '<label id="ride-rival-option"><input id="ride-rival" type="checkbox">祀來搶獎品 · 認真模式<small>壓彎、出彎收筆加速 · 控線撿補給才有機會贏<br>關閉較省電 · 切換會重開本局</small></label><p id="ride-rival-status" role="status"></p>');
    this.$('#ride-rival').checked = this.opponentEnabled;
    this.onOpponentChange = () => { this.opponentEnabled = this.$('#ride-rival').checked; this.engine.reset(); this.clearInput(); this.stage.time = 0; this.stage.resetEffects(); this.openingIndex = -1; this.syncOpponentUrl(); this.prepareOpponent(); };
    this.$('#ride-rival').addEventListener('change', this.onOpponentChange);
    root.insertAdjacentHTML('beforeend', '<aside id="ride-prize" hidden aria-label="冠軍獎品公告"><span aria-hidden="true">🎁</span><small>冠軍獎品</small><strong>管理員贊助</strong><em>神祕獎品 · 僅限第一名</em></aside>');
    this.$('#ride-card .hint').innerHTML = '方向＋煞車：蓄甩尾Ⅰ／Ⅱ／Ⅲ，放開噴射<br>氣態息壤／E：道具噴射，最多帶兩罐<br>撞車會減速；暫停可換角色';
    this.$('#ride-card details p').innerHTML = '<a id="ride-source" target="_blank" rel="noopener noreferrer">人物模型 · Abcxyz51</a> / <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>。水墨毛筆、辦公椅與跟班均為本站二創簡模；坐姿允許衣物穿模。<a href="https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7" target="_blank" rel="noopener noreferrer">祀對手模型 · Abcxyz51</a>，同為 CC BY 4.0。';
    this.$('[data-raft="brake"]').innerHTML = '煞車<small>甩尾／放開加速</small>';
    root.querySelector('.raft-controls').insertAdjacentHTML('beforeend', '<button id="ride-gas">息壤噴射<small id="ride-gas-count">E · 1 罐</small></button>');
    root.querySelector('.raft-controls').setAttribute('aria-label', '坐騎駕駛操作');
    root.querySelector('.raft-meters').insertAdjacentHTML('afterend', '<div class="ride-drift"><label for="ride-drift-meter" id="ride-drift-label">方向＋煞車，開始甩尾</label><meter id="ride-drift-meter" min="0" max="1" value="0"></meter></div>');
    root.insertAdjacentHTML('afterbegin', '<div class="ride-vfx" aria-hidden="true"></div>');
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
      if (button.id === 'ride-gas') this.activatePower();
    };
    root.addEventListener('click', this.onClick);
    this.onGasKey = event => { if (this.active && event.code === 'KeyE' && !event.repeat && !/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) { event.preventDefault(); this.activatePower(); } };
    document.addEventListener('keydown', this.onGasKey);
    this.raceDialogue=new RaceDialogue(this.$('#ride-line'));
    this.encore=new RaceEncore();
    const settings=document.createElement('details');settings.id='ride-settings';settings.open=true;
    const summary=document.createElement('summary');summary.textContent='賽事設定與操作';settings.append(summary);
    for(const node of [this.$('.ride-picker'),this.$('#ride-rival-option'),this.$('#ride-rival-status'),this.$('#ride-card .hint'),this.$('#ride-card > details')])settings.append(node);
    this.$('#ride-card').append(settings);
  }

  get profile() { return rideProfiles[this.character]; }
  enter() { this.encore.reset();this.endingStarted=false;this.siOpeningIndex=-1;this.engine.setCharacter(this.character); this.stage.setCharacter(this.character); super.enter(); this.comicUntil = this.nextQuipAt = 0; this.openingIndex = -1; this.pickupFlashUntil = 0; this.rivalTaunt = false; this.$('#ride-comic').hidden = true; this.message(this.profile.start); this.prepareOpponent(); }
  start(restart = false) {
    if (this.rivalLoading) return;
    const resume = this.engine.state === 'paused' && !restart;
    super.start(restart);
    if (!this.ready) return;
    if (!resume) {
      this.encore.reset();this.$('#ride-settings').open=true;this.stage.encoreReady=false;
      this.stage.lastTime = this.stage.lastSpins = this.stage.lastBumps = this.stage.seatSpin = 0;
      this.stage.shotUntil = 0;
      this.stage.resetEffects();
      this.stage.brushSeat.rotation.y = this.stage.chairSeat.rotation.y = Math.PI;
      this.$('#ride-comic').hidden = true; this.comicUntil = 0;
      this.nextQuipAt = 0; this.openingIndex = -1; this.pickupFlashUntil = 0; this.rivalTaunt = false;
      this.rivalQuipIndex = 0;
      this.siOpeningIndex=-1;
      this.endingStarted=false;
      this.message(this.profile.start);
    }
  }

  message(text,mood=null){
    if(!this.raceDialogue){super.message(text);return;}
    const e=this.engine;
    const clock=e.elapsed+(e.state==='won'?this.encore.clock:0);
    const duration=this.raceDialogue.set(text,clock,this.character,mood,e.state==='won'?0:e.petGrudge);
    this.messageUntil=clock+duration;return duration;
  }

  gameplayLine(events){
    if(events.some(event=>event.type==='jump-fail'))return this.engine.isZhuang?'龍泡泡：坑我就算了，還真有坑？！':'小聰明：領墨水怎麼還要填坑？！';
    if(events.some(event=>event.type==='grudge'))return this.engine.isZhuang?'龍泡泡：剛剛三根柱子，我都有記。':'小聰明：三次了！這筆帳我記住了！';
    if(events.some(event=>event.type==='jump'))return this.engine.isZhuang?'龍泡泡：還好，我沒——等、等等！！':'小聰明：你過去了，我呢？！';
    if(events.some(event=>event.type==='jump-warning'))return '系統：對準黃色跳板，保留速度！';
    if(events.some(event=>event.type==='jump-land'))return this.engine.isZhuang?'莊：過來了。龍泡泡：我的靈魂還沒！':'祀：一筆帶過。小聰明：帶的是我啊！';
    if(events.some(event=>event.type==='grudge-calm'))return this.engine.isZhuang?'龍泡泡：先原諒一根柱子。':'小聰明：這段還行，先不告狀。';
    const gap=events.find(event=>event.type==='gap');return gap?gapLines[gap.band]:null;
  }
  render() {
    super.render();
    if (!this.active) return;
    const e = this.engine, p = this.profile;
    this.root.dataset.rider = this.character;
    if (!e.isZhuang) this.$('#ride-line').hidden = false;
    this.root.querySelector('.raft-hud h2').textContent = `${p.name} · ${p.vehicle}`;
    this.$('#ride-title').textContent = e.state === 'paused' ? '先停一下，也可以換車。' : e.state === 'won' ? '系統：已抵達，請停止辦公。' : p.title;
    this.$('#ride-description').textContent = p.intro;
    this.$('#ride-start').textContent = !this.ready ? `正在準備${p.name}…` : e.state === 'paused' ? '繼續失控' : e.state === 'won' ? '再失控一次' : '坐穩 · 出發';
    this.$('#ride-source').href = p.source;
    this.$('#ride-source').textContent = `${p.name}模型 · Abcxyz51`;
    this.$('#ride-gas').firstChild.textContent = e.isZhuang ? '✦' : '息壤噴射';
    this.$('[data-raft="brake"]').hidden = e.isZhuang;
    this.$('#ride-card > small').textContent = e.isZhuang ? '兜風 12 秒 → 搶獎品 → 你按鍵起飛' : `${e.config.length}m 寬路甩尾 · 三段路線`;
    this.$('#ride-card .hint').innerHTML = e.isZhuang ? '按住 ◀ ▶ 轉向，持續轉彎甩尾、回正加速<br>✦／E：莊接管後解鎖法術；拾取息壤補次數<br>藍色＋1：撿取補充；金色✦：按下加速<br>最後慢動作等你按 ⇧ 起飛，起飛不消耗次數' : '方向＋煞車：蓄甩尾Ⅰ／Ⅱ／Ⅲ，放開噴射<br>氣態息壤／E：道具噴射，最多帶兩罐<br>撞車會減速；暫停可換角色';
    if (e.state === 'won' && !e.isZhuang) {
      this.$('#ride-result').textContent = `${e.elapsed.toFixed(1)} 秒 · 最高 ${(e.topSpeed * 3.6).toFixed(0)} km/h\n甩尾 ${Math.floor(e.driftPoints)} 分／噴射 ${e.driftCount} 次\n墨印 ${e.ink.size}/${e.config.stamps.length} · 碰撞 ${e.bumps} 次 · 息壤 ${e.gasUsed} 罐\n${p.finish}`;
    }
    this.$('#ride-rival-option').hidden = !e.isZhuang;
    if (e.isZhuang && e.state === 'won') {
      this.$('#ride-title').textContent = e.outcome === 'rival' ? '祀先把獎品領走了？！' : e.outcome === 'late' ? '領獎處下班了。' : zhuangBeats.finish.title;
      const ending = e.outcome === 'rival' ? '祀：謝謝管理員。莊：再跑一局。\n少撞牆、撿藍色＋1，回正甩尾後接 ✦。' : e.outcome === 'late' ? '龍泡泡：假沒休到，獎也沒領到。' : e.rival.enabled ? '祀：椅子贏了毛筆？！莊：獎品，我的。' : zhuangBeats.finish.line;
      this.$('#ride-result').textContent = `${e.elapsed.toFixed(1)} 秒 · 最高 ${(e.topSpeed * 3.6).toFixed(0)} km/h\n龍泡泡：地上撞 ${e.petGroundBumps} 次／天上撞 ${e.petAirBumps} 次\n${ending}\n${e.rival.enabled ? '祀 AI 對戰' : '單人故事模式'}`;
    }
    if (this.rivalLoading) { this.$('#ride-start').disabled = true; if (this.ready) this.$('#ride-start').textContent = '祀正在上車…'; }
    if(e.state==='won'&&!this.endingStarted){this.endingStarted=true;this.encore.start();this.stage.encoreReady=false;this.$('#ride-settings').open=false;this.$('#ride-comic').hidden=true;this.$('#ride-prize').hidden=true;}
    if(e.state==='won'){for(const key of ['boost','gas','impact','slow','refill'])this.root.dataset[key]='false';this.root.dataset.pace='calm';}
    if(e.state!=='won')this.$('#ride-settings').open=true;
    for (const button of this.root.querySelectorAll('[data-rider]')) button.setAttribute('aria-pressed', String(button.dataset.rider === this.character));
  }

  comic(tag, text) {
    this.$('#ride-comic-tag').textContent = tag; this.$('#ride-comic-text').textContent = text;
    this.$('#ride-comic').hidden = false; this.comicUntil = this.engine.elapsed + 2;
  }
  updateMeters() {
    super.updateMeters();
    const e = this.engine;
    if (e.isZhuang) { this.updateZhuangMeters(); return; }
    this.$('#ride-distance').textContent = `便道 ${Math.floor(e.progress / e.config.length * 100)}%`;
    this.$('#ride-score').textContent = `墨印 ${e.ink.size}/${e.config.stamps.length} · 甩尾 ${Math.floor(e.driftPoints)}`;
    this.$('#ride-speed').textContent = `${e.gasTime ? e.isZhuang ? '法術 ' : '息壤 ' : e.boost ? '噴射 ' : ''}${(e.speed * 3.6).toFixed(0)} km/h`;
    this.root.querySelector('.raft-hud small').textContent = `${e.config.sectors[e.sector].name} · ${Math.floor(e.progress)}/${e.config.length}m`;
    this.$('#ride-drift-meter').value = e.charge;
    const tiers = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'];
    this.$('#ride-drift-label').textContent = e.isDrifting ? `甩尾 ${tiers[e.driftTier] || '蓄力中'} · ${e.driftTier ? '放開煞車噴射！' : '繼續壓彎'}` : e.boost ? '甩尾噴射中！' : '方向＋煞車，蓄甩尾放開噴射';
    this.root.dataset.tier = String(e.driftTier); this.root.dataset.impact = String(e.hit > .25); this.root.dataset.gas = String(e.gasTime > 0);
    this.root.dataset.story = e.storyPhase || '';
    this.$('#ride-gas-count').textContent = e.state === 'won' ? '已完賽' : e.gasTime ? `噴射中 · ${e.gasLeft}` : `E · ${e.gasLeft} 罐`;
    this.$('#ride-gas').setAttribute('aria-label', `氣態息壤噴射，剩餘 ${e.gasLeft} 罐`);
    this.$('#ride-gas').disabled = !this.ready || e.state !== 'playing' || !e.gasLeft || e.gasTime > 0;
  }
  update(delta) {
    if (!this.active) return;
    const e = this.engine, before = e.state, p = this.profile;
    if(e.state==='won'){
      // Results and race clocks remain frozen; only this visual/skit clock runs.
      const line=this.encore.update(delta,e,this.character);
      if(line)this.encore.restAfter(this.message(line));
      const clock=e.elapsed+this.encore.clock;this.raceDialogue.update(clock);
      this.$('#ride-line').hidden=clock>=this.messageUntil;
      const part=this.raceDialogue.parts?.[this.raceDialogue.index];
      this.stage.updateEncore(e,delta,{...part,gesture:this.encore.gesture,talking:clock<this.messageUntil});
      return;
    }
    e.update(delta, this.input); this.stage.update(e, delta * e.timeScale);
    this.raceDialogue.update(e.elapsed);
    const events = e.takeEvents();
    if (e.isZhuang) {
      this.updateZhuang(events);
      if (before !== e.state) { this.clearInput(); this.render(); }
      return;
    }
    for (const event of events) {
      if (event.type === 'boost') { this.message(p.boost); this.comic(`甩尾 ${['', 'Ⅰ', 'Ⅱ', 'Ⅲ'][event.tier]} · 工業集成噴射`, this.character === 'si' ? '未核准起飛' : '椅動辦公：加速'); }
      else if (event.type === 'gas') { this.message(this.character === 'si' ? '祀：加一點氣態息壤。　小聰明：你把理智也氣化了？！' : '莊芳宜：借過。　龍泡泡：我不是法術彈藥！！'); this.comic(e.isZhuang ? '法術加速' : '氣態息壤噴射', e.isZhuang ? '獎品，我拿定了' : '氣態息壤，固態嘴硬'); }
      else if (event.type === 'pickup') { this.message(e.isZhuang ? '系統：息壤補充，施法次數 ＋1。' : '系統：拾取氣態息壤。剩餘理智：不負責保管。'); this.comic('道具補充', e.isZhuang ? '法術 ＋1' : '噴射罐 ＋1'); }
      else if (event.type === 'spin') { this.message(p.spin); this.comic('三級大甩尾', this.character === 'si' ? '誰在開誰？！' : '座椅：我先轉了'); }
      else if (event.type === 'ink') this.message(`系統：墨印已簽收。　${p.companion}：先簽收我！！`);
      else if (event.type === 'sector') { const s = e.config.sectors[event.sector]; this.message(s.caption); this.comic(`第 ${event.sector + 1} 路段`, s.name); }
      else if (event.type === 'finish') this.message(p.finish);
      else if (event.type === 'collision') { this.message(p.bump); this.comic(`咚！撞到${event.kind}`, this.character === 'si' ? '御筆飛行 → 御筆撞牆' : '人還在上班，椅子已離職'); }
    }
    if (!events.length && e.state === 'playing' && e.elapsed > (this.messageUntil || 0)) this.message(p.idle[Math.floor(e.elapsed / 5) % p.idle.length]);
    const siBeat=siOpeningDialogue.findLastIndex(line=>e.elapsed>=line.at);
    if(e.elapsed<14&&siBeat!==this.siOpeningIndex){this.siOpeningIndex=siBeat;this.message(siOpeningDialogue[siBeat].line);}
    const gameplay=this.gameplayLine(events);if(gameplay)this.message(gameplay);
    if (e.elapsed >= (this.comicUntil || 0)) this.$('#ride-comic').hidden = true;
    this.updateMeters();
    this.root.dataset.boost = String(e.boost > 0 || e.gasTime > 0);
    if (before !== e.state) { this.clearInput(); this.render(); }
  }
  updateZhuangMeters() {
    const e = this.engine, phase = zhuangBeats[e.storyPhase];
    this.root.dataset.story = e.storyPhase; this.root.dataset.slow = String(e.takeoffPending); this.root.dataset.tutorial = String(e.elapsed < 6);
    this.root.dataset.pace = e.flying ? 'flight' : e.elapsed >= zhuangRace.raceAt ? 'fast' : 'calm';
    this.root.dataset.tier = String(e.driftTier); this.root.dataset.impact = String(e.pet.hit > .3);
    this.root.dataset.gas = String(e.gasTime > 0); this.root.dataset.boost = String(e.boost > 0 || e.gasTime > 0 || e.flying);
    this.root.querySelector('.raft-hud small').textContent = phase?.title || '龍泡泡兜風';
    this.$('#ride-distance').textContent = `${Math.floor(e.progress / e.config.length * 100)}%${e.prizeRemaining !== null ? ` · 領獎 ${e.prizeRemaining.toFixed(1)}s` : ''}`;
    const gap = Math.round(e.rival.progress - e.progress);
    const rivalMove = e.rival.windup ? ' · 蓄墨' : e.rival.burst ? ' · 收筆！' : e.rival.cornering ? ' · 壓彎' : '';
    this.$('#ride-score').textContent = e.rival.enabled ? e.rival.finished ? '祀已衝線' : (gap > 0 ? `祀領先 ${gap}m` : `領先祀 ${-gap}m`) + rivalMove : e.petGrudge>=3?`泡泡記仇 ${e.petGrudge}`:`泡泡 ${e.petBumps} 撞`;
    this.$('#ride-speed').textContent = `${(e.speed * 3.6).toFixed(0)} km/h`;
    this.$('#ride-drift-meter').value = e.charge;
    const locked = e.elapsed < zhuangRace.raceAt;
    this.$('#ride-gas').firstChild.textContent = e.takeoffPending ? '⇧' : '✦';
    this.$('#ride-gas-count').textContent = e.state === 'won' ? '完賽' : e.takeoffPending ? '點我起飛' : locked ? '接管後解鎖' : e.gasTime ? '加速中' : !e.gasLeft ? '撿藍色＋1' : e.elapsed < this.pickupFlashUntil ? `＋1 · ${e.gasLeft} 次` : `${e.gasLeft} 次`;
    this.$('#ride-gas').setAttribute('aria-label', e.takeoffPending ? '立即起飛，不消耗加速次數' : `法術加速，剩餘 ${e.gasLeft} 次`);
    this.$('#ride-gas').disabled = !this.ready || e.state !== 'playing' || (!e.takeoffPending && (!e.gasLeft || e.gasTime > 0 || locked));
    this.root.dataset.refill = String(e.elapsed < this.pickupFlashUntil);
    this.$('#ride-prize').hidden = e.state !== 'playing' || !['sponsor', 'takeover'].includes(e.storyPhase);
    for (const button of this.root.querySelectorAll('[data-raft]')) button.disabled = e.state !== 'playing';
  }

  updateZhuang(events) {
    const e = this.engine;
    this.$('#ride-comic').hidden = true;
    const story = events.findLast(event => event.type === 'story');
    if (story) {
      this.message(zhuangBeats[story.phase].line); this.messageUntil = e.elapsed + 2.8;
      this.nextQuipAt = e.elapsed + 3.5;
    }
    if (e.elapsed < zhuangRace.sponsorAt) {
      const index = openingDialogue.findLastIndex(line => e.elapsed >= line.at);
      if (index !== this.openingIndex) { this.openingIndex = index; this.message(openingDialogue[index].line); this.messageUntil = e.elapsed + 2.8; }
    } else if (!story && e.rival.enabled && !this.rivalTaunt && e.elapsed >= 15 && e.elapsed < 22) {
      this.message(this.engine.rival.style==='early'?'祀：獎品只有一份，我先收筆！':'祀：先讓妳跑一段，我留著墨呢。'); this.rivalTaunt = true; this.nextQuipAt = e.elapsed + 4;
    } else if (!story && e.takeoffPending && e.elapsed >= this.messageUntil) {
      this.message('點右下 ⇧ 起飛，龍泡泡不負責降落！');
    } else if (!story && e.elapsed >= this.nextQuipAt && e.state === 'playing') {
      const hit = events.find(event => event.type === 'pet-hit' || event.type === 'collision');
      const gameplay=this.gameplayLine(events);
      const rival = ['finish', 'passed', 'pass', 'near', 'windup', 'burst'].map(action => events.find(event => event.type === 'rival' && event.action === action)).find(Boolean);
      if(gameplay){this.message(gameplay);this.nextQuipAt=Math.max(e.elapsed+4,this.messageUntil+.5);}
      else if (rival) { this.message(rivalLines[rival.action][this.rivalQuipIndex++ % 2]); this.nextQuipAt = e.elapsed + 4; }
      else if (hit) { this.message(impactLines[hit.kind] || '龍泡泡：撞的是我！！'); this.nextQuipAt = e.elapsed + 4; }
      else if (events.some(event => event.type === 'gas')) { this.message('莊：獎品，我拿定了。'); this.nextQuipAt = e.elapsed + 4; }
    }
    // A jump or finish-gap cue must survive collision chatter / quip cooldowns.
    const urgent=events.filter(event=>['jump-warning','jump','jump-fail','grudge','gap'].includes(event.type));
    if(urgent.length&&!e.takeoffPending&&e.elapsed>=zhuangRace.raceAt){this.message(this.gameplayLine(urgent));this.nextQuipAt=Math.max(e.elapsed+4,this.messageUntil+.5);}
    if (events.some(event => event.type === 'pickup')) this.pickupFlashUntil = e.elapsed + 1.2;
    this.$('#ride-line').hidden = e.elapsed >= this.messageUntil || e.state !== 'playing';
    this.updateZhuangMeters();
  }

  activatePower() {
    if (this.engine.takeoffPending) this.engine.requestTakeoff(); else this.engine.useGas();
    this.updateMeters();
  }
  syncOpponentUrl() {
    if (!this.active) return;
    const url = new URL(location.href); url.searchParams.set('ai', this.opponentEnabled ? '1' : '0');
    history.replaceState(null, '', url);
  }
  async prepareOpponent() {
    const request = ++this.opponentRequest;
    const enabled = this.character === 'zhuang' && this.opponentEnabled;
    this.rivalLoading = enabled; this.engine.setOpponent(false);
    this.$('#ride-rival-status').textContent = enabled ? '祀正在上車…' : '';
    this.render();
    try {
      const ready = await this.stage.opponent?.setEnabled(enabled);
      if (request !== this.opponentRequest || !this.active) return;
      this.engine.setOpponent(enabled && ready);
      this.$('#ride-rival-status').textContent = ready ? '祀已就位：這次不放水，獎品只有一份喔。' : '';
    } catch {
      if (request !== this.opponentRequest || !this.active) return;
      this.opponentEnabled = false; this.$('#ride-rival').checked = false;
      this.engine.setOpponent(false); this.syncOpponentUrl();
      this.$('#ride-rival-status').textContent = '祀暫時沒趕上，先玩單人；可重新勾選再試。';
    } finally { if (request === this.opponentRequest) { this.rivalLoading = false; this.render(); } }
  }
  leave() {
    ++this.opponentRequest; this.rivalLoading = false;
    this.stage.opponent?.setEnabled(false); super.leave();
  }

  dispose() { this.$('#ride-rival').removeEventListener('change', this.onOpponentChange); document.removeEventListener('keydown', this.onGasKey); super.dispose(); }
}
