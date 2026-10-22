import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, CanvasTexture, Group, MeshBasicMaterial, PlaneGeometry } from 'three';
import { ModelManager } from '../viewer/ModelManager.js';
import { SeatedRider } from './SeatedRider.js';
import { animateCompanion } from './RideProps.js';

// Optional second actor. Owns its loader and model resources; never replaces
// the viewer's current character or creates another renderer / frame loop.
export class RideOpponent {
  constructor(stage) {
    this.stage = stage;
    this.models = new ModelManager(new Group(), stage.models.config);
    this.root = new Group(); this.root.scale.setScalar(.9); stage.root.add(this.root); this.root.visible = false;
    this.request = 0; this.ready = this.loading = false;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#23372dcf'; ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#e5eac6'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('祀 · 御筆飛行', 128, 34);
    this.badge = stage.mesh(stage.own(new PlaneGeometry(2.4, .45)), stage.own(new MeshBasicMaterial({ map: stage.own(new CanvasTexture(canvas)), transparent: true, depthWrite: false })), this.root, [0, 3.8, 0]);
    const ropeGeometry=stage.own(new BufferGeometry());ropeGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(27),3));
    this.rope=new Line(ropeGeometry,stage.own(new LineBasicMaterial({color:0xd9d9b8})));this.root.add(this.rope);
  }

  async setEnabled(enabled) {
    if (enabled && this.ready) return true;
    const request = ++this.request;
    this.clear();
    if (!enabled) return false;
    this.loading = true;
    try {
      const base = import.meta.env?.BASE_URL || './';
      const asset = typeof __MODEL_ASSETS__ !== 'undefined' ? __MODEL_ASSETS__['models/si.glb'] : null;
      const model = await this.models.load(`${base}models/si.glb`, undefined, { characterId: 'si', asset });
      if (!model || request !== this.request) return false;
      this.rig = new SeatedRider(model, this.stage.brushMount, 2.6, { sideSaddle: true });
      if (!this.rig.attach()) throw new Error('祀的坐姿尚未準備好，請關閉對手後先玩。');
      this.root.add(this.stage.brush); this.stage.brushSeat.rotation.y = 0;
      this.root.add(this.stage.inkBody);this.stage.inkBody.visible=true;
      this.stage.brush.visible = true; this.ready = true;
      return true;
    } catch (error) {
      if (request !== this.request) return false;
      this.clear(); throw error;
    } finally { if (request === this.request) this.loading = false; }
  }

  update(engine) {
    const r = engine.rival;
    if (!this.ready || !r.enabled) { this.root.visible = false; return; }
    this.root.visible = Math.abs(r.progress - engine.progress) < 95;
    if (!this.root.visible) return;
    this.stage.brush.visible = true; this.stage.brushSeat.rotation.y = 0;
    const center = this.stage.center;
    this.root.position.set(center(r.progress) + r.offset, .95 + Math.sin(r.clock * 3) * .08, -r.progress);
    const slope = center(r.progress + .5) - center(r.progress - .5);
    const bank = r.cornering ? Math.sign(engine.curvature(r.progress)) * -.18 : Math.sin(r.clock * 2) * .035;
    this.root.rotation.set(r.burst ? -.13 : -.03, -Math.atan(slope), bank);
    const reacting = r.clock < r.reactionUntil;
    this.rig.update(r.clock, bank, 0, { wave: r.windup>0||reacting && r.reaction !== 'passed', lookBack: reacting ? 1 : 0 });
    this.stage.brushCharge.visible=r.windup>0;
    this.stage.brushCharge.scale.setScalar(.8+Math.sin(r.clock*18)*.15);this.stage.brushCharge.rotation.z=r.clock*4;
    const ink=this.stage.inkBody;ink.visible=true;ink.scale.setScalar(.63);
    ink.position.set(Math.max(-2,Math.min(2,-bank*9)) + Math.sin(r.clock*3)*.18,.1+Math.sin(r.clock*5)*.09,4.4);
    ink.rotation.set(0,Math.atan2(this.stage.scene.camera.position.x-this.root.position.x,this.stage.scene.camera.position.z-this.root.position.z)-this.root.rotation.y,Math.sin(r.clock*5)*.1);
    animateCompanion(this.stage.inkProp,r.clock,{mood:r.burst?'panic':'smug',stress:r.burst ? .7 : 0});
    const points=this.rope.geometry.attributes.position;for(let i=0;i<9;i++){const a=i/8;points.setXYZ(i,ink.position.x*a,.65-Math.sin(a*Math.PI)*.15,2.8+(ink.position.z-2.8)*a);}points.needsUpdate=true;
    this.badge.quaternion.copy(this.stage.scene.camera.quaternion);
    this.badge.rotateY(-this.root.rotation.y);
    this.stage.flames.forEach((flame, i) => { flame.scale.y = (r.burst ? 3 : .65) + Math.sin(r.clock * 20 + i) * .2; flame.position.x = (i - 1.5) * .14 + Math.sin(r.clock * 8 + i) * .07; });
  }

  clear() {
    this.rig?.restore(); this.rig = null;
    this.models.current?.group.removeFromParent(); this.models.dispose();
    this.stage.raft.add(this.stage.brush); this.stage.brush.visible = false;
    this.stage.pet.add(this.stage.inkBody);this.stage.inkBody.visible=false;this.stage.inkBody.position.set(0,0,0);this.stage.inkBody.scale.setScalar(.85);
    this.root.visible = this.ready = this.loading = false;
  }
  dispose() { ++this.request; this.clear(); this.root.removeFromParent(); }
}
