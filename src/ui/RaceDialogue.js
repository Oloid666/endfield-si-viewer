export const raceCast = {
  si:{name:'祀',row:0}, zhuang:{name:'莊芳宜',row:1}, ink:{name:'小聰明',row:2}, dragon:{name:'龍泡泡',row:3},
};
export const portraitMoods=['calm','smug','panic','angry','dead'];
const speakers={'祀':'si','莊':'zhuang','莊芳宜':'zhuang','小聰明':'ink','龍泡泡':'dragon'};
export function dialogueParts(text, fallback='si', mood=null){
  return String(text).split(/(?=(?:祀|莊芳宜|莊|小聰明|龍泡泡)[：:])/u).map(s=>s.trim()).filter(Boolean).map(part=>{
    const prefix=part.match(/^(祀|莊芳宜|莊|小聰明|龍泡泡)[：:]/u),speaker=/^(廣播|系統)[：:]/.test(part)?'system':prefix?speakers[prefix[1]]:fallback;
    const feeling=mood||(/？！|！！|起飛|機翼|升天|完了/.test(part)?'panic':/記得|記住|三根|算帳|放手/.test(part)?'angry':/休息了|躺|假沒休|拖把|呢？！/.test(part)?'dead':/先收|獎品|拿定|順便贏|借過|收筆/.test(part)?'smug':'calm');
    return {text:part,speaker,mood:portraitMoods.includes(feeling)?feeling:'calm'};
  });
}
// One speaker at a time. The atlas is pre-rendered, never a second 3D canvas.
export class RaceDialogue {
  constructor(line){
    this.line=line;line.replaceChildren();
    this.portrait=document.createElement('span');this.portrait.className='race-portrait';this.portrait.setAttribute('role','img');
    this.portrait.style.backgroundImage=`url("${import.meta.env.BASE_URL}images/race-portraits.png")`;
    this.label=document.createElement('small');this.portrait.append(this.label);
    this.text=document.createElement('span');this.text.className='race-dialogue-text';line.append(this.portrait,this.text);
  }
  set(text,clock,fallback='si',mood=null){this.parts=dialogueParts(text,fallback,mood);this.index=0;this.next=clock+2.6;this.show();return 3.3+(this.parts.length-1)*2.6;}
  show(){
    const part=this.parts[this.index],cast=raceCast[part.speaker]||raceCast.si;
    this.line.dataset.speaker=part.speaker;this.line.dataset.mood=part.mood;
    this.portrait.hidden=part.speaker==='system';
    this.text.textContent=part.text;this.label.textContent=cast.name;
    this.portrait.style.backgroundPosition=`${portraitMoods.indexOf(part.mood)*25}% ${cast.row/3*100}%`;
    this.portrait.setAttribute('aria-label',`${cast.name}，${{calm:'平靜',smug:'得意',panic:'驚恐',angry:'生氣',dead:'生無可戀'}[part.mood]}`);
  }
  update(clock){if(this.parts&&this.index<this.parts.length-1&&clock>=this.next){this.index++;this.next=clock+2.6;this.show();}}
}
