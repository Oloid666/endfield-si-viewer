import { raftConfig } from './raftConfig.js';

export const rideConfig = {
  ...raftConfig,
  length: 280,
  speed: 11.8,
  brakeSpeed: 5.2,
  actorHeight: 2.6,
  ropeLength: 3.3,
  maxRopeLength: 7.5,
  driving: { turn: .7, grip: 2.4, driftGrip: 1.15, acceleration: 2.3, boostSpeed: 5, boostSeconds: 1.6 },
  obstacles: [...raftConfig.obstacles, { s: 255, offset: 1.8, radius: .9 }],
};

export const rideProfiles = {
  si: {
    name: '祀', vehicle: '漂浮迷你帝江號', companion: '小聰明', hover: .95,
    source: 'https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7',
    title: '帝江號，怎麼祀你在開？',
    intro: '祀坐迷你帝江號，小聰明被迫當風箏。按住方向轉彎；同時按煞車甩尾，放開煞車會噴焰加速。',
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
    title: '椅直在上班。',
    intro: '莊芳宜坐得很端正，辦公椅完全不端正。煞車加方向甩尾，鬆開煞車加速；碰撞與急彎可能讓椅子自己轉半圈。',
    start: '莊芳宜：只是換個地方辦公。　龍泡泡：啵？',
    boost: '工業集成系統：椅動辦公，效率翻倍。',
    bump: '莊芳宜：椅子留下。　系統：人已經出去了。',
    spin: '系統：座椅已轉向，工作態度保持不變。',
    finish: '莊芳宜：到了。誰把會議室搬走了？',
    idle: ['莊芳宜：慢一點。　龍泡泡：啵！　系統：已理解為加速。', '系統：工作地點持續變更，考勤已放棄定位。', '莊芳宜：扶手很穩。　系統：其餘部分不保證。'],
  },
};

// IDs belong to the two supplied GLBs, whose labels are partly lost in export.
// Each chain is validated before use; no rig is inferred for uploaded files.
export const seatedRigNodes = {
  si: { pelvis: 11, spine: 73, head: 77, thighL: 38, kneeL: 39, footL: 40, thighR: 68, kneeR: 69, footR: 70, armL: 256, elbowL: 258, wristL: 260, armR: 379, elbowR: 381, wristR: 383 },
  zhuang: { pelvis: 13, spine: 80, head: 83, thighL: 55, kneeL: 56, footL: 57, thighR: 33, kneeR: 34, footR: 35, armL: 338, elbowL: 340, wristL: 342, armR: 385, elbowR: 387, wristR: 389 },
};
