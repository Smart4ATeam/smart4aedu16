

# 訊息排版 + 已發送廣播檢視

## 一、問題

1. **訊息全擠在一起**：`Messages.tsx` 第 417 行 `<p>{msg.content}</p>` 直接吐純文字 → 換行字元被瀏覽器吃掉、URL 不會變連結。
2. **後台看不到已發送內容**：`AdminBroadcast.tsx` 的歷史表格只顯示標題／人數／日期，點不進去看當時發了什麼。

## 二、修正方案

### A. 學員端：訊息支援換行 + 可點連結

新增 `src/components/messages/MessageContent.tsx` 共用元件：

- 用 `whitespace-pre-wrap` + `break-words` 保留 `\n`、空白、長 URL 自動斷行
- 用 regex 偵測 `https?://...`，把 URL 切成 `<a target="_blank" rel="noopener noreferrer">` 樣式為主色底線
- 純文字渲染（不解析 HTML）→ 安全、不會被注入

`Messages.tsx` 第 417 行 `<p>{msg.content}</p>` 換成 `<MessageContent text={msg.content} fromMe={fromMe} />`。

> 註：已發出的舊訊息只要原本內容有 `\n`，重新渲染後就會分行；若原本完全沒換行符，那則訊息仍會是一整段（DB 內容沒被改）。

### B. 後台：已發送廣播可展開檢視內容

`AdminBroadcast.tsx` 歷史區改造：

1. `fetchBroadcasts` 多撈一個欄位 → 額外查 `messages` 表拿每個 conversation 的首則內容（或一次撈：先撈 conversations，再用 `in('conversation_id', ids)` 撈 messages，前端組裝）
2. 表格每列前面加一顆「眼睛」icon 按鈕 → 點開 Dialog 顯示：
   - 標題、優先級、發送時間、收件人數
   - 內容區用同一個 `MessageContent` 元件渲染（換行 + 連結點擊一致）
   - 「複製內容」按鈕
3. 表格新增「內容預覽」欄（截斷 60 字 + `...`），方便快速辨識

## 三、影響檔案

| 檔案 | 異動 |
|---|---|
| `src/components/messages/MessageContent.tsx` | **新增**：共用文字渲染（換行 + URL linkify） |
| `src/pages/Messages.tsx` | 第 417 行改用 `MessageContent` |
| `src/pages/admin/AdminBroadcast.tsx` | 多撈 message content、加內容預覽欄、加檢視 Dialog |

無需資料庫變更、無需 Edge Function 變更。

## 四、驗收

- 在後台發一則訊息，內容刻意打多行 + 貼一個 https 網址 → 學員端訊息中心應分行顯示、網址可點開新分頁
- 後台「已發送廣播」每列點眼睛 → 跳出 Dialog 看到完整內容（同樣分行 + 連結可點）
- 圖中那則「入門班～立即報名」舊訊息：分行依原始 content 是否含 `\n` 而定，網址會自動變連結

