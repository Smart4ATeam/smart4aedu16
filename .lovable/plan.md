

## Plan: 資源試用領用系統

### 概要
建立學員每日可領用一個套件/模板的完整系統，包含：資源試用設定、領用記錄、Webhook 金鑰申請、管理員統計、API 文件。

---

### 1. 資料庫 Migration

**resources 表新增欄位：**
```sql
ALTER TABLE resources ADD COLUMN app_id text;
ALTER TABLE resources ADD COLUMN trial_enabled boolean NOT NULL DEFAULT false;
```
- `app_id`：套件/模板的應用編號（如截圖中的 `richmenu-yrfqmv`）
- `trial_enabled`：是否開放試用

**新增 resource_trials 表：**
```sql
CREATE TABLE public.resource_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resource_id uuid REFERENCES resources(id) ON DELETE CASCADE NOT NULL,
  member_no text,
  organization_id text NOT NULL,
  app_id text NOT NULL,
  resource_category text NOT NULL,
  api_key text,
  webhook_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, resource_id)
);
ALTER TABLE resource_trials ENABLE ROW LEVEL SECURITY;

-- 學員只能看到自己的領用紀錄
CREATE POLICY "Users can view own trials"
  ON resource_trials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trials"
  ON resource_trials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 管理員可查看全部
CREATE POLICY "Admins can view all trials"
  ON resource_trials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

---

### 2. 資源管理 UI 新增欄位

**檔案**：`src/pages/admin/AdminContent.tsx`

- `NewResource` type 新增 `app_id: string` 和 `trial_enabled: boolean`
- `emptyResource()` 加入預設值
- `buildInsertPayload` 加入 `app_id` 和 `trial_enabled`
- `DynamicFields` 中，當分類為 `extensions` 或 `templates` 時顯示：
  - APP ID 輸入框
  - 開放試用 checkbox
- 資源列表 Table 增加「試用」欄位標記

---

### 3. 學員資源頁面 — 領用功能

**檔案**：`src/pages/Resources.tsx`

- 套件卡片 (`ExtensionCard`) 和模板卡片 (`TemplateCard`)：當 `trial_enabled=true` 時顯示「領用試用」按鈕
- 領用前檢查：
  1. 使用者已登入
  2. `profiles.organization_id` 已設定（未設定則提示前往設定頁面）
  3. 當日尚未領用過任何資源（查 `resource_trials` 當日記錄，套件和模板分開計算各一個）
- 領用流程：呼叫新的 Edge Function `api-resource-trial`

---

### 4. 學員試用紀錄頁面

**檔案**：`src/pages/Resources.tsx`（新增 Tab 或區塊）

- 在資源頁面上方加入「我的試用」Tab
- 列出該學員所有領用紀錄：資源名稱、APP ID、領用日期、API Key（若已回傳）
- API Key 以遮罩顯示，點擊可複製

---

### 5. Edge Function：領用資源

**新增檔案**：`supabase/functions/api-resource-trial/index.ts`

- 需要使用者 JWT 認證（非 x-api-key）
- 接收 `resource_id`
- 驗證：
  1. 資源存在且 `trial_enabled = true`
  2. 使用者 `organization_id` 已設定
  3. 該資源的 category 當日未領用（extensions 一個 / templates 一個）
  4. 該資源未曾領用過
- 寫入 `resource_trials` 記錄
- 發送 Webhook（POST）到系統設定的 URL，payload：
  ```json
  {
    "organization_id": "學員的組織編號",
    "app_id": "資源的 APP ID",
    "member_no": "學員編號",
    "category": "extensions 或 templates",
    "resource_title": "資源名稱",
    "trial_id": "resource_trials 的 id"
  }
  ```
- Webhook URL 從 `system_settings` 表取得（key: `trial_webhook_url`），管理員可在設定頁面配置

---

### 6. Webhook 回傳 API Key 端點

**新增檔案**：`supabase/functions/api-resource-trial-callback/index.ts`

- 使用 `x-api-key` 認證
- 接收 `{ trial_id, api_key }`
- 更新 `resource_trials` 的 `api_key` 和 `webhook_status = 'completed'`

---

### 7. 管理員統計

**檔案**：`src/pages/admin/AdminContent.tsx`

- 新增「試用統計」區塊或 Tab：
  - 今日領用數量
  - 各資源領用人次排名（熱門排行）
  - 近期領用紀錄列表（學員、資源、時間）

---

### 8. 管理員設定 — Webhook URL

**檔案**：`src/pages/admin/AdminSettings.tsx`（或 AdminIntegrations）

- 新增「試用 Webhook URL」設定欄位，儲存至 `system_settings` 表（key: `trial_webhook_url`）

---

### 9. API 文件更新

**檔案**：`src/pages/admin/AdminIntegrations.tsx`

- 新增 `api-resource-trial-callback` 端點文件：
  - Method: POST
  - Auth: x-api-key
  - 必填：`trial_id`, `api_key`
  - 範例 cURL 與回應

---

### 技術細節
- Migration：resources 新增 2 欄位 + 新建 resource_trials 表
- 新增 Edge Function：`api-resource-trial`（學員領用）、`api-resource-trial-callback`（接收金鑰回傳）
- 修改檔案：`AdminContent.tsx`、`Resources.tsx`、`AdminIntegrations.tsx`、`AdminSettings.tsx`、`types.ts`
- 每日限制邏輯：套件和模板各一個，以 `created_at` 的日期（台灣時區 UTC+8）判斷

