// Short original skits. Eligibility follows the actual cast and race results.
// One queue and the existing frame loop; no timers or extra model downloads.
export const encoreScripts = [
  {id:'z-prize',character:'zhuang',when:e=>e.outcome==='player',lines:'莊：管理員贊助的，我收好了。龍泡泡：那管理員贊助維修嗎？'},
  {id:'z-lost',character:'zhuang',when:e=>e.outcome==='rival',lines:'莊：再來一局。龍泡泡：妳有沒有問過椅子？祀：獎品不接受退換喔。'},
  {id:'late',character:'zhuang',when:e=>e.outcome==='late',lines:'龍泡泡：人家領獎處都下班了。莊：那就明天再來。龍泡泡：我申請連休！'},
  {id:'repair',when:e=>e.petBumps+e.bumps>=4,lines:{zhuang:'龍泡泡：維修單，要寫幾頁？莊：寫成會議紀錄，管理員比較會看。',si:'小聰明：我身上都是刮痕。祀：這叫飛白，藝術。'}},
  {id:'clean',when:e=>e.petBumps+e.bumps<4,lines:{zhuang:'莊：今天開得很穩。龍泡泡：妳對穩的定義，包含起飛？',si:'祀：看吧，平安到達。小聰明：建議把平安兩字圈起來。'}},
  {id:'jump',when:e=>e.jumpWins>0,lines:{zhuang:'龍泡泡：剛剛跳過去了耶！莊：下次可以再遠一點。龍泡泡：我沒有說要下次！',si:'祀：剛剛那一跳，很有筆勢。小聰明：我當時只有去勢。'}},
  {id:'pit',when:e=>e.jumpFails>0,lines:{zhuang:'龍泡泡：跳板在那邊，妳往哪開？莊：走了一條少人走的路。',si:'小聰明：那個坑有名字嗎？祀：現在有了，叫小聰明。'}},
  {id:'si-ink',character:'si',lines:'祀：差點忘了領免費墨水。小聰明：先給我補，我快嚇褪色了。'},
  {id:'z-rest',character:'zhuang',lines:'莊：兜風完了，回去加班。龍泡泡：我白挨這一頓？！'},
  {id:'pet-job',lines:{zhuang:'龍泡泡：下次換我坐椅子。莊：可以，記得把報告帶上。',si:'小聰明：我的職稱是什麼？祀：隨行筆記。小聰明：隨行挨撞吧！'}},
  {id:'pet-nap',lines:{zhuang:'龍泡泡：我現在可以休息了吧？莊：嗯，帶薪。龍泡泡：終於有一句人話。',si:'祀：你怎麼不說話？小聰明：墨水已用盡，請下次再試。'}},
  {id:'insurance',lines:{zhuang:'龍泡泡：保險有沒有保天上？莊：我看看條款。龍泡泡：現在才看？！',si:'小聰明：下次請畫一頂安全帽。祀：連同駕照一起畫。小聰明：駕照不能畫！'}},
  {id:'two-pets',duel:true,lines:'小聰明：你也是來休息的？龍泡泡：她們是。我們不是。'},
  {id:'two-racers',duel:true,lines:'祀：椅子裝法術，算改裝吧？莊：毛筆裝人，也不是原廠規格。'},
  {id:'bill',duel:true,lines:'龍泡泡：維修費平分？小聰明：不，給管理員。莊：我來送。祀：我也去。'},
];

export class RaceEncore {
  constructor(random=Math.random){this.random=random;this.recent=[];this.reset();}
  reset(){this.clock=0;this.next=0;this.active=false;this.current=null;this.gesture=0;}
  start(){this.reset();this.active=true;}
  update(delta,engine,character){
    if(!this.active)return null;
    this.clock+=Math.min(Math.max(delta,0),.12);
    if(this.clock<this.next)return null;
    const pool=encoreScripts.filter(s=>(!s.character||s.character===character)&&(!s.duel||engine.rival.enabled)&&(!s.when||s.when(engine)));
    // Open with a performance-specific gag. Subsequent skits can use all themes.
    const contextual=pool.filter(s=>s.when);
    const candidates=(this.current?pool:contextual.length?contextual:pool).filter(s=>!this.recent.includes(s.id));
    const choices=candidates.length?candidates:pool.filter(s=>s.id!==this.current?.id);
    const script=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];
    const text=typeof script.lines==='string'?script.lines:script.lines[character];
    this.current={id:script.id,text};this.gesture=Math.floor(this.random()*3);
    this.recent.push(script.id);this.recent=this.recent.slice(-3);
    return text;
  }
  restAfter(duration){this.next=this.clock+duration+5+this.random()*2;}
}
