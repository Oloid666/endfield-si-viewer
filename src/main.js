import './styles/main.css';
import { viewerConfig } from './config/viewerConfig.js';
import { SceneManager } from './viewer/SceneManager.js';
import { ModelManager } from './viewer/ModelManager.js';
import { CameraController } from './viewer/CameraController.js';

const status = document.querySelector('#status');
const fileInput = document.querySelector('#model-file');
const reset = document.querySelector('#reset');
const idleButton = document.querySelector('#idle-toggle');
const gestureButtons = [...document.querySelectorAll('[data-gesture]')];
const gestureLabels = new Map(gestureButtons.map((button) => [button, button.textContent]));
let previousGestureState;

function syncGestureButtons() {
  const idle = models?.current?.idle;
  const active = idle?.gestureTime != null ? idle.gestureKind : '';
  const state = `${!!idle?.head}:${active}`;
  if (state === previousGestureState) return;
  previousGestureState = state;
  for (const button of gestureButtons) {
    button.disabled = !idle?.head || !!active;
    button.textContent = gestureLabels.get(button) + (active === button.dataset.gesture ? '…' : '');
    button.setAttribute('aria-busy', String(active === button.dataset.gesture));
  }
}
const panel = document.querySelector('.panel');
const panelToggle = document.querySelector('#panel-toggle');

function setPanelExpanded(expanded) {
  panel.dataset.expanded = String(expanded);
  panelToggle.setAttribute('aria-expanded', String(expanded));
  panelToggle.textContent = expanded ? '收合操作' : '展開操作';
  document.querySelector('#panel-content').hidden = !expanded;
}
panelToggle.addEventListener('click', () => setPanelExpanded(panelToggle.getAttribute('aria-expanded') !== 'true'));

let scene;
let models;
let camera;
let requestId = 0;
let observer;

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
  if (error) setPanelExpanded(true);
}

async function loadModel(url, label, isDefault = false) {
  const id = ++requestId;
  showStatus(`載入 ${label}…`);
  try {
    const model = await models.load(url, (event) => {
      if (id !== requestId) return;
      showStatus(event.total ? `載入 ${label}… ${Math.round(event.loaded / event.total * 100)}%` : `載入 ${label} 與貼圖…`);
    });
    if (!model || id !== requestId) return;
    document.querySelector('#model-credit').hidden = !isDefault;
    camera.frame(model.bounds);
    reset.disabled = false;
    idleButton.disabled = !model.idle.supported;
    syncGestureButtons();
    idleButton.textContent = model.idle.supported ? '暫停待機' : '模型不支援待機';
    idleButton.setAttribute('aria-pressed', String(model.idle.supported));
    showStatus(isDefault ? '祀 · 載入完成' : `${label} · 載入完成`);
  } catch (error) {
    if (id !== requestId) return;
    console.error('Model load failed:', error);
    showStatus(`無法載入 ${label}。請上傳有效、內嵌貼圖的 GLB；若使用外部資源，請檢查路徑與檔案。${models.current ? ' 原模型仍可操作。' : ''}`, true);
  }
}

try {
  scene = new SceneManager(document.querySelector('#viewport'), viewerConfig, () => {
    showStatus('WebGL 繪圖連線已中斷，請重新整理頁面。', true);
    fileInput.disabled = true;
    reset.disabled = true;
    idleButton.disabled = true;
    for (const button of gestureButtons) button.disabled = true;
  });
  camera = new CameraController(scene.camera, scene.renderer.domElement, viewerConfig);
  models = new ModelManager(scene.scene, viewerConfig);
  const resize = () => {
    scene.resize();
    const viewport = document.querySelector('#viewport').getBoundingClientRect();
    const header = document.querySelector('header').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    if (viewport.width > viewport.height && panel.right < viewport.width * 0.65) {
      camera.setViewportInsets(viewport.width, viewport.height, 0, 0, Math.max(header.right, panel.right));
    } else {
      camera.setViewportInsets(viewport.width, viewport.height, header.bottom, viewport.bottom - panel.top);
    }
    camera.resize();
  };
  observer = new ResizeObserver(resize);
  observer.observe(document.querySelector('#viewport'));
  observer.observe(document.querySelector('.panel'));
  resize();
  scene.start((delta) => { camera.update(); models.update(delta); syncGestureButtons(); });
  idleButton.addEventListener('click', () => {
    const playing = idleButton.getAttribute('aria-pressed') !== 'true';
    models.setIdlePlaying(playing);
    idleButton.setAttribute('aria-pressed', String(playing));
    idleButton.textContent = playing ? '暫停待機' : '播放待機';
  });
  reset.addEventListener('click', () => camera.reset());
  for (const button of gestureButtons) button.addEventListener('click', () => {
    models.playGesture(scene.camera.position, button.dataset.gesture);
    syncGestureButtons();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    if (!/\.glb$/i.test(file.name)) { showStatus('請選擇 .glb 模型檔案。', true); return; }
    const url = URL.createObjectURL(file);
    try { await loadModel(url, file.name); }
    finally { URL.revokeObjectURL(url); }
  });
  loadModel(`${import.meta.env.BASE_URL}${viewerConfig.modelPath}`, 'si.glb', true);
} catch (error) {
  console.error(error);
  showStatus('無法啟動 WebGL 3D 顯示。請使用支援 WebGL 的 Safari／Chrome／Edge，並確認硬體加速可用。', true);
  fileInput.disabled = true;
  scene?.dispose();
}

// pagehide also runs for Safari's back/forward cache; preserve that session.
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  ++requestId;
  observer?.disconnect();
  camera?.dispose();
  models?.dispose();
  scene?.dispose();
});
