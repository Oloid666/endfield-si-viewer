import { MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
  constructor(camera, element, config) {
    this.camera = camera;
    this.config = config;
    this.controls = new OrbitControls(camera, element);
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

  frame(bounds) {
    // Flush any remaining damping before replacing the view.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.bounds = bounds.clone();
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const vertical = MathUtils.degToRad(this.camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    const distance = (Math.max(size.y / (2 * Math.tan(vertical) * (this.visibleHeightRatio || 1)), size.x / (2 * Math.tan(horizontal) * (this.visibleWidthRatio || 1))) + size.z / 2) * this.config.camera.fitPadding;
    const scale = size.length();
    this.camera.near = Math.max(scale / 10000, 0.000001);
    this.camera.far = Math.max(distance * this.config.controls.maxDistanceFactor * 4, scale * 10);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = scale * this.config.controls.minDistanceFactor;
    this.controls.maxDistance = Math.max(distance * this.config.controls.maxDistanceFactor, this.controls.minDistance * 2);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new Vector3(0, 0, distance));
    this.controls.update();
    this.controls.saveState();
    this.controls.enableDamping = damping;
  }

  reset() { if (this.bounds) this.frame(this.bounds); }
  resize() { this.reset(); }
  update() { this.controls.update(); }
  dispose() { this.controls.dispose(); }
}
