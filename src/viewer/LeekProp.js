import {
  BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, SphereGeometry, Vector3,
} from 'three';

// Original, low-poly ink-painted prop. All geometry/textures are local resources;
// twelve fixed trail samples replace particles/postprocessing.
export class LeekProp {
  constructor(hand, palm, root, height, config) {
    this.hand = hand; this.root = root; this.height = height; this.config = config;
    this.alpha = 0; this.sampleTime = 0; this.disposed = false;
    this.group = new Group(); this.group.name = 'si-ink-leek'; this.group.visible = false;
    this.handInverse = new Quaternion(); this.upright = new Quaternion(); this.upAxis = new Vector3(0,0,1);
    this.tip = new Vector3(); this.local = new Vector3(); this.side = new Vector3();
    this.scale = hand.getWorldScale(new Vector3());
    this.group.scale.set(height / this.scale.x, height / this.scale.y, height / this.scale.z);
    this.group.quaternion.copy(hand.getWorldQuaternion(new Quaternion()).invert());
    this.group.position.copy(hand.worldToLocal(palm.getWorldPosition(new Vector3()))).multiplyScalar(.7);
    hand.add(this.group);
    this.materials = []; this.geometries = []; this.textures = [];
    const stem = new CylinderGeometry(config.stemRadius*.7, config.stemRadius, config.stemLength, 9);
    stem.translate(0, config.stemLength*.35, 0);
    const stemMaterial = new MeshStandardMaterial({color:0xe6e8cb,roughness:1,transparent:true});
    this.add(stem,stemMaterial);
    const texture = this.paintTexture();
    for(let leaf=0;leaf<4;leaf++) {
      const positions=[],uv=[],indices=[];
      for(let j=0;j<=7;j++) {
        const t=j/7, spread=(leaf-1.5)*.34;
        const width=config.leafWidth*Math.sin(Math.PI*(t*.9+.05))*(1-t*.5);
        const x=Math.sin(spread)*t*t*.09;
        const y=config.stemLength*.68+t*config.leafLength*(1-Math.abs(spread)*.12);
        const z=(leaf%2 ? 1:-1)*t*t*.025;
        positions.push(x-width/2,y,z,x+width/2,y,z+.002);
        uv.push(0,t,1,t);
        if(j<7){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
      }
      const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
      const material=new MeshBasicMaterial({color:leaf%2?0x749a70:0x456c53,map:texture,side:DoubleSide,transparent:true,forceSinglePass:true,alphaTest:.08,depthWrite:false});
      this.add(geometry,material);
    }
    this.face = new Group(); this.face.visible = false; this.group.add(this.face);
    const faceGeometry = new SphereGeometry(1, 6, 4);
    const faceMaterial = new MeshBasicMaterial({color:0x202a21, transparent:true});
    this.geometries.push(faceGeometry); this.materials.push(faceMaterial);
    for (let i=0;i<3;i++) {
      const mark = new Mesh(faceGeometry,faceMaterial);
      mark.position.set(i===2?0:(i?1:-1)*.0032,config.stemLength*.4-(i===2?.006:0),config.stemRadius+.001);
      mark.scale.set(i===2?.003:.0014,i===2?.0008:.0021,.0007);
      this.face.add(mark);
    }
    this.points=Array.from({length:config.trailSamples},()=>new Vector3());
    this.trailGeometry=new BufferGeometry();
    this.trailGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array((config.trailSamples-1)*18),3));
    this.trailMaterial=new MeshBasicMaterial({color:0x94aa89,side:DoubleSide,transparent:true,forceSinglePass:true,opacity:.25,depthWrite:false});
    this.trail=new Mesh(this.trailGeometry,this.trailMaterial);this.trail.name='si-ink-trail';this.trail.frustumCulled=false;this.trail.visible=false;root.add(this.trail);
  }

  add(geometry,material){this.geometries.push(geometry);this.materials.push(material);this.group.add(new Mesh(geometry,material));}

  paintTexture() {
    // Node's rig tests run without a DOM; the browser creates the dry-brush map.
    if(typeof document==='undefined'||!document.createElement)return null;
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    const wash=ctx.createLinearGradient(0,0,128,0);wash.addColorStop(0,'rgba(255,255,255,0)');wash.addColorStop(.16,'#a9b49c');wash.addColorStop(.5,'#e5e7cf');wash.addColorStop(.84,'#83967d');wash.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=wash;ctx.fillRect(0,0,128,256);
    // Deterministic broken strokes leave transparent gaps at the brush edges.
    for(let j=0;j<46;j++){const x=(j*37)%128,y=(j*53)%256;ctx.clearRect(x,y,1+(j%3),12+(j%31));ctx.fillStyle='rgba(25,45,34,.16)';ctx.fillRect(x+3,y,1,20+j%43)}
    const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;this.textures.push(texture);return texture;
  }

  setFace(visible) { this.face.visible = visible; }

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
    for(const item of [...this.geometries,...this.materials,...this.textures,this.trailGeometry,this.trailMaterial])item.dispose();
  }
}
