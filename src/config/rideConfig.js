import { raftConfig } from './raftConfig.js';

export function rideCenter(s) {
  const enter = Math.max(0, Math.min(1, (s - 260) / 80));
  const leave = 1 - Math.max(0, Math.min(1, (s - 630) / 80));
  return Math.sin(s * .013) * 14 + Math.sin(s * .031) * 6 + Math.sin((s - 260) * .045) * 8 * enter * leave;
}

export const rideConfig = {
  ...raftConfig,
  center: rideCenter,
  length: 900,
  speed: 19,
  brakeSpeed: 11,
  maxSpeed: 34,
  roadHalfWidth: 10.5,
  riverHalfWidth: 13,
  edge: 8.2,
  actorHeight: 2.6,
  ropeLength: 3.3,
  maxRopeLength: 7.5,
  driving: { turn: .57, driftTurn: .95, grip: 5.5, driftGrip: .85, sidePower: .7, curveForce: .6, acceleration: 3.2, boostSpeed: 8, boostSeconds: 1.5, minDriftSpeed: 7 },
  gas: { start: 1, capacity: 2, seconds: 3.2, speed: 14 },
  obstacles: [
    { s: 95, offset: 0, radius: 1 }, { s: 150, offset: -5, radius: 1.2 },
    { s: 210, offset: 4, radius: 1.1 }, { s: 290, offset: -2, radius: 1.3 },
    { s: 350, offset: -5, radius: 1.1 }, { s: 350, offset: 4.5, radius: 1.1 },
    { s: 425, offset: 0, radius: 1.3 }, { s: 500, offset: 5, radius: 1.1 },
    { s: 565, offset: -4, radius: 1.2 }, { s: 645, offset: 1.5, radius: 1.3 },
    { s: 710, offset: -5, radius: 1.1 }, { s: 710, offset: 4.5, radius: 1.1 },
    { s: 790, offset: 0, radius: 1.3 }, { s: 850, offset: -4, radius: 1.1 },
  ],
  stamps: Array.from({ length: 15 }, (_, i) => ({ s: 45 + i * 57, offset: [0, -4, 4, -2, 2][i % 5] })),
  pickups: [
    { s: 65, offset: 0 }, { s: 190, offset: -3.5 }, { s: 335, offset: 3 },
    { s: 470, offset: -3 }, { s: 610, offset: 4 }, { s: 760, offset: 0 },
  ],
  sectors: [{ s: 0, name: '清波寨快速路', caption: '工作地點：持續移動中' }, { s: 300, name: '連彎工業區', caption: '氣態息壤，固態嘴硬' }, { s: 650, name: '禁止正常上班', caption: '前方簽到，禁止超速辦公' }],
};

// Gentle first turns, a straight sponsor zone, then alternating larger bends.
const zhuangTurns = [[0, 0], [240, 0], [420, 30], [630, -35], [830, 38], [1050, -40], [1280, 36], [1500, -38], [1750, 24], [1950, 24], [2150, -30], [2370, 36], [2600, 0]];
export function zhuangCenter(s) {
  if (s <= 0) return 0;
  for (let i = 1; i < zhuangTurns.length; i++) {
    const [end, x] = zhuangTurns[i], [start, previous] = zhuangTurns[i - 1];
    if (s <= end) {
      const t = (s - start) / (end - start), blend = t ** 3 * (10 + t * (-15 + 6 * t));
      return previous + (x - previous) * blend;
    }
  }
  return 0;
}
export const zhuangRideConfig = {
  ...rideConfig, center: zhuangCenter, length: 2600, actorHeight: 3,
  roadHalfWidth: 7.5, riverHalfWidth: 10, edge: 6,
  ropeLength: 2.8, maxRopeLength: 6.4,
  driving: { ...rideConfig.driving, turn: .3, driftTurn: .42, grip: 6.5, driftGrip: 2.8, curveForce: 2, acceleration: 1.8 },
  obstacles: [{ s: 740, offset: 5.4, radius: .7, name: '臨時會議' }, { s: 1450, offset: -5.4, radius: .7, name: '緊急簽核' }],
  stamps: [],
  pickups: [480, 790, 1120, 1440, 1770, 2080, 2370].map(s => ({ s, offset: 0 })),
  sectors: [{ s: 0, name: '龍泡泡帶薪兜風', caption: '' }, { s: 420, name: '莊芳宜搶獎品', caption: '' }, { s: 1900, name: '禁止飛行辦公', caption: '' }],
  petHazards: [580, 820, 1050, 1280, 1500, 1720].map((s, i) => ({ s, offset: i % 2 ? 4.2 : -4.2, radius: .8, name: ['加班打卡機', '待辦事項', '會議邀請', '休假申請', '績效考核', '禁止內卷'][i] })),
  airHazards: [1985, 2080, 2175, 2270, 2365, 2460, 2545].flatMap(s => [-1, 1].map(side => ({ s, offset: side * 5.5, height: 6.8, width: 8, tall: 3, name: side < 0 ? '反內卷結界' : '空中考勤' }))),
};

export const rideProfiles = {
  si: {
    name: '祀', vehicle: '漂浮迷你帝江號', companion: '小聰明', hover: .95,
    source: 'https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7',
    title: '帝江號，怎麼祀你在開？',
    intro: '900 公尺寬路甩尾！祀坐迷你帝江號，小聰明被迫當風箏。方向＋煞車蓄甩尾，放開噴射；氣態息壤可再加速。',
    start: '祀：縮小了，應該不用申請航線吧。',
    boost: '系統：航線未核准。　祀：那就飛快一點。',
    bump: '小聰明：這不是帝江號，是抵牆號！！',
    spin: '祀：船頭在哪？　小聰明：先問我在哪！！',
    finish: '小聰明：下次你掛在後面。',
    idle: ['祀：這叫便攜式帝江號。　小聰明：我叫便攜式乘客嗎？', '系統：請勿將旗艦作為個人代步工具。', '祀：不用怕，我畫過說明書。　小聰明：你畫的？！'],
  },
  zhuang: {
    name: '莊芳宜', vehicle: '失控辦公椅', companion: '龍泡泡', hover: 0,
    source: 'https://sketchfab.com/3d-models/zhuang-fangyi-arknights-endfield-51d669eb7ef94cb49aeeaf2d9541d9de',
    title: '本來只想讓她下班。',
    intro: '龍泡泡拉阿莊出門休息。結果休息的是她，受罪的是牠。管理員贊助的獎品，到底誰先拿到？',
    start: '龍泡泡：阿莊，加班太久了！',
    boost: '工業集成系統：椅動辦公，效率翻倍。',
    bump: '莊芳宜：椅子留下。　系統：人已經出去了。',
    spin: '系統：座椅已轉向，工作態度保持不變。',
    finish: '莊芳宜：獎品呢？　龍泡泡：地上撞完，天上也撞？！',
    idle: ['莊芳宜：管理員贊助的，當然要認真。　龍泡泡：也不用這麼認真！！', '龍泡泡：我帶你來放假，不是帶我來加班！！', '莊芳宜：扶手抓穩。　龍泡泡：我沒有扶手！！'],
  },
};

// IDs belong to the two supplied GLBs, whose labels are partly lost in export.
// Each chain is validated before use; no rig is inferred for uploaded files.
export const seatedRigNodes = {
  si: { pelvis: 11, spine: 73, head: 77, thighL: 38, kneeL: 39, footL: 40, thighR: 68, kneeR: 69, footR: 70, armL: 256, elbowL: 258, wristL: 260, armR: 379, elbowR: 381, wristR: 383 },
  zhuang: { pelvis: 13, spine: 80, head: 83, thighL: 55, kneeL: 56, footL: 57, thighR: 33, kneeR: 34, footR: 35, armL: 338, elbowL: 340, wristL: 342, armR: 385, elbowR: 387, wristR: 389 },
};
