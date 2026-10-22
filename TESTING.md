# 展示陪伴、四人頭像、跳板與競速情緒（2026-10-22）

- `npm test`：136 項通過，包含原有全部功能。新增真實莊骨架待機／12 個眼皮控制點／暫停／自有道具釋放、跳板命中與未命中／跟班延遲／一次失誤救回、記仇與乾淨駕駛消氣、實際差距台詞去重、多人說話者拆分與表情判定；更新 AI 收筆預告先於噴射的驗證。
- 正式 Repository 子路徑 `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 通過。維持一個 Renderer／Canvas／主循環，無新依賴、後處理或新下載模型。原始兩份 GLB 的 SHA-256 未變。
- Chromium／SwiftShader 390×844、844×390：實際兩份 GLB、莊展示陪伴／暫停／切換場景還原、全部 20 個頭像狀態、墨水故事、AI 預告、記仇、跳板成功／失誤恢復、角色切換、暫停／重玩及單一 Canvas 通過，無未捕捉 JavaScript 錯誤。跳板、近身和整局策略驗證使用測試 response 注入的固定步長快轉，不包含在產品；不是實體 iPhone FPS 測量。
- 實際載入 GLB 的整局策略驗證亦通過：58.38 秒獲勝、11 次甩尾、7 個補給；結算時兩隻跟班逐句切換頭像，頭像位於結果卡片外，不被卡片遮住。AI 小聰明的掛繩、關閉後還原父層及再切回祀亦通過。
- 畫面：[莊與龍泡泡](docs/screenshots/cast-zhuang-display.png)、[說話頭像](docs/screenshots/cast-dialogue-mobile.png)、[跳板](docs/screenshots/cast-jump-mobile.png)、[記仇](docs/screenshots/cast-grudge-mobile.png)、[結算接話](docs/screenshots/cast-ending-mobile.png)。
- 圖集由現有模型與程序跟班離線渲染，再以 Canvas 畫漫畫五官，遊戲中只切靜態圖；未建立角色頭像的即時 WebGL 視窗。小聰明曲面紙面曾遮住部分眼睛，已經由實際渲染檢查並修正。
- 尚未測試：實體 iPhone Safari 的效能、熱負載及觸控手感；原生 Safari／Edge、VoiceOver。完整變更見 `docs/CAST-RACE-CHANGES.md`。

# 認真祀 AI、側坐水墨毛筆與競速互動（2026-10-22）

- `npm test`：131 項通過。新增強度驗證：不操作 73.47 秒、只用加速 70.23 秒皆輸，祀固定約 63.54 秒完賽；每 0.18 秒才判斷一次左右按鍵、控線收集補給並甩尾的規則測試 58.38 秒獲勝，零撞牆、11 次甩尾、7 個補給。這是自動化有效按鍵策略，不是人類試玩或手機 FPS。兩種失誤策略下 AI 衝線時間一致，沒有橡皮筋追趕或瞬移。
- AI 以自己的固定步長時鐘預判彎道、彎前減速、直路有限收筆噴射；最高 58 m/s。規則測試包含超車／被超車、互動冷卻、彎前不啟動新噴射、暫停／重開、30／60／120 Hz 與慢動作倒數。
- 真實 Si GLB 骨架驗證雙膝朝同側、小腿下垂、骨盆不漂移、揮手抬高及所有改動關節可還原；測試抓到並修正可選姿勢未提供 determined 時產生非有限值的問題。祀主控與 AI 均換為同一程序水墨毛筆，刪除未再使用的迷你艦幾何。原 GLB 檔不變。
- Chromium／SwiftShader 390×844：實際載入兩份 GLB、側坐、毛筆輪廓、近身超車短台詞／平滑揮手與回頭、有限骨架、失敗與勝利結算、暫停／重來、AI 關閉／角色切換／取消載入通過；844×390 按鈕留在畫面內、遊戲入口名稱同步，僅一個 Canvas、沒有未捕捉 JavaScript 錯誤。關鍵階段使用測試 response 注入快轉與近身取景，不包含在正式產品。
- 畫面：[側坐毛筆](docs/screenshots/ride-brush-mobile.png)、[同場超車](docs/screenshots/ride-brush-rival-mobile.png)、[操作取勝](docs/screenshots/ride-skill-win-mobile.png)。
- 尚未測試：實體 iPhone Safari 的 FPS／發熱／觸控手感，以及原生 Safari／Edge。未新增依賴、模型下載、Renderer、渲染循環、陰影或後處理。

# 開場對白、冠軍公告、祀對手與手動起飛（2026-10-22）

- `npm test`：128 項通過。開場由 27 秒流程縮為 12 秒，第 0 秒有台詞，公告安排在直道；新增開場文案／物件梗對應、慢動作中的世界／倒數、零加速次數仍可手動起飛、祀獨立推進與真正勝負、單人錯過領獎、AI 暫停／重來及 30／60／120 Hz 一致性。按鍵時間允許一個畫面更新的量化差，物理仍是固定 120 Hz。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功。無新依賴、Canvas 或 Renderer，兩份原始 GLB 雜湊未變；16 條噴流使用 InstancedMesh，煙霧池保留並減少莊線白煙。祀只在距離玩家足夠近時更新可見模型。
- Chromium／SwiftShader，390×844：實際載入莊及祀兩份 GLB，確認開關後祀坐迷你帝江號同場、開場立即對白、冠軍卡片、可用加速鍵亮起、藍色補充方塊、金色噴流、單句撞擊梗、慢動作／倒數、按鈕切起飛、加速為零仍能按、升空操控、暫停／重玩／角色切換／離場釋放通過。最後流程使用測試 dev response 注入的固定步長控制快轉，關鍵畫面以真實 Renderer 截圖；該介面不包含在正式部署，也不是實體 iPhone 效能測試。
- 這次整局遊戲時鐘 75.7 秒，對手開啟、玩家先拿到獎品，祀尚未衝線；規則測試另確認晚按會輸給祀。慢動作倒數為遊戲時間，非現實限時。844×390 公告及三顆操作按鈕留在畫面內，只有一個 Canvas，無未捕捉 JavaScript 錯誤。
- 新的獨立瀏覽器情境攔截祀的 gzip／原始 GLB 請求失敗：自動關閉對手、顯示「祀暫時沒趕上」、單人仍可開始。關閉 AI 的新情境未請求祀模型（0 次）。對手尚在載入時切換角色，不會晚到後跑回舊場景。
- 畫面：[冠軍獎品](docs/screenshots/ride-prize-mobile.png)、[祀電腦對手](docs/screenshots/ride-rival-mobile.png)、[慢動作起飛](docs/screenshots/ride-takeoff-mobile.png)。
- 尚未測試：實體 iPhone Safari、雙人物真機 FPS／熱負載／觸控手感、原生 Safari／Edge、VoiceOver。祀是本機自動駕駛原型，未加入多人連線、聊天模型或排行榜。

# 速度落差、可操作開場、固定追尾與飛行撞擊（2026-10-22）

- `npm test`：125 項通過。新增／更新莊線 22 秒可操作開場、公告與換位、法術解鎖、三鍵自動甩尾／回正加速、約 80 秒完整路線、三段速度、平滑升空後仍可轉向、暫停／重來清理、龍泡泡獨立碰撞與防重複、實際障礙接觸／空中碰撞頻率、反打方向減少擦撞。30／60／120 Hz 結果一致。
- 兩種螢幕比例對各階段與彎道做相機投影，確認左／右不因接管而反轉、鏡頭始終在後方；全程大幅轉向時龍泡泡臉部範圍留在手機畫面內，鏡頭距離有上限。兩份真實骨架的坐姿／施法手勢與離場關節恢復通過。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功。保留既有 bundle 大小提示，無新套件、Renderer、Canvas 或渲染循環。兩份原始 GLB 的 SHA-256 未變。
- Chromium／SwiftShader、390×844，實際按鍵整局：三顆按鈕、引導後半透明按區、導覽收起、單句字幕消失後的道路、管理員公告、法術加速、地面與空中撞擊、飛行仍能操作、暫停／繼續、結算／重來通過。換祀後恢復四顆按鈕與原 900m 路線，再換莊能重新開始；844×390 按鈕留在畫面內，離場還原展示、四個遊戲入口及 11 關爬塔索引通過，只有一個 Canvas、無未捕捉 JS 錯誤。
- 最後的構圖與透明警示框調整，另用測試專用 dev response 注入控制介面，按固定步長快轉、在關鍵階段實際渲染截圖，再驗證角色切換／暫停／重玩與橫式。最新這次遊戲內 82.7 秒，地面 19 撞、空中 7 撞；快轉時鐘與 SwiftShader 都不是 iPhone FPS 或真實執行時間測試。測試介面不包含在部署程式。
- 畫面：[清爽行駛畫面](docs/screenshots/ride-clear-mobile.png)、[地面撞擊](docs/screenshots/ride-dragon-ground-mobile.png)、[空中撞擊](docs/screenshots/ride-dragon-flight-mobile.png)。
- 尚未驗證：實體 iPhone Safari、真機 FPS／熱負載／手感、原生 Safari／Edge、VoiceOver。冠軍屬原創劇情結尾，尚無對手 AI；未增加帳號或付費服務。

# 莊芳宜強制下班劇情線（2026-10-22）

- `npm test`：120 項通過。新增劇情階段／前後換位、施法解鎖／扣次數與上限、暫停／續播／重來／切回祀、橋面抬高與入口連續／繞過地面路障、30／60／120 Hz 完整結局一致性；真實莊骨架另確認施法手抬起、關節數值有限且可還原。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功，既有 bundle 大小提示保留。兩份原始 GLB 的 SHA-256 未變，沒有新依賴、Canvas、Renderer 或 render loop。橋面使用 84 個實例，法術沿用煙霧池及簡單符環。
- Chromium／SwiftShader，390×844：直接莊線網址載入、龍泡泡領跑、管理員贊助公告、暫停凍結／繼續、前後換位、法術加速按鈕、900 公尺整局、實際架橋通行、冠軍結算、立即重玩、暫停後重來、切回祀線道具操作均通過。劇情冠軍明示尚無對手 AI，未指定神祕獎品內容。
- 844×390：公告與四顆按鈕在畫面內；離場還原莊方宜展示、遊戲區四張同層入口與 11 關爬塔索引通過。只有一個 Canvas，沒有未捕捉 JavaScript 錯誤。
- 高速跟拍修正絕對座標平滑造成的縮小；莊接管時鏡頭繞到前側，龍泡泡轉向鏡頭保持表情可讀。換位後恢復原有彈簧拖繩及甩動，架橋時自動通行並明示控制狀態。
- 畫面紀錄：[接管與法術](docs/screenshots/zhuang-race-story.png)、[息壤橋](docs/screenshots/zhuang-xiran-bridge.png)。
- 尚未驗證：實體 iPhone Safari、真機 FPS／發熱、原生 Safari／Edge、VoiceOver。手機尺寸模擬不能替代真機效能與觸控驗證。

# 坐騎擴大、三級甩尾、氣態息壤與美術（2026-10-21）

- `npm test`：115 項通過；新增三級甩尾獎勵、短按不能刷加速、道具使用／容量／拾取一次、噴射期間不能再消耗、暫停與重開重置、撞擊停頓／減速／取消噴射／冷卻、900 公尺全路段可通關、高速拖繩有界等驗證。原骨架、竹筏、爬塔及節奏規則測試保留。
- 正式子路徑 Build 成功。Chromium／SwiftShader 390×844 實際操作：巡航 68 km/h、息壤噴射逾 100 km/h、道具按鈕／持有量、路上拾取、雙指方向＋煞車蓄至Ⅲ、放開加速、撞護欄後的字幕／星星／煙塵／速度回落、暫停凍結、重新開始歸零均通過。
- 辦公椅全程實際跑到 900 公尺、第三路段與結算，遊戲內用時 49.8 秒、碰撞 6 次，能立即重玩；此測試未用道具，因此最高 68 km/h。三級甩尾及噴射由前述單獨操作測試驗證，未把遊戲內時間當成實機 FPS／真實執行時間。
- 兩個人物與兩隻重畫跟班均可顯示；844×390 橫式四顆操作按鈕留在畫面內。角色切換、直接角色網址、離場還原兩個人物展示、竹筏開始、11 關爬塔索引／首關移動、甩蔥開局通過。只有一個 Canvas，沒有未捕捉 JavaScript 錯誤。
- 靜態道具合併材質批次；煙霧 40／星星 8／拖痕 40 個實例固定重用。未新增渲染循環、服務、依賴或官方模型素材。原始兩個 GLB 檔保持不變；美術參考及簡化處見 `docs/RIDE-ART-REFERENCES.md`。
- 畫面紀錄：`docs/screenshots/ride-gas-mobile.png`、`ride-impact-mobile.png`、`ride-drift-mobile.png`，兩個人物的原有試作截圖也已更新。
- 尚未測試：實體 iPhone Safari、真機 FPS／發熱／熱降頻、原生 Safari／Edge、VoiceOver。瀏覽器模擬及固定步長測試不能替代手機實測。

# 迷你帝江號／辦公椅坐騎試作（2026-10-21）

- `npm test`：110 項通過。新增 5 項，涵蓋車頭轉向／放手慣性、煞車加轉向蓄力／放手加速、不可輕點刷加速、30／60／120 Hz 一致、暫停與重玩清理；直接解碼兩個原始 GLB 的骨架，確認膝蓋向前、腳落在膝下、手接近扶手、骨盆對準座椅、所有改動關節能恢復。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功。原始 GLB 的 SHA-256 均未變；未新增依賴、Canvas、Renderer 或 RAF。既有 bundle 大小提示仍保留。
- Chromium／SwiftShader，390×844：四張遊戲卡片、Si 坐迷你艦／莊芳宜坐辦公椅、角色切換與對應 GLB、同時觸控轉向與煞車、放開出現加速／吐槽、鍵盤操作、暫停凍結、重新出發、直接 `?rider=zhuang#ride` 通過。
- 瀏覽器實際完整跑完辦公椅路線，出現結算，能再玩一次。844×390 橫式按鈕留在可視範圍。離開後莊方宜恢復站姿／展示；竹筏可開始，11 關爬塔選單與第一關移動、甩蔥正常開局均通過，無未捕捉 JavaScript 錯誤，只有一個 Canvas。
- 畫面：`docs/screenshots/ride-ship-mobile.png`、`docs/screenshots/ride-chair-mobile.png`。迷你艦、辦公椅、小聰明與龍泡泡是程序二創簡模；衣物穿模為此試作已接受限制。
- 尚未測試：實體 iPhone Safari、真機 FPS／熱負載、VoiceOver；未加入官方載具資產、布料物理或自由三軸飛行。本次沒有實作討論清單中的其他爬塔改動。

# 清波寨竹筏獨立試作（2026-10-21）

- `npm test`：105 項通過。新增 6 項拖行規則測試，涵蓋完整路線通關及重玩、30／60／120 Hz 結果一致、煞車減速及收繩、暫停凍結、碰岸反彈／碰撞冷卻、拖繩有界、墨印不重複計分、異常時間值及背景停頓保護。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功；保留現有 bundle 大小警告，未增加套件、Renderer 或渲染循環。兩個原始 GLB 的 SHA-256 與原版相同。
- Chromium／SwiftShader，正式子路徑 Build、390×844 觸控尺寸：三個遊戲入口均可點選，選單不下載人物模型；竹筏開始、真實觸控按住右轉／第二指煞車／放開、減速、暫停凍結、重新出發、直接 `#raft` 載入均通過。
- 實際瀏覽器完整跑到水道 100%，顯示到岸用時 41.8 秒、墨印 3/7、碰撞 3 次，再次開始進度歸零。此用時為遊戲內計時，不是 SwiftShader 的真實執行時間或手機效能量測。
- 844×390 橫式按鈕留在畫面內；離開竹筏後祀的比例、骨骼姿勢及深灰背景恢復，莊方宜可載入，11 關爬塔選單／第一關移動、既有甩蔥正常開局通過。只有一個 Canvas，無未捕捉 JavaScript 錯誤。
- 畫面紀錄：`docs/screenshots/raft-mobile.png`、`docs/screenshots/raft-landscape.png`。水面與跟班是程序簡模，未新增未授權模型素材。
- 尚未測試：實體 iPhone Safari、原生 Safari／Edge、真機 FPS／熱負載、長時間觸控手感。尚未加入龍泡泡、大蔥竹筏或正式場景美術。

# 不同路線的三個專家關卡（2026-10-21）

- `npm test`：99 項通過；含 11 個手工解法、指定貨物才能過關、取件封門／撤回／重玩清理、雙繩側向進入與下繩收集、電箱身分與先卸貨後搭橋。
- 對「未鋪回程就取件」及「先搭橋後卸貨」各做有限狀態搜尋：包含正常走動、推拉、爬繩／下繩、轉身、放置與回收；不使用撤回／重來時，都無法到達勝利狀態。正確路線均可通關。
- Chromium／SwiftShader，正式子路徑 Build、390×844 觸控尺寸：11 關均用實際按鈕通關；測過取件封門、先蓋橋死路、任務勾選、撤回／重來、暫停看全圖與計時凍結。844×390 橫式操作可用，文件無捲動。
- 遊戲選單仍有甩蔥／爬塔兩個同層入口；正常甩蔥開局及實際鍵盤得分、音訊 resume 永不結束時的無聲開局、直接 hash／重新整理、一個 Canvas、無未捕捉頁面錯誤通過。全 11 關不請求人物 GLB。
- 保留既有八關、甩蔥與角色展示；新三關無人物 GLB、無新依賴、無額外 WebGL 渲染器或循環。全圖為暫停面板內的 SVG。
- 實體 iPhone Safari、實機效能及使用者首次盲玩難度尚未測試；本次沒有實作待討論的三次源石技藝、侵蝕死亡演出或重寫舊關電話故事。

# 八關難度、重來與遊戲索引（2026-10-21）

- `npm test`：90 項通過。八個手工解法涵蓋原四關及低槽／壓力機關／交錯噴流／限額建造；另驗證門只能由箱子開啟、單箱不能越過關閉高門、回收額度與撤回／重玩、不同噴流相位及禁止硬闖、音訊 resume 永不完成／拒絕／缺失時的有界回退。
- 低槽錯誤路線另做有限狀態搜尋：不允許撤回或重來時，所有正常移動與推拉的可達狀態均不能到終點；撤回及重新開始可恢復。解法放在 `tests/escapeRoutes.js`，不進產品 bundle。
- Chromium／SwiftShader 390×844，正式子路徑 Build：兩個同層入口文字及點擊、原生八關下拉選單、每關真實按鍵通關、兩種電話回覆／讀取期間凍結、故意推入低槽的警告、退一步／重來保持關卡、限額材料與回收重設、暫停／恢復、直接 hash／重新整理、一個 Canvas、無未捕捉頁面錯誤。
- 844×390 橫式：操作與重來可用、頁面不捲動。直接進選單／八關不下載人物 GLB，選甩蔥才依既有流程載入祀。
- 瀏覽器另強制 `AudioContext.resume()` 永不回應，確認一次點開始仍進入 playing 並顯示無聲提示；這是可控模擬，未宣稱已重現使用者 Safari 的原始原因。正常音訊路徑與實際節奏輸入亦列入複測。
- 尚未驗證：實體 iPhone Safari、真機音訊延遲／觸控手感／FPS／熱負載、VoiceOver。

---

# 呱嘎四種玩法試作（2026-10-21）

- `npm test`：81 項通過；新增 12 項測試，涵蓋四關各自的可解路線、通訊凍結、侵蝕不得直接通行／移走安全箱、繩索懸掛／上下界／噴流受侵蝕、回縮平台不會生成在玩家體內、放置／回收／階梯／撤回材料、禁止重疊／越界／拆固定方塊／憑空通行、逾時與重玩重設、企鵝動作及資源釋放。
- Chromium／SwiftShader，390×844：四關都使用實際手機按鍵通關；建造另外實測回收、撤回後材料數量、高一格階梯；繩索實測按住按鍵連爬與放開停止。通訊選擇、暫停／恢復、選關、直接 hash 與重新整理通過，無未捕捉頁面錯誤。
- 844×390 橫式：關卡與操作可見，頁面無捲動。從新遊戲切到節奏區／莊方宜展示，再切回新遊戲及展示，場景與人物可見性恢復；一個 Canvas。
- 直接 `#escape` 到四關全通未請求任何人物 GLB；進入角色／節奏區才按原流程載入。未新增產品依賴，原 GLB 不變；舊版爬塔與角色展示仍保留。
- 企鵝是本站原創簡模代替物；玩法先用固定側向小關卡驗證，沒有宣稱完整還原既有二創呱嘎造型。源石通道、侵蝕、回縮平台與人物關係為遊戲二創規則。
- 尚未驗證：實體 iPhone Safari、多點觸控手感、熱負載、真機 FPS、VoiceOver。逾時與侵蝕失敗以規則測試驗證；這輪瀏覽器重點為四關通關及切換恢復。

---

# 查勤爬塔原型（2026-10-20）

- `npm test`：69 項通過（44 骨架／鏡頭／互動與場景測試、10 下載測試、5 節奏測試、10 爬塔測試）。新增兩次搬箱的可解路線、不可跨兩格高牆、推拉／支撐、撤回不倒退時間、教學不計時、通訊／暫停凍結、方塊遮蔽搜尋、被發現與廢液兩種失敗、崩塌後復原、來電不重複，以及接完電話立即接受輸入。
- 使用實際祀骨架的場景測試：帶有偏移原點的模型在縮放及旋轉後仍維持平台接地，離場精確恢復外層比例／位移，場景自有幾何釋放。
- Repository 子路徑正式 build 成功；未新增產品依賴、Renderer、RAF 或物理引擎。兩份原始 GLB 未修改。莊方宜通訊頭像直接取自現有模型瀏覽器渲染，來源及授權保留在遊戲說明。
- Chromium／SwiftShader，390×844 觸控尺寸：以實際按鈕完成整關；兩種電話回覆、等待時時間不動、暫停忽略移動、繼續、拉箱／撤回、破損方塊塌陷與撤回復原、勝利重玩均通過。
- 844×390 橫式：按鍵與關卡可見，文件沒有捲動。從爬塔切回既有節奏遊戲可開局，回展示區比例與全身鏡頭恢復；遊戲入口、直接 `#climb`、重新整理及快取重用通過，只有一個 Canvas，無未捕捉頁面錯誤。
- 原有兩角色 lazy load、鏡頭／鞋子四段、表情切換歸零，以及完整節奏判定、暫停／恢復、中場反甩、整局結算／重玩與區域切換的瀏覽器回歸通過。
- 這版是單排側向 2.5D 原型，不是完整《凱薩琳》重製；程序攀爬姿勢、工業場景及泡泡龍代替物尚未精修。被抓及廢液失敗已做規則自動測試；手機端完整失敗演出與手感仍需玩家回饋。
- 尚未驗證：實體 iPhone Safari、真機 FPS／熱負載、VoiceOver、正式泡泡龍模型與正式攀爬動畫。

---

# 三區與節奏甩蔥原型（2026-10-20）

- `npm test`：58 項通過（43 個真實骨架／鏡頭／互動測試、10 個下載／快取測試、5 個節奏判定測試）。新增遊戲舞步持續循環、巨蔥實際手腕抓握與離場恢復、莊方宜獨立取景錨點、兩角色快取共存、四拍預備、判定時窗、防連按刷分、暫停恢復、全連擊與不同幀率漏拍結算。
- Repository 子路徑正式 build 成功，同時生成兩份無損 gzip。祀原始 SHA-256 不變；莊方宜原始檔 `43c4d1063caf4f5d5f7405aae32cbd02ceb2de0ab043acc54e26dd7aa49ceb94`，7,520,868 bytes。
- Chromium／SwiftShader，390×844 觸控尺寸：先只下載祀；切大蔥區後才下載莊方宜，四段鞋靴、近看、轉背及署名切換正常；回祀／遊戲及再切回莊方宜使用兩份獨立快取，只有一個 Canvas。
- 真實鍵盤輸入取得分數；遊戲暫停保持音符位置不動、可繼續、中場反甩、整局結算、重玩、離場並返回原角色。844×390 橫式截圖，文件無捲動。不同表情切換滑桿歸零且清掉舊字幕。
- 直接區域 hash、重新整理與 WebGL context lost 的可見恢復提示亦列入瀏覽器驗證。未捕捉 JavaScript 錯誤為零。
- 原型未提供莊方宜動畫／表情、完整角色對話、授權歌曲、錄影、全球排行榜或精細遊戲美術。實體 iPhone Safari、實機音訊延遲與熱負載仍待驗證。

---

# 手機下載停滯修正（2026-10-20）

- 49 項測試通過：原 40 項動作／互動測試，以及 9 項下載測試（無損 gzip 還原原始位元組、首包與串流停滯逾時、壓縮失效退回原檔、取消不重試、截斷／錯誤雜湊／損壞壓縮檔拒收、快取免重抓、本機檔不進持久快取、私人儲存失效、舊瀏覽器退回原 GLB）。
- 正式 Repository 子路徑 build 成功，自動生成無損 gzip。原始 GLB SHA-256 保持 `34fd795c693433e1ff1532c6cb7e4e801c3fb152d179e81ee1ab708c16b4c1e1`。
- Chromium／SwiftShader 實際 HTTP 串流測試：下載四分之一後保持連線不再送資料；畫面保留本機檔與重試入口，15 秒後自動取消停滯請求、退回原始 GLB 並成功顯示。
- 同一瀏覽器重新整理後，模型伺服器設為失效仍可從已驗證快取顯示，沒有第二次模型請求。另測壓縮檔 404 fallback、兩次 HTTP 503 的明確錯誤、本機檔備援、重試按鈕、載入後既有「蔥末地」選擇與恢復。
- 實體 iPhone Safari、使用者的電信 4G 路線與實際首載秒數仍無法在此環境驗證；本次模擬的是同類下載停滯，不宣稱重現使用者電信端的根本原因。

---

# 最新驗證：玩家選擇、四區文案與攝影互動（2026-10-20）

- `npm ci --cache /tmp/si-npm-cache --no-audit --no-fund` 成功；未新增產品依賴。
- `npm test`：40 項通過。新增選擇點精準停住／長時間不自動繼續、兩條真實分支、取消清理、四圈大風車、固定龍捲風池與資源釋放、四區邊界／A/B 獨立輪替、驕傲被駁回後收回笑容、近看停留／移開重設／單次觸發、後仰雙腳著地、半圈鏡頭與背後接縫方向限制。
- `VITE_BASE_PATH=/endfield-si-viewer/ npm run build` 成功。Three.js 主 bundle 的既有 500 kB 提示仍在，不影響建置。
- Chromium／SwiftShader，以正式 Build 的 Repository 子路徑預覽測試真實 GLB，390×844 觸控尺寸與 844×390 橫式：新按鈕名稱、三種高強度 UI、鞋子四段、轉背、臉部停留吐槽及移開取消、動作自動收合／還原、選擇停等、救援與加碼、完整落款、Escape 取消均通過，無未捕捉 JavaScript 錯誤。
- 開發測試曾連到殘留 Vite dev server，出現 Outdated Optimize Dep 504；改用獨立的正式 Build preview，避免舊快取與 HMR 影響驗證。
- 原始 GLB SHA-256：`34fd795c693433e1ff1532c6cb7e4e801c3fb152d179e81ee1ab708c16b4c1e1`，保持不變。
- 下方為各輪歷史驗證，舊按鈕名稱、時長及測試數量以本節及現行 README 為準。
- **尚未測試：實體 iPhone Safari、硬體 FPS、長時間熱負載與 VoiceOver。** 桌面 Chromium 的手機尺寸測試不代表 iPhone 真機效能。

---

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

## Onion character design

- `npm test`: 25 passing tests. New checks cover the three-tuft merged crown, bent stem, surface-conforming face geometry, independent expression UV selection, three shared-map dancers, delayed beat, playing dead and clean cancellation/disposal.
- Repository-subpath production build passes. Chromium real-GLB mobile/landscape checks cover story framing, repeat-play resource stability and full GPU geometry/texture disposal after model clearing.
- Physical iPhone Safari and hardware FPS remain untested.

## Brush drawing / four-stage shoe camera / automatic menu return

- 32 Node tests pass, including three distinct shoe magnifications and fourth-click restoration, manual orbit interruption retaining the level, panel settling/override, world-fixed strokes and exact brush-tip alignment, and a half-painted giant's 1.5-second stare.
- Repository-subpath production build passes. Browser checks use the actual decoded GLB, with brush/ink captures, three shoe framing captures, mobile/landscape, menu auto-fold/return/scroll/manual override, action completion and resource disposal.
- Physical iPhone Safari and hardware FPS remain untested.
