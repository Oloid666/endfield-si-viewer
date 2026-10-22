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
export const siOpeningDialogue=[
  {at:0,line:'祀：繞一圈，領墨水，回家。'},
  {at:3,line:'小聰明：領墨水需要戴安全帽嗎？'},
  {at:7,line:'廣播：冠軍獎品，管理員親自頒發！'},
  {at:10,line:'祀：……參加獎突然不香了。'},
];
export const zhuangBeats = {
  drag: { title: '龍泡泡強制下班', line: openingDialogue[0].line },
  sponsor: { title: '冠軍獎品揭曉', line: '廣播：冠軍獎品，管理員贊助並親自頒發！' },
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
export const rivalLines = {
  pass: ['祀：阿莊，獎品不等加班的人喔。', '小聰明：讓一讓，文具超車！'],
  passed: ['祀：椅子怎麼比毛筆還快？！', '莊：借過。祀：不是，真借過啊？！'],
  near: ['祀：要不要幫你的椅子畫對翅膀？', '龍泡泡：她側著坐都比你快！'],
  burst: ['祀：收筆——先收獎品！', '小聰明：這筆畫超出格子了！！'],
  finish: ['祀：管理員，獎品我先簽收囉。', '小聰明：贏了！這次不用當拖把了！'],
  windup:['祀：收筆前，先跟上喔。','小聰明：她抬手了！先抓繩子！！'],
};
export const gapLines={
  ahead:'莊：獎品先替我包好。',
  behind:'祀：阿莊，別急著下班。',
  close:'莊：妳先鬆手。祀：妳先收筆。',
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
