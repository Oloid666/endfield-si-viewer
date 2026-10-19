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
  viewer/SceneManager.js
  viewer/ModelManager.js
  viewer/CameraController.js
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

## Phase 2 建議（尚未實作）

先以實際模型確認是否帶有 idle clip，再由 `ModelManager` 管理 `AnimationMixer` 與播放狀態；讓 SceneManager 的更新 callback 傳入 delta time。播放／暫停 UI 留在 main.js，鏡頭不依賴動畫。背景與光源先擴充集中設定，再以 iPhone 實測評估動漫光影，不預先加入後處理套件。


## Phase 2：眨眼與待機測試

眨眼與待機已發布至原 GitHub Pages 網址；Phase 1 可由 Git 歷史查閱。`public/models/si.glb` 位元內容不變。

新增 `IdleController`，使用現有眼皮骨骼做約 3–6 秒一次、約 0.24 秒的眨眼，另加入微幅呼吸與頭部微動。這是本站製作的程序動畫，並非遊戲官方 Idle 動作。設定集中於 `viewerConfig.idle`；不新增模型骨架、套件或額外 render loop。

「暫停待機」會恢復休息姿勢與張眼，再按「播放待機」可恢復。替換為不具相容眼皮骨骼的 GLB 時，保持靜態展示並停用待機按鈕。鏡頭旋轉與重設仍可操作。分頁隱藏時停止更新，返回時不快轉補跑。

後續若取得真正的動畫 clip，可改用 `AnimationMixer`；目前不包含 MMD、舞蹈、布料物理或動漫 Shader。


### 收合操作與原創互動

下方操作區預設收合，按「展開操作」可使用上傳、重設、播放／暫停及角色動作按鈕。載入錯誤會自動展開以顯示完整訊息及上傳入口。收合／展開會依可用空間調整取景，同時保留旋轉方向、平移及相對縮放。

待機加入有停頓的左右視線，眼睛先移動、頭部稍後跟上，再回正。「歪頭看你」是約 3.2 秒的本站原創動作：朝鏡頭方向小幅轉頭、歪頭、眨眼、輕點頭，再回復；不是遊戲官方招牌動作。動作中重複按鈕不會堆疊。暫停待機時仍可單次播放此動作，結束後回到靜止姿勢。

此版本沒有處理手臂放鬆姿勢、微笑、布料物理或官方動畫；大幅動作仍需要適合模型的動畫製作。原始 GLB、材質與骨架結構不變。


### 可選動作按鈕

展開操作後，有三個獨立按鈕：

- **歪頭看你**：約 3.2 秒，微微歪頭、眨眼並點頭。
- **點點頭**：約 2.2 秒，正面做小幅點頭。
- **傲嬌一下**：約 4.4 秒，瞥一眼、略抬下巴別過頭、停頓，眼睛先偷看回來，再恢復待機。

播放時按鈕顯示「…」並暫停接受下一個動作，結束後自動恢復。暫停待機時仍可單次播放；按「播放／暫停待機」也可取消進行中的動作並恢復姿勢。三個動作均為本站原創，非遊戲官方動畫；不包含抱胸、手臂動作或語音。可在 `viewerConfig.idle` 調整時長、角度與傲嬌動作的關鍵姿勢。
