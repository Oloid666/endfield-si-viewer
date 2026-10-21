import { BoxGeometry, CanvasTexture, CylinderGeometry, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial, TorusGeometry } from 'three';
import { ClimbStage } from './ClimbStage.js';
import { GuaguaActor } from './GuaguaActor.js';

export class EscapeStage extends ClimbStage {
  constructor(scene,camera,models,config){
    super(scene,camera,models,config,new GuaguaActor());
    this.corrosionMaterial=new MeshStandardMaterial({color:0x8f5baf,emissive:0x78389d,emissiveIntensity:.65,roughness:.8});
    this.builtMaterial=new MeshStandardMaterial({color:0xc5d694,emissive:0x47613e,emissiveIntensity:.3});
    this.oreMaterial=new MeshStandardMaterial({color:0x292b38,emissive:0x38253d,emissiveIntensity:.35,roughness:1});
    this.gateMaterial=new MeshStandardMaterial({color:0xc09161,emissive:0x5e3524,emissiveIntensity:.4});
    this.ghostMaterial=new MeshStandardMaterial({color:0xb6e3c4,transparent:true,opacity:.32,depthWrite:false});
    this.materials.push(this.corrosionMaterial,this.builtMaterial,this.ghostMaterial,this.oreMaterial,this.gateMaterial);
    this.hazardGeometry=new BoxGeometry(.96,.12,1.45);this.jetGeometry=new BoxGeometry(1.1,.65,1.4);
    this.ropeGeometry=new CylinderGeometry(.035,.035,1,8);this.geometries.push(this.hazardGeometry,this.jetGeometry,this.ropeGeometry);
    this.hazards=Array.from({length:4},()=>{const m=new Mesh(this.hazardGeometry,this.corrosionMaterial);m.visible=false;this.root.add(m);return m;});
    this.rope=new Mesh(this.ropeGeometry,this.trimMaterial);this.root.add(this.rope);
    this.ropes=[this.rope,new Mesh(this.ropeGeometry,this.trimMaterial)];this.root.add(this.ropes[1]);
    this.markerGeometry=new TorusGeometry(.34,.045,5,20);this.geometries.push(this.markerGeometry);
    this.pickups=Array.from({length:2},()=>{const m=new Mesh(this.markerGeometry,this.trimMaterial);m.visible=false;this.root.add(m);return m;});
    this.deliveries=Array.from({length:2},()=>{const m=new Mesh(this.boxGeometry,this.ghostMaterial);m.visible=false;this.root.add(m);return m;});
    this.labels=new Map();
    this.ghost=new Mesh(this.boxGeometry,this.ghostMaterial);this.root.add(this.ghost);
    this.plates=Array.from({length:2},()=>{const m=new Mesh(this.hazardGeometry,this.trimMaterial);m.visible=false;this.root.add(m);return m;});
  }
  setLevel(config){
    this.config=config;this.exit.position.set(config.exit.x,config.exit.y,0);
    this.currentPosition?.set(config.start.x,config.start.y,0);this.animation=null;this.time=0;
    for(const mesh of this.blockMeshes.values())this.root.remove(mesh);this.blockMeshes.clear();
    this.hazards.forEach((m,i)=>{
      const h=config.hazards[i];m.visible=!!h;m.material=this.corrosionMaterial;m.scale.set(1,1,1);if(h){m.geometry=h.kind==='jet'?this.jetGeometry:this.hazardGeometry;m.position.set(h.x,h.kind==='jet'?h.y+.5:h.y+.05,0);}
    });
    this.ropes.forEach((m,i)=>{const r=(config.ropes||(config.rope?[config.rope]:[]))[i];m.visible=!!r;if(r){m.scale.y=r.top-r.bottom+1.5;m.position.set(r.x,(r.top+r.bottom)/2+.7,.28);}});
    this.plates.forEach((m,i)=>{const p=config.plates?.[i];m.visible=!!p;if(p)m.position.set(p.x,p.y+.05,0);});
    this.deliveries.forEach((m,i)=>{const p=config.deliveries?.[i];m.visible=!!p;if(p)m.position.set(p.x,p.y+.5,0);});
  }
  label(text){
    if(!this.labels.has(text)){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#10251fee';ctx.fillRect(8,8,112,112);ctx.strokeStyle='#deebae';ctx.lineWidth=5;ctx.strokeRect(8,8,112,112);
      ctx.fillStyle='#eff6d5';ctx.font='bold 82px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,69);
      const map=new CanvasTexture(canvas),material=new SpriteMaterial({map,depthTest:false});this.labels.set(text,{map,material});
    }
    const sprite=new Sprite(this.labels.get(text).material);sprite.scale.set(.56,.56,1);sprite.position.set(0,0,.75);return sprite;
  }
  update(engine,delta){
    super.update(engine,delta);if(!this.active)return;
    this.hazards.forEach((m,i)=>{
      const h=this.config.hazards[i];if(!h)return;
      if(h.kind==='jet'){const phase=engine.hazardPhase(h);m.visible=phase!=='rest';m.scale.y=phase==='active'?1:.2;m.material=phase==='warning'?this.fragileMaterial:this.corrosionMaterial;}
      else m.visible=!engine.blocks.some(b=>b.x===h.x&&b.y===h.y);
    });
    this.corrosionMaterial.color.set(0x8f5baf);
    this.pickups.forEach((m,i)=>{const p=this.config.pickups?.[i];m.visible=!!p&&!engine.collected.includes(p.id);if(p){m.position.set(p.x,p.y+.8+Math.sin(this.time*3)*.08,.3);m.rotation.y=this.time*1.5;}});
    this.ghost.visible=this.config.stock>0&&engine.state==='playing'&&engine.canPlace();
    if(this.ghost.visible){const t=engine.buildTarget;this.ghost.position.set(t.x,t.y+.5,0);}
    for(const b of engine.blocks){const m=this.blockMeshes.get(b.id);if(b.kind==='built')m.material=this.builtMaterial;else if(b.kind==='gate')m.material=this.gateMaterial;else if(this.config.rope&&b.kind==='fixed'&&b.x>=2&&b.x<=4)m.material=this.oreMaterial;
      if(b.label&&!m.userData.label){m.add(this.label(b.label));m.userData.label=true;}
    }
  }
  dispose(){for(const {map,material} of this.labels.values()){map.dispose();material.dispose();}this.labels.clear();super.dispose();}
}
