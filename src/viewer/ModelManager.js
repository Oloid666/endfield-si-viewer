import { Box3, Group, Vector3 } from 'three';
import { IdleController } from './IdleController.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ModelManager {
  constructor(scene, config) {
    this.config = config;
    this.scene = scene;
    this.loader = new GLTFLoader();
    this.requestId = 0;
    this.current = null;
  }

  async load(url, onProgress) {
    const id = ++this.requestId;
    const gltf = await this.loader.loadAsync(url, onProgress);
    const group = new Group();
    const actor = new Group();
    actor.name = 'si-actor';
    actor.add(gltf.scene);
    group.add(actor);
    if (id !== this.requestId) { this.release(group); return null; }
    try {
      group.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(group, true);
      const size = bounds.getSize(new Vector3());
      if (bounds.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0) {
        throw new Error('模型沒有可顯示的幾何資料。');
      }
      // Move only a wrapper: preserve imported transforms, skeleton and scale.
      group.position.copy(bounds.getCenter(new Vector3())).negate();
      group.updateMatrixWorld(true);
      this.clear();
      this.current = { group, gltf, bounds: new Box3().setFromObject(group, true) };
      this.current.idle = new IdleController(gltf, this.config.idle, this.current.bounds, actor, this.config.face, this.config.gaze);
      this.scene.add(group);
      return this.current;
    } catch (error) { this.release(group); throw error; }
  }

  update(delta, cameraPosition) { this.current?.idle.update(delta, cameraPosition); }

  setExpression(selection, strength) { return this.current?.idle.expression?.setExpression(selection, strength); }
  setGazeMode(mode) { return this.current?.idle.look?.setMode(mode); }
  setGazePoint(point) { return this.current?.idle.look?.setPoint(point); }
  getGazeAnchor() {
    const idle = this.current?.idle;
    return idle?.head ? { position: idle.head.bone.getWorldPosition(new Vector3()), height: idle.height } : null;
  }
  getFaceBounds() {
    const anchor = this.getGazeAnchor();
    if (!anchor) return null;
    const preset = this.config.camera.face;
    anchor.position.y += anchor.height*preset.headOffset;
    return new Box3().setFromCenterAndSize(anchor.position, new Vector3(preset.width,preset.height,preset.depth).multiplyScalar(anchor.height));
  }

  setIdlePlaying(playing) { this.current?.idle.setPlaying(playing); }

  playGesture(cameraPosition, kind) { return this.current?.idle.playGesture(cameraPosition, kind); }

  getReverseBounds() {
    if (!this.current) return null;
    const {bounds}=this.current;
    const height=bounds.max.y-bounds.min.y;
    const center=bounds.getCenter(new Vector3());center.y=bounds.min.y+height*.64;center.x-=height*.1;
    const c=this.config.camera.reverse;
    return new Box3().setFromCenterAndSize(center,new Vector3(c.width,c.height,c.depth).multiplyScalar(height));
  }

  getShoeBounds() {
    if (!this.current) return null;
    const { bounds, idle } = this.current;
    const height = bounds.max.y - bounds.min.y;
    const preset = this.config.camera.shoes;
    const center = bounds.getCenter(new Vector3());
    // Use the original ankle locations, so character motions do not shake the camera.
    if (idle.legs) center.copy(idle.legs.L.anchor).add(idle.legs.R.anchor).multiplyScalar(0.5);
    center.y = bounds.min.y + height * preset.heightFactor / 2;
    return new Box3().setFromCenterAndSize(center, new Vector3(preset.widthFactor, preset.heightFactor, preset.depthFactor).multiplyScalar(height));
  }

  stopGesture() { return this.current?.idle.stopGesture(); }

  release(root) {
    const geometries = new Set();
    const materials = new Set();
    const textures = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
      object.skeleton?.dispose();
    });
    for (const geometry of geometries) geometry.dispose();
    const images = new Set();
    for (const texture of textures) { if (texture.source?.data) images.add(texture.source.data); texture.dispose(); }
    for (const image of images) image.close?.();
    for (const material of materials) material.dispose();
  }

  clear() {
    if (!this.current) return;
    this.current.idle.dispose();
    this.scene.remove(this.current.group);
    this.release(this.current.group);
    this.current = null;
  }

  dispose() { ++this.requestId; this.clear(); }
}
