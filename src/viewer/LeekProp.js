import {
  BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3,
} from 'three';

// Original, low-poly ink-painted prop. All geometry/textures are local resources;
// twelve fixed trail samples replace particles/postprocessing.
export class LeekProp {
  constructor(hand, palm, root, height, config, variant = 'held') {
    this.hand = hand; this.root = root; this.height = height; this.config = config;
    this.variant = variant; this.design = config.design[variant];
    this.expression = 'hidden';
    this.alpha = 0; this.sampleTime = 0; this.disposed = false;
    this.group = new Group(); this.group.name = 'si-ink-leek'; this.group.visible = false;
    this.handInverse = new Quaternion(); this.upright = new Quaternion(); this.upAxis = new Vector3(0,0,1);
    this.tip = new Vector3(); this.local = new Vector3(); this.side = new Vector3();
    this.scale = hand.getWorldScale(new Vector3());
    this.group.scale.set(height / this.scale.x, height / this.scale.y, height / this.scale.z);
    this.group.quaternion.copy(hand.getWorldQuaternion(new Quaternion()).invert());
    this.group.position.copy(hand.worldToLocal(palm.getWorldPosition(new Vector3()))).multiplyScalar(.7);
    hand.add(this.group);
    this.restPosition=this.group.position.clone();
    this.materials = []; this.geometries = []; this.textures = [];
    this.assets = acquirePaintAssets();
    const texture = this.assets.brush;
    this.textures = [texture,this.assets.face].filter(Boolean);
    const stem = new CylinderGeometry(config.stemRadius,config.stemRadius,config.stemLength,10,8);
    const positions = stem.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const t=positions.getY(i)/config.stemLength+.5;
      const radius=this.stemRadius(t)/config.stemRadius;
      positions.setXYZ(i,positions.getX(i)*radius+this.stemBend(t),(t-.15)*config.stemLength,positions.getZ(i)*radius);
    }
    stem.computeVertexNormals();
    const stemMaterial = new MeshStandardMaterial({color:0xe1e8cc,roughness:1,transparent:true});
    this.stemMesh=this.add(stem,stemMaterial);
    const leafMaterial=new MeshBasicMaterial({vertexColors:true,map:texture,side:DoubleSide,transparent:true,forceSinglePass:true,alphaTest:.08,depthWrite:false});
    this.crownMesh=this.add(this.crownGeometry(),leafMaterial);
    this.cowlick=new Group();this.cowlick.position.set(this.design.spread*.45,config.stemLength*.68+config.leafLength*.58,0);this.group.add(this.cowlick);
    const cowlickGeometry=this.ribbonGeometry(config.design.cowlick.length,config.design.cowlick.width,.025);
    const cowlickMaterial=new MeshBasicMaterial({color:0x6d8a50,map:texture,side:DoubleSide,transparent:true,forceSinglePass:true,alphaTest:.08,depthWrite:false});
    this.geometries.push(cowlickGeometry);this.materials.push(cowlickMaterial);this.cowlick.add(new Mesh(cowlickGeometry,cowlickMaterial));
    this.cowlick.rotation.z=config.design.cowlick.angle;
    const roots=this.roots=new Group();roots.position.set(this.stemBend(0),-config.stemLength*.15,0);this.group.add(roots);
    const rootGeometry=this.ribbonGeometry(.025,.0016,.009);
    const rootMaterial=new MeshBasicMaterial({color:0x5d6046,map:texture,side:DoubleSide,transparent:true,forceSinglePass:true,alphaTest:.08});
    // Three whiskers are merged into one mesh, keeping the silhouette inexpensive.
    const rootPositions=[],rootUV=[],rootIndices=[];
    for(let i=0;i<3;i++){
      const p=rootGeometry.getAttribute('position'),uv=rootGeometry.getAttribute('uv'),base=rootPositions.length/3;
      for(let j=0;j<p.count;j++){rootPositions.push(p.getX(j)+(i-1)*.003,-p.getY(j),p.getZ(j)+(i-1)*.002);rootUV.push(uv.getX(j),uv.getY(j));}
      for(const index of rootGeometry.index.array)rootIndices.push(base+index);
    }
    rootGeometry.dispose();
    const mergedRoots=new BufferGeometry();mergedRoots.setAttribute('position',new Float32BufferAttribute(rootPositions,3));mergedRoots.setAttribute('uv',new Float32BufferAttribute(rootUV,2));mergedRoots.setIndex(rootIndices);
    this.geometries.push(mergedRoots);this.materials.push(rootMaterial);roots.add(new Mesh(mergedRoots,rootMaterial));
    // Conform the face directly to the bent stem: no detached paper mask.
    this.faceGeometry=new BufferGeometry();
    const facePosition=[],faceUV=[],faceIndex=[];
    for(let row=0;row<2;row++)for(let i=0;i<=16;i++){
      const t=.56+(row-.5)*.43,angle=(i/16-.5)*1.9,radius=this.stemRadius(t)+.00035;
      facePosition.push(this.stemBend(t)+Math.sin(angle)*radius,(t-.15)*config.stemLength,Math.cos(angle)*radius);
      faceUV.push(i/16,row);
      if(row===0&&i<16)faceIndex.push(i,i+1,i+17,i+1,i+18,i+17);
    }
    this.faceGeometry.setAttribute('position',new Float32BufferAttribute(facePosition,3));this.faceGeometry.setAttribute('uv',new Float32BufferAttribute(faceUV,2));this.faceGeometry.setIndex(faceIndex);
    this.faceMaterial=new MeshBasicMaterial({color:0xffffff,map:this.assets.face,side:DoubleSide,transparent:true,alphaTest:.05,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    this.face=new Mesh(this.faceGeometry,this.faceMaterial);this.face.visible=false;this.group.add(this.face);
    this.geometries.push(this.faceGeometry);this.materials.push(this.faceMaterial);
    this.points=Array.from({length:config.trailSamples},()=>new Vector3());
    this.trailGeometry=new BufferGeometry();
    this.trailGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array((config.trailSamples-1)*18),3));
    this.trailMaterial=new MeshBasicMaterial({color:0x94aa89,side:DoubleSide,transparent:true,forceSinglePass:true,opacity:.25,depthWrite:false});
    this.trail=new Mesh(this.trailGeometry,this.trailMaterial);this.trail.name='si-ink-trail';this.trail.frustumCulled=false;this.trail.visible=false;root.add(this.trail);
  }

  add(geometry,material){this.geometries.push(geometry);this.materials.push(material);const mesh=new Mesh(geometry,material);this.group.add(mesh);return mesh;}

  setReveal(progress){
    const p=MathUtils.clamp(progress,0,1);
    const stem=this.stemMesh.geometry,crown=this.crownMesh.geometry;
    if(!this.sortedStem){
      const indices=Array.from(stem.index.array),position=stem.getAttribute('position'),triangles=[];
      for(let i=0;i<indices.length;i+=3)triangles.push(indices.slice(i,i+3));
      triangles.sort((a,b)=>a.reduce((sum,j)=>sum+position.getY(j),0)-b.reduce((sum,j)=>sum+position.getY(j),0));
      stem.setIndex(triangles.flat());this.sortedStem=true;
    }
    stem.setDrawRange(0,Math.floor(Math.min(1,p/.3)*stem.index.count/3)*3);
    crown.setDrawRange(0,Math.floor(MathUtils.clamp((p-.3)/.7,0,1)*crown.index.count/3)*3);
    this.cowlick.visible=p>.94;this.roots.visible=p>.3;
  }
  placeAt(world,weight){
    this.group.position.copy(this.restPosition);
    if(weight>0){this.local.copy(world);this.hand.worldToLocal(this.local);this.group.position.lerp(this.local,weight);}
  }

  stemRadius(t){return this.config.stemRadius*this.design.radius*(.82+.26*(1-t)**2);}
  stemBend(t){return this.design.bend*(t*t-.25*t);}

  ribbonGeometry(length,width,bend){
    const p=[],uv=[],index=[];
    for(let i=0;i<=8;i++){
      const t=i/8,w=width*Math.sin(Math.PI*(t*.94+.03))*(1-t*.65),x=bend*t*t;
      p.push(x-w/2,t*length,0,x+w/2,t*length,.001*Math.sin(t*Math.PI));uv.push(0,t,1,t);
      if(i<8){const a=i*2;index.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(index);return geometry;
  }

  crownGeometry(){
    const p=[],uv=[],colors=[],indices=[],c=this.config,d=this.design;
    const palette=[[.22,.38,.24],[.34,.52,.3],[.27,.44,.28]];
    for(let leaf=0;leaf<3;leaf++){
      const side=leaf-1,base=p.length/3;
      for(let j=0;j<=10;j++){
        const t=j/10,width=c.leafWidth*d.leafWidth*Math.sin(Math.PI*(t*.96+.025))*(1-t*.6);
        const x=this.stemBend(.83)+side*d.spread*t*t;
        const y=c.stemLength*.68+t*c.leafLength*d.leafLength*(side?.85:1);
        const z=(side?-.012:.014)*Math.sin(t*Math.PI);
        p.push(x-width/2,y,z,x+width/2,y,z+.005*Math.sin(t*Math.PI));uv.push(0,t,1,t);
        colors.push(...palette[leaf],...palette[leaf]);
        if(j<10){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
    }
    const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(p,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setAttribute('color',new Float32BufferAttribute(colors,3));geometry.setIndex(indices);return geometry;
  }

  setFace(expression){
    const selection=expression===true?'peek':expression || 'hidden';
    this.face.visible=selection!=='hidden';
    if(selection===this.expression)return;
    this.expression=selection;
    const column=Math.max(0,['peek','serious','dead','smug'].indexOf(selection));
    const uv=this.faceGeometry.getAttribute('uv');
    for(let i=0;i<uv.count;i++)uv.setX(i,(column+(i%17)/16)/4);
    uv.needsUpdate=true;
  }

  perform(seconds,expression,mischief=0){
    this.setFace(expression);
    const c=this.config.design.cowlick;
    this.cowlick.rotation.z=c.angle+Math.sin(seconds*c.frequency)*c.amplitude*mischief;
  }

  update(active,delta,fadeDuration,tilt=0) {
    if(this.disposed)return;
    this.alpha=MathUtils.clamp(this.alpha+(active?1:-1)*delta/fadeDuration,0,1);
    this.group.visible=this.alpha>0;this.trail.visible=this.alpha>0;
    for(const material of this.materials)material.opacity=this.alpha;
    if(!this.alpha){this.sampleTime=0;this.initialized=false;return;}
    this.hand.getWorldQuaternion(this.handInverse).invert();
    if(active)this.tilt=tilt;
    this.upright.setFromAxisAngle(this.upAxis,this.tilt || 0);
    this.group.quaternion.copy(this.handInverse.multiply(this.upright));
    this.group.updateWorldMatrix(true,false);
    this.tip.set(0,this.config.stemLength*.68+this.config.leafLength,0);this.group.localToWorld(this.tip);this.root.worldToLocal(this.tip);
    if(!this.initialized){for(const point of this.points)point.copy(this.tip);this.initialized=true;}
    this.sampleTime+=delta;
    if(this.sampleTime>=this.config.trailStep){
      // A long frame expires the old trail instead of drawing a screen-wide streak.
      if(delta>.15)for(const point of this.points)point.copy(this.tip);
      else {for(let j=this.points.length-1;j>0;j--)this.points[j].copy(this.points[j-1]);this.points[0].copy(this.tip);}
      this.sampleTime%=this.config.trailStep;
    }
    const attribute=this.trailGeometry.getAttribute('position');let index=0;
    for(let j=0;j<this.points.length-1;j++){
      const a=this.points[j],b=this.points[j+1];
      this.side.subVectors(b,a);this.side.set(this.side.y,-this.side.x,0).normalize().multiplyScalar(this.height*this.config.trailWidth*(1-j/this.points.length));
      for(const [point,sign] of [[a,1],[a,-1],[b,1],[a,-1],[b,-1],[b,1]]){this.local.copy(point).addScaledVector(this.side,sign);attribute.setXYZ(index++,this.local.x,this.local.y,this.local.z)}
    }
    attribute.needsUpdate=true;this.trailMaterial.opacity=.26*this.alpha;
  }

  dispose(){
    if(this.disposed)return;this.disposed=true;this.group.removeFromParent();this.trail.removeFromParent();
    for(const item of [...this.geometries,...this.materials,this.trailGeometry,this.trailMaterial])item.dispose();
    releasePaintAssets(this.assets);
  }
}

// All held, giant and chorus onions share two generated maps for this model session.
let paintAssets;
function acquirePaintAssets(){
  if(!paintAssets)paintAssets={users:0,brush:paintBrush(),face:paintFaces()};
  paintAssets.users++;return paintAssets;
}
function releasePaintAssets(assets){
  assets.users--;if(assets.users===0){assets.brush?.dispose();assets.face?.dispose();if(paintAssets===assets)paintAssets=null;}
}
function canvasTexture(width,height,paint){
  if(typeof document==='undefined'||!document.createElement)return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return null;paint(ctx);
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}
function paintBrush(){return canvasTexture(128,256,ctx=>{
  const wash=ctx.createLinearGradient(0,0,128,0);wash.addColorStop(0,'rgba(255,255,255,0)');wash.addColorStop(.16,'#a9b49c');wash.addColorStop(.5,'#e5e7cf');wash.addColorStop(.84,'#83967d');wash.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=wash;ctx.fillRect(0,0,128,256);
  for(let j=0;j<46;j++){const x=(j*37)%128,y=(j*53)%256;ctx.clearRect(x,y,1+j%3,12+j%31);ctx.fillStyle='rgba(25,45,34,.16)';ctx.fillRect(x+3,y,1,20+j%43);}
});}
function paintFaces(){return canvasTexture(512,128,ctx=>{
  for(let mode=0;mode<4;mode++){
    ctx.save();ctx.translate(mode*128,0);ctx.strokeStyle='#142219';ctx.fillStyle='#142219';ctx.lineWidth=7;ctx.lineCap='round';
    const line=(x,y,a,b)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(a,b);ctx.stroke();};
    if(mode===0){line(24,53,47,57);ctx.beginPath();ctx.ellipse(88,56,6,11,0,0,Math.PI*2);ctx.fill();line(71,33,98,28);}
    if(mode===1){line(22,53,47,57);line(80,57,105,53);line(22,34,47,41);line(80,41,105,34);}
    if(mode===2){line(22,58,47,58);line(80,58,105,58);}
    if(mode===3){line(22,50,47,57);line(80,57,105,50);line(22,28,47,36);}
    ctx.beginPath();ctx.moveTo(49,91);ctx.quadraticCurveTo(66,mode===3?104:mode===0?99:91,82,mode===0?84:91);ctx.stroke();ctx.restore();
  }
});}
