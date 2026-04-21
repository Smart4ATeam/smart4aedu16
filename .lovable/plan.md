

# 修復 Agent「查不到 5 月課程」與全面盤點

## 真正的根因（已驗證）

1. **`api-agent-courses` 沒有問題**：CORS 完整、log 沒錯誤、curl 直接打也正常。Agent 講的「被瀏覽器擋下、registration_url 被過濾」是 **LLM 幻覺**——Agent 不是瀏覽器，根本沒有 CORS 問題。
2. **真正缺的是「梯次查詢能力」**：使用者問「5 月有哪些課」，這個資訊在 `course_sessions.start_date / end_date`，但學員端 Agent **完全沒有任何 endpoint 可查 sessions**。Agent 撈了 `courses` 卻找不到日期欄位，只好硬掰一個藉口交差。
3. **資源中心 / 序號領取**：我已逐一比對 `api-agent-resources`、`api-agent-claim-trial`、`api-agent-my-trials`，CORS、token 驗證、回傳格式都正常，沒有壞掉，可以正常使用。
4. **最近的修改沒有破壞既有功能**：先前改的是 `api-admin-agent-registrations`（管理者端）、`api-agent-my-enrollments`、`api-agent-my-progress`（學員端，且加了 reg_members 中介查詢，是更穩健的修法），都跟 `api-agent-courses` 無關。

## 修改方案

### 1. 新增 `supabase/functions/api-agent-sessions/index.ts`（學員端梯次查詢）
讓 Agent 能查「某個月、某個課程、某狀態」的梯次。支援參數：
- `course_id`：指定課程
- `category`：例如 `basic` / `quest`
- `date_from` / `date_to`：日期區間（YYYY-MM-DD），用於「5 月」「下個月」這類問題
- `status`：預設只回 `scheduled`（未來/可報名），可傳 `all`
- `upcoming=true`：只回 `start_date >= 今天` 的梯次

回傳每筆 session 含：`id, course_id, title_suffix, start_date, end_date, location, max_students, registration_url`，並順便帶出對應 `course.title / course_code / category / price`，Agent 不必再多一次 query。

僅回傳已上架（`courses.status = published`）課程下的梯次，避免洩漏草稿。

### 2. 在 `api-agent-courses` 詳情模式順帶回傳該課程的 sessions
查 `?id=<course_id>` 時，除了原本 `units / sections`，再附上 `sessions: [...]`（只回 `status = scheduled` 且未過期的梯次）。這樣 Agent 問「XX 課什麼時候開」一次就拿到。

### 3. 更新 `src/lib/agent-skills/learning-skill.ts`
- 新增「梯次查詢」章節，把 `/api-agent-sessions` 的參數、回傳、使用範例都寫清楚。
- 加一條 **明確的反幻覺指引**：「若呼叫 endpoint 失敗，請回報實際 HTTP 狀態碼與錯誤訊息，**不得**自行推測為『瀏覽器 CORS / 內容被過濾 / BLOCKED』，你不是瀏覽器。」
- 在「常見問題對應」加入：「使用者問『X 月有哪些課』→ 用 `/api-agent-sessions?date_from=...&date_to=...`」與「『XX 課什麼時候開』→ `/api-agent-courses?id=<id>` 取 `sessions`」。

## 不會動到的部分
- 不動資料表 schema、不動 RLS、不動既有 endpoint 的回傳結構（只是新增欄位、新增 endpoint）。
- 不動管理者端的 `api-admin-agent-sessions`（那是另一支，已有不同用途）。
- 不動前端 UI。

## 影響檔案總覽
| 檔案 | 動作 |
|---|---|
| `supabase/functions/api-agent-sessions/index.ts` | **新增** |
| `supabase/functions/api-agent-courses/index.ts` | 詳情模式增回 `sessions` |
| `src/lib/agent-skills/learning-skill.ts` | 補梯次章節 + 反幻覺規則 |

確認後我就執行。

