import { MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, element, config) {
    this.camera = camera;
    this.config = config;
    this.controls = new OrbitControls(camera, element);
    this.onInteraction = () => this.stopShoeOrbit();
    this.controls.addEventListener('start', this.onInteraction);
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

  frame(bounds, preserveView = false) {
    const direction = preserveView ? this.camera.position.clone().sub(this.controls.target).normalize() : new Vector3(0, 0, 1);
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
    this.shoeBounds = shoeBounds?.clone();
    this.frame(bounds);
  }

  showStage(bounds) { if(bounds){this.stopShoeOrbit();this.frame(bounds);} }

  startShoeOrbit() {
    if (!this.shoeBounds) return false;
    this.stopShoeOrbit();
    this.frame(this.shoeBounds);
    this.controls.autoRotateSpeed = 60 / this.config.camera.shoes.lapSeconds;
    this.controls.autoRotate = true;
    return true;
  }

  stopShoeOrbit() { this.controls.autoRotate = false; }
  get shoeOrbitActive() { return this.controls.autoRotate; }

  reset() {
    this.stopShoeOrbit();
    if (this.modelBounds || this.bounds) this.frame(this.modelBounds || this.bounds);
  }
  resize() { if (this.bounds) this.frame(this.bounds, true); }
  update(delta) { this.controls.update(delta); }
  dispose() { this.stopShoeOrbit(); this.controls.removeEventListener('start', this.onInteraction); this.controls.dispose(); }
}
