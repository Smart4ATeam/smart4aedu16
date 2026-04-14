
## Plan: 場景範本領用 — Supabase Storage + 24 小時一次性下載

### 狀態：✅ 已完成

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

#### 1. ✅ 資料庫 Migration
- 建立私有 storage bucket `resource-templates`（`public = false`）
- Storage RLS：admin 可上傳/刪除/讀取
- `resources` 表新增 `template_file_path text`（bucket 內檔案路徑）

#### 2. ✅ Admin 前端 (`AdminContent.tsx`)
- 範本類別的編輯表單新增「範本檔案」上傳欄位（.zip / .json）
- 上傳至 `resource-templates` bucket，路徑存入 `resources.template_file_path`
- 範本類別不再強制要求 `app_id`（改為選填）

#### 3. ✅ 領用 Edge Function (`api-resource-trial`)
- 判斷 `resource.category === 'templates'` 時：
  - 驗證 `template_file_path` 存在
  - 用 service role 產生 24 小時 signed URL（86400 秒）
  - 寫入 `resource_trials.api_key`
  - 設定 `webhook_status = 'completed'`
  - 發送系統訊息通知學員
  - 跳過外部 webhook 發送
- 套件（extensions）流程不變，維持原有 webhook 機制

#### 4. ✅ 學員前端 `Resources.tsx` — CallbackValueCell
- 範本類別：根據 `created_at` + 24 小時判斷是否過期
  - 未過期：顯示「📥 下載範本」按鈕（直接開啟 signed URL）
  - 已過期：顯示「⏰ 已過期」灰色文字，不可點擊

#### 5. ✅ 學員前端 `Resources.tsx` — 領用驗證
- 範本類別跳過 `app_id` 檢查
- 改為檢查 `template_file_path` 是否存在

#### 6. ✅ Admin 試用紀錄分頁 — 過期狀態
- 範本類別試用紀錄超過 24 小時顯示「⏰ 已過期」紅色標籤
- 其他類別維持原有狀態顯示邏輯

### 不需變更
- 套件（extensions）流程完全不變
- `api-resource-trial-callback` 不變
- 不需新增 Edge Function
- 資料庫 `resource_trials` 表結構不變

### 技術要點
- Storage bucket 為 private，只能透過 signed URL 存取
- signed URL 有效期固定 24 小時（86400 秒），過期不可再下載
- 前端用 `trial.created_at` + 24h 與當前時間比較判斷過期狀態
- Admin 與學員端共用相同的 24 小時過期判斷邏輯

### 相關檔案
- `supabase/functions/api-resource-trial/index.ts` — 領用 Edge Function（含範本 signed URL 邏輯）
- `src/pages/Resources.tsx` — 學員資源中心（含試用列表、下載/過期顯示）
- `src/pages/admin/AdminContent.tsx` — Admin 資源管理（含範本上傳、試用紀錄過期狀態）
- `supabase/migrations/` — Storage bucket 與 `template_file_path` 欄位
