# 賽車對話頭像

`race-portraits.webp` 為 1920×1536 WebP（每格 384×384），四列依序為祀、莊芳宜、小聰明、龍泡泡；五欄依序為平靜、得意、驚恐、生氣、生無可戀。

祀與莊芳宜的頭像由本站已收錄的使用者提供 GLB 渲染，逐格調整現有眉眼、嘴角與頭部骨架；人物臉上不再疊加漫畫五官或色塊。驚嘆號、怒符、汗滴放在臉外。這些是本站衍生渲染，原 GLB 未改動。

- Si / Arknights Endfield — Abcxyz51：https://sketchfab.com/3d-models/si-arknights-endfield-304e5f23db204cbd834b44138ca570d7
- Zhuang Fangyi / Arknights Endfield — Abcxyz51：https://sketchfab.com/3d-models/zhuang-fangyi-arknights-endfield-51d669eb7ef94cb49aeeaf2d9541d9de
- 兩份人物模型採 CC BY 4.0：https://creativecommons.org/licenses/by/4.0/

小聰明與龍泡泡頭像由本站程序二創模型渲染，非官方頭像素材。所有角色／世界觀權利歸原權利人；本站為同人試作。

2026-10-22 圓頭白臉改版：小聰明從一體圓頭 UV 貼圖簡模重新渲染；移除舊紙牌臉與未使用的 PNG 圖集。遊戲仍只切換靜態背景切格，不建立第二個 Renderer。網址含圖集版本，避免沿用先前髒污表情的快取。

離線重製工具：`tools/render-race-portraits.mjs`。在本機啟動 Vite 後，指定現有 Playwright 模組與 Chromium 路徑執行；該工具不進入正式 bundle，專案沒有新增依賴。工具使用兩份 GLB 的已核對節點設定，缺少節點或出現非有限骨架時會中止產圖。
