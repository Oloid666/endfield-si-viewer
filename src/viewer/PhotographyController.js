import { MathUtils, Vector3 } from 'three';

// Reads actual framing, including manual zoom/pan. No timer or extra RAF.
export class PhotographyController {
  constructor(config, speak) {
    this.config = config; this.speak = speak; this.last = new Vector3(); this.reset();
  }
  reset() { this.close = false; this.lean = 0; this.dwell = 0; this.spoken = false; this.initialized = false; }
  update(delta, camera, target, anchor, blocked = false, moving = false) {
    const c = this.config;
    if (!anchor || blocked) { this.reset(); return 0; }
    const h = anchor.height;
    const speed = this.initialized && delta > 0 ? camera.position.distanceTo(this.last)/(h*delta) : Infinity;
    this.last.copy(camera.position); this.initialized = true;
    const frontal = camera.position.z-anchor.position.z > h*.05;
    const close = frontal && camera.position.distanceTo(anchor.position) < h*c.closeDistance && target.distanceTo(anchor.position) < h*c.targetRadius;
    if (!close) { this.dwell = 0; this.spoken = false; }
    else if (!this.spoken) {
      if (moving || speed > c.stillSpeed) this.dwell = 0;
      else this.dwell += delta;
      if (this.dwell >= c.dwellSeconds && this.speak('……看夠了？') !== false) this.spoken = true;
    }
    this.close = close;
    this.lean = MathUtils.lerp(this.lean,close?1:0,1-Math.exp(-delta*c.response));
    return this.lean;
  }
}
