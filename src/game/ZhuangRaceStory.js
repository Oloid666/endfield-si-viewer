const clamp = x => Math.max(0, Math.min(1, x));
export const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

export const zhuangRace = {
  sponsorAt: 7, takeoverAt: 10, raceAt: 12, impatientAt: 1750, flightAt: 1900,
  introSpeed: 14, speed: 36, maxSpeed: 70, flightSpeed: 58, flightHeight: 6,
  steeringHold: .35, petGroundRope: 4.8, petAirRope: 5.8,
  decisionScale: .18, prizeSeconds: 16,
};

// One short line at a time. The story opens immediately, on a straight road.
export const openingDialogue = [
  { at: 0, line: '龍泡泡：阿莊，加班太久了！' },
  { at: 2.6, line: '龍泡泡：給我出來兜風休息！' },
  { at: 5, line: '莊：我就坐一下，不參賽。' },
];
export const zhuangBeats = {
  drag: { title: '龍泡泡強制下班', line: openingDialogue[0].line },
  sponsor: { title: '冠軍獎品揭曉', line: '廣播：冠軍獎品，由管理員贊助！' },
  takeover: { title: '莊芳宜接管', line: '莊：……管理員？龍泡泡，坐穩。' },
  race: { title: '莊芳宜暴走', line: '龍泡泡：說好的不參賽呢？！' },
  impatient: { title: '領獎快截止了', line: '莊：獎品要被搬走了，來不及。' },
  takeoff: { title: '慢動作 · 點右下起飛', line: '龍泡泡：時間不夠，也別拿我當機翼！' },
  flight: { title: '辦公椅起飛', line: '莊：路太慢。走上面。' },
  finish: { title: '獎品到手 · 龍泡泡報廢', line: '龍泡泡：你休息了，我呢？！' },
};
export const impactLines = {
  '臨時會議': '莊：會議改線上，我人不回去。',
  '緊急簽核': '龍泡泡：都下班了，還有緊急簽核？！',
  '加班打卡機': '龍泡泡：撞一下還算加班？！',
  '待辦事項': '龍泡泡：待辦都追到路上了？！',
  '會議邀請': '龍泡泡：會議別追著我跑！！',
  '休假申請': '龍泡泡：假沒批，我先碎了！',
  '績效考核': '龍泡泡：這也算撞績效？！',
  '禁止內卷': '龍泡泡：禁止內卷，先放過我！',
  '反內卷結界': '龍泡泡：反內卷，怎麼只反我？！',
  '空中考勤': '龍泡泡：飛上來也要打卡？！',
};
export function zhuangPhase(elapsed, progress, won = false, flying = false) {
  if (won) return 'finish';
  if (flying) return 'flight';
  if (progress >= zhuangRace.flightAt) return 'takeoff';
  if (progress >= zhuangRace.impatientAt) return 'impatient';
  if (elapsed < zhuangRace.sponsorAt) return 'drag';
  if (elapsed < zhuangRace.takeoverAt) return 'sponsor';
  if (elapsed < zhuangRace.raceAt) return 'takeover';
  return 'race';
}
export function takeoverBlend(elapsed) { return smooth((elapsed - zhuangRace.takeoverAt) / (zhuangRace.raceAt - zhuangRace.takeoverAt)); }
export function flightHeight(seconds) { return zhuangRace.flightHeight * smooth(seconds / 2.4); }
