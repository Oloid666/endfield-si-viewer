export const characters = {
  si: { name:'祀', subtitle:'Si · 小蔥區', path:'models/si.glb', profile:'si',
    source:'https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7',
    sourceName:'Si / Arknights Endfield' },
  zhuang: { name:'莊芳宜', subtitle:'Zhuang Fangyi · 大蔥區', path:'models/zhuang-fangyi.glb', profile:'zhuang',
    viewNodes:{head:83,feet:[57,35]},
    source:'https://sketchfab.com/3d-models/zhuang-fangyi-arknights-endfield-51d669eb7ef94cb49aeeaf2d9541d9de',
    sourceName:'Zhuang Fangyi / Arknights Endfield' },
};

export const zhuangDisplayConfig = {
  cycle: 20,
  nodes: { spine:80,head:83,eyeL:85,eyeR:90,armL:338,elbowL:340,wristL:342,armR:385,elbowR:387,wristR:389 },
  lids: [[132,143],[134,142],[137,141],[146,157],[148,156],[151,155]],
};
