import { Scene, PerspectiveCamera, WebGLRenderer, Color, AmbientLight, DirectionalLight } from 'three';

export class SceneManager {
  constructor(container, config, onContextLost) {
    this.container = container;
    this.config = config;
    this.scene = new Scene();
    this.scene.background = new Color(config.background);
    this.camera = new PerspectiveCamera(config.camera.fov, 1, config.camera.near, config.camera.far);
    this.renderer = new WebGLRenderer({ antialias: config.renderer.antialias, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.renderer.maxPixelRatio));
    container.append(this.renderer.domElement);
    this.contextLost = (event) => { event.preventDefault(); this.stop(); onContextLost(); };
    this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
    this.scene.add(new AmbientLight(config.lights.ambient.color, config.lights.ambient.intensity));
    for (const settings of [config.lights.directional, config.lights.fill, config.lights.rim].filter(Boolean)) {
      const light = new DirectionalLight(settings.color, settings.intensity);
      light.position.fromArray(settings.position);
      this.scene.add(light);
    }
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.config.renderer.maxPixelRatio));
    this.renderer.setSize(width, height);
  }

  // A future postprocessing pipeline can replace this method.
  render() { this.renderer.render(this.scene, this.camera); }

  start(update) {
    this.stop();
    let previous;
    this.renderer.setAnimationLoop((now) => {
      if (document.hidden) { previous = undefined; return; }
      const delta = previous === undefined ? 0 : Math.max(0, (now - previous) / 1000);
      previous = now;
      update(delta);
      this.render();
    });
  }

  stop() { this.renderer.setAnimationLoop(null); }

  dispose() {
    this.stop();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
