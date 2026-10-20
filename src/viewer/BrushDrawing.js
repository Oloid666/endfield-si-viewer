import { Box3, BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, MathUtils, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import { LeekProp } from './LeekProp.js';
import { ramp } from './actionTimeline.js';

const UP=new Vector3(0,1,0);
const INTERVALS=[[0,.28],[.34,.52],[.58,.76],[.82,1]];

// Four fixed painted strokes and one brush, all sampled from the same tip path.
// The world-anchored sketch never follows the hand or the camera.
export class BrushDrawing {
  constructor(parent,bounds,height,config,propConfig,reverseConfig,texture){
    this.parent=parent;this.bounds=bounds;this.height=height;this.config=config;this.propConfig=propConfig;this.reverseConfig=reverseConfig;
    this.center=bounds.getCenter(new Vector3());this.floor=bounds.min.y;this.tip=new Vector3();this.grip=new Vector3();this.direction=new Vector3();this.local=new Vector3();this.rotation=new Quaternion();
    this.alpha=0;this.kind='';this.progress=0;
    this.root=new Group();this.root.name='si-brush-drawing';parent.add(this.root);
    this.inkMaterial=new MeshBasicMaterial({vertexColors:true,map:texture,transparent:true,side:DoubleSide,forceSinglePass:true,depthWrite:false});
    this.sketches={};
    for(const kind of ['leek','reverse']){
      const design=propConfig.design[kind==='reverse'?'giant':'held'];
      const geometry=this.paintGeometry(design),mesh=new Mesh(geometry,this.inkMaterial);mesh.visible=false;mesh.name=`si-painted-${kind}`;this.root.add(mesh);
      this.sketches[kind]=mesh;
    }
    this.brush=new Group();this.brush.name='si-calligraphy-brush';this.brush.visible=false;parent.add(this.brush);
    this.materials=[0x835936,0xb39b5a,0x17271e].map(color=>new MeshBasicMaterial({color,transparent:true,depthTest:false,depthWrite:false}));
    const length=config.brushLength*height;
    this.geometries=[new CylinderGeometry(height*.009,height*.01,length*.68,8),new CylinderGeometry(height*.011,height*.011,length*.1,8),new ConeGeometry(height*.014,length*.22,8)];
    this.geometries.forEach((geometry,i)=>{
      const mesh=new Mesh(geometry,this.materials[i]);mesh.renderOrder=30+i;mesh.position.y=length*[.34,.73,.89][i];this.brush.add(mesh);
    });
    this.previewHost=new Group();parent.add(this.previewHost);const palm=new Group();this.previewHost.add(palm);
    this.preview=new LeekProp(this.previewHost,palm,parent,height,propConfig,'held');
  }
  point(x,y,z,out){return out.set(this.center.x+x*this.height,this.floor+y*this.height,this.center.z+z*this.height);}
  origin(kind,out){return kind==='reverse'?this.point(this.reverseConfig.leekX,this.reverseConfig.leekY,this.reverseConfig.birthDepth,out):this.point(...this.config.smallOrigin,out);}
  path(stroke,u,design,out){
    const c=this.propConfig;
    if(stroke===0){const t=u;return out.set(design.bend*(t*t-.25*t),(t-.15)*c.stemLength,.012);}
    const side=stroke-2;
    return out.set(design.bend*(.83*.83-.25*.83)+side*design.spread*u*u,c.stemLength*.68+u*c.leafLength*design.leafLength*(side?.85:1),.012);
  }
  paintGeometry(design){
    const p=[],uv=[],colors=[],indices=[],a=new Vector3(),b=new Vector3();
    for(let stroke=0;stroke<4;stroke++)for(let i=0;i<16;i++){
      const t=i/16,next=(i+1)/16;
      this.path(stroke,t,design,a);this.path(stroke,next,design,b);
      const width=stroke===0?this.propConfig.stemRadius*design.radius*1.8:this.propConfig.leafWidth*design.leafWidth*Math.sin(Math.PI*(t*.96+.025))*(1-t*.6);
      const color=stroke===0?[.84,.88,.72]:[.22+stroke*.035,.42+stroke*.025,.25];
      const base=p.length/3;
      p.push(a.x-width/2,a.y,a.z,a.x+width/2,a.y,a.z,b.x-width/2,b.y,b.z,b.x+width/2,b.y,b.z);
      uv.push(0,t,1,t,0,next,1,next);for(let k=0;k<4;k++)colors.push(...color);
      indices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.setDrawRange(0,0);return geometry;
  }
  drawingProgress(kind,time){
    const c=this.config;
    if(kind==='leek')return MathUtils.clamp((time-c.start)/(c.smallEnd-c.start),0,1);
    if(time<=c.giantInterrupt)return MathUtils.clamp((time-c.start)/(c.giantInterrupt-c.start),0,1)*c.giantProgress;
    return MathUtils.lerp(c.giantProgress,1,ramp(time,this.reverseConfig.beats.grab,this.reverseConfig.beats.swing));
  }
  sample(kind,progress,out){
    const design=this.propConfig.design[kind==='reverse'?'giant':'held'];
    let count=0;
    for(let stroke=0;stroke<4;stroke++){
      const [start,end]=INTERVALS[stroke];
      if(progress>=start&&progress<=end){const u=MathUtils.smoothstep(progress,start,end);this.path(stroke,u,design,out);return (stroke+u)*96;}
      if(progress>end)count=(stroke+1)*96;
      if(stroke<3&&progress>end&&progress<INTERVALS[stroke+1][0]){
        this.path(stroke,1,design,out);this.path(stroke+1,0,design,this.local);
        const u=ramp(progress,end,INTERVALS[stroke+1][0]);out.lerp(this.local,u);out.z+=Math.sin(u*Math.PI)*.025;return count;
      }
    }
    this.path(progress<=0?0:3,progress<=0?0:1,design,out);return count;
  }
  tipAt(kind,time,out){
    // Freeze the unfinished picture while the giant onion comes alive.
    const penTime=kind==='reverse'?Math.min(time,this.config.giantInterrupt):time;
    this.sample(kind,this.drawingProgress(kind,penTime),out);
    out.multiplyScalar(this.height*(kind==='reverse'?this.reverseConfig.leekScale:1));
    this.origin(kind,this.local);return out.add(this.local);
  }
  getHandTarget(kind,time,out){
    this.tipAt(kind,time,this.tip);
    this.point(-.12,.73,.08,this.grip);
    this.direction.subVectors(this.tip,this.grip).normalize();
    return out.copy(this.tip).addScaledVector(this.direction,-this.config.brushLength*this.height);
  }
  penAt(grip,tip,opacity){
    this.brush.visible=opacity>.002;if(!this.brush.visible)return;
    this.parent.worldToLocal(this.grip.copy(grip));this.brush.position.copy(this.grip);
    this.parent.worldToLocal(this.local.copy(tip));this.direction.subVectors(this.local,this.grip);
    const length=this.direction.length();this.brush.quaternion.setFromUnitVectors(UP,this.direction.normalize());
    this.brush.scale.set(1,length/(this.config.brushLength*this.height),1);
    for(const material of this.materials)material.opacity=opacity;
  }
  update(kind,time,delta,wrist,reverse){
    const active=['leek','reverse'].includes(kind),c=this.config;
    const author=kind==='reverse'&&time>=this.reverseConfig.beats.bow&&time<this.reverseConfig.beats.writeEnd;
    const penEnd=kind==='leek'?c.smallEnd+.35:this.reverseConfig.beats.grab;
    const penTarget=active&&(time<penEnd||author)?1:0;
    this.alpha=MathUtils.clamp(this.alpha+(penTarget?1:-1)*delta/c.fade,0,1);
    if(active){
      this.kind=kind;this.progress=this.drawingProgress(kind,time);
      const mesh=this.sketches[kind],count=this.sample(kind,this.progress,this.tip);
      mesh.geometry.setDrawRange(0,Math.floor(count/6)*6);
      this.origin(kind,this.local);this.parent.worldToLocal(this.local);this.root.position.copy(this.local);
      this.root.scale.setScalar(this.height*(kind==='reverse'?this.reverseConfig.leekScale:1));
      const fade=kind==='leek'?1-ramp(time,c.smallEnd,c.revealEnd):1-ramp(time,this.reverseConfig.beats.grab,this.reverseConfig.beats.swing);
      this.inkMaterial.opacity=fade;this.root.visible=fade>.002;
      for(const [key,sketch] of Object.entries(this.sketches))sketch.visible=key===kind;
      this.origin('leek',this.previewHost.position);this.parent.worldToLocal(this.previewHost.position);
      const reveal=kind==='leek'&&time>=c.smallEnd&&time<c.revealEnd;
      this.preview.update(reveal,delta,.2,0);this.preview.group.visible=reveal&&this.preview.alpha>0;this.preview.trail.visible=false;
      for(const material of this.preview.materials)material.opacity*=ramp(time,c.smallEnd,c.revealEnd)*(1-ramp(time,c.revealEnd,c.takeEnd));
      if(author){
        reverse.otherHand.getWorldPosition(this.grip);
        this.tip.copy(this.grip).add(this.direction.set(.12+Math.sin(time*9)*.025,.12+Math.cos(time*8)*.025,.04).multiplyScalar(this.height));
        this.penAt(this.grip,this.tip,this.alpha);
      }else{
        wrist.getWorldPosition(this.grip);this.tipAt(kind,time,this.tip);
        if(kind==='leek'&&time>c.smallEnd){this.local.copy(this.grip).addScaledVector(UP,c.brushLength*this.height);this.tip.lerp(this.local,ramp(time,c.smallEnd,c.smallEnd+.25));}
        this.penAt(this.grip,this.tip,this.alpha);
      }
    }else{
      this.root.visible=false;this.preview.update(false,delta,c.fade,0);this.preview.trail.visible=false;
      this.brush.visible=this.alpha>.002;for(const material of this.materials)material.opacity=this.alpha;
    }
  }
  get busy(){return this.alpha>0||this.preview.alpha>0;}
  getBounds(kind){
    const center=this.point(kind==='reverse'?-.2:-.1,kind==='reverse'?.68:.77,kind==='reverse'?.14:.2,new Vector3());
    return new Box3().setFromCenterAndSize(center,new Vector3(kind==='reverse'?.8:.5,kind==='reverse'?1:.62,.6).multiplyScalar(this.height));
  }
  dispose(){this.preview.dispose();this.previewHost.removeFromParent();this.root.removeFromParent();this.brush.removeFromParent();for(const mesh of Object.values(this.sketches))mesh.geometry.dispose();for(const item of [...this.geometries,...this.materials,this.inkMaterial])item.dispose();this.alpha=0;}
}
