

## Plan: 場景範本領用 — Supabase Storage + 24 小時一次性下載

### 流程簡述

```text
管理員：上傳範本檔案(.zip/.json) → 存入私有 bucket → 路徑記錄在 resources 表

學員領用：
  1. 點「領用試用」→ 驗證身份 + 每日限額
  2. 範本類別：跳過 webhook，直接產生 24 小時 signed URL 寫入 api_key
  3. 設定 webhook_status = 'completed'，發系統訊息通知
  4. 學員在「我的試用」看到「下載範本」按鈕
  5. 超過 24 小時 → 連結失效，顯示「已過期」

  ※ 不重新產生 signed URL，過期就是過期
  ※ 不需 api-resource-trial-download Edge Function
```

### 具體變更

#### 1. 資料庫 Migration
- 建立私有 storage bucket `resource-templates`（`public = false`）
- Storage RLS：admin 可上傳/刪除
- `resources` 表新增 `template_file_path text`（bucket 內檔案路徑）

#### 2. Admin 前端 (`AdminContent.tsx`)
- 範本類別的編輯表單新增「範本檔案」上傳欄位（.zip / .json）
- 上傳至 `resource-templates` bucket，路徑存入 `resources.template_file_path`
- 範本類別不再強制要求 `app_id`（改為選填）

#### 3. 領用 Edge Function (`api-resource-trial`)
- 新增判斷：`resource.category === 'templates'` 時
  - 從 `resources.template_file_path` 取得檔案路徑
  - 用 service role 產生 24 小時 signed URL
  - 寫入 `resource_trials.api_key`
  - 設定 `webhook_status = 'completed'`
  - 發送系統訊息：「📦 [標題] 範本下載連結已到，請至「我的試用」下載（24小時內有效）」
  - 跳過 webhook 發送
  - 回傳成功訊息：「領用成功！請至「我的試用」下載範本」

#### 4. 前端 `Resources.tsx` — CallbackValueCell
- 範本類別：根據 `created_at` + 24 小時判斷是否過期
  - 未過期：顯示「下載範本」按鈕
  - 已過期：顯示「已過期」灰色文字，不可點擊

#### 5. 前端 `Resources.tsx` — 領用驗證
- 範本類別跳過 `app_id` 檢查（因為範本不一定有 app_id）
- 改為檢查 `template_file_path` 是否存在

### 不需變更
- 套件（extensions）流程完全不變
- `api-resource-trial-callback` 不變
- 不需新增 Edge Function
- 資料庫 `resource_trials` 表結構不變

### 技術要點
- Storage bucket 為 private，只能透過 signed URL 存取
- signed URL 有效期固定 24 小時（86400 秒），過期不可再下載
- 前端用 `trial.created_at` + 24h 與當前時間比較判斷過期狀態

