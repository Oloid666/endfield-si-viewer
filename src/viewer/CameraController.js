import { MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, element, config) {
    this.camera = camera;
    this.config = config;
    this.controls = new OrbitControls(camera, element);
    this.shoeLevel=0;this.story=null;
    this.interacting=false;
    this.onInteraction = () => { this.interacting=true;this.transition=null;this.stopShoeOrbit();if(this.story)this.story.manual=true; };
    this.onInteractionEnd=()=>{this.interacting=false;};
    this.controls.addEventListener('start', this.onInteraction);
    this.controls.addEventListener('end', this.onInteractionEnd);
    Object.assign(this.controls, {
      enableDamping: true,
      dampingFactor: config.controls.dampingFactor,
      minPolarAngle: config.controls.minPolarAngle,
      maxPolarAngle: config.controls.maxPolarAngle,
    });
  }

  setViewportInsets(width, height, top, bottom, left = 0, right = 0) {
    this.visibleHeightRatio = Math.max(0.2, (height - top - bottom) / height);
    this.visibleWidthRatio = Math.max(0.2, (width - left - right) / width);
    this.camera.setViewOffset(width, height, (right - left) / 2, (bottom - top) / 2, width, height);
  }

  frame(bounds, preserveView = false, directionOverride = null) {
    this.transition = null;
    const direction = directionOverride || (preserveView ? this.camera.position.clone().sub(this.controls.target).normalize() : new Vector3(0, 0, 1));
    const zoom = preserveView && this.fitDistance ? this.camera.position.distanceTo(this.controls.target) / this.fitDistance : 1;
    const pan = preserveView && this.bounds ? this.controls.target.clone().sub(this.bounds.getCenter(new Vector3())) : new Vector3();
    // Flush any remaining damping before replacing the view.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.bounds = bounds.clone();
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const vertical = MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const right = new Vector3().crossVectors(this.camera.up, direction).normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    let fitDistance = 0;
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      const corner = new Vector3(size.x * x, size.y * y, size.z * z);
      const depth = corner.dot(direction);
      fitDistance = Math.max(fitDistance,
        Math.abs(corner.dot(up)) / (Math.tan(vertical) * (this.visibleHeightRatio || 1)) + depth,
        Math.abs(corner.dot(right)) / (Math.tan(horizontal) * (this.visibleWidthRatio || 1)) + depth);
    }
    this.fitDistance = fitDistance * this.config.camera.fitPadding;
    const distance = this.fitDistance * zoom;
    const scale = size.length();
    this.camera.near = Math.max(scale / 10000, 0.000001);
    this.camera.far = Math.max(this.fitDistance * this.config.controls.maxDistanceFactor * 4, scale * 10);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = scale * this.config.controls.minDistanceFactor;
    this.controls.maxDistance = Math.max(this.fitDistance * this.config.controls.maxDistanceFactor, this.controls.minDistance * 2);
    this.controls.target.copy(center).add(pan);
    this.camera.position.copy(this.controls.target).addScaledVector(direction, MathUtils.clamp(distance, this.controls.minDistance, this.controls.maxDistance));
    this.controls.update();
    this.controls.saveState();
    this.controls.enableDamping = damping;
  }

  setModel(bounds, shoeBounds) {
    this.stopShoeOrbit();
    this.modelBounds = bounds.clone();
    this.shoeLevel=0;this.story=null;
    this.shoePresets=Array.isArray(shoeBounds)?shoeBounds.map(b=>b.clone()):[];
    if(!Array.isArray(shoeBounds)&&shoeBounds)this.shoePresets=this.config.camera.shoes.stages.map((stage,i)=>{const b=shoeBounds.clone();if(i)b.expandByScalar(-Math.min(...b.getSize(new Vector3()).toArray())*i*.12);return b;});
    this.shoeBounds=this.shoePresets[0];
    this.frame(bounds);
  }

  showStage(bounds, smooth=false, preserveDirection=false) {
    if(!bounds)return;
    const startPosition=this.camera.position.clone(),startTarget=this.controls.target.clone();
    const direction=preserveDirection?startPosition.clone().sub(startTarget).normalize():null;
    this.stopShoeOrbit();this.shoeLevel=0;this.frame(bounds,false,direction);
    if(smooth){
      this.transition={time:0,startPosition,startTarget,endPosition:this.camera.position.clone(),endTarget:this.controls.target.clone()};
      this.camera.position.copy(startPosition);this.controls.target.copy(startTarget);
    }
  }
  showBack() {
    if(!this.modelBounds)return;
    if(this.story)this.story.manual=true;
    const startPosition=this.camera.position.clone(),startTarget=this.controls.target.clone();
    const direction=startPosition.clone().sub(startTarget).normalize();
    direction.applyAxisAngle(this.camera.up,Math.PI);
    this.stopShoeOrbit();this.shoeLevel=0;this.frame(this.modelBounds,false,direction);
    this.transition={time:0,startPosition,startTarget,endPosition:this.camera.position.clone(),endTarget:this.controls.target.clone(),orbit:true,
      startAngle:Math.atan2(direction.x,direction.z)-Math.PI,endAngle:Math.atan2(direction.x,direction.z),startDistance:startPosition.distanceTo(startTarget)};
  }
  advanceShoeView(){
    const next=(this.shoeLevel+1)%4;
    if(!next){this.reset(true);return 0;}
    const bounds=this.shoePresets[next-1];if(!bounds)return this.shoeLevel;
    this.story=null;this.showStage(bounds,true,true);this.shoeLevel=next;
    this.controls.autoRotateSpeed=60/this.config.camera.shoes.stages[next-1].lapSeconds;
    if(this.transition)this.transition.resumeOrbit=true;else this.controls.autoRotate=true;
    return next;
  }
  startShoeOrbit(){this.shoeLevel=0;return this.advanceShoeView()>0;}
  stopShoeOrbit(){this.controls.autoRotate=false;if(this.transition)this.transition.resumeOrbit=false;}
  get shoeOrbitActive(){return !!(this.controls.autoRotate||this.transition?.resumeOrbit);}
  startStory(kind){this.story={kind,shot:'',manual:false};this.stopShoeOrbit();this.shoeLevel=0;}
  updateStory(idle,models){
    if(!this.story||this.story.manual||idle?.gestureTime==null||idle.reverseChoice==='pending')return;
    const kind=this.story.kind,t=idle.gestureTime,c=this.config.idle;
    let shot='full',bounds=models.current.bounds;
    if(kind==='leek'){
      if(t<c.leekStory.beats.dance){shot='drawing';bounds=models.getDrawingBounds(kind);}
      else if(t>=c.leekStory.beats.pose){shot='reaction';bounds=models.getReactionBounds();}
    }else if(kind==='reverse'){
      shot='wide';bounds=models.getReverseBounds();
      if(t<c.reverse.beats.limbs){shot='drawing';bounds=models.getDrawingBounds(kind);}
      if(t>=c.reverse.beats.release&&t<c.reverse.beats.windmill){shot='fake-ending';bounds=models.current.bounds;}
    }else if(t>=4.7&&t<6.5||t>=8.7){shot='caught';bounds=models.getFaceBounds();}
    if(shot!==this.story.shot){this.story.shot=shot;this.showStage(bounds,true);}
  }
  endStory(){const manual=this.story?.manual;this.story=null;if(!manual)this.reset(true);}

  reset(smooth=false) {
    this.stopShoeOrbit();this.shoeLevel=0;
    if(this.modelBounds||this.bounds)this.showStage(this.modelBounds||this.bounds,smooth);
  }
  resize() {
    if(!this.bounds)return;
    if(this.transition){const level=this.shoeLevel,resume=this.transition.resumeOrbit;this.showStage(this.bounds,true);this.shoeLevel=level;if(this.transition)this.transition.resumeOrbit=resume;}
    else this.frame(this.bounds,true);
  }
  update(delta) {
    if (this.transition) {
      const t = this.transition;
      t.time += delta;
      const weight = MathUtils.smoothstep(t.time, 0, t.orbit?1.1:.55);
      this.controls.target.lerpVectors(t.startTarget, t.endTarget, weight);
      if(t.orbit){
        const angle=MathUtils.lerp(t.startAngle,t.endAngle,weight),distance=MathUtils.lerp(t.startDistance,t.endPosition.distanceTo(t.endTarget),weight);
        const y=MathUtils.lerp(t.startPosition.y-t.startTarget.y,t.endPosition.y-t.endTarget.y,weight),radius=Math.sqrt(Math.max(0,distance*distance-y*y));
        this.camera.position.set(this.controls.target.x+Math.sin(angle)*radius,this.controls.target.y+y,this.controls.target.z+Math.cos(angle)*radius);
      }else this.camera.position.lerpVectors(t.startPosition, t.endPosition, weight);
      if (weight === 1) { const resume=t.resumeOrbit;this.transition=null;if(resume)this.controls.autoRotate=true; }
    }
    this.controls.update(delta);
  }
  dispose() { this.stopShoeOrbit(); this.controls.removeEventListener('start', this.onInteraction); this.controls.removeEventListener('end',this.onInteractionEnd);this.controls.dispose(); }
}
