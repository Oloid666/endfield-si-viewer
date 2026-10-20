import { MathUtils } from 'three';
import { windowWeight } from '../viewer/actionTimeline.js';

const MOUNTAINS = '<svg viewBox="0 0 900 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="ink-wash" x2="0" y2="1"><stop stop-color="#435b48" stop-opacity=".23"/><stop offset="1" stop-color="#52634c" stop-opacity="0"/></linearGradient></defs><g fill="url(#ink-wash)"><path d="M-60 500Q15 395 68 270L103 230 125 172 143 198 160 190Q183 278 220 310L272 390 318 500Z"/><path d="M170 500Q245 395 290 256L317 235 339 145 357 174 370 168 389 215 411 232Q452 348 552 500Z"/><path d="M410 500Q525 371 581 294L603 260 622 278 648 213 671 250 685 248Q728 357 942 500Z"/></g><g fill="none" stroke="#38503e" stroke-linecap="round" opacity=".17"><path stroke-width="3" d="m125 172-9 92-19 43 16 34m226-196-21 102 8 38-23 59m345-131-13 91 15 23-9 40"/><path stroke-width="2" d="M0 470Q230 430 420 470T900 455M70 481Q280 460 500 486"/></g></svg>';

// One static SVG landscape under the transparent WebGL canvas. Only transform
// and opacity change; no full-screen shader, blur, particles or second RAF.
export class InkTheater {
  constructor(viewport,parent,config){
    this.config=config;this.parent=parent;this.opacity=0;this.kind='';
    this.paper=document.createElement('div');this.paper.className='ink-paper';this.paper.innerHTML=MOUNTAINS;
    viewport.prepend(this.paper);
    this.caption=document.createElement('div');this.caption.className='ink-caption';this.caption.setAttribute('aria-hidden','true');
    this.line=document.createElement('span');this.seal=document.createElement('b');this.seal.textContent='蔥';
    this.caption.append(this.line,this.seal);parent.append(this.caption);
    this.question=document.createElement('div');this.question.className='ink-question';this.question.textContent='？　？';this.question.setAttribute('aria-hidden','true');parent.append(this.question);
  }
  update(idle,delta){
    const kind=idle?.gestureTime!=null?idle.gestureKind:'',time=idle?.gestureTime||0;
    const target=kind==='reverse'?1:0;
    this.opacity=MathUtils.lerp(this.opacity,target,1-Math.exp(-delta/this.config.paperFade));
    if(this.opacity<.002)this.opacity=0;
    this.paper.style.opacity=String(this.opacity);
    this.parent.dataset.inkPaper=String(this.opacity>.1);
    const mountains=this.paper.firstElementChild;
    const toss=kind==='reverse'?windowWeight(time,7.55,10,.25):0;
    mountains.style.transform=`translateX(${toss*115}%) rotate(${toss*14}deg)`;
    let text='',seal=false;
    if(kind==='reverse'){
      if(time<1.35)text='起筆，召蔥。';
      else if(time<2.3)text='……蔥長手了？';
      else if(time<2.9)text='';
      else if(time<6.1)text='現在，換蔥示範。';
      else if(time<7.55)text='好，結束了。';
      else if(time<9.5)text='還有一下。';
      else {text='蔥，出於祀，而甩於祀。';seal=true;}
    }else if(kind==='leek'){
      text=time<1.3?'本小姐親自示範。':time<5.6?'':time<6.6?'就這？':time<7.9?'……你剛剛是不是動了？':'';
    }else if(kind==='tsundere'){
      text=time<1?'哼。':time>4.8&&time<6.35?'誰、誰畫的花！':'';
    }
    if(text!==this.line.textContent)this.line.textContent=text;
    this.caption.hidden=!text;
    this.caption.classList.toggle('is-paper',kind==='reverse');this.seal.hidden=!seal;
    this.question.hidden=!(kind==='reverse'&&time>=2.3&&time<2.9);
    this.kind=kind;return this.opacity>0;
  }
  dispose(){this.paper.remove();this.caption.remove();this.question.remove();}
}
