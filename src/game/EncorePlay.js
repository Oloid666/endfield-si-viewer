// Visual-only ending actions. The race engine, score and finish time are never
// advanced here. Taps react now; replies use RaceEncore's existing story queue.
export function encoreCast(character, duel) {
  return duel && character === 'zhuang' ? ['zhuang', 'dragon', 'si', 'ink'] : [character, character === 'si' ? 'ink' : 'dragon'];
}

const reactions = {
  zhuang: [
    '莊：誰在轉我的椅子？龍泡泡：這次不是我！',
    '莊：只是試一下輪子。龍泡泡：妳已經試完一整條賽道了。',
    '莊：休息一下。龍泡泡：妳終於想起來我們出來幹嘛了。',
  ],
  si: [
    '祀：還沒看夠？小聰明：祂想看我滾。',
    '祀：這叫御筆轉身。小聰明：叫停車場甩尾。',
    '祀：來，打個招呼。小聰明：大家好，請勿再次出發。',
  ],
  dragon: [
    '龍泡泡：我自己滾，跟被拖著滾，是兩回事！莊：嗯，這次很穩。',
    '龍泡泡：誰戳我？！莊：管理員。龍泡泡：那……再戳一下也行。',
    '龍泡泡：這圈算加班嗎？莊：算兜風。龍泡泡：妳少來！',
  ],
  ink: [
    '小聰明：這次我自己滾，不准收拖行費。祀：行，記在創作費裡。',
    '小聰明：不要戳，墨還沒乾！祀：你剛剛滾完一整圈。',
    '小聰明：我有自己的想法。祀：說來聽聽。小聰明：下次妳掛後面。',
  ],
};

export class EncorePlay {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() {
    this.clock = 0; this.actions = new Map(); this.counts = new Map();
    this.idleIndex = 0; this.nextIdle = 1.5; this.nextTap = 0;
  }
  begin(actor, manual = false) {
    const count = this.counts.get(actor) || 0;
    const pet = actor === 'dragon' || actor === 'ink';
    const kind = pet ? (count % 2 ? 'hop' : 'roll') : (count % 2 ? 'rock' : 'twirl');
    const duration = kind === 'roll' ? 2.8 : kind === 'twirl' ? 3 : 2.2;
    this.actions.set(actor, { kind, start: this.clock, duration, direction: Math.floor(count / 2) % 2 ? -1 : 1 });
    this.counts.set(actor, count + 1);
    return manual ? reactions[actor][count % reactions[actor].length] : null;
  }
  tap(actor, cast) {
    if (!cast.includes(actor) || this.clock < this.nextTap) return null;
    // A tap never restarts a moving actor mid-roll or floods the dialogue queue.
    this.nextTap = this.clock + .8;
    if (this.actions.has(actor)) return reactions[actor][((this.counts.get(actor) || 1) - 1) % reactions[actor].length];
    return this.begin(actor, true);
  }
  update(delta, cast) {
    this.clock += Math.max(0, Math.min(delta, .12));
    for (const [actor, action] of this.actions) {
      if (!cast.includes(actor) || this.clock >= action.start + action.duration) this.actions.delete(actor);
    }
    if (this.clock < this.nextIdle || !cast.length) return;
    // Alternate the whole cast; pets get their own rolls instead of only swaying.
    const actor = cast[this.idleIndex++ % cast.length];
    if (!this.actions.has(actor)) this.begin(actor);
    this.nextIdle = this.clock + 3.3 + this.random() * 1.2;
  }
  sample(actor) {
    const action = this.actions.get(actor);
    if (!action) return null;
    const p = Math.max(0, Math.min(1, (this.clock - action.start) / action.duration));
    const ease = p * p * (3 - 2 * p), envelope = Math.sin(p * Math.PI) ** 2;
    return {
      kind: action.kind, envelope,
      roll: action.kind === 'roll' ? ease * Math.PI * 2 * action.direction : 0,
      turn: action.kind === 'twirl' ? ease * Math.PI * 2 * action.direction : 0,
      hop: action.kind === 'hop' ? Math.abs(Math.sin(p * Math.PI * 3)) * envelope * .65 : envelope * .1,
      travel: action.kind === 'roll' ? Math.sin(p * Math.PI) ** 2 * action.direction * .55 : 0,
      rock: Math.sin(p * Math.PI * 4) * envelope * (action.kind === 'rock' ? .2 : .065),
    };
  }
}
