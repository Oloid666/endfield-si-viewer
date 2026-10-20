# Endfield Si 3D Viewer

以 iPhone Safari 為優先的 Three.js 人物展示頁。已接入使用者從 Sketchfab 下載並提供的祀 GLB，附有模型來源與 CC BY 4.0 署名；詳見 `public/models/SOURCE.md`。無後端、資料庫或付費 API。

## 本機啟動

需要 Node.js 22.12+（或 20.19+）。

```sh
npm install
npm run dev
npm run build
npm run preview
```

在終端顯示的網址開啟。iPhone 與開發電腦位於同一網路時，可用電腦區網 IP 加上 Vite 的連接埠測試；需允許防火牆連線。

## 模型上傳與替換

- 預設將合法模型放在 `public/models/si.glb`，重新啟動／重新建置即可。
- 缺少模型時仍會顯示介面、錯誤訊息及「上傳本機 GLB」。選檔只在當前頁面記憶體使用，不會上傳或永久儲存；重新整理後恢復預設模型。
- 建議 GLB 內嵌貼圖。一般 GLTF 與外部貼圖可部署到 `public/models/`，再修改 `src/config/viewerConfig.js` 的 `modelPath`，保留 `.bin` 與貼圖的相對路徑；本機選檔目前只接受 GLB。
- 不附 Draco、Meshopt、KTX2 解碼器。遇到這些壓縮格式需先合法轉出一般 GLB，或後續按需要加入解碼器。
- 模型比例、材質、貼圖與骨架保持匯入狀態；只平移外層容器，不自動旋轉模型的朝向。若模型朝向不同，可自行旋轉觀看。
- 手機載入能力仍取決於模型大小、三角形數與貼圖解析度；建議先使用低負載版本，再於真機量測。

## 手機下載與離線快取

首次開啟時，支援原生 gzip 解壓縮的瀏覽器優先下載無損壓縮版：原模型 8,148,092 bytes，壓縮約 5.48 MB，減少約 33%。Vite 自動生成 `models/si.glb.gz` 及模型 SHA-256 版本，不修改原 GLB、材質或骨架；更換原檔後重新 build 即可，不需手動更新雜湊。舊瀏覽器或壓縮檔失效會退回原 GLB。

預設模型驗證成功後存進此瀏覽器的 Cache Storage，之後改版或重新整理可直接讀取模型，避免重複下載。模型版本變更時自動換新；私人瀏覽、容量不足或儲存不支援時仍可正常下載。瀏覽器可能自行清除快取，因此不保證永久離線。

下載 15 秒未收到資料會中止並重試一次，每次總下載上限 120 秒。載入畫面直接顯示已下載 MB、進度、重新下載及本機 GLB 入口；不必等到失敗才找選單。本機選檔會取消先前請求，且不會存進持久快取或上傳到伺服器。

## 操作

單指／左鍵旋轉，雙指縮放與平移，滾輪縮放，右鍵平移。水平可完整旋轉，垂直角度略避開極點。重設視角恢復完整模型的正面取景；視窗尺寸或方向改變時重新取景。

## 架構

```text
.github/workflows/deploy.yml
public/models/README.md
public/models/SOURCE.md
public/models/si.glb
src/
  main.js
  config/viewerConfig.js
  config/interactionConfig.js
  viewer/SceneManager.js
  viewer/ModelManager.js
  viewer/ModelTransfer.js
  viewer/CameraController.js
  viewer/IdleController.js
  viewer/FaceController.js
  viewer/GazeController.js
  viewer/PhotographyController.js
  viewer/BrushDrawing.js
  viewer/InkStage.js
  viewer/LeekChorus.js
  viewer/actionTimeline.js
  ui/ActionPanel.js
  ui/InkTheater.js
  ui/ComicEffects.js
  ui/ViewerDialogue.js
  ui/GazePointer.js
  viewer/LimbSolver.js
  viewer/LeekProp.js
  viewer/ReverseLeekController.js
  ui/loadingStatus.js
  styles/main.css
index.html
package.json
package-lock.json
vite.config.js
README.md
```

`SceneManager` 管理場景、光源、Renderer 與唯一渲染循環；`render()` 可在將來接後處理。`ModelManager.load(url, onProgress)` 處理 GLB／GLTF、置中與替換，`current.gltf` 保留動畫等匯入資訊，`clear()`／`dispose()` 釋放資源。`CameraController.frame(bounds)`／`reset()` 管理取景與控制。設定集中在 `viewerConfig`，模組間不循環依賴。

DPR 上限為 1.5，無陰影或後處理；頁面隱藏時跳過更新及繪製。支援 safe-area、動態視窗高度與 ResizeObserver。WebGL 初始化失敗及 context lost 均顯示提示。

## GitHub Pages

1. 將此目錄的內容推送至 GitHub Repository 的 `main` 分支（若使用其他分支，調整 Workflow）。不需將 `dist` 或 `node_modules` 推上去。
2. Repository → Settings → Pages → Build and deployment → Source 選擇 **GitHub Actions**。
3. Push 或在 Actions 手動執行 **Deploy GitHub Pages**。
4. Workflow 以 `npm ci` 安裝並 build，從 `configure-pages` 自動取得 base path，再部署 `dist`。完成後從 deployment URL 開啟。
5. 模型必須與程式碼一同部署到 `public/models/si.glb`。留意 GitHub 單檔與 Pages 容量限制；大型模型不應直接提交。

預設 Vite base 為 `./`，支援本機與子目錄預覽；Workflow 會依 Pages 設定覆寫。模型 URL 使用 `import.meta.env.BASE_URL`。手動測試指定子路徑：

```sh
VITE_BASE_PATH=/endfield-si-viewer/ npm run build
VITE_BASE_PATH=/endfield-si-viewer/ npm run preview
```

沒有前端路由，於 Pages 根入口 `/REPOSITORY/` 重新整理即可；沒有宣告任意深層網址路由。本專案 Repository 為 https://github.com/Oloid666/endfield-si-viewer ，公開網站預期網址為 https://oloid666.github.io/endfield-si-viewer/ ，部署狀態可至 Actions 查看。

## 測試

實測結果見 `TESTING.md`。桌面 Chromium 的行動 viewport 模擬不能替代 iPhone Safari 真機觸控與效能測試。已以使用者提供的祀模型實測 Chromium 顯示；手機負載仍需真機驗證。

## 現行互動與角色動作

底部 ☰ 選單分四個獨立收合區：表情與眼神、原創角色動作、視角、其他。面板只在內部捲動；上傳、待機暫停及第二層模型署名位於「其他」。

### 三個動作

- **釘宮祀萌**：10 秒，叉腰、別頭偷看、被抓包、跺腳及延遲回彈，再偷看一次。
- **源祀技藝**：15.6 秒，變出毛筆，在空中畫四筆蔥畫，立體化交到手上，搭配兩個完整八拍舞步和三根伴舞蔥；最後一根慢半拍。沒有音樂。
- **蔥末地**：巨大蔥畫到一半長出水墨四肢，對看 1.5 秒，抓住祀反甩。10 秒時停住，跳出通訊選擇，沒有倒數也不會自動選擇：
  - **小蔥，我馬上來幫你！**：真的救援，跳過加碼，角色嘴硬道謝後回待機。
  - **別急，我給蔥續個八拍。**：恢復假結束停頓，再跳出「危機合約：禁止停手」，四圈大風車、水墨龍捲風，最後落款蓋章。演出本身 21.8 秒，不含玩家等待時間。

成功開始動作後自動收合面板；演出與復原完成後恢復原本展開狀態及捲動位置。途中手動開關面板會覆蓋自動恢復。收合時的「■ 停止」可中止；通訊選擇時可按 Escape 取消。鏡頭可由玩家拖曳接管自動運鏡。

### 表情與眼神

三個表情為 **原來是管理員／磁小軌／協議裡沒有這個吧！**。強度 0–200%，0% 不出文字；四區為 1–50%、51–100%、101–150%、151–200%，各有兩句 A／B 文案獨立輪替。拖動即時改表情，放手才觸發台詞。舊 0–200% 曲線已壓縮到 0–50%，51% 後加入另設計的誇張端點、漫畫符號與 UI 補刀。

高強度依序玩「廢料鑑定不予回收」「申請當管理員的管理員卻被駁回」「查無協議，系統當場更新」三個梗。每次只有一句主台詞及一張系統卡，不疊加多張；角色動作優先，中止表情字幕及攝影反應。

眼神可選看鏡頭、看點擊位置、自然待機、不追蹤。點擊模式只接受短暫單指輕點，拖曳、長按或雙指仍交給 OrbitControls。眼睛比頭部先反應，角度受限；越過背後角度接縫時保持同一側回頭，避免突然甩頭。

### 攝影互動

- **人呢？給我全身**：回完整正面取景。
- **靠近點**：臉部近看，人物小幅後仰，雙腳維持著地。
- **轉過去**：鏡頭沿半圈繞到另一側，不直線穿過人物；預設「看鏡頭」時眼睛先追、頭部再跟，身體不整個轉向。
- **合乎周禮 → 合乎舟禮 → 給我飯盒 → 吃飽了**：腿腳環繞、鞋靴放大環繞、鞋靴特寫環繞、回全身。手動拖曳中止環繞但保留檔位。

實際臉部取景停穩約 4 秒，會說「……看夠了？」；移開取消，每次取景只觸發一次。攝影互動讀取真實鏡頭與頭部距離，不只依按鈕名稱判斷；正式動作期間讓位。

### 模組與效能

`viewerConfig` 匯入 `interactionConfig`，集中管理四區文案、UI 時序與攝影參數。`ViewerDialogue` 管表情／攝影台詞，`PhotographyController` 管靠近及停留；`IdleController` 統一寫入骨骼並管理演出、選擇及救援狀態。

`BrushDrawing` 管世界座標筆畫與毛筆，`ReverseLeekController` 只移動 actor wrapper，不更動原骨架結構；`InkStage` 重用八筆墨痕、六片龍捲風弧帶與六個飛散墨點，無逐幀新增粒子。蔥共用生成的筆觸貼圖與表情圖集，模型替換及停止時正確清理。

所有演出仍只有一個 render loop、DPR 上限 1.5，沒有新增產品依賴、後處理、布料或流體物理。遊戲風 UI、文案與程序動作是本站原創改編，不是官方技能、動畫、聲優音檔或 MMD 資料。原 GLB 材質、貼圖及骨架結構保持不變。

後續可在同一骨架加入 Blender 動畫片段，再以 AnimationMixer 播放並保留眼神層。錄影模式、音樂、MMD 匯入及真機效能優化尚未實作。
