

## 規劃：學員 Agent Skill 擴充（資源中心）

### 1. 新增 Edge Functions（皆使用 `verify-user-token.ts` sk_xxx token 驗證）

**A. `api-agent-resources` — 資源查詢（唯讀，智能查詢）**

`GET /api-agent-resources` — 列表 + 搜尋 + 篩選

可選 query：
- `q`：關鍵字（會比對 `title`、`description`、`tags`、`industry_tag`）
- `category`：`plugins | extensions | templates | videos`
- `sub_category`：例如「熱門套件」「電商應用」
- `difficulty`：`初級|中級|高級`
- `is_hot`：`true` 只看熱門
- `trial_only`：`true` 只看 `trial_enabled=true`（給「我可以領哪些試用」用）
- `industry_tag`：產業標籤
- `limit`（預設 30、最多 100）、`offset`

僅回傳 `status='approved'` 的資源。回傳精簡欄位（避免 token 爆量）：
```
{
  total, limit, offset,
  resources: [{
    id, title, category, sub_category, description (截斷 200 字),
    author, version, tags, difficulty, is_hot, hot_rank,
    industry_tag, duration, video_type,
    trial_enabled, has_trial_file (templates 才有意義),
    detail_url, download_url, thumbnail_url
  }]
}
```

`GET /api-agent-resources?id=<resource_id>` — 單筆完整資料
回傳完整欄位 + `sub_categories_in_category`（同類別所有 sub_category 列表，方便 Agent 推薦）。

`GET /api-agent-resources?facets=true` — 篩選選項
回傳：`{ categories: [...], sub_categories: { extensions: [...], templates: [...] }, difficulties: [...], industry_tags: [...] }`，讓 Agent 知道有哪些可選值。

**B. `api-agent-my-trials` — 我的試用查詢（唯讀）**

`GET /api-agent-my-trials`

可選 query：`status=pending|completed|failed|all`（預設 all）、`limit`（預設 50、最多 200）

回傳：
```
{
  trials: [{
    trial_id, resource_id, resource_title, resource_category,
    app_id, member_no, organization_id,
    api_key (套件序號 / 範本下載連結),
    webhook_status, created_at
  }]
}
```

> 範本類別的 `api_key` 是 24 小時 signed URL，Agent 應提醒「24 小時內有效」。

**C. `api-agent-claim-trial` — 領取試用（寫入）**

`POST /api-agent-claim-trial`，body：`{ resource_id }`

完整移植 `api-resource-trial` 的所有規則，但用 sk_xxx token 驗 user：

1. 驗 `resource.trial_enabled`、`status='approved'`
2. 範本檢查 `template_file_path`、套件檢查 `app_id`
3. 檢查 `profile.organization_id`，沒設定回 400 並提示「請至設定頁填組織編號」
4. 解析 `member_no`（profile.student_id → reg_members.member_no）
5. **每天每類別限領 1 個**（台灣時區 UTC+8 當日）— 超過回 429 並訊息「今日已領用過一個{類別}，明天再來吧！」
6. 範本：直接產生 24h signed URL → 寫 trial → 回 `api_key`（下載連結）+ `expires_in: 86400`
7. 套件：寫 trial → 觸發 webhook（讀 `system_settings.trial_webhook_url`）→ 回 `webhook_status`，並提示「請稍後用 `GET /api-agent-my-trials` 查詢序號」
8. 同步發系統訊息（沿用既有邏輯，看 `notification_settings.show_success`）

回傳：
```
{
  success: true,
  trial_id, resource_title, resource_category, app_id,
  api_key (範本才有，套件需稍後查詢),
  webhook_status,
  message: "..."
}
```

錯誤回傳統一格式：`{ error, code }`，code 包含 `MISSING_ORG_ID | DAILY_LIMIT_REACHED | TRIAL_DISABLED | NO_TEMPLATE_FILE | NO_APP_ID | RESOURCE_NOT_FOUND`，方便 Agent 給使用者看正確提示。

### 2. 更新 Agent Skill 文件 `src/lib/agent-skills/learning-skill.ts`

新增「資源中心」整段，含：

- 三個 endpoint 完整說明
- 「智能查詢」使用說明：建議 Agent 先用 `?facets=true` 拿到合法值再去搜尋；模糊比對用 `q`、精確篩選用 `category/sub_category/difficulty`
- 領取規則明列：每天每類別 1 個、需先設組織編號、套件需等 webhook 回拋（用 my-trials 查序號）、範本連結 24h 有效
- 範例：
  - 「有什麼 LINE 相關的套件？」→ `?q=LINE&category=extensions`
  - 「推薦熱門電商範本」→ `?category=templates&sub_category=電商應用&is_hot=true`
  - 「我可以領哪些試用？」→ `?trial_only=true`
  - 「幫我領 X 套件」→ POST claim-trial（成功後若是套件提醒查 my-trials）
  - 「我的試用序號」→ GET my-trials
  - 「我今天還能領嗎？」→ Agent 自行用 my-trials 比對當日 created_at 跟 category
- 限制段落補充：每日領取限額、不能跨用戶、不能改 webhook_url、不能領 `trial_enabled=false` 的資源

### 3. 不需變更

- 不需新 table 或 migration（`resources`、`resource_trials`、`resource_sub_categories`、`system_settings` 都已存在）
- 不需動 RLS（Edge Function 用 service role + token 驗 userId）
- 不需動前端 UI 與既有 `api-resource-trial`

### 檔案清單

- 新增 `supabase/functions/api-agent-resources/index.ts`
- 新增 `supabase/functions/api-agent-my-trials/index.ts`
- 新增 `supabase/functions/api-agent-claim-trial/index.ts`
- 修改 `src/lib/agent-skills/learning-skill.ts`（補上資源中心整段 + 範例 + 限制）

