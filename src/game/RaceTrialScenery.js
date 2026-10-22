import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, InstancedMesh, MeshBasicMaterial, PlaneGeometry, CanvasTexture, TorusGeometry } from 'three';

// Low-poly fan scenery. Static scenery is batched; only bridges, parcels and
// gate markers update. All GPU resources belong to the existing RideStage.
export class RaceTrialScenery {
  constructor(owner){
    this.owner=owner;this.trial=owner.config.trial;
    this.box=owner.own(new BoxGeometry(1,1,1));this.bridges=[];this.parcels=[];this.gates=[];this.belts=[];
    if(this.trial.type==='bridge')this.buildWuling();
    else if(this.trial.type==='cargo')this.buildValley();
    else this.buildDijiang();
    this.sign(this.trial.type==='bridge'?'施工中 · 自己修':this.trial.type==='cargo'?'跟班簽收 · 人不算':'協議通行 · 禁止打卡',35);
    this.sign('作業完成 · 先下班',this.trial.length-25);
  }
  sign(text,s){
    const o=this.owner,canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#142c32';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#dce8b2';ctx.lineWidth=6;ctx.strokeRect(3,3,506,90);ctx.fillStyle='#f0edcc';ctx.font='bold 37px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,63);
    o.mesh(o.own(new PlaneGeometry(6,1.125)),o.own(new MeshBasicMaterial({map:o.own(new CanvasTexture(canvas))})),o.root,[o.center(s)+10,4,-s]);
  }
  buildWuling(){
    const o=this.owner,t=this.trial,stone=o.material(0x8a9990),wall=o.material(0xd7d8be),roof=o.material(0x345955),gold=o.material(0xe7ca7b,{emissive:0x806d24,emissiveIntensity:.3});
    o.mesh(this.box,o.material(0x356e70,{roughness:.4}),o.root,[0,-1.8,-t.length/2],[150,.2,t.length+160]);
    const houses=[],roofs=[],pillars=[],cliffs=[],lanterns=[],windows=[],arches=[];
    for(let i=0;i<Math.ceil(t.length/55);i++)for(const side of [-1,1]){
      const s=i*55,x=o.center(s)+side*(12+i%3*1.5);
      houses.push({p:[x,3,-s],s:[6,7,6]});roofs.push({p:[x,7.2,-s],s:[5.5,2.4,5.5],r:[0,Math.PI/4,0]});
      for(const dx of [-2.7,2.7]){pillars.push({p:[x+dx,2,-s+2.6],s:[.3,7,.3]});windows.push({p:[x+dx*.45,4,-s+3.05],s:[1,1.6,.08]});}
      cliffs.push({p:[x+side*13,6,-s-17],s:[12,19+i%4*3,12],r:[0,i,.1]});
      lanterns.push({p:[x-side*3,4.5,-s+3.5],s:[.5,.8,.5]});
    }
    o.instances(this.box,wall,houses);o.instances(o.own(new ConeGeometry(1,1,4)),roof,roofs);o.instances(this.box,roof,pillars);o.instances(o.own(new ConeGeometry(1,1,6)),stone,cliffs);o.instances(o.own(new CylinderGeometry(1,1,1,8)),o.material(0xb97954),lanterns);
    o.instances(this.box,roof,windows);
    for(const s of [145,445,745,1010]){
      for(const side of [-1,1])arches.push({p:[o.center(s)+side*8.5,3.5,-s],s:[.45,7,.5]});
      arches.push({p:[o.center(s),7,-s],s:[19,.55,1.7]});
      o.mesh(o.own(new ConeGeometry(1,1,4)),roof,o.root,[o.center(s),8,-s],[11,1.6,3.4]).rotation.y=Math.PI/4;
    }
    o.instances(this.box,gold,arches);
    const tiles=document.createElement('canvas');tiles.width=tiles.height=256;const ctx=tiles.getContext('2d');ctx.fillStyle='#c7d2b1';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#687c60';ctx.lineWidth=5;
    for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(i*64,0);ctx.lineTo(i*64,256);ctx.moveTo(0,i*64);ctx.lineTo(256,i*64);ctx.stroke();}
    const bridgeMaterial=o.material(0xcbd3ae,{map:o.own(new CanvasTexture(tiles)),emissive:0x657d3f,emissiveIntensity:.2});
    const borders=[];
    for(const gap of t.gaps){
      const mid=(gap.start+gap.end)/2,x=o.center(mid),length=gap.end-gap.start;
      const bridge=o.mesh(this.box,bridgeMaterial,o.root,[x,.1,-mid],[16,.32,length]);bridge.visible=false;this.bridges.push(bridge);
      for(const side of [-1,1])borders.push({p:[x+side*7.7,.2,-mid],s:[.18,.15,length]});
      for(const s of [gap.start,gap.end])borders.push({p:[o.center(s),.2,-s],s:[16,.12,.25]});
    }
    o.instances(this.box,gold,borders);
  }
  buildValley(){
    const o=this.owner,t=this.trial,rust=o.material(0x9e6652),steel=o.material(0x34444b),orange=o.material(0xe6ac65),light=o.material(0x86d7cf,{emissive:0x44a9a8,emissiveIntensity:.5});
    o.mesh(this.box,o.material(0xa18a70),o.root,[0,-2,-t.length/2],[160,1,t.length+200]);
    const cliffs=[],beams=[],pipes=[],stripe=[];
    for(let i=0;i<Math.ceil(t.length/40);i++){
      const s=i*40;
      for(const side of [-1,1]){
        const x=o.center(s)+side*11;
        cliffs.push({p:[x+side*9,6,-s],s:[12,18+i%4*3,14],r:[0,i,side*.2]});
        beams.push({p:[x,4.5,-s],s:[1,9,1]});pipes.push({p:[x-side*.8,2,-s],s:[.9,40,.9],r:[Math.PI/2,0,0]});
        stripe.push({p:[o.center(s)+side*8,.55,-s],s:[.4,1,2]});
      }
      if(i%3===0)beams.push({p:[o.center(s),9,-s],s:[24,.8,1.2]});
    }
    o.instances(o.own(new ConeGeometry(1,1,5)),rust,cliffs);o.instances(this.box,steel,beams);o.instances(o.own(new CylinderGeometry(1,1,1,7)),orange,pipes);o.instances(this.box,orange,stripe);
    const arrowGeometry=o.own(new BoxGeometry(.65,.03,.13));
    for(const belt of t.belts){
      const mid=(belt.start+belt.end)/2;
      o.mesh(this.box,o.material(0x2d6968),o.root,[o.center(mid),.085,-mid],[15,.025,belt.end-belt.start]);
      const arrows=new InstancedMesh(arrowGeometry,light,48);arrows.frustumCulled=false;o.root.add(arrows);this.belts.push({arrows,belt});
    }
    const gold=o.material(0xf2ce75,{emissive:0xc49b37,emissiveIntensity:.4}),tape=o.material(0x394d55);
    for(const item of t.packages){
      const root=new Group();root.position.set(o.center(item.s)+item.offset,.85,-item.s);o.root.add(root);
      o.mesh(this.box,gold,root,[0,0,0],[1.2,1.2,1.2]);o.mesh(this.box,tape,root,[0,.62,0],[.16,.04,1.22]);o.mesh(this.box,tape,root,[0,0,.62],[.16,1.2,.04]);
      const ring=o.mesh(o.own(new TorusGeometry(.88,.04,4,20)),light,root,[0,.03,0]);ring.rotation.x=Math.PI/2;
      this.parcels.push(root);
    }
  }
  buildDijiang(){
    const o=this.owner,t=this.trial,dark=o.material(0x263c55),cyan=o.material(0x84dfef,{emissive:0x388bba,emissiveIntensity:.65}),pale=o.material(0x98aebe);
    o.mesh(this.box,o.material(0x102238),o.root,[0,-15,-t.length/2],[220,.5,t.length+200]);
    const panels=[],frames=[],lights=[];
    for(let i=0;i<Math.ceil(t.length/22);i++){
      const s=i*22,x=o.center(s);
      for(const side of [-1,1]){
        panels.push({p:[x+side*13,3,-s],s:[5,7,15],r:[0,0,side*.18]});lights.push({p:[x+side*7.6,.15,-s],s:[.12,.08,11]});
        if(i%3===0)frames.push({p:[x+side*12,5,-s],s:[.6,11,.6],r:[0,0,side*.2]});
      }
      if(i%3===0)frames.push({p:[x,10.4,-s],s:[34,.7,.7]});
    }
    o.instances(this.box,dark,panels);o.instances(this.box,pale,frames);o.instances(this.box,cyan,lights);
    const red=o.own(new MeshBasicMaterial({color:0xf08288,transparent:true,opacity:.45,depthWrite:false}));
    const green=o.material(0xa0e6b0,{emissive:0x47b78e,emissiveIntensity:.6});
    for(const gate of t.gates){
      const root=new Group();root.position.set(o.center(gate.s),0,-gate.s);o.root.add(root);
      for(const side of [-1,1])o.mesh(this.box,cyan,root,[side*8,2.5,0],[.22,5,.3]);
      o.mesh(this.box,cyan,root,[0,5,0],[16,.25,.3]);
      const left=gate.safe-2,right=gate.safe+2;
      if(left>-8)o.mesh(this.box,red,root,[(-8+left)/2,2.4,0],[left+8,4.7,.12]);
      if(right<8)o.mesh(this.box,red,root,[(8+right)/2,2.4,0],[8-right,4.7,.12]);
      for(const side of [-1,1])o.mesh(this.box,green,root,[gate.safe+side*2,2.2,.15],[.1,4.4,.1]);
      o.mesh(this.box,green,root,[gate.safe,.11,0],[3.9,.08,4]);this.gates.push(root);
    }
  }
  update(engine){
    const o=this.owner,t=engine.elapsed;
    this.bridges.forEach((mesh,i)=>{mesh.visible=engine.built.has(i);if(mesh.visible)mesh.position.y=.1-Math.max(0,1-(engine.prizeClock-engine.built.get(i))/.45)*1.5;});
    this.parcels.forEach((root,i)=>{root.visible=!engine.cargo.has(i)&&!engine.resolved.has(i);root.rotation.y=Math.sin(t*1.5+i)*.14;});
    for(const {arrows,belt}of this.belts){
      for(let i=0;i<24;i++)for(let side=0;side<2;side++){
        const s=belt.start+(i/24)*(belt.end-belt.start),direction=Math.sign(belt.force)*engine.beltSign;
        o.temp.position.set(o.center(s)+(((t*.4+i*.17)%1)-.5)*12,.13,-s+(side?-.2:.2));o.temp.rotation.set(0,(side?-.7:.7)+(direction<0?Math.PI:0),0);o.temp.scale.set(1,1,1);o.temp.updateMatrix();arrows.setMatrixAt(i*2+side,o.temp.matrix);
      }
      arrows.instanceMatrix.needsUpdate=true;
    }
    this.gates.forEach((root,i)=>{root.visible=!engine.resolved.has(i);});
    o.spell.visible=engine.state==='playing'&&engine.powerTime>0;o.spell.scale.setScalar(1+Math.sin(t*14)*.1);o.spell.rotation.y=t*3;
  }
}
