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
  viewer/IdleController.js
  viewer/FaceController.js
  viewer/GazeController.js
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

## 角色動作

下方操作區預設收合。按「展開操作」可使用兩個按鈕：

1. **傲嬌**：約 6.8 秒，雙手叉腰、前傾瞪你、抬腳跺地、抬下巴別過頭，再偷看裝兇；播放一次。眉毛、眼皮、嘴角與臉頰使用骨骼表情時間線，手不再舉高遮臉。
2. **水墨甩蔥**：單手叉腰、另一手握原創立體蔥，左右甩動前臂與手腕，配合點頭、身體搖擺和換重心。循環播放；同一按鈕變成「停止甩蔥」，再按一次平滑停止，道具與墨痕淡出。沒有音樂。

兩個動作互斥，待機暫停時仍可播放；播放／暫停待機也會取消目前動作。結束或取消後回到放鬆站姿。鏡頭始終可旋轉、縮放和平移。另有「3 · 合乎周禮」鏡頭按鈕：靠近鞋靴並水平 360° 自動環繞，約 16 秒一圈；再按一次停止。手動拖曳／縮放會接管並停止自動環繞，重設視角回到全身。更換模型也會停止環繞；普通模型使用 Bounding Box 底部作為取景範圍。替換不相容 GLB 時停用角色動作，保留靜態 Viewer。

`IdleController` 管理表演、眼神、眨眼、過渡與少量手指握持；`LimbSolver` 使用解析式雙骨 IK 讓手落在腰側、支撐腳固定並抬起另一隻腳。腿部使用原 GLB 真正帶 skin weights 的變形骨，沒有新增或重建骨架。

`LeekProp` 管理原創蔥道具、程式生成的乾筆透明貼圖與固定 12 點墨痕帶。葉片使用單次雙面繪製；沒有粒子系統、陰影、後處理或外部貼圖下載，停止後淡出，替換模型時釋放 geometry、material、texture。

動作、燈光、尺寸與骨架對應設定集中在 `viewerConfig`。水墨視覺與甩蔥均為本站原創實作，不是遊戲官方技能特效或初音原始動作資料。原模型檔、材質及骨架結構保持不變；依使用者偏好允許衣袖及飾物穿模，未加入碰撞或布料物理。

## 動作驗證與後續

執行 `npm test`：使用原 GLB 節點、骨架及 skin weights 測試叉腰、跺腳、支撐腳、不同幀率、循環停止、過渡與資源釋放，不需額外測試套件。另以 Chromium 的實際 skinned mesh 與正式 build 複測；詳見 `TESTING.md`。

預覽：[傲嬌](docs/previews/si-tsundere.mp4)、[水墨甩蔥](docs/previews/si-ink-leek.mp4)、[表情對照](docs/screenshots/si-expressions.jpg)。這些逐格預覽用來檢查姿勢與節奏，不代表 iPhone 實測幀率。

後續若需要更細緻的表演，可在 Blender 使用原骨架製作動畫 clip，再由 AnimationMixer 播放並保留即時眼神。尚未實作遊戲官方動畫、MMD 匯入、完整手指動畫、頭髮動力學或布料模擬；iPhone Safari 真機效能仍待驗證。


### 蔥甩蔥與介面整理

「4 · 蔥甩蔥」會讓擬人化大蔥伸出水墨手臂，抓著縮小的祀左右甩動。鏡頭自動切到較寬的舞台範圍，仍可手動旋轉和縮放。再按一次或暫停待機後，祀平滑落地、恢復原尺寸，道具消失並回到全身取景；更換模型亦會完整清除。這是原創搞怪程序動畫，沒有使用布娃娃物理。預覽見 [影片](docs/previews/si-reverse-leek.mp4)。

下載百分比限制在合法範圍；傳輸達到伺服器回報的大小時改顯示「處理模型與貼圖」，等模型實際準備好後才顯示載入完成。總大小不明時不顯示百分比。模型署名保留於操作區中的「模型來源與授權」，預設收起，點開可查看作者、來源及 CC BY 4.0。


### 表情面板與眼神追蹤

展開操作 →「表情與眼神」可選自然、生氣、得意、害羞、驚訝，並用 0–200% 滑桿調整強度。表情平滑切換，眉毛左右不對稱；驚訝會略微睜大眼睛。動作播放時優先使用動作表情，結束後回到所選表情；設定也能在待機暫停時操作。沒有新增 morph target 或改寫 GLB。

眼神模式：

- **看鏡頭**（預設）：跟隨目前 3D 鏡頭位置，眼睛先轉、頭部稍後跟上，角度有上限。
- **看點擊位置**：輕點 3D 畫面選擇注視目標；點擊投射到人物前方的空間平面，不需要點到模型表面。拖曳、長按和雙指操作不會選取目標，仍交給 OrbitControls。
- **自然待機**：恢復原本有停頓的自動視線。
- **不追蹤**：平滑回到正視，保留表情及既有眨眼。

「臉部近看」可拉近檢查表情；「重設視角」回到全身。面板預設收起，展開後可在面板內捲動。更換模型會清除注視位置；不支援骨架的模型停用表情與眼神設定。

`FaceController` 只管理使用者表情偏移，`GazeController` 管理空間目標與眼睛／頭部角度，`GazePointer` 管理點擊與觸控辨識；由原有 IdleController 統一寫入骨骼並決定動作優先順序。設定集中在 viewerConfig.face、viewerConfig.gaze、viewerConfig.camera.face，仍只有一個渲染循環。


### 200% 誇張演出與大幅跺腳

表情強度 0–100% 保留原本的表情曲線；100–200% 平滑混入另外設計的眉形、嘴角、眼皮與歪頭端點，並以暖色數字標示誇張區域。自然表情維持中性。頭部偏移仍讓位給角色動作，動作結束後回到所選表情。

傲嬌的抬腳高度由早期約人物高度 4.7% 提高為一般演出的 8.5%；滑桿 200% 時約 12%。另加大前伸、重心轉移、腰身預備與落地壓縮／回彈；支撐腳維持固定，雙手仍落在腰側。強度變更會平滑過渡。沒有增加模型、依賴或渲染循環。

### 精簡選單與漫畫表情

底部 ☰ 展開操作；四區可各自折疊：表情與眼神、原創角色動作、視角、其他。上傳與待機暫停在「其他」，重設在「視角」。收起選單仍可停止正在播放的動作。

表情為「看垃圾」「磁小軌」「驚訝」。0% 回到自然；原本 0–200% 的表情變化壓縮到 0–50%，51–200% 加上逐步放大、增加的漫畫符號或對話框。符號由 `ComicEffects` 重用三個 DOM 節點，從頭部世界座標投影，不增加 WebGL 後處理或渲染循環。播放角色動作時特效暫退，停止後恢復。點選表情、調整強度或眼神會平滑切至臉部；單純開關區塊不切鏡頭。
