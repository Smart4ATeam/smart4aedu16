

# 修復 Joyce 報名 / 學習進度查不到的問題

## 根本原因（已查證）

我直接撈資料對齊，找到兩個問題：

### 問題 1：`api-agent-my-enrollments` 用錯欄位
這支端點是用 `reg_enrollments.user_id = <登入者>` 來撈，但 Joyce 那 6 筆 enrollments 的 `user_id` 全部是 **NULL**，只有 `member_id` 有值。

- profile 與 reg_member 已正確綁定（`profiles.id` = `reg_members.user_id` = `741f8db…`）
- 但 enrollments 是由 `api-reg-split` 在訂單拆解時建立的，那支只寫了 `member_id`、沒寫 `user_id`
- 之後 Joyce 才綁定帳號，舊 enrollments 的 `user_id` 沒被回填 → 端點查不到

正確的查法應該透過 `reg_members.user_id → reg_members.id → reg_enrollments.member_id` 這條路徑。

### 問題 2：`api-agent-my-progress` 查的是空表
這支查的是 `user_learning_progress` 表，但 Joyce 在這張表裡 **沒有任何資料**（0 筆）。

事實上整個系統的「課程完成 / 學習進度」是由 `reg_enrollments.status`（`enrolled` / `completed` / `cancelled`）在表達的，`user_learning_progress` 是另一條舊的學習路徑系統，目前並沒有跟報名系統打通。

Joyce 的真實學習進度（從 enrollments 推得）：
- 入門課（quest）2026/04/16 → **completed**
- 基礎課（basic）2026/05/09-10 → **enrolled**（已繳費，待上課）
- 另有 4 筆 cancelled 的舊紀錄

## 修改方案

### 1. 修 `supabase/functions/api-agent-my-enrollments/index.ts`
改成走 `reg_members` 中介查詢：
1. 先用 `user_id` 查 `reg_members.id`
2. 再用 `member_id` 查 `reg_enrollments`（這樣不管是新舊資料、之後綁定都查得到）
3. 同時順便把對應的課程資訊（title / course_code / category）一起回傳，Agent 不必再多一次查詢
4. 預設過濾掉 `status = 'cancelled'`，可加 `?include_cancelled=true` 還原

### 2. 修 `supabase/functions/api-agent-my-progress/index.ts`
這支改成「以 enrollments 為事實來源」，不再查 `user_learning_progress`。回傳：
- `completed_courses`：`status = completed` 的課程清單（含完成日、測驗分數、證書）
- `in_progress_courses`：`status = enrolled` 且已繳費的課程（含 session_date）
- 仍支援 `?completed=true|false` 篩選

如果你之後還想保留 `user_learning_progress` 給「自學路徑」用，這支可加 `source=path` 參數切回舊邏輯，預設走 enrollments。

### 3. 補資料：回填舊 enrollments 的 `user_id`
寫一支 migration，一次性把所有 `reg_enrollments.user_id IS NULL` 但對應 `reg_members.user_id` 已綁定的紀錄補上，並建立一個 trigger：往後 `reg_members.user_id` 一旦設定，自動把該 member 名下所有 enrollments 的 `user_id` 同步補齊。這樣未來不管哪支端點用 `user_id` 查都不會再漏。

### 4. 同步更新 `src/lib/agent-skills/learning-skill.ts`
把 `/api-agent-my-enrollments` 與 `/api-agent-my-progress` 的回傳欄位、`include_cancelled` 參數、以及「進度=來自 enrollments」的說明補進去，讓 Agent 給管理者/學員的回覆更精準。

## 不會動到的部分
- 不動 `reg_members` / `reg_enrollments` 的 schema 結構（只回填資料 + 加 trigger）
- 不動學員端 UI（Learning 頁原本就是用 member_id 的方式查，本來就看得到）
- 不動 admin Agent 端點

## 影響檔案總覽
| 檔案 | 動作 |
|---|---|
| `supabase/functions/api-agent-my-enrollments/index.ts` | 改查詢邏輯 |
| `supabase/functions/api-agent-my-progress/index.ts` | 改為從 enrollments 推導 |
| `src/lib/agent-skills/learning-skill.ts` | 更新 Skill 文件 |
| 新 migration | 回填 `reg_enrollments.user_id` + 建立同步 trigger |

## 需要你確認

1. **學習進度資料來源**：同意改成「以 reg_enrollments 為主」嗎？（這是目前實際在用的那套）`user_learning_progress` 那張表先擱著、不刪，未來如要做自學路徑再啟用。
2. **trigger 範圍**：trigger 在 `reg_members.user_id` 從 NULL 變成有值時觸發，把對應 enrollments 全部補上 user_id。同意嗎？
3. **cancelled 預設**：學員端 Agent 查自己的報名，預設要不要排除已取消的？我傾向 **預設排除**，加 `?include_cancelled=true` 才顯示（避免一堆舊取消單干擾）。

