

# 修正試用領取規則：允許重複領取（每天 1 次仍生效）

## 一、問題

目前 `resource_trials` 有 `UNIQUE(user_id, resource_id)` 限制 → 同一使用者領過 LineRichMenu 後，隔天想再領一次序號（因試用碼只有 1 天有效）就會撞 23505 → 回 `INTERNAL_ERROR`。

## 二、規則確認（修正後）

| 規則 | 狀態 |
|---|---|
| 每位使用者「每天」整體只能領 1 個套件 + 1 個模板 | ✅ 維持（按 category 分） |
| 同一使用者可「跨天」重複領同一個資源 | ✅ 新增允許 |
| 同一天內針對同一資源只能領 1 次 | ✅ 由「每日 category 限制」自然涵蓋 |

## 三、要動的東西

### A. 資料庫 migration
- **移除** `resource_trials` 的 `UNIQUE(user_id, resource_id)` constraint  
  （名稱推測為 `resource_trials_user_id_resource_id_key`，migration 內用 `IF EXISTS` 保險）
- 不新增其他 unique；每日限制由 edge function 程式邏輯把關（已存在）
- 既有資料完全不動

### B. Edge Function：`api-agent-claim-trial/index.ts`
- 在 insert 失敗時補上 `error.code === '23505'` → 回 `409 ALREADY_CLAIMED_TODAY`，避免未來其他競態狀況再吐 500
- 流程不變：仍先檢查當日 category 是否已領 → 已領回 429 `DAILY_LIMIT_REACHED`

### C. Edge Function：`api-resource-trial/index.ts`（舊版同邏輯）
- 同步加上 23505 → 409 防護
- 維持每日 category 限制檢查

### D. 前端：`src/pages/Resources.tsx`
- 「我的試用」分頁與資源卡片狀態渲染不需邏輯變更（同一資源會出現多筆紀錄，按 `created_at desc` 排序顯示最新）
- 確認 `MyTrialsTab` 不會因重複 resource_id 出錯（目前用 `trial_id` 當 key，沒問題）
- 卡片上的「已領用」chip 改成判斷「今日是否已領用此 category」而非「此資源是否曾經領過」→ 跨天就能再次顯示「立即領用」按鈕

### E. Agent skill：`src/lib/agent-skills/admin-skill.ts` 與 `learning-skill.ts`
- 補一段說明：「試用序號 24 小時有效，跨天可重複領用同一資源；但每日仍受『每類別 1 次』限制」
- 錯誤碼新增 `ALREADY_CLAIMED_TODAY (409)`，讓 agent 正確回覆使用者

## 四、影響檔案總覽

| 檔案 | 異動 |
|---|---|
| 新 migration | DROP CONSTRAINT `resource_trials_user_id_resource_id_key` |
| `supabase/functions/api-agent-claim-trial/index.ts` | 23505 → 409 防護 |
| `supabase/functions/api-resource-trial/index.ts` | 23505 → 409 防護 |
| `src/pages/Resources.tsx` | 卡片「已領用」狀態改用「今日同類別是否已領」判斷 |
| `src/lib/agent-skills/admin-skill.ts` | 新增規則說明與錯誤碼 |
| `src/lib/agent-skills/learning-skill.ts` | 新增規則說明與錯誤碼 |

## 五、驗收

1. 今天領 LineRichMenu → 成功
2. 今天再領 LineRichMenu → 收到 429 `DAILY_LIMIT_REACHED`（不是 500）
3. 今天領完套件後再領模板 → 成功（不同 category）
4. 明天再領 LineRichMenu → 成功（跨天解鎖）
5. 「我的試用」可看到 2 筆 LineRichMenu 紀錄，各自序號獨立

