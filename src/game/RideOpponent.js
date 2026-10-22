import { CanvasTexture, Group, MeshBasicMaterial, PlaneGeometry } from 'three';
import { ModelManager } from '../viewer/ModelManager.js';
import { SeatedRider } from './SeatedRider.js';

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
    this.rig.update(r.clock, bank, 0, { wave: reacting && r.reaction !== 'passed', lookBack: reacting ? 1 : 0 });
    this.badge.quaternion.copy(this.stage.scene.camera.quaternion);
    this.badge.rotateY(-this.root.rotation.y);
    this.stage.flames.forEach((flame, i) => { flame.scale.y = (r.burst ? 3 : .65) + Math.sin(r.clock * 20 + i) * .2; flame.position.x = (i - 1.5) * .14 + Math.sin(r.clock * 8 + i) * .07; });
  }

  clear() {
    this.rig?.restore(); this.rig = null;
    this.models.current?.group.removeFromParent(); this.models.dispose();
    this.stage.raft.add(this.stage.brush); this.stage.brush.visible = false;
    this.root.visible = this.ready = this.loading = false;
  }
  dispose() { ++this.request; this.clear(); this.root.removeFromParent(); }
}
