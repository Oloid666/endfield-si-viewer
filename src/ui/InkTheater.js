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
    this.speaker=document.createElement('small');this.caption.append(this.speaker);
    this.line=document.createElement('span');this.seal=document.createElement('b');this.seal.textContent='蔥';
    this.caption.append(this.line,this.seal);parent.append(this.caption);
    this.question=document.createElement('div');this.question.className='ink-question';this.question.textContent='？　？';this.question.setAttribute('aria-hidden','true');parent.append(this.question);
    this.choice=document.createElement('dialog');this.choice.className='story-choice';this.choice.setAttribute('aria-labelledby','choice-title');
    this.choice.innerHTML='<div class="comms-heading"><span class="comms-avatar" aria-hidden="true">祀</span><div><small>ENDFIELD · 通訊接入</small><h2 id="choice-title">管理員，管一下啊！</h2></div><b>Ⅱ 等待回覆</b></div><p>演出已暫停，選擇後繼續。</p><button data-choice="rescue"><small>01 · 救援</small>小蔥，我馬上來幫你！</button><button data-choice="extend"><small>02 · 加碼</small>別急，我給蔥續個八拍。</button>';
    parent.append(this.choice);
    this.onChoice=event=>{const value=event.target.closest('[data-choice]')?.dataset.choice;if(value)this.idle?.chooseReverse(value);};
    this.onCancel=event=>{event.preventDefault();this.idle?.stopGesture();};
    this.choice.addEventListener('click',this.onChoice);this.choice.addEventListener('cancel',this.onCancel);
    this.contract=document.createElement('div');this.contract.className='contract-card';this.contract.innerHTML='<small>危機合約 · 管理員已批准</small><strong>禁止停手</strong><span>追加指令：還有八拍</span><b>生效</b>';this.contract.hidden=true;parent.append(this.contract);
  }
  update(idle,delta){
    this.idle=idle;
    const waiting=idle?.reverseChoice==='pending';
    if(waiting&&!this.choice.open)this.choice.showModal();
    if(!waiting&&this.choice.open)this.choice.close();
    const kind=idle?.gestureTime!=null?idle.gestureKind:'',time=idle?.gestureTime||0;
    const target=['leek','reverse'].includes(kind)?1:0;
    this.opacity=MathUtils.lerp(this.opacity,target,1-Math.exp(-delta/this.config.paperFade));
    if(this.opacity<.002)this.opacity=0;
    this.paper.style.opacity=String(this.opacity);
    this.parent.dataset.inkPaper=String(this.opacity>.1);
    const mountains=this.paper.firstElementChild;
    const toss=kind==='reverse'?windowWeight(time,idle.config.reverse.beats.windmill,idle.config.reverse.beats.bow,.25):0;
    mountains.style.transform=`translateX(${toss*115}%) rotate(${toss*14}deg)`;
    const entry=(this.config.captions[kind]||[]).find(([start,end])=>time>=start&&time<end);
    let text=entry?.[3]||'',speaker=entry?.[2]||'',seal=false;
    if(idle?.rescueTime!=null){text=idle.rescueTime<2?'……也沒那麼需要你幫忙。':'你來得還挺快。';speaker=idle.rescueTime<2?'祀':'祀 OS';}
    if(kind==='reverse'&&time>=idle.config.reverse.beats.bow){
      const full='蔥，出於祀，而甩於祀。';
      const progress=MathUtils.clamp((time-idle.config.reverse.beats.bow)/(idle.config.reverse.beats.writeEnd-idle.config.reverse.beats.bow),0,1);
      text=Array.from(full).slice(0,Math.ceil(progress*Array.from(full).length)).join('');speaker='蔥 · 落款';seal=progress>=1;
    }
    if(text!==this.line.textContent)this.line.textContent=text;
    this.speaker.textContent=speaker;this.speaker.hidden=!speaker;
    this.caption.hidden=!text||waiting;
    this.caption.classList.toggle('is-paper',target===1);this.caption.classList.toggle('is-stamp',kind==='tsundere'&&time>=8.7);
    this.seal.hidden=!seal;
    this.question.hidden=!(kind==='reverse'&&time>=idle.config.reverse.beats.stare&&time<idle.config.reverse.beats.grab);
    const contract=kind==='reverse'&&idle.reverseChoice==='extend'&&time>=idle.config.reverse.contractAt&&time<idle.config.reverse.beats.return;
    this.contract.hidden=!contract;this.contract.classList.toggle('is-small',contract&&time>=idle.config.reverse.beats.windmill);
    this.kind=kind;return this.opacity>0;
  }
  dispose(){this.choice.close();this.choice.removeEventListener('click',this.onChoice);this.choice.removeEventListener('cancel',this.onCancel);this.choice.remove();this.contract.remove();this.paper.remove();this.caption.remove();this.question.remove();}
}
