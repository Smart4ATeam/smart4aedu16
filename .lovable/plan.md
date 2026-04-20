

## 目標
Admin Agent 擴充學習中心相關 function：課程/梯次/合作單位/講師 CRUD、訂單/報名明細查詢、成就頒發/撤銷。所有寫入操作（特別是刪除）必須先在 Skill 中要求 Agent 跟管理者口頭確認。

## 設計策略

### Endpoint 拆分原則
為避免單一 function 過大，按「實體」分檔，每支 function 內以 `action` 區分動作（GET 用 query string、寫入用 POST body 帶 `action`）。全部複用 `verify-admin-token.ts` + 寫 `reg_operation_logs`。

### 新增的 Edge Functions（共 6 支）

| Function | Methods / Actions | 說明 |
|---|---|---|
| `api-admin-agent-courses` | GET 列表/單筆、POST `create`/`update`/`delete` | 課程 CRUD |
| `api-admin-agent-sessions` | GET 列表（帶 course/date/status filter）、POST `create`/`update`/`delete` | 梯次 CRUD |
| `api-admin-agent-partners` | GET 列表、POST `create`/`update`/`delete` | 合作單位 CRUD |
| `api-admin-agent-instructors` | GET 列表、POST `create`/`update`/`delete` | 講師 CRUD |
| `api-admin-agent-registrations` | GET `orders`（搜尋訂單）、GET `enrollments`（搜尋報名明細） | 報名報到查詢 |
| `api-admin-agent-achievements` | GET 列表、POST `award`/`revoke` | 成就頒發/撤銷 |

### 報名明細查詢設計（重點）
`GET /api-admin-agent-registrations?type=enrollments` 支援組合條件：
- `q`：關鍵字（比對學員姓名 / member_no / email / phone / 訂單編號）
- `course_id` 或 `course_code`（可任一）
- `session_date_from` / `session_date_to`：日期區間
- `status`：`enrolled | paid | checked_in | cancelled | completed`
- `payment_status`：`pending | paid | refunded`
- `checked_in`：`true|false`
- `limit`（預設 50、最多 200）/ `offset`

回傳每筆含：學員姓名 / member_no / email / phone、課程名稱 / course_code、session_date、status、payment_status、checked_in、test_score、enrolled_at。
另外回 `summary`：`{ total, by_status: {...}, by_course: [...] }` 讓 Agent 可摘要。

訂單查詢 `?type=orders` 支援：`q`（訂單號 / P1~P3 姓名 / email / phone）、`payment_status`、`date_from/to`、`limit/offset`。

### 安全規範（寫進 Skill）
1. **新增/修改**：Agent 必須先用自然語言完整覆述所有欄位，操作者明確同意才送 `confirm: true`
2. **刪除**：必須兩段式確認
   - 先呼叫 GET 取得該筆資料 → 念出「要刪除：[名稱/標題/學員]，這個動作無法復原」
   - 操作者明確說「確認刪除」才送 `confirm: true` + `confirm_delete: true`（雙旗標）
3. **撤銷成就**：等同刪除，需雙確認
4. 所有寫入 / 刪除都記錄到 `reg_operation_logs`（entity_type 對應 `course/session/partner/instructor/enrollment/achievement_award`）

### 必填欄位定義（Skill 中明列）

| 實體 | 新增必填 | 修改 | 刪除 |
|---|---|---|---|
| 課程 | title | id + 任一欄位 | id + confirm_delete |
| 梯次 | course_id, start_date, end_date | id | id + confirm_delete |
| 合作單位 | name | id | id + confirm_delete |
| 講師 | name | id | id + confirm_delete |
| 頒發成就 | user_id 或 student_id 或 email, achievement_id 或 achievement_name | — | award_id + confirm_delete |

### Skill 文件擴充（`admin-skill.ts`）
在現有 admin skill 後追加 6 個新區塊：「課程管理 / 梯次管理 / 合作單位 / 講師 / 報名查詢 / 成就管理」，每個區塊含端點、欄位表、確認流程範例對話。

範例對話（刪除）：
```
使用者：把「Make 進階班」這個課程刪掉
Agent：[GET courses?q=Make 進階班] 找到課程「Make 進階班 (course_code: MK-ADV-001)」，
      狀態：published、已有 3 個梯次。
      ⚠️ 刪除課程會影響相關梯次與報名資料，無法復原。
      確認要刪除嗎？
使用者：確認刪除
Agent：[POST action=delete with confirm=true, confirm_delete=true]
      已刪除。
```

## 變動檔案

| 檔案 | 動作 |
|---|---|
| `supabase/functions/api-admin-agent-courses/index.ts` | 新建 |
| `supabase/functions/api-admin-agent-sessions/index.ts` | 新建 |
| `supabase/functions/api-admin-agent-partners/index.ts` | 新建 |
| `supabase/functions/api-admin-agent-instructors/index.ts` | 新建 |
| `supabase/functions/api-admin-agent-registrations/index.ts` | 新建 |
| `supabase/functions/api-admin-agent-achievements/index.ts` | 新建 |
| `src/lib/agent-skills/admin-skill.ts` | 擴充新區塊 |

### 不動的部分
- 不動現有 admin UI、不動學員端 Agent、不動資料表 schema、不動其他 edge functions
- 共用現有 `user_api_tokens` + `verify-admin-token.ts`

## 需要你確認

1. **梯次刪除若已有報名怎麼處理？** 三選一：
   - (a) 直接拒絕刪除，回 `HAS_ENROLLMENTS` 錯誤（最安全，建議）
   - (b) 允許刪除但連帶刪 enrollments
   - (c) 允許刪除但保留 enrollments（孤兒資料）

2. **課程/合作單位/講師被引用時的刪除策略？** 同上，建議一律 (a) 拒絕，回傳引用數量。

3. **報名明細查詢是否要包含已 cancelled 的？** 預設排除，可用 `include_cancelled=true` 加回來。

4. **這次先做這 6 支？** 之後若要再加（例如：批次建立梯次、匯入報名、寄通知信）可下輪擴充。

