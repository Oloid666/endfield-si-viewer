import { rideConfig } from './rideConfig.js';

// Original fan-game courses using Endfield terms, not official maps or rules.
const definitions = [
  {
    id:'wuling',type:'bridge',character:'zhuang',name:'武陵 · 息壤不是提款機',tag:'試玩 1 · 現場造橋',
    title:'路沒修好，會還是要開。',
    intro:'莊芳宜要去開會，施工單卻先到了。接近黃色斷橋框時按「造橋」，三次息壤剛好補三個缺口；漏一座就會掉下去被龍泡泡撈回。',
    objective:'三座橋全補上，75 秒內抵達',power:'▦',powerName:'息壤造橋',
    opening:'龍泡泡：前面沒路！莊：那就現場生成。龍泡泡：我問的是妳怎麼還在上班！',
    idle:['莊：這條路，預算多少？龍泡泡：三次法術，零次下班。','龍泡泡：妳的會議室在哪？莊：路修到哪，就開到哪。'],
    success:'莊：路修好了，順便把會開完。龍泡泡：橋是三座，加班是無限。',
    failure:'龍泡泡：差的那座橋呢？莊：列入待辦。龍泡泡：我已經掉進待辦裡了！',
    endingWin:'莊：三座橋，全數驗收。龍泡泡：我能驗收休假嗎？',endingFail:'龍泡泡：施工失敗，請勿直接進入會議！莊：再修一次。',
    banter:['龍泡泡：這橋有名字嗎？莊：臨時會議橋。龍泡泡：妳不要每個地方都開會！','莊：施工單，簽一下。龍泡泡：我只有爪印，沒有同意加班。','龍泡泡：下次換我坐椅子。莊：可以，妳來寫驗收報告。龍泡泡：我突然很喜歡游泳。','莊：管理員說謝謝。龍泡泡：能把謝謝換成休假嗎？'],
    length:1050,speed:23,limit:75,sky:0xc3d6c8,road:0x455e5c,rail:0xdbbf76,accent:0xead17c,
    gaps:[220,520,820].map(s=>({start:s,end:s+25})),
  },
  {
    id:'valley',type:'cargo',character:'si',name:'四號谷地 · 我不是快遞',tag:'試玩 2 · 跟班分揀',
    title:'人事把小聰明分到物流了。',
    intro:'祀的免費墨水被分錯倉，小聰明只好當掃貨機。左右移動讓後面的跟班碰到金色包裹；青色輸送帶會橫推，按「反轉」改變方向。',
    objective:'跟班收齊至少 4／6 件，70 秒內簽收',power:'⇄',powerName:'反轉輸送帶',
    opening:'祀：拿六件快遞，很快。小聰明：為什麼條碼貼在我頭上？！',
    idle:['祀：這叫工業集成。小聰明：我看是工傷集成。','小聰明：這箱是什麼？祀：墨水。小聰明：旁邊那箱呢？祀：你的績效。'],
    success:'祀：快遞簽收了。小聰明：我也快被簽進去了。',failure:'小聰明：漏件了！祀：再跑一趟。小聰明：我不是包郵！',
    endingWin:'祀：簽收完成，墨水歸我。小聰明：維修單也請簽收。',endingFail:'小聰明：貨還沒齊！祀：那就祀後補寄。',
    banter:['小聰明：我頭上的條碼呢？祀：先留著，下次免排隊。','祀：這叫自動分揀。小聰明：哪裡自動？我每一件都撞得很主動！','小聰明：為什麼墨水比我貴？祀：因為你還會自己回來。','祀：要五星好評喔。小聰明：一星給箱子，四星給我的工傷。'],
    length:1000,speed:21,limit:70,sky:0xcbb193,road:0x454b4b,rail:0xd89b5c,accent:0x82d6d1,
    packages:[180,320,460,600,740,880].map((s,i)=>({s,offset:[0,-3.6,3.6,-3.6,3.6,0][i]})),
    belts:[{start:230,end:400,force:2.1},{start:480,end:670,force:-2.5},{start:710,end:930,force:2.8}],
  },
  {
    id:'dijiang',type:'phase',character:'zhuang',name:'帝江號 · 下班協議',tag:'試玩 3 · 協議穿門',
    title:'休假一天，考勤門六道。',
    intro:'佩利卡要管理員補簽名，莊芳宜卻順手接了單。左右找綠色通道，或抓時機按「協議穿越」穿過紅色考勤門；技能有 3.2 秒冷卻。',
    objective:'六道門最多失誤一次，60 秒內送達',power:'◇',powerName:'協議穿越',
    opening:'龍泡泡：說好只送簽名，怎麼在天上？！莊：順路。',
    idle:['莊：協議允許通行。龍泡泡：那休假協議呢？','龍泡泡：佩利卡又來電了！莊：告訴她，正在走流程。龍泡泡：妳是正在穿流程！'],
    success:'莊：簽名送到了，考勤沒打。龍泡泡：終於有一次是成功下班。',failure:'龍泡泡：被考勤記到了！莊：這叫遠端辦公。',
    endingWin:'莊：協議通過，準備下班。龍泡泡：這句話我錄音了！',endingFail:'龍泡泡：妳被系統留在加班名單上了！莊：下次換條協議。',
    banter:['龍泡泡：佩利卡問人在哪。莊：走流程。龍泡泡：流程都被妳穿了六個洞！','莊：簽名送達。龍泡泡：那休假申請呢？莊：也送了。龍泡泡：第一次覺得妳辦事真快。','龍泡泡：門說禁止打卡。莊：所以我沒有打。龍泡泡：妳直接撞了！','莊：回去休息。龍泡泡：先聲明，回去不能再順路開會。'],
    length:950,speed:25,limit:60,sky:0x182e46,road:0x283b50,rail:0x7bd3e2,accent:0x84e1f0,
    gates:[180,310,440,570,700,830].map((s,i)=>({s,safe:[-4,4,0,-4,4,0][i]})),
  },
];

export const raceTrials=Object.fromEntries(definitions.map(trial=>[trial.id,{
  ...trial,
  config:{...rideConfig,trial,center:s=>Math.sin(Math.max(0,s-65)*.007)*8+Math.sin(Math.max(0,s-65)*.014)*3,
    length:trial.length,speed:trial.speed,brakeSpeed:trial.speed*.93,maxSpeed:trial.speed+10,
    roadHalfWidth:8,riverHalfWidth:10,edge:6.7,actorHeight:trial.character==='zhuang'?3:2.6,
    autoDrift:true,driving:{...rideConfig.driving,turn:.33,driftTurn:.42,curveForce:.6,boostSpeed:3.5,acceleration:2.8},
    gas:{...rideConfig.gas,start:0,capacity:0},obstacles:[],stamps:[],pickups:[],jumps:[],
    sectors:[0,trial.length/3,trial.length*2/3].map((s,i)=>({s,name:[trial.name,'進入作業範圍','最後一段 · 先別下班'][i],caption:''})),
  },
}]));

export function getRaceTrial(id){return raceTrials[id]||null;}
