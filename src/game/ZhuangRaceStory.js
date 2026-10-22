import { rideConfig } from '../config/rideConfig.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t = clamp(x); return t * t * (3 - 2 * t); };

// Original fan story. Time advances only through the engine's fixed-step clock.
// The last stretch is an actual raised straight shortcut, shared by physics
// and scenery so the chair never drives through a decorative bridge.
export const zhuangRace = {
  sponsorAt: 4, takeoverAt: 8, raceAt: 10, bridgeAt: 760,
  speed: 24, maxSpeed: 40, bridgeSpeed: 36, bridgeHeight: 4.5,
};

export const zhuangBeats = {
  drag: { title: '龍泡泡領跑 · 強制下班', line: '龍泡泡：啵！（你加班太久了，出去玩！）\n莊芳宜：等等，我的文件還沒——', caption: '龍泡泡在前面拉，莊芳宜不情願地跟上。' },
  sponsor: { title: '賽事公告 · 贊助商：管理員', line: '廣播：冠軍獎品——管理員贊助的神祕獎品！\n莊芳宜：……管理員，贊助的？', caption: '龍泡泡：啵？（你怎麼突然不說要回去了？）' },
  takeover: { title: '主控權轉移 · 莊芳宜上線', line: '莊芳宜：坐好。現在換我。\n龍泡泡：啵？！（我只是帶你出來休息！！）', caption: '前後交換！現在是莊芳宜拉龍泡泡。' },
  race: { title: '莊芳宜領跑 · 法術加速解鎖', line: '莊芳宜：獎品，我拿定了。\n按「法術加速／E」；方向＋煞車甩尾，放開噴射。', caption: '龍泡泡：啵——！（放假怎麼比上班還累！！）' },
  bridge: { title: '息壤架橋 · 此處原本沒有路', line: '莊芳宜：路太繞？那就造一條。\n賽事系統：選手正在修改賽道？！', caption: '息壤橋自動通行中 · 莊芳宜：這叫合理利用專業。' },
  finish: { title: '冠軍＊ · 賽道由選手自行提供', line: '莊芳宜：獎品呢？\n龍泡泡：啵……（下次還是讓你加班吧。）', caption: '＊劇情演出冠軍，尚未加入對手 AI。' },
};

export function zhuangPhase(elapsed, progress, won = false) {
  if (won) return 'finish';
  if (progress >= zhuangRace.bridgeAt) return 'bridge';
  if (elapsed < zhuangRace.sponsorAt) return 'drag';
  if (elapsed < zhuangRace.takeoverAt) return 'sponsor';
  if (elapsed < zhuangRace.raceAt) return 'takeover';
  return 'race';
}

export function takeoverBlend(elapsed) { return smooth((elapsed - zhuangRace.takeoverAt) / (zhuangRace.raceAt - zhuangRace.takeoverAt)); }

export function bridgePoint(s, entryOffset = 0) {
  const t = clamp((s - zhuangRace.bridgeAt) / (rideConfig.length - zhuangRace.bridgeAt));
  const a = rideConfig.center(zhuangRace.bridgeAt) + entryOffset, b = rideConfig.center(rideConfig.length);
  return { x: a + (b - a) * t, y: t === 0 || t === 1 ? 0 : Math.sin(Math.PI * t) ** 2 * zhuangRace.bridgeHeight, z: -s };
}
