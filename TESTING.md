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


## 動作自然度第一輪改進（2026-10-19）

- 新增 `npm test`，使用原始 GLB 的節點與骨架轉換資料建立測試，不需要額外套件或圖片解碼。7 項測試涵蓋預備動作與延遲手腕、兩支動作收尾、15/30/60fps 時間一致、取消過渡、釋放恢復原骨架、不支援模型，以及背景分頁時鐘處理。
- 真實模型的 Chromium/WebGL 瀏覽器複測：兩支動作骨骼數值有限、主要身體不再長時間維持同姿勢、收尾回到新自然站姿、取消不立即跳姿勢；手機尺寸按鈕互斥、取消、操作區收合均可用，沒有未捕捉 page error。
- 已逐格擷取動作並檢查序列圖：自然站姿放下雙臂；害羞左右手分開抬起、偷看再遮掩；高冷抬手翻腕與腰肩錯開。這是程序動畫的第一輪改進，不等同專業角色動畫品質驗收。
- 暫停行為更新：取消動作後約 0.28 秒平滑回到自然站姿；替換／釋放模型時立即恢復匯入值。
- 移除渲染時鐘的 0.05 秒截斷，避免低於 20fps 時動作時長被拉長；隱藏分頁恢復時仍重設時鐘。
- 尚未製作 Blender 動畫、手指動畫、頭髮動力學、IK 或腳部固定。未增加光影或後處理負載，原始 GLB 不變。
- iPhone Safari 真機的實際效果、幀率與長時間穩定性仍待驗證。


## 傲嬌叉腰跺腳與水墨甩蔥（2026-10-19）

- `npm test` 9 項通過：傲嬌時序與收尾、15/30/60fps 一致、取消過渡、腰側手部落點、支撐腳固定／抬腳落地、變形骨具真實 skin weights、甩蔥循環／停止與資源釋放、不相容模型、背景分頁時鐘。
- 找到原 GLB 的平行控制骨／變形骨鏈；腿部切換為真正影響皮膚的 38/39/40 與 68/69/70 節點。Chromium 量測右靴實際 skinned vertices 在抬腳峰值上移約人物高度 4.71%，而非只檢查骨骼數值。
- 真實模型逐格擷取並檢查叉腰、抬腳、落地、別頭、偷看與甩蔥；加入眉線與更多嘴唇部位，臉保持可見。預覽已存入 docs/previews 與 docs/screenshots。
- 正式 Repository Base Path build 及 preview 通過載入／重新整理；390×844 觸控尺寸下，傲嬌播放中停用另一按鈕，甩蔥按鈕可再次按下停止，取消後恢復可用。操作區收合及橫式無捲動亦通過。
- 甩蔥中替換為不相容 GLB 後停用兩個動作、保留 Viewer，無未捕捉 page error；單元測試另驗證蔥與墨痕 geometry/material 釋放、道具移除。
- 本機測試曾因開發中 HMR 重新載入及 preview 未套用同一 Base Path 而中斷；改以匹配 Base Path 的正式 build 重測後通過。
- 沒有增加 npm 依賴、第二個渲染循環、陰影或後處理；蔥為低面數幾何、128×256 程式筆觸貼圖與固定 12 點墨痕。原 GLB SHA-256 維持不變。
- 這是原創程序動作與水墨意象，沒有官方技能 Shader、MMD 動作檔或音樂。iPhone Safari 真機、長時間負載與主觀表演自然度仍需使用者實際觀看。


## 合乎周禮：鞋靴 360° 鏡頭

- 新增獨立鏡頭按鈕，不占用傲嬌或甩蔥動作；以原始腳踝中心及模型底部建立鞋靴取景盒，不追隨跺腳而晃動。一般模型提供 Bounding Box 底部的 fallback。
- `npm test` 10 項通過；新增鞋靴取景盒的腳踝中心、地面高度及一般模型 fallback 測試。
- Chromium 實際 OrbitControls 測試：模擬 17 秒更新，累積水平環繞 6.600 rad（超過完整 360°），target 保持固定；重設回到原全身 Bounding Box。
- 正式子路徑 build 的 390×844 頁面：開始／停止、手動拖曳接管、操作區收合後取景、重設及更換模型停止皆通過，無未捕捉 page error。近景截圖見 docs/screenshots/si-shoes-mobile.png。
- 沿用唯一 render loop，以 delta 傳入 OrbitControls；預設 16 秒一圈，可連續環繞。iPhone Safari 真機手勢與幀率仍待驗證。


## 蔥甩蔥、載入狀態與第二層署名

- `npm test` 13 項通過，新增壓縮大小不一致／未知總大小／處理階段的進度格式測試，以及反轉表演的抓握、落地、15/30/60fps 一致、原始尺寸恢復與資源釋放測試。
- Chromium/WebGL 逐格檢查擬人大蔥與縮小人物的甩動：手腕與墨手位置吻合，停止後 wrapper 的 position、quaternion、scale 回到原值；原 GLB 及骨架結構不變。
- 正式子路徑 Build 的手機尺寸複測：署名預設收起且可展開、三個角色動作與獨立鞋靴鏡頭、蔥甩蔥開始／停止／落地、既有甩蔥仍可使用；反轉表演期間替換為一般 GLB 後停用不相容動作且隱藏原模型署名。無未捕捉 page error。
- 新表演沿用唯一 render loop，新增外層 actor 容器與輕量水墨手臂，不新增 npm 套件、後處理或模型下載。
- 整體表演會自動拉遠取景；手機可雙指放大細看。實體 iPhone Safari 的幀率及長時間穩定性仍待實測。


## 表情面板與眼神追蹤（2026-10-20）

- `npm test` 17 項通過，新增表情平滑／強度限制／自然復原、待機暫停時表情可用、動作表情優先與結束恢復、眼睛先於頭部、角度限制／無效目標、鏡頭跟隨與動作頭部優先。
- Chromium/WebGL 實際 Si 模型渲染自然、生氣、得意、害羞、驚訝五種表情；34 個臉部控制部位與眼皮骨骼數值均有限。表情強度及驚訝睜眼位置有實際變化。
- 真實 pointer/touch 事件：輕點成功設定注視點並轉動眼睛與頭部，滑鼠拖曳改變相機且不新增目標；雙指操作不選點，移除 GazePointer 後不再收到選點回呼。
- 正式 Repository Base Path build 的 390×844 UI 測試通過：表情選中狀態、強度輸出、眼神選單／提示、臉部近看、動作播放互斥以及替換不相容 GLB 後停用面板。844×390 文件不捲動，操作面板可內部捲動，沒有未捕捉 page error。
- 測試曾以 Playwright 對 fieldset 的 isDisabled 判斷造成誤判；確認 DOM disabled=true 且子按鈕確實停用，改用這兩項驗證後通過。
- 沒有新增產品依賴、額外渲染循環、模型下載或模型檔修改。桌面 Chromium／SwiftShader 不代表 iPhone Safari 真機幀率；真機表情觀感與長時間負載仍待驗證。


## 200% 表情與更大跺腳（2026-10-20）

- `npm test` 19 項通過，新增 100/150/200% 表情端點、非等比例誇張設計、歪頭、自然復原、大幅抬腳／支撐腳／叉腰落點及取消後恢復所選表情的驗證。
- Chromium/WebGL 實際渲染生氣、得意、害羞、驚訝的 100% 與 200% 對照，確認頭部角度和眉眼嘴角改變，沒有非有限骨骼數值。
- 實際 Si 右靴 934 個主要 skin-weighted vertices 的平均抬升：100% 為人物高度 8.507%，200% 為 12.008%；支撐腳位置誤差低於人物高度的 0.00001。原始 GLB 不變。
- 正式 Repository Base Path build 的手機尺寸 UI：滑桿最大值 200、200% 顯示與暖色提示、看鏡頭模式、臉部近看、傲嬌播放互斥與取消均通過，無未捕捉 page error。
- 不新增怒符、選單重排或其他鏡頭段落；此輪僅實作已指定的 200% 表情、歪頭與大幅跺腳。iPhone Safari 真機效能仍待實測。

## Comic expression / compact menu revision

- `npm test`: 20 passing tests, including the former 0–200% curve compressed into 0–50%, new bounded expression endpoints, zero-intensity restoration and weighted stomp regression.
- Repository-subpath production build: `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` passed.
- Chromium mobile viewport 390×844 (SwiftShader): three expressions × 0/50/100/150/200 intensity, independent drawer sections, action suppression, collapsed quick-stop, landscape 844×390, no uncaught JavaScript errors. Browser harness is an external Playwright verification script; Playwright is not a product dependency.
- Physical iPhone Safari, GPU performance, and VoiceOver remain untested.

## Three ink comedy shorts

- `npm test`: 23 passing tests, including one-shot completion for all three actions, full wrist attachment during both grabs, grounded fake ending, cancellation at six story phases, actor transform restoration, prop-eye reveal/replay, and disposal of shared ink resources.
- Chromium 390×844, real decoded/skinned GLB: sampled all story beats; checked projected head/feet framing, mobile stop and landscape completion. First visual pass reached at most 34 draw calls; repeated three-action replays retained the same GPU geometry/texture counts. These are software-renderer structural measurements, not an iPhone FPS claim.
- Actual iPhone Safari performance and visual checks remain pending.
