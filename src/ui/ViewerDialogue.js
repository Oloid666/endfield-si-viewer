export function expressionBand(strength) {
  if (!Number.isFinite(strength) || strength <= 0) return -1;
  return Math.min(3, Math.ceil(strength / .5) - 1);
}

// One timed speech bubble + one system card, driven by the existing render loop.
export class ViewerDialogue {
  constructor(parent, config) {
    this.config = config; this.turns = new Map(); this.session = null;
    this.root = document.createElement('div'); this.root.className = 'viewer-dialogue'; this.root.hidden = true;
    this.speech = document.createElement('p'); this.speech.className = 'viewer-speech'; this.speech.setAttribute('role','status');
    this.card = document.createElement('div'); this.card.className = 'system-card';
    this.title = document.createElement('small'); this.body = document.createElement('span'); this.result = document.createElement('b');
    this.card.append(this.title,this.body,this.result); this.root.append(this.speech,this.card); parent.append(this.root);
  }
  expression(selection, strength) {
    this.cancel(); const band = expressionBand(strength), variants = this.config.lines[selection]?.[band];
    if (!variants) return;
    const key = `${selection}:${band}`, turn = this.turns.get(key) || 0;
    this.turns.set(key,turn+1);
    this.session = {selection,band,line:variants[turn%2],time:0};
  }
  cameraLine(line) {
    if (this.session) return false;
    this.session = {line,time:0,camera:true}; return true;
  }
  cancel() { this.session = null; this.root.hidden = true; }
  update(delta, blocked = false) {
    if (blocked) this.cancel();
    const s = this.session, c = this.config;
    this.root.hidden = !s; if (!s) return null;
    s.time += delta;
    const system = !s.camera && c.systems[s.selection]?.[s.band];
    const payoff = s.band === 3 && s.time >= c.payoffAt;
    const limit = s.camera ? c.cameraSeconds : system ? c.uiSeconds : c.lineSeconds;
    if (s.time >= limit) { this.cancel(); return null; }
    // The long signature line deliberately lands in two beats.
    let line = payoff && s.selection !== 'angry' ? c.payoffs[s.selection] : s.line;
    if (line.startsWith('原來是管理員，') && s.time < 1.15) line = '原來是管理員，';
    this.speech.textContent = line;
    this.speech.hidden = !!system && s.time > c.lineSeconds && !payoff;
    this.card.hidden = !system || s.time < .7;
    if (system) {
      this.title.textContent = system[0]; this.body.textContent = system[1];
      this.result.textContent = s.time < 2.5 ? '處理中……' : payoff && s.selection === 'angry' ? c.payoffs.angry : system[2];
      this.card.dataset.final = String(s.time >= 2.5); this.card.dataset.kind = s.selection;
    }
    this.root.dataset.camera = String(!!s.camera);
    return payoff ? {selection:s.selection} : null;
  }
  dispose() { this.cancel(); this.root.remove(); }
}
