import './styles/main.css';
import { ActionPanel } from './ui/ActionPanel.js';
import { InkTheater } from './ui/InkTheater.js';
import { ComicEffects } from './ui/ComicEffects.js';
import { GazePointer } from './ui/GazePointer.js';
import { loadingStatus } from './ui/loadingStatus.js';
import { viewerConfig } from './config/viewerConfig.js';
import { SceneManager } from './viewer/SceneManager.js';
import { ModelManager } from './viewer/ModelManager.js';
import { CameraController } from './viewer/CameraController.js';
import { ViewerDialogue } from './ui/ViewerDialogue.js';
import { PhotographyController } from './viewer/PhotographyController.js';
import { RhythmGame } from './game/RhythmGame.js';
import { GameStage } from './game/GameStage.js';
import { climbConfig } from './config/climbConfig.js';
import { ClimbStage } from './game/ClimbStage.js';
import { ClimbGame } from './game/ClimbGame.js';
import { EscapeGame } from './game/EscapeGame.js';
import { EscapeStage } from './game/EscapeStage.js';
import { escapeLevels } from './config/escapeConfig.js';
import { RaftGame } from './game/RaftGame.js';
import { RaftStage } from './game/RaftStage.js';
import { RideGame } from './game/RideGame.js';
import { RideStage } from './game/RideStage.js';

const status = document.querySelector('#status');
const fileInput = document.querySelector('#model-file');
const reset = document.querySelector('#reset');
const idleButton = document.querySelector('#idle-toggle');
const shoeButton = document.querySelector('#shoe-orbit');
const faceControls = document.querySelector('#face-controls');
const expressionButtons = [...document.querySelectorAll('[data-expression]')];
const strengthInput = document.querySelector('#expression-strength');
const gazeSelect = document.querySelector('#gaze-mode');
const loadPanel=document.querySelector('#load-panel');
const loadTitle=document.querySelector('#load-title');
const loadDetail=document.querySelector('#load-detail');
const loadProgress=document.querySelector('#load-progress');
strengthInput.max = String(viewerConfig.face.maxStrength*100);
const faceHint = document.querySelector('#face-hint');
let expressionSelection = 'neutral';
let comics;
let theater;
let background;
let cameraMode = 'full';
let dialogue;
let photography;
let game;
let gameStage;
let climb;
let escapeGame;
let raft;
let ride;
let hiddenEscapeModel;
let zone='si';
let lastViewerZone='si';
let graphicsLost=false;
let zoneHashListener;
const quickStop = document.querySelector('#quick-stop');
strengthInput.value = String(viewerConfig.face.defaultStrength*100);
function showFace() {
  if (cameraMode === 'face') return;
  if(camera.story)camera.story.manual=true;
  cameraMode = 'face'; camera.showStage(models.getFaceBounds(), true); syncShoeButton();
}
let gazePointer;

function applyExpression() {
  models?.setExpression(expressionSelection, Number(strengthInput.value)/100);
  document.querySelector('#expression-value').value = `${strengthInput.value}%`;
  document.querySelector('#expression-value').classList.toggle('exaggerated', Number(strengthInput.value)>50);
  for (const button of expressionButtons) button.setAttribute('aria-pressed', String(button.dataset.expression === expressionSelection));
}

function updateFaceHint() {
  faceHint.textContent = faceControls.disabled ? '此模型不支援表情與眼神控制。' : gazeSelect.value === 'point'
    ? '輕點 3D 畫面選擇注視位置；拖曳與雙指仍控制鏡頭。'
    : '動作播放時優先使用動作表情；重設視角可回到全身。';
}
let previousShoeState;

function syncShoeButton() {
  const level=camera?.shoeLevel||0,active=!!camera?.shoeOrbitActive;
  const state=`${level}:${active}`;if(state===previousShoeState)return;previousShoeState=state;
  const labels=['合乎周禮','合乎舟禮','給我飯盒','吃飽了'];
  shoeButton.textContent=labels[level];shoeButton.setAttribute('aria-label',labels[level]);shoeButton.setAttribute('aria-pressed',String(level>0));
  const hint=document.querySelector('#shoe-status');hint.hidden=!level;hint.textContent=level?viewerConfig.camera.shoes.stages[level-1].short:'';
}
const gestureButtons = [...document.querySelectorAll('[data-gesture]')];
const gestureLabels = new Map(gestureButtons.map((button) => [button, button.textContent]));
let previousGestureState;

function syncGestureButtons() {
  const idle = models?.current?.idle;
  const settling=!!(idle?.rescueTime!=null||idle?.reverse?.landing||idle?.transition||idle?.drawing?.busy||idle?.leek?.alpha||idle?.chorus?.entries.some(({prop})=>prop.alpha>0));
  const active=idle?.gestureTime!=null?idle.gestureKind:actionPanel?.session&&settling?'settling':'';
  if(actionPanel?.session&&!active){camera?.endStory();actionPanel.update(false);}
  quickStop.hidden = !active || panelToggle.getAttribute('aria-expanded') === 'true';
  const state = `${!!idle?.head}:${active}`;
  if (state === previousGestureState) return;
  previousGestureState = state;
  for (const button of gestureButtons) {
    button.disabled = !idle?.head || (!!active && active !== button.dataset.gesture);
    button.textContent = active === button.dataset.gesture ? `■ 停止${gestureLabels.get(button)}` : gestureLabels.get(button);
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
  panelToggle.textContent = expanded ? '⌄' : '☰';
  panelToggle.setAttribute('aria-label', expanded ? '收合操作' : '展開操作');
  document.querySelector('#panel-content').hidden = !expanded;
}
const actionPanel=new ActionPanel(panel,setPanelExpanded);
panelToggle.addEventListener('click', () => { actionPanel.manualToggle();setPanelExpanded(panelToggle.getAttribute('aria-expanded') !== 'true'); });

let scene;
let models;
let camera;
let requestId = 0;
let observer;

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.loading = String(!error && !message.includes('載入完成'));
  status.classList.toggle('error', error);
  if (error) { setPanelExpanded(true); document.querySelector('#other-panel').open = true; }
}

async function loadModel(url, label, isDefault = false, characterKey='si') {
  const id = ++requestId;
  actionPanel.cancel();
  dialogue?.cancel();photography?.reset();
  showStatus(`載入 ${label}…`);
  const character=isDefault?viewerConfig.characters[characterKey]:null;
  game?.setReady(false);
  climb?.setReady(false);
  raft?.setReady(false);
  ride?.setReady(false);
  loadPanel.hidden=false;loadTitle.textContent=character?`正在下載${character.name}`:`正在載入 ${label}`;
  loadProgress.removeAttribute('value');loadProgress.hidden=false;
  const asset=character?(viewerConfig.modelTransfer.assets[character.path]||(characterKey==='si'?viewerConfig.modelTransfer.asset:null)):null;
  const zipped=asset&&typeof DecompressionStream==='function';
  loadDetail.textContent=asset?`首次下載約 ${((zipped?asset.gzipBytes:asset.bytes)/1e6).toFixed(2)} MB；成功後會快取在此瀏覽器。`:'正在讀取模型與貼圖…';
  try {
    const model = await models.load(url, (event) => {
      if (id !== requestId) return;
      showStatus(loadingStatus(label, event));
      const loaded=(event.loaded/1e6).toFixed(2),total=event.total>0?(event.total/1e6).toFixed(2):null;
      loadDetail.textContent=total?`已下載 ${loaded} / ${total} MB`:`已下載 ${loaded} MB`;
      if(event.total>0){loadProgress.max=100;loadProgress.value=Math.min(100,event.loaded/event.total*100);}
    },{asset,viewNodes:character?.viewNodes,characterId:character?characterKey:null,compressedUrl:zipped?`${import.meta.env.BASE_URL}${asset.gzipPath}`:null,onState:state=>{
      if(id!==requestId)return;
      const messages={retry:'連線中斷，正在重新下載…',cached:'正在讀取本機快取…',decompress:'正在解壓縮模型…',parse:'正在處理模型與貼圖…'};
      loadTitle.textContent=messages[state]||'正在載入模型…';showStatus(loadTitle.textContent);
      if(state==='retry'){loadProgress.removeAttribute('value');loadDetail.textContent='已重新連線；也可直接選手機裡的 GLB。';}
    }});
    if (!model || id !== requestId) return;
    document.querySelector('#model-credit').hidden = !isDefault;
    document.querySelector('#model-credit').open = false;
    if(character){
      document.querySelector('#source-model-link').href=character.source;document.querySelector('#source-model-link').textContent=character.sourceName;
      document.querySelector('#source-description').textContent=characterKey==='si'?'原模型檔未改動；本站加入骨骼待機與原創互動':'原模型檔未改動；本區提供模型觀看與鏡頭操作';
      document.querySelector('#character-name').textContent=character.name;document.querySelector('#character-subtitle').textContent=character.subtitle;
    }
    camera.setModel(model.bounds, models.getShoePresets());
    cameraMode = 'full';
    document.querySelector('#full-body').disabled = false;
    document.querySelector('#back-view').disabled = false;
    document.querySelector('#face-closeup').disabled = !models.getGazeAnchor();
    shoeButton.disabled = false;
    syncShoeButton();
    reset.disabled = false;
    idleButton.disabled = !model.idle.supported;
    faceControls.disabled = !model.idle.expression;
    applyExpression();
    models.setGazeMode(gazeSelect.value);
    updateFaceHint();
    syncGestureButtons();
    idleButton.textContent = model.idle.supported ? '暫停待機' : '靜態模型展示';
    idleButton.setAttribute('aria-pressed', String(model.idle.supported));
    showStatus(character ? `${character.name} · 載入完成` : `${label} · 載入完成`);
    loadPanel.hidden=true;
    game?.setReady(model.characterId==='si'&&!!model.idle.leek);
    climb?.setReady(zone==='climb'&&model.characterId==='si'&&model.idle.supported);
    raft?.setReady(zone==='raft'&&model.characterId==='si'&&model.idle.supported);
    ride?.setReady(zone==='ride'&&model.characterId===ride.character);
  } catch (error) {
    if (id !== requestId) return;
    console.error('Model load failed:', error);
    const network=error.code==='stalled'||error.code==='timeout'||error.code==='http'||error instanceof TypeError;
    loadTitle.textContent=network?'下載連線中斷':'模型載入失敗';loadProgress.hidden=true;
    loadDetail.textContent=network?'已停止空等。可按重新下載，或直接選手機裡的 GLB。':'請重試，或選有效、內嵌貼圖的 GLB 檔案。';
    showStatus(`${loadTitle.textContent}。${models.current?'原模型仍可操作。':'請重試或載入本機 GLB。'}`,true);
  }
}

try {
  scene = new SceneManager(document.querySelector('#viewport'), viewerConfig, () => {
    graphicsLost=true;game?.pause();climb?.pause();
    raft?.pause();raft?.setReady(false);ride?.pause();ride?.setReady(false);
    escapeGame?.setAvailable(false);
    climb?.setReady(false);
    showStatus('WebGL 繪圖連線已中斷，請重新整理頁面。', true);
    loadPanel.hidden=false;loadTitle.textContent='3D 繪圖已中斷';loadProgress.hidden=true;loadDetail.textContent='請重新整理頁面，已下載的模型可從快取讀取。';
    document.querySelector('#retry-model').textContent='重新整理頁面';
    document.querySelectorAll('.zone-nav button,#game-hub button,#full-body,#face-closeup,#back-view').forEach(button=>{button.disabled=true;});
    fileInput.disabled = true;
    reset.disabled = true;
    idleButton.disabled = true;
    shoeButton.disabled = true;
    faceControls.disabled = true;
    for (const button of gestureButtons) button.disabled = true;
  });
  document.querySelector('#status').dataset.loading = 'true';
  theater = new InkTheater(document.querySelector('#viewport'),document.querySelector('#app'),viewerConfig.idle.theater);
  background = scene.scene.background;
  comics = new ComicEffects(document.querySelector('#viewport'), viewerConfig.face.comic);
  dialogue = new ViewerDialogue(document.querySelector('#app'),viewerConfig.interactions.dialogue);
  photography = new PhotographyController(viewerConfig.interactions.photography,line=>dialogue.cameraLine(line));
  camera = new CameraController(scene.camera, scene.renderer.domElement, viewerConfig);
  models = new ModelManager(scene.scene, viewerConfig);
  gameStage=new GameStage(models,viewerConfig.game);
  gazePointer = new GazePointer(scene.renderer.domElement, scene.camera, viewerConfig.gaze,
    () => gazeSelect.value === 'point' ? models.getGazeAnchor() : null,
    (point) => models.setGazePoint(point));
  for (const button of expressionButtons) button.addEventListener('click', () => {
    if(expressionSelection!==button.dataset.expression){strengthInput.value='0';dialogue.cancel();}
    expressionSelection = button.dataset.expression;
    applyExpression(); showFace();
    dialogue.expression(expressionSelection,Number(strengthInput.value)/100);
  });
  strengthInput.addEventListener('input', () => { dialogue.cancel();applyExpression(); showFace(); });
  strengthInput.addEventListener('change',()=>dialogue.expression(expressionSelection,Number(strengthInput.value)/100));
  gazeSelect.addEventListener('change', () => { models.setGazeMode(gazeSelect.value); updateFaceHint(); showFace(); });
  document.querySelector('#face-closeup').addEventListener('click', () => {
    cameraMode = 'full'; showFace();
    syncShoeButton();
  });
  const resize = () => {
    scene.resize();
    const viewport = document.querySelector('#viewport').getBoundingClientRect();
    const header = document.querySelector('header').getBoundingClientRect();
    const panel = document.querySelector('.panel').getBoundingClientRect();
    const nav=document.querySelector('.zone-nav').getBoundingClientRect();
    if(zone==='hub')return;
    if(zone==='raft'){raft?.stage.frameCamera(raft.engine);return;}
    if(zone==='ride'){ride?.stage.frameCamera(ride.engine);return;}
    if(zone==='escape'){
      escapeGame?.stage.frameCamera(true);return;
    }else if(zone==='climb'){
      climb?.stage.frameCamera(true);return;
    }else if(zone==='game'){
      const hud=document.querySelector('.game-hud')?.getBoundingClientRect();
      const pads=document.querySelector('#game-chart')?.getBoundingClientRect();
      if(viewport.width>viewport.height)camera.setViewportInsets(viewport.width,viewport.height,nav.bottom+10,16,0,viewport.width*.45);
      else camera.setViewportInsets(viewport.width,viewport.height,Math.max(nav.bottom,hud?.bottom||0)+30,pads?.height?viewport.bottom-pads.top:90);
    }else if (viewport.width > viewport.height && panel.right < viewport.width * 0.65) {
      camera.setViewportInsets(viewport.width, viewport.height, 0, 0, Math.max(header.right, panel.right));
    } else {
      camera.setViewportInsets(viewport.width, viewport.height, Math.max(header.bottom,nav.bottom), viewport.bottom - panel.top);
    }
    camera.resize();
  };
  observer = new ResizeObserver(resize);
  observer.observe(document.querySelector('#viewport'));
  observer.observe(document.querySelector('.panel'));
  async function selectZone(next){
    if(graphicsLost||!['si','zhuang','hub','game','climb','escape','raft','ride'].includes(next))return;
    if(game?.active)game.leave();
    if(climb?.active)climb.leave();
    if(escapeGame?.active)escapeGame.leave();
    if(raft?.active)raft.leave();
    if(ride?.active)ride.leave();
    if(hiddenEscapeModel){hiddenEscapeModel.group.visible=hiddenEscapeModel.visible;hiddenEscapeModel=null;}
    ++requestId;models.cancelLoad();models.stopGesture();actionPanel.cancel();dialogue.cancel();photography.reset();camera.story=null;
    zone=next;if(!['hub','game','climb','escape','raft','ride'].includes(next))lastViewerZone=next;
    document.querySelector('#app').dataset.zone=next;
    document.querySelector('#game-hub').hidden=next!=='hub';
    history.replaceState(null,'',next==='ride'?`?rider=${ride.character}#ride`:`#${next}`);
    for(const button of document.querySelectorAll('.zone-nav button[data-zone]'))button.setAttribute('aria-pressed',String(button.dataset.zone===next||(['game','climb','escape','raft','ride'].includes(next)&&button.dataset.zone==='hub')));
    document.querySelector('#face-panel').hidden=next==='zhuang';document.querySelector('#action-section').hidden=next==='zhuang';
    camera.controls.enabled=!['hub','game','climb','escape','raft','ride'].includes(next);setPanelExpanded(false);cameraMode=['hub','game','climb','escape','raft','ride'].includes(next)?next:'full';
    if(next==='escape'||next==='hub'){
      if(models.current){hiddenEscapeModel={group:models.current.group,visible:models.current.group.visible};models.current.group.visible=false;}
      loadPanel.hidden=true;camera.stopShoeOrbit();if(next==='escape')escapeGame.enter();resize();return;
    }
    if(next==='game')game.enter();
    if(next==='climb')climb.enter();
    if(next==='raft')raft.enter();
    if(next==='ride')ride.enter();
    const key=next==='ride'?ride.character:next==='zhuang'?'zhuang':'si',character=viewerConfig.characters[key];
    resize();
    if(models.current?.characterId===key){
      loadPanel.hidden=true;camera.reset();game.setReady(key==='si'&&!!models.current.idle.leek&&!models.current.idle.transition&&!models.current.idle.reverse?.landing);showStatus(`${character.name} · 載入完成`);
      climb.setReady(next==='climb'&&key==='si'&&models.current.idle.supported);
      raft.setReady(next==='raft'&&key==='si'&&models.current.idle.supported);
      ride.setReady(next==='ride'&&key===ride.character);
    }else await loadModel(`${import.meta.env.BASE_URL}${character.path}`,character.name,true,key);
  }
  game=new RhythmGame(document.querySelector('#game-root'),viewerConfig.game,{
    exit:()=>selectZone('hub'),
    start:()=>{const ok=gameStage.start(scene.camera.position);if(ok){camera.showStage(models.current.bounds);resize();}return ok;},
    frame:(time,phase)=>{gameStage.prepare(time,phase);if(phase!==game.lastShot){game.lastShot=phase;camera.showStage(phase==='reverse'?models.getReverseBounds():models.current.bounds,true);}},
    stop:()=>{gameStage.stop();game.lastShot=null;},
    hit:(side,result,time)=>gameStage.hit(side,result,time),
  });
  climb=new ClimbGame(document.querySelector('#climb-root'),new ClimbStage(scene,camera,models,climbConfig),climbConfig,{
    exit:()=>selectZone('hub'),view:()=>selectZone(lastViewerZone),
  });
  escapeGame=new EscapeGame(document.querySelector('#escape-root'),new EscapeStage(scene,camera,models,escapeLevels[0]),{exit:()=>selectZone('hub')});
  raft=new RaftGame(document.querySelector('#raft-root'),new RaftStage(scene,camera,models),{exit:()=>selectZone('hub')});
  ride=new RideGame(document.querySelector('#ride-root'),new RideStage(scene,camera,models),{exit:()=>selectZone('hub'),character:key=>{ride.character=key;selectZone('ride');}});
  for(const button of document.querySelectorAll('#game-hub [data-open]'))button.addEventListener('click',()=>selectZone(button.dataset.open));
  for(const button of document.querySelectorAll('.zone-nav button[data-zone]'))button.addEventListener('click',()=>selectZone(button.dataset.zone));
  zoneHashListener=()=>{const next=location.hash.slice(1);if(next!==zone&&['si','zhuang','hub','game','climb','escape','raft','ride'].includes(next))selectZone(next);};
  window.addEventListener('hashchange',zoneHashListener);
  observer.observe(document.querySelector('#game-chart'));
  resize();
  scene.start((delta) => {
    if(zone==='ride'){ride.update(delta);theater.update(null,delta);comics.update(delta,scene.camera,null,null,true);return;}
    if(zone==='raft'){raft.update(delta);theater.update(null,delta);comics.update(delta,scene.camera,null,null,true);return;}
    if(zone==='hub'){theater.update(null,delta);scene.scene.background=background;comics.update(delta,scene.camera,null,null,true);return;}
    if(zone==='escape'){
      escapeGame.update(delta);theater.update(null,delta);scene.scene.background=background;
      comics.update(delta,scene.camera,null,null,true);return;
    }
    if(zone==='climb'){
      climb.update(delta);theater.update(null,delta);scene.scene.background=background;
      comics.update(delta,scene.camera,null,null,true);return;
    }
    game.update();camera.update(delta);
    const idle = models.current?.idle;
    if(zone==='game'&&['idle','results'].includes(game.state)){
      const ready=models.current?.characterId==='si'&&!!idle?.leek&&!idle.transition&&!idle.reverse?.landing;
      if(game.ready!==ready)game.setReady(ready);
    }
    const busy=zone==='game'||!!(idle?.gestureTime!=null||idle?.rescueTime!=null||idle?.reverse?.landing||idle?.transition);
    if(idle)idle.photoLean=photography.update(delta,scene.camera,camera.controls.target,models.getGazeAnchor(),busy,!!camera.transition||camera.interacting);
    if(!photography.close&&dialogue.session?.camera)dialogue.cancel();
    if(idle)idle.dialogueReaction=dialogue.update(delta,busy);
    if(!(zone==='game'&&game.state==='paused')){
      models.update(delta,scene.camera.position);if(gameStage.active)gameStage.afterUpdate(delta,game.engine.elapsed,game.engine.phase);
    }
    if(zone!=='game')camera.updateStory(idle,models);syncGestureButtons();syncShoeButton();
    scene.scene.background = theater.update(zone==='game'?null:idle,delta) ? null : background;
    comics.update(delta, scene.camera, models.getGazeAnchor(), idle?.expression, busy);
  });
  idleButton.addEventListener('click', () => {
    const playing = idleButton.getAttribute('aria-pressed') !== 'true';
    models.setIdlePlaying(playing);
    idleButton.setAttribute('aria-pressed', String(playing));
    idleButton.textContent = playing ? '暫停待機' : '播放待機';
  });
  const fullView = () => { if(camera.story)camera.story.manual=true;cameraMode = 'full'; camera.reset(); syncShoeButton(); };
  reset.addEventListener('click', fullView);
  document.querySelector('#full-body').addEventListener('click', fullView);
  document.querySelector('#back-view').addEventListener('click',()=>{dialogue.cancel();cameraMode='back';camera.showBack();syncShoeButton();});
  quickStop.addEventListener('click', () => { models.stopGesture(); syncGestureButtons(); });
  shoeButton.addEventListener('click', () => {
    cameraMode = 'shoe';
    camera.advanceShoeView();
    syncShoeButton();
  });
  for (const button of gestureButtons) button.addEventListener('click', () => {
    if (models.current?.idle.gestureKind === button.dataset.gesture && models.current.idle.gestureTime !== null) models.stopGesture();
    else if (models.playGesture(scene.camera.position, button.dataset.gesture)) {
      dialogue.cancel();photography.reset();
      cameraMode = 'action';
      actionPanel.start();
      camera.startStory(button.dataset.gesture);
      camera.updateStory(models.current.idle,models);
    }
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
  document.querySelector('#retry-model').addEventListener('click',()=>{if(graphicsLost){location.reload();return;}const key=zone==='ride'?ride.character:zone==='zhuang'?'zhuang':'si',c=viewerConfig.characters[key];loadModel(`${import.meta.env.BASE_URL}${c.path}`,c.name,true,key);});
  selectZone(['si','zhuang','hub','game','climb','escape','raft','ride'].includes(location.hash.slice(1))?location.hash.slice(1):'si');
} catch (error) {
  console.error(error);
  showStatus('無法啟動 WebGL 3D 顯示。請使用支援 WebGL 的 Safari／Chrome／Edge，並確認硬體加速可用。', true);
  fileInput.disabled = true;
  loadPanel.hidden=false;loadTitle.textContent='無法啟動 3D 顯示';loadProgress.hidden=true;
  loadDetail.textContent='請使用支援 WebGL 的 Safari／Chrome／Edge，並確認硬體加速可用。';
  document.querySelector('#retry-model').disabled=true;
  scene?.dispose();
}

// pagehide also runs for Safari's back/forward cache; preserve that session.
window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  ++requestId;
  game?.dispose();
  climb?.dispose();
  escapeGame?.dispose();
  raft?.dispose();
  ride?.dispose();
  window.removeEventListener('hashchange',zoneHashListener);
  observer?.disconnect();
  gazePointer?.dispose();
  comics?.dispose();
  theater?.dispose();
  dialogue?.dispose();
  camera?.dispose();
  models?.dispose();
  scene?.dispose();
});
