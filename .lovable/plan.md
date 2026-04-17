

## 規劃：學員 Agent Skill 擴充（行事曆 + 我的點數）

### 1. 新增 Edge Functions（皆使用 `verify-user-token.ts` 驗證 sk_xxx token）

**A. `api-agent-my-calendar` — 行事曆 CRUD**

支援多種 HTTP method，全部以該學員身份操作：

- `GET /api-agent-my-calendar` 
  - 可選 query：`from=YYYY-MM-DD`、`to=YYYY-MM-DD`、`scope=own|global|all`（預設 all）
  - 回傳：`{ events: [{ id, title, description, event_date, event_time, color, is_global, user_id, created_at }] }`
  - 學員可看到自己的事件 + 全域事件（與 RLS 邏輯一致）

- `POST /api-agent-my-calendar`
  - body：`{ title, event_date, event_time?, description?, color? }`
  - 強制 `is_global=false`、`user_id=<token's userId>`
  - 回傳：`{ event }`

- `PATCH /api-agent-my-calendar?id=<event_id>`
  - body：可更新 `title, event_date, event_time, description, color`
  - 限制：只能修改 `is_global=false AND user_id=<token's userId>` 的事件，否則回 403
  - 回傳：`{ event }`

- `DELETE /api-agent-my-calendar?id=<event_id>`
  - 限制同上
  - 回傳：`{ success: true }`

**B. `api-agent-my-points` — 點數查詢（唯讀）**

- `GET /api-agent-my-points`
  - 透過 token 取得 userId → 查 `reg_members`（先 user_id，找不到再 fallback email）
  - 回傳：`{ member: { member_no, name, points }, balance: number }`
  - 找不到對應會員則回 `{ member: null, balance: 0 }`

- `GET /api-agent-my-points?history=true&limit=50`
  - 回傳該會員的 `reg_point_transactions`：
    `{ transactions: [{ id, points_delta, type, description, created_at }] }`
  - 預設 limit=50、最多 200，按 `created_at desc`

> 兩支函式都使用 service role client，但行事曆寫入時嚴格以 token 對應的 `userId` 鎖定 `user_id` 欄位，確保 Agent 不能跨用戶。

### 2. 更新 Agent Skill 文件

修改 `src/lib/agent-skills/learning-skill.ts`，新增兩個區塊：

- **行事曆**：列出 4 個 endpoint、欄位說明、限制（不可改全域事件、僅能 CRUD 自己建立的事件）
- **我的點數**：列出 2 個查詢方式、欄位說明、會員不存在的處理建議
- 加入使用範例（「我下週有什麼活動？」「幫我加一個明天的活動」「我現在還有多少點？」「最近的點數紀錄」）
- 更新「限制」段落：寫入操作僅限行事曆，且不能動全域 / 他人事件

### 3. 不需要的變更

- 不需新增資料表或 migration（`calendar_events`、`reg_members`、`reg_point_transactions` 都已存在）
- 不需動 RLS（Edge Function 用 service role，自行做權限判斷）
- 不需動前端 UI

### 檔案清單

- 新增 `supabase/functions/api-agent-my-calendar/index.ts`
- 新增 `supabase/functions/api-agent-my-points/index.ts`
- 修改 `src/lib/agent-skills/learning-skill.ts`（補上兩段文件 + 範例 + 限制）

