# Phase 1 測試紀錄

測試環境：2026-10-19，Node.js 24.19.0、npm 11.9.0，Linux Chromium（headless、SwiftShader WebGL）。以暫時安裝於 /tmp 的 Playwright 驅動，未增加產品依賴。測試模型為自行產生的 GLB 三角形，含偏移節點與基本材質，沒有使用原作資源。

## 已通過

- `npm install`：成功，產生 package-lock.json。
- `npm ci --offline --cache /tmp/si-npm-cache`：在開啟必要執行權限後成功，確認 lockfile 可乾淨安裝。
- `npm run build`：成功。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build`：成功。
- 正式 build 以相同 base 啟動 preview：`/endfield-si-viewer/` 可開啟、可重新整理，JS/CSS 正常載入，可上傳模型。
- 缺少預設 si.glb：顯示明確錯誤與可用上傳按鈕，無白畫面。
- 本機有效 GLB：成功解析並實際繪出材質；重設按鈕啟用。
- Bounding Box 中心為原點；匯入節點原始 translation `[3,4,1]` 未被修改。
- 390×844、844×390 與桌面寬高比：Bounding Box 所有角落均在相機畫面內。
- 手機尺寸的實際截圖：調整取景後模型完整避開標題與操作面板。
- OrbitControls 水平限制為正負 Infinity，允許完整 360°；滾輪事件改變距離、重設恢復原距離。
- 正式 build 中實際滑鼠左鍵拖曳旋轉、右鍵平移、重設：以截圖差異確認畫面變動。
- 模型替換時舊 geometry 發出 dispose 事件。
- 上傳損壞 GLB：錯誤訊息出現、原模型保留、仍可重設。
- Device Pixel Ratio 模擬 3 時，Renderer 實際使用 1.5。
- 橫式頁面無垂直捲動，正常操作沒有未捕捉的 JavaScript 錯誤。
- 模擬 WebGL context 無法建立：顯示 WebGL 不可用提示。

Build 唯一提示是主要 JS chunk 約 597 kB（gzip 約 153 kB），包含 Three.js 與 GLTFLoader；未加入額外框架或後處理。

## 尚未驗證

- 實體 iPhone Safari 單指旋轉、雙指縮放／平移、瀏海 safe-area、方向切換與 GPU 效能。Chromium 行動 viewport／高 DPR 不等於 iOS 真機測試。
- 桌面 Safari、Edge 的實際執行。
- 祀模型在 iPhone Safari 的 GPU 負載、長時間效能與遊戲原始 Shader 的視覺一致性。
- 外部 GLTF、外部貼圖的實際檔案相容性。
- GitHub Actions 線上執行及實際 Pages 發布：此次準備推送至 Oloid666/endfield-si-viewer，正式結果待線上驗證。
- 長時間記憶體壓力、WebGL context loss 與 Safari BFCache 真機行為。

## iPhone 驗收建議

以合法的 si.glb 部署後，使用 Safari 開啟：確認載入狀態、全身可見、單指水平旋轉超過一圈、雙指縮放和平移、重設、直橫切換；再連續替換模型數次並切換 App 返回，觀察有無卡頓或崩潰。將檔案大小、貼圖解析度、iPhone 型號與 iOS 版本記錄下來，才可對流暢度下結論。

## 實際祀模型接入複測（2026-10-19）

使用者提供 `si__arknights_endfield.glb`，已原樣複製為 `public/models/si.glb`，約 7.8 MiB。GLB 2.0 長度與 header 一致；6 個 mesh、6 個材質、6 張內嵌圖片、1 個 skin、0 個動畫，沒有外部 URI 或必要壓縮擴充。

- 正式子路徑 build 成功；以 `/endfield-si-viewer/` 啟動 preview，預設祀模型與貼圖成功載入。
- 390×844 直式：頭部、雙腳與服飾完整取景，未被標題或操作面板遮住。
- 844×390 橫式：改用操作面板右側空間取景，避免人物過小。
- 滑鼠拖曳實際祀模型旋轉、重設與直橫切換，已擷取畫面檢查。
- 預設模型顯示來源、作者 Abcxyz51、CC BY 4.0 與格式轉換說明。
- 重新整理後預設模型仍可載入，無未捕捉錯誤或瀏覽器 console error。
- Chromium CDP 模擬單指旋轉與雙指捏合／拖移：畫面成功變動。此為觸控事件模擬，仍需 iPhone 真機驗證。
- 本機替換為測試 GLB 後，預設模型的署名正確隱藏。
- 瀏覽器曾額外請求不存在的 favicon，已新增內嵌 SVG icon，複測無 404。
- `cmp` 確認接入的 si.glb 與使用者上傳檔案完全一致；正式 dist 亦包含該檔案。
- 最後重新執行預設 `npm run build`：成功。

以上為桌面 Chromium / SwiftShader；不代表 iPhone Safari 真機效能。模型採用 GLB 本身的 PBR 材質，沒有還原遊戲專用 Shader。原始模型檔未改動。


## Phase 2 待機分支測試

- 模型檢查：0 個 Morph Target、0 個內建 animation clip，但具左右眼皮骨骼。
- `IdleController` 驗證 12 個眼皮骨骼位置可動，休息與完全閉眼截圖已人工檢查（docs/screenshots/si-eye-open.png、si-eye-closed.png）。
- 輕微呼吸可改變脊椎尺度；暫停會恢復原始尺度、頭部姿勢與張眼位置。
- 瀏覽器實測播放／暫停 UI、替換不支援動畫的 GLB 後停用按鈕，無未捕捉 page error。
- `npm run build` 成功；原始 GLB SHA-256 不變。
- 尚未在 iPhone Safari 真機驗證眨眼與待機流暢度；此分支未部署或取代 main 網站。


## 收合操作區與原創點頭互動

- 390×844 觸控尺寸實測：預設收合、操作區低於 80 CSS px、按鈕至少 44 px；展開／收合與播放／暫停均可用。
- 844×390 橫式無文件捲動。調整取景時，旋轉角度及相對縮放維持一致；Bounding Box 角落落在未被 UI 遮住的區域。
- 眼神切換確實帶動雙眼與頭部；近照確認歪頭姿勢可辨識。
- 單次動作在待機暫停時仍可播放，重複觸發受到阻擋，結束後回到靜止原姿勢。
- 不相容本機 GLB 停用待機及互動按鈕，靜態 Viewer 保留；瀏覽器無未捕捉 page error。
- 模擬預設模型 HTTP 404：操作區自動展開，上傳按鈕可見。
- `npm run build` 與 `git diff --check` 通過。
- 未新增依賴、渲染循環或修改模型檔；iPhone Safari 的實際 GPU 效能仍須真機驗證。


## 三個動作按鈕與傲嬌動作

- 三個動作均通過開始、骨骼姿勢變動、重複觸發阻擋及結束後恢復測試；在暫停待機時也能播放。
- 傲嬌時間線實測：別過頭的停頓後，頭部保持相同姿勢，雙眼先轉回；近照已人工檢查。
- 修正近距離鏡頭位於眼睛上方時，點頭被朝鏡頭仰頭抵消而顯得不明顯的問題。
- 390×844 操作區顯示三個按鈕，播放中的按鈕有 aria-busy／省略號提示，動作完成或取消後恢復可用。
- 不相容 GLB 停用全部三個動作；無未捕捉 page error。
- 保留收合區、鏡頭旋轉、縮放與平移；未修改 GLB 或增加依賴。真機 iPhone Safari 的效果仍需使用者驗收。


## 兩組大幅全身動作與臉部光影

- 實際 Si 模型綁定 11 個身體旋轉部位（腰、肩、手臂、手腕、膝蓋）及髖部平移，另有 16 個眉毛、嘴角、臉頰表情部位。
- 高冷版峰值手腕位移約為人物高度 37%，腰部轉角約 23°；害羞版手腕位移約為人物高度 38%，腰部轉角約 15°。兩組均確實改變面部姿勢。
- 兩組動作結束後，身體四元數各分量、髖部位置與面部位置恢復原值（暫停待機狀態下驗證）。
- 暖色主光、冷色補光與輪廓光共三盞方向光；Shadow Map 保持關閉。已用同一相機比對舊／新燈光截圖。
- 390×844 網頁實測兩個編號按鈕、播放中停用／提示、取消及模型替換；不支援模型停用兩個動作，無未捕捉 page error。
- 大幅度與衣物穿模依使用者偏好保留；未實作 IK 或碰撞物理。iPhone Safari 的實際效能仍待真機驗收。
