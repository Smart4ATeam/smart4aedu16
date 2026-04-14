

## Plan: 統一欄位 `api_key`，依類別顯示不同 UI

沿用現有的 `resource_trials.api_key` 欄位存放所有回傳值（金鑰或下載連結），前端根據 `resource_category` 判斷顯示方式。

### 變更內容

#### 1. 前端 `Resources.tsx` — MyTrialsTab 區域
- **狀態文字**：`templates` 類別顯示「✅ 連結已回傳」而非「✅ 金鑰已回傳」
- **ApiKeyCell → 通用 CallbackValueCell**：依 `resource_category` 判斷：
  - `extensions`：維持現有遮罩 + 複製金鑰行為
  - `templates`：顯示「下載範本」按鈕（`window.open(api_key)`），不需遮罩

#### 2. 前端 `AdminContent.tsx` — Trials 分頁
- 同步調整管理端試用紀錄表的顯示，templates 類別顯示為「下載連結」而非「API Key」

#### 3. 回調 Edge Function (`api-resource-trial-callback`)
- 通知訊息依類別調整：templates 改為「範本下載連結已到」而非「API Key 已到」

#### 4. Webhook 通知訊息 (`api-resource-trial-callback`)
- 系統訊息內容：templates → `「請至資源中心「我的試用」分頁下載」`

### 不需變更
- 資料庫結構不變（繼續用 `api_key` 欄位）
- `api-resource-trial` 領用流程不變
- Webhook 發送流程不變

