import { Plane, Raycaster, Vector3 } from 'three';

// A short, stationary single-pointer tap selects attention. Orbit drags, long
// presses and multi-touch gestures stay entirely with OrbitControls.
export class GazePointer {
  constructor(element, camera, config, getAnchor, onPoint) {
    this.element = element;
    this.camera = camera;
    this.config = config;
    this.getAnchor = getAnchor;
    this.onPoint = onPoint;
    this.pointers = new Set();
    this.ray = new Raycaster(); this.plane = new Plane();
    this.normal = new Vector3(); this.center = new Vector3(); this.point = new Vector3();
    this.down = (event) => {
      this.pointers.add(event.pointerId);
      if (this.pointers.size !== 1 || !event.isPrimary) { this.tap = null; return; }
      this.tap = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
    };
    this.move = (event) => {
      if (this.tap && Math.hypot(event.clientX-this.tap.x, event.clientY-this.tap.y) > config.tapTolerance) this.tap = null;
    };
    this.up = (event) => {
      const tap = this.tap;
      this.pointers.delete(event.pointerId); this.tap = null;
      if (!tap || tap.id !== event.pointerId || performance.now()-tap.time > config.tapMaxMs || Math.hypot(event.clientX-tap.x, event.clientY-tap.y) > config.tapTolerance) return;
      const anchor = getAnchor();
      if (!anchor) return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.center.subVectors(camera.position, anchor.position);
      const distance = Math.min(anchor.height*config.pointPlaneDistance, this.center.length()*.6);
      this.center.normalize().multiplyScalar(distance).add(anchor.position);
      camera.getWorldDirection(this.normal);
      this.plane.setFromNormalAndCoplanarPoint(this.normal, this.center);
      this.ray.setFromCamera({ x: (event.clientX-rect.left)/rect.width*2-1, y: 1-(event.clientY-rect.top)/rect.height*2 }, camera);
      if (this.ray.ray.intersectPlane(this.plane, this.point)) onPoint(this.point);
    };
    this.cancel = (event) => { this.pointers.delete(event.pointerId); this.tap = null; };
    for (const [type, handler] of this.handlers()) element.addEventListener(type, handler, { passive: true });
  }

  handlers() { return [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['lostpointercapture',this.cancel]]; }
  dispose() { for (const [type, handler] of this.handlers()) this.element.removeEventListener(type, handler); this.pointers.clear(); this.tap = null; }
}
