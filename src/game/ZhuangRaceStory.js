const clamp = x => Math.max(0, Math.min(1, x));
export const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

// These original fan-story beats leave time for driving; all use the paused
// engine clock. Announcements happen on the wide, almost straight first bend.
export const zhuangRace = {
  sponsorAt: 22, takeoverAt: 25, raceAt: 27, impatientAt: 1750, flightAt: 1900,
  introSpeed: 14, speed: 36, maxSpeed: 70, flightSpeed: 58, flightHeight: 6,
  steeringHold: .35, petGroundRope: 4.8, petAirRope: 5.8,
};

export const zhuangBeats = {
  drag: { title: '龍泡泡領跑', line: '龍泡泡：下班！文件明天再說！' },
  sponsor: { title: '管理員贊助', line: '廣播：冠軍獎品，由管理員贊助。' },
  takeover: { title: '莊芳宜接管', line: '莊芳宜：……換我。' },
  race: { title: '莊芳宜暴走', line: '龍泡泡：我是帶你來休息的！！' },
  impatient: { title: '還不夠快', line: '莊芳宜：這樣太慢。' },
  flight: { title: '辦公椅起飛', line: '莊芳宜：那就不走路。' },
  finish: { title: '冠軍＊ · 地上太慢，直接飛', line: '龍泡泡：地上撞完，天上也撞？！' },
};

export function zhuangPhase(elapsed, progress, won = false) {
  if (won) return 'finish';
  if (progress >= zhuangRace.flightAt) return 'flight';
  if (progress >= zhuangRace.impatientAt) return 'impatient';
  if (elapsed < zhuangRace.sponsorAt) return 'drag';
  if (elapsed < zhuangRace.takeoverAt) return 'sponsor';
  if (elapsed < zhuangRace.raceAt) return 'takeover';
  return 'race';
}
export function takeoverBlend(elapsed) { return smooth((elapsed - zhuangRace.takeoverAt) / (zhuangRace.raceAt - zhuangRace.takeoverAt)); }
export function flightHeight(seconds) { return zhuangRace.flightHeight * smooth(seconds / 2.4); }
