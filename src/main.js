import './styles/main.css';
import { GazePointer } from './ui/GazePointer.js';
import { loadingStatus } from './ui/loadingStatus.js';
import { viewerConfig } from './config/viewerConfig.js';
import { SceneManager } from './viewer/SceneManager.js';
import { ModelManager } from './viewer/ModelManager.js';
import { CameraController } from './viewer/CameraController.js';

const status = document.querySelector('#status');
const fileInput = document.querySelector('#model-file');
const reset = document.querySelector('#reset');
const idleButton = document.querySelector('#idle-toggle');
const shoeButton = document.querySelector('#shoe-orbit');
const faceControls = document.querySelector('#face-controls');
const expressionButtons = [...document.querySelectorAll('[data-expression]')];
const strengthInput = document.querySelector('#expression-strength');
const gazeSelect = document.querySelector('#gaze-mode');
strengthInput.max = String(viewerConfig.face.maxStrength*100);
const faceHint = document.querySelector('#face-hint');
let expressionSelection = 'neutral';
let gazePointer;

function applyExpression() {
  models?.setExpression(expressionSelection, Number(strengthInput.value)/100);
  document.querySelector('#expression-value').value = `${strengthInput.value}%`;
  document.querySelector('#expression-value').classList.toggle('exaggerated', Number(strengthInput.value)>100);
  for (const button of expressionButtons) button.setAttribute('aria-pressed', String(button.dataset.expression === expressionSelection));
}

function updateFaceHint() {
  faceHint.textContent = faceControls.disabled ? '此模型不支援表情與眼神控制。' : gazeSelect.value === 'point'
    ? '輕點 3D 畫面選擇注視位置；拖曳與雙指仍控制鏡頭。'
    : '動作播放時優先使用動作表情；重設視角可回到全身。';
}
let previousShoeState;

function syncShoeButton() {
  const active = !!camera?.shoeOrbitActive;
  if (active === previousShoeState) return;
  previousShoeState = active;
  shoeButton.textContent = active ? '3 · 停止環繞' : '3 · 合乎周禮';
  shoeButton.setAttribute('aria-pressed', String(active));
  shoeButton.setAttribute('aria-label', active ? '停止鞋靴環繞' : '合乎周禮：鞋靴視角 360 度環繞');
}
const gestureButtons = [...document.querySelectorAll('[data-gesture]')];
const gestureLabels = new Map(gestureButtons.map((button) => [button, button.textContent]));
let previousGestureState;

function syncGestureButtons() {
  const idle = models?.current?.idle;
  const active = idle?.gestureTime != null ? idle.gestureKind : idle?.reverse?.landing ? 'landing' : '';
  if ((previousGestureState?.endsWith(':reverse') || previousGestureState?.endsWith(':landing')) && !active) camera?.reset();
  const state = `${!!idle?.head}:${active}`;
  if (state === previousGestureState) return;
  previousGestureState = state;
  for (const button of gestureButtons) {
    button.disabled = !idle?.head || (!!active && !(['leek','reverse'].includes(active) && button.dataset.gesture === active));
    button.textContent = ['leek','reverse'].includes(active) && button.dataset.gesture === active ? (active==='leek'?'2 · 停止甩蔥':'4 · 停止蔥甩蔥') : gestureLabels.get(button) + (active === button.dataset.gesture ? '…' : '');
    button.setAttribute('aria-pressed', String(active === button.dataset.gesture));
    button.setAttribute('aria-label', button.textContent);
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
      showStatus(loadingStatus(label, event));
    });
    if (!model || id !== requestId) return;
    document.querySelector('#model-credit').hidden = !isDefault;
    document.querySelector('#model-credit').open = false;
    camera.setModel(model.bounds, models.getShoeBounds());
    shoeButton.disabled = false;
    syncShoeButton();
    reset.disabled = false;
    idleButton.disabled = !model.idle.supported;
    faceControls.disabled = !model.idle.expression;
    applyExpression();
    models.setGazeMode(gazeSelect.value);
    updateFaceHint();
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
    shoeButton.disabled = true;
    faceControls.disabled = true;
    for (const button of gestureButtons) button.disabled = true;
  });
  camera = new CameraController(scene.camera, scene.renderer.domElement, viewerConfig);
  models = new ModelManager(scene.scene, viewerConfig);
  gazePointer = new GazePointer(scene.renderer.domElement, scene.camera, viewerConfig.gaze,
    () => gazeSelect.value === 'point' ? models.getGazeAnchor() : null,
    (point) => models.setGazePoint(point));
  for (const button of expressionButtons) button.addEventListener('click', () => {
    expressionSelection = button.dataset.expression;
    applyExpression();
  });
  strengthInput.addEventListener('input', applyExpression);
  gazeSelect.addEventListener('change', () => { models.setGazeMode(gazeSelect.value); updateFaceHint(); });
  document.querySelector('#face-closeup').addEventListener('click', () => {
    camera.showStage(models.getFaceBounds());
    syncShoeButton();
  });
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
  scene.start((delta) => { camera.update(delta); models.update(delta, scene.camera.position); syncGestureButtons(); syncShoeButton(); });
  idleButton.addEventListener('click', () => {
    const playing = idleButton.getAttribute('aria-pressed') !== 'true';
    models.setIdlePlaying(playing);
    idleButton.setAttribute('aria-pressed', String(playing));
    idleButton.textContent = playing ? '暫停待機' : '播放待機';
  });
  reset.addEventListener('click', () => { camera.reset(); syncShoeButton(); });
  shoeButton.addEventListener('click', () => {
    if (camera.shoeOrbitActive) camera.stopShoeOrbit();
    else camera.startShoeOrbit();
    syncShoeButton();
  });
  for (const button of gestureButtons) button.addEventListener('click', () => {
    if (['leek','reverse'].includes(button.dataset.gesture) && models.current?.idle.gestureKind === button.dataset.gesture && models.current.idle.gestureTime !== null) models.stopGesture();
    else if (models.playGesture(scene.camera.position, button.dataset.gesture) && button.dataset.gesture==='reverse') camera.showStage(models.getReverseBounds());
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
  gazePointer?.dispose();
  camera?.dispose();
  models?.dispose();
  scene?.dispose();
});
