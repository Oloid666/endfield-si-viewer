import { climbConfig } from '../config/climbConfig.js';

// Integer-grid collision and support rules; no Three.js, timers or rigid bodies.
export class ClimbEngine {
  constructor(config = climbConfig) { this.config = config; this.reset(); }

  reset() {
    const c = this.config;
    this.blocks = [];
    for (let x = 0; x < c.width; x++) for (let y = 0; y < c.columns[x]; y++) {
      const fragile = x === c.fragile.x && y === c.fragile.y;
      this.blocks.push({ id: `fixed-${x}-${y}`, x, y, kind: fragile ? 'fragile' : 'fixed', crack: null });
    }
    this.blocks.push(...c.crates.map(b => ({ ...b, kind: 'crate', crack: null })));
    this.player = { ...c.start, facing: 1 };
    this.state = 'idle'; this.clock = 0; this.elapsed = 0; this.exposure = 0;
    this.carry = false; this.called = false; this.answer = null; this.reason = '';
    this.history = []; this.moves = 0; this.pushes = 0; this.undos = 0;
    this.lastMoveAt = -Infinity; this.lastAction = null;
  }
  start() { this.reset(); this.state = 'playing'; }
  get waste() { return this.config.wasteStart + this.elapsed / this.config.timeLimit * (this.config.wasteEnd - this.config.wasteStart); }
  get remaining() { return Math.max(0, this.config.timeLimit - this.elapsed); }
  blockAt(x, y) { return this.blocks.find(b => b.x === x && b.y === y); }
  clearAt(x, feet) {
    return !this.blocks.some(b => b.x === x && b.y < feet + this.config.actorHeight - .08 && b.y + 1 > feet + .01);
  }
  standingAt(x, maxFeet) {
    if (x < 0 || x >= this.config.width) return null;
    const tops = this.blocks.filter(b => b.x === x && b.y + 1 <= maxFeet + .001).map(b => b.y + 1).sort((a,b) => b-a);
    return tops.find(y => this.clearAt(x, y)) ?? null;
  }
  snapshot() { return { player: { ...this.player }, blocks: this.blocks.map(b => ({ ...b })), carry: this.carry }; }
  restore(snapshot) { this.player = { ...snapshot.player }; this.blocks = snapshot.blocks.map(b => ({ ...b })); this.carry = snapshot.carry; }
  settle(crate) {
    while (crate.y > 0 && !this.blockAt(crate.x, crate.y - 1)) crate.y--;
  }
  move(direction) {
    if (this.state !== 'playing' || ![-1,1].includes(direction) || this.clock - this.lastMoveAt < this.config.moveSeconds) return null;
    const p = this.player, before = this.snapshot(), x = p.x + direction;
    const front = this.blockAt(x, p.y);
    let kind = 'walk', moved;
    if (this.carry && front?.kind === 'crate') {
      const next = x + direction;
      if (next < 0 || next >= this.config.width || this.blockAt(next, front.y)) return { kind:'blocked', message:'箱子前面沒有空位。先關搬箱，才能爬上箱子。' };
      moved = front.id; front.x = next; this.settle(front); kind = 'push';
    } else if (this.carry && !front) {
      const behind = this.blockAt(p.x - direction, p.y);
      if (behind?.kind === 'crate') { moved = behind.id; behind.x = p.x; this.settle(behind); kind = 'pull'; }
    }
    const y = this.standingAt(x, p.y + 1);
    if (y === null) { this.restore(before); return { kind:'blocked', message:'這裡太高。開啟搬箱，把亮框息壤推過來當階梯。' }; }
    if (kind === 'walk') kind = y > p.y ? 'climb' : y < p.y ? 'drop' : 'walk';
    this.history.push(before); if (this.history.length > 32) this.history.shift();
    this.player = { x, y, facing: direction }; this.moves++;
    if (moved) this.pushes++;
    this.lastMoveAt = this.clock;
    this.lastAction = { kind, from: before.player, to: { ...this.player }, block: moved, blockFrom: moved ? before.blocks.find(b=>b.id===moved) : null, at: this.clock };
    const support = this.blockAt(x, y-1);
    if (support?.kind === 'fragile' && support.crack === null) support.crack = 0;
    if (x >= (this.config.callAt ?? 4) && !this.called) { this.called = true; this.state = 'call'; }
    if (x === this.config.exit.x && y === this.config.exit.y) this.state = 'won';
    return this.lastAction;
  }
  toggleCarry() { if (this.state === 'playing') this.carry = !this.carry; }
  undo() {
    if (this.state !== 'playing' || !this.history.length || this.clock - this.lastMoveAt < this.config.moveSeconds) return false;
    this.restore(this.history.pop()); this.undos++; this.lastMoveAt = this.clock; this.lastAction = null;
    // Time, discovery and the once-only phone call never rewind.
    return true;
  }
  chooseAnswer(choice) {
    if (this.state !== 'call' || !['honest','work'].includes(choice)) return false;
    this.answer = choice; return true;
  }
  finishCall() {
    if (this.state === 'call' && this.answer) { this.state = 'playing'; this.lastMoveAt = -Infinity; }
  }
  pause() { if (this.state === 'playing') { this.state = 'paused'; return true; } return false; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
  get patrol() {
    const c = this.config.patrol, cycle = Math.floor(this.elapsed / c.period), t = this.elapsed % c.period;
    return { x: cycle % 2 ? 4.1 : 7.9, y: 3, direction: cycle % 2 ? 1 : -1,
      phase: !this.called ? 'rest' : t < c.warnSeconds ? 'warning' : t < c.warnSeconds + c.scanSeconds ? 'scan' : 'rest' };
  }
  get visibleToPatrol() {
    const e = this.patrol, p = this.player, distance = (p.x - e.x) * e.direction;
    if (e.phase !== 'scan' || Math.abs(p.y-e.y) > .5 || distance < 0 || distance > this.config.patrol.range) return false;
    const low = Math.min(p.x,e.x), high = Math.max(p.x,e.x);
    return !this.blocks.some(b => b.x !== p.x && b.x >= low && b.x <= high && b.y === e.y);
  }
  update(delta) {
    if (this.state !== 'playing' || !Number.isFinite(delta) || delta < 0) return;
    this.clock += delta;
    if (this.called) this.elapsed += delta;
    for (const b of this.blocks) if (b.kind === 'fragile' && b.crack !== null) b.crack += delta;
    this.blocks = this.blocks.filter(b => b.kind !== 'fragile' || b.crack === null || b.crack < this.config.fragileSeconds);
    const floor = this.standingAt(this.player.x, this.player.y);
    if (floor !== null && floor < this.player.y) { this.player.y = floor; this.reason = '破損息壤塌了！可以倒退一步，重走這段。'; }
    const patrol = this.config.patrol;
    this.exposure = Math.max(0, Math.min(100, this.exposure + delta * (this.visibleToPatrol ? patrol.exposureRate : -patrol.recoveryRate)));
    if (this.player.y <= this.waste + .08 || this.elapsed >= this.config.timeLimit) { this.state = 'lost'; this.reason = '祀故現場：廢液到了，你還沒到。'; }
    else if (this.exposure >= 100) { this.state = 'lost'; this.reason = '泡泡龍：找到管理員了。莊方宜：位置發我。'; }
  }
  get hint() {
    if (!this.called) return this.carry ? '搬箱已開：按 → 把亮框息壤推到高牆旁，再關搬箱，按 → 爬上去。' : '先按「搬箱」，靠近亮框息壤按 → 推動；關掉搬箱後才能踩上去。';
    if (this.player.x < 8) return '把第二塊亮框息壤推到高牆旁。箱子可以擋住搜尋；別在紅光裡停太久。';
    return '接駁口就在右上方！橘色破損息壤踩過會塌，繼續往右爬。';
  }
}
