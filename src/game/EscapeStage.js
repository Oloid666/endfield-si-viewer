import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial } from 'three';
import { ClimbStage } from './ClimbStage.js';
import { GuaguaActor } from './GuaguaActor.js';

export class EscapeStage extends ClimbStage {
  constructor(scene,camera,models,config){
    super(scene,camera,models,config,new GuaguaActor());
    this.corrosionMaterial=new MeshStandardMaterial({color:0x8f5baf,emissive:0x78389d,emissiveIntensity:.65,roughness:.8});
    this.builtMaterial=new MeshStandardMaterial({color:0xc5d694,emissive:0x47613e,emissiveIntensity:.3});
    this.oreMaterial=new MeshStandardMaterial({color:0x292b38,emissive:0x38253d,emissiveIntensity:.35,roughness:1});
    this.ghostMaterial=new MeshStandardMaterial({color:0xb6e3c4,transparent:true,opacity:.32,depthWrite:false});
    this.materials.push(this.corrosionMaterial,this.builtMaterial,this.ghostMaterial,this.oreMaterial);
    this.hazardGeometry=new BoxGeometry(.96,.12,1.45);this.jetGeometry=new BoxGeometry(1.1,.65,1.4);
    this.ropeGeometry=new CylinderGeometry(.035,.035,1,8);this.geometries.push(this.hazardGeometry,this.jetGeometry,this.ropeGeometry);
    this.hazards=Array.from({length:4},()=>{const m=new Mesh(this.hazardGeometry,this.corrosionMaterial);m.visible=false;this.root.add(m);return m;});
    this.rope=new Mesh(this.ropeGeometry,this.trimMaterial);this.root.add(this.rope);
    this.ghost=new Mesh(this.boxGeometry,this.ghostMaterial);this.root.add(this.ghost);
  }
  setLevel(config){
    this.config=config;this.exit.position.set(config.exit.x,config.exit.y,0);
    this.currentPosition?.set(config.start.x,config.start.y,0);this.animation=null;this.time=0;
    for(const mesh of this.blockMeshes.values())this.root.remove(mesh);this.blockMeshes.clear();
    this.hazards.forEach((m,i)=>{
      const h=config.hazards[i];m.visible=!!h;if(h){m.geometry=h.kind==='jet'?this.jetGeometry:this.hazardGeometry;m.position.set(h.x,h.kind==='jet'?h.y+.5:h.y+.05,0);}
    });
    this.rope.visible=!!config.rope;
    if(config.rope){const r=config.rope;this.rope.scale.y=r.top-r.bottom+1.5;this.rope.position.set(r.x,(r.top+r.bottom)/2+.7,.28);}
  }
  update(engine,delta){
    super.update(engine,delta);if(!this.active)return;
    this.hazards.forEach((m,i)=>{
      const h=this.config.hazards[i];if(!h)return;
      if(h.kind==='jet'){m.visible=engine.jetPhase!=='rest';m.scale.y=engine.jetPhase==='active'?1:.2;}
      else m.visible=!engine.blocks.some(b=>b.x===h.x&&b.y===h.y);
    });
    this.corrosionMaterial.color.set(this.config.rope&&engine.jetPhase==='warning'?0xe2c56c:0x8f5baf);
    this.ghost.visible=this.config.id==='build'&&engine.state==='playing'&&engine.canPlace();
    if(this.ghost.visible){const t=engine.buildTarget;this.ghost.position.set(t.x,t.y+.5,0);}
    for(const b of engine.blocks){const m=this.blockMeshes.get(b.id);if(b.kind==='built')m.material=this.builtMaterial;else if(this.config.id==='rope'&&b.kind==='fixed'&&b.x>=2&&b.x<=4)m.material=this.oreMaterial;}
  }
}
