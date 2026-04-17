

## 規劃：學員 Agent Skill 擴充（訊息中心 + 個人設定）

### 1. 新增 Edge Functions（皆使用 `verify-user-token.ts` 驗證 sk_xxx token）

**A. `api-agent-my-messages` — 訊息中心**

- `GET /api-agent-my-messages`
  - query：`filter=all|unread|starred|archived`（預設 all=非封存）、`category=system|client|team`、`limit`（預設 50、最多 200）
  - 回傳對話列表（含最後一則訊息、unread/starred/archived 狀態、category、updated_at）
  - 範例：「我有哪些未讀訊息？」「列出我標星的訊息」

- `GET /api-agent-my-messages?conversation_id=<id>`
  - 回傳該對話的所有訊息（content/sender_id/is_system/created_at）+ 對話 meta
  - 權限：必須是該對話的 participant（user_id = token 對應 userId），否則 403

- `PATCH /api-agent-my-messages?conversation_id=<id>`
  - body：可更新 `starred`、`unread`、`archived`（可選一或多）
  - 僅更新該 user 自己的 `conversation_participants` row
  - 範例：「把這封標星」「全部標為已讀」

> 不開放發送訊息（避免 Agent 主動發 client/team 訊息），只支援查詢與狀態管理。

**B. `api-agent-my-settings` — 個人設定**

- `GET /api-agent-my-settings`
  - 回傳：
    - `profile`：`display_name, phone, bio, avatar_url, email, student_id`
    - `environment`：`organization_id, server_location`
    - `learning`：`learning_goal, difficulty_preference, daily_learning_time`
    - `server_location_options`：固定列舉允許值（從現有 Settings.tsx 讀出），方便 Agent 提示

- `PATCH /api-agent-my-settings`
  - body 為 partial JSON，分組允許欄位：
    - profile：`display_name`、`phone`、`bio` （字串長度限制：name≤50, phone≤20, bio≤500）
    - environment：`organization_id`（≤50）、`server_location`（必須在白名單內，否則 400）
    - learning：`learning_goal`（≤200）、`difficulty_preference`（白名單：`初級|中級|高級`）、`daily_learning_time`（白名單：`30 分鐘|1 小時|2 小時|3 小時以上`）
  - 任何不在白名單的欄位（例如 email、avatar_url、role、activated）一律拒絕，回 400 並列出允許欄位
  - 以 `userId` 為條件 update `profiles` table
  - 回傳更新後的完整 settings（同 GET 格式）

> server_location 與 difficulty / daily_learning_time 的白名單，會先讀 `src/pages/Settings.tsx` 把現有選項對齊（避免硬寫不一致）。

### 2. 更新 Agent Skill 文件

修改 `src/lib/agent-skills/learning-skill.ts`，新增兩段：

- **訊息中心**：列 3 個 endpoint、欄位、filter / category 列表、星號與已讀操作範例
- **個人設定**：列 2 個 endpoint、可編輯欄位白名單（明確標示哪些禁止）、`server_location` / `difficulty` / `daily_learning_time` 的合法值
- 加入範例：「我有幾封未讀？」「把第三封標星」「把我的顯示名稱改成 XXX」「把 make 主機改成 EU1」「我學習偏好設成中級、每天 2 小時」
- 限制段落補充：不可改 email / 頭像 / 角色 / 啟用狀態；不可發訊息

### 3. 不需要的變更

- 不需新增資料表或 migration（`profiles`、`conversations`、`conversation_participants`、`messages` 都已存在）
- 不需動 RLS（Edge Function 用 service role + 自行驗 userId）
- 不需動前端 UI

### 檔案清單

- 新增 `supabase/functions/api-agent-my-messages/index.ts`
- 新增 `supabase/functions/api-agent-my-settings/index.ts`
- 修改 `src/lib/agent-skills/learning-skill.ts`（補上兩段文件 + 白名單 + 範例）

