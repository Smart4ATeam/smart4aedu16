

# 管理員 Agent：行事曆管理 整合規劃

## 目標
讓管理員透過 AI Agent 對行事曆執行 查詢 / 新增 / 修改 / 刪除，並嚴格區分「全域活動」「個人活動」與「課程梯次連動活動」三種情境。

---

## 一、新增 Edge Function

### `supabase/functions/api-admin-agent-calendar/index.ts`
- 認證：沿用 `verify-admin-token.ts`（Bearer JWT + admin role check）
- CORS、輸入驗證、錯誤碼一致於現有 admin agent functions

### 端點行為（單一 function 用 `action` 路由）

| Method | Action | 說明 |
|---|---|---|
| GET | `list` | Query: `scope=global|personal|session|all`、`date_from`、`date_to`、`q`（標題/描述模糊）、`limit/offset`。回傳含 `session_id`、`session_day_index`、是否 linked |
| GET | `get` | `?id=<uuid>` 單筆（含關聯課程資訊） |
| POST | `create` | 建立活動，需 `confirm:true` |
| POST | `update` | 修改活動，需 `confirm:true`；若 `session_id != null` 一律回 `409 LINKED_TO_SESSION` 並附課程/梯次資訊 |
| POST | `delete` | 刪除，需 `confirm:true` + `confirm_delete:true`；linked 活動同樣 409 拒絕 |

### Scope 規則（重要）
- `global` → `is_global = true AND session_id IS NULL`
- `personal` → `user_id = <admin 自己 user id> AND is_global = false`
- `session` → `session_id IS NOT NULL`（唯讀）
- `all` → 上述聯集

### 必填欄位（create / update）
- `create`：`title`、`event_date`(YYYY-MM-DD)、`scope`('global' | 'personal')
- 選填：`event_time`、`end_time`(HH:MM)、`description`、`color`(預設 `gradient-orange`)
- `update`：`id` + 任一欲改欄位

### 安全攔截邏輯
1. 取得目標活動
2. 若 `session_id != null`：直接回 409，payload 含 `course_title`、`session_id`、`start_date`，並提示請改呼叫 `api-admin-agent-sessions`
3. 寫入 `reg_operation_logs`（entity_type='calendar_event'）

---

## 二、更新 Agent Skill 文件

### `src/lib/agent-skills/admin-skill.ts`
新增「12. 行事曆管理」段落，內容包含：

1. **⚠️ 開場必詢問（最高優先級）**
   > 管理員同時擁有「管理員後台行事曆」與「學員端個人行事曆」兩種視角。任何行事曆操作前，Agent 必須先問：
   > 「您要操作的是『管理員後台 全域活動』還是『您學員端的個人活動』？」
   > 對應 → `scope: "global"` 或 `scope: "personal"`

2. **端點規格**：列出 list / get / create / update / delete 與 query/body 範例

3. **連動活動處理規則**：
   - 查詢結果遇到 `session_id != null` → 標示「🔗 課程連動」並附課程名稱、梯次日期
   - 使用者要求修改/刪除 linked 活動 → **不可呼叫 calendar API**，改流程：
     1. 告知「此活動由課程梯次連動建立」
     2. 引導改用 `api-admin-agent-sessions`（修改梯次）或調整 status 回 `scheduled`（自動刪除行事曆）
   - 若使用者堅持，依然回報 API 會拒絕，請改梯次

4. **變更類流程（嚴格）**：
   - **新增**：先覆述「scope / 標題 / 日期 / 起訖時間 / 描述」→ 等使用者確認 → `confirm:true`
   - **修改**：先 GET 該筆 → 覆述「修改前 vs 修改後」→ 等確認 → `confirm:true`
   - **刪除**：先 GET → 覆述標題/日期 → 警告無法復原 → 等「確認刪除」→ `confirm:true` + `confirm_delete:true`

5. **錯誤碼**：補上 `409 LINKED_TO_SESSION`

6. **自然語言範例**：
   ```
   使用者：幫我在 5/20 加一個全所員工會議
   Agent：請問是要加在「管理員後台 全域活動」（所有學員看得到）
         還是「您個人學員端行事曆」（只有您自己看得到）？
   使用者：全域
   Agent：即將新增：
         - Scope：全域活動
         - 標題：全所員工會議
         - 日期：2026-05-20
         - 時間：未填
         確認執行嗎？
   ```

   ```
   使用者：幫我把 5/9 的「Make 入門班 Day 1」刪掉
   Agent：[GET list] 該活動 session_id=xxx，是課程梯次連動活動。
         🔗 連動課程：Make 入門班（梯次 2026/05/09–05/10）
         不能直接從行事曆刪除。請選：
         A) 將梯次狀態改為「排程中」(對應行事曆會自動清掉)
         B) 直接刪除整個梯次
         需要我幫您改梯次嗎？
   ```

---

## 三、檔案清單

**新增**
- `supabase/functions/api-admin-agent-calendar/index.ts`

**修改**
- `src/lib/agent-skills/admin-skill.ts`（追加第 12 章 + 開場必詢問規則 + 錯誤碼補充）

**不需改動**
- 資料庫 schema（已有 `session_id`、起訖時間欄位）
- `verify-admin-token.ts`、其他現有 agent functions
- 前端 UI（行事曆管理頁已完成）

---

## 四、影響範圍
- 管理員透過 Agent 可完整 CRUD 全域 / 個人活動
- 課程連動活動受保護，避免行事曆與梯次資料不一致
- 所有變更操作會寫入 `reg_operation_logs` 留稽核軌跡
- 學員端 Agent（`AGENT_SKILL_MD`）不受影響，仍只能看自己的活動

