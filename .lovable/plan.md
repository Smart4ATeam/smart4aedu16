

# 訊息廣播：邏輯修正規劃

## 一、問題根因

### 1️⃣ 4/16 入門班顯示 0 人 — **資料格式三大不匹配**

**A. session_id 全是 NULL**
- `course_sessions.id = 1fa9a460...`（這是「梯次」的 PK）
- 但 `reg_enrollments.session_id` 全是 `NULL`，從沒寫入過
- 目前 `RecipientSelector` 勾選梯次後送 `session_ids: [...]`，後端用 `WHERE session_id IN (...)` 永遠抓不到資料

**B. session_date 是字串、格式是 `YYYY/MM/DD` 不是 ISO**
- 實際值：`"2026/04/16"`、`"2025/06/21-06/22"`（甚至有跨日字串）
- 目前 UI 的「日期起／迄」用 `<input type="date">` 產出 `2026-04-16`，後端用 `gte/lte` 比對 → **字串比對會錯位**（`/` vs `-`）

**C. 11 筆 4/16 入門班 user_id 幾乎都是 NULL**
- 11 筆中只有 2 筆綁了 user_id（你自己 = 741f8dbb，且其中一筆是 cancelled）
- 其他 9 筆是「未啟用帳號」的學員（reg_member 還沒綁 user）→ 本來就無法收訊息
- 你自己「未取消」的那筆是 `status='completed'`，但目前 UI 預設沒勾任何狀態 = 不過濾，理論上應該抓到 → 真正擋住你的是 A + B

### 2️⃣ 報名狀態顯示英文
目前直接顯示 `enrolled / paid / checked_in / completed`；資料庫實際只有 `enrolled / confirmed / completed / cancelled`（連選項也錯）

### 3️⃣ 「日期起／迄」用途不明
原意是「篩選某段期間的梯次」，但跟「梯次多選」功能重疊、又因格式問題不能用 → 容易混淆

---

## 二、修正方案

### A. 後端 `resolve-recipients.ts`：改用 course_id + session_date 比對

把「梯次選擇」的內部邏輯改成：UI 仍然讓使用者勾梯次卡片，但送到後端時轉成 `{course_id, session_date}` 配對，後端用這組去查 `reg_enrollments`：

```ts
// 新 filter 結構
filters: {
  course_ids?: string[];           // 上過這些課（任一）
  course_ids_all?: string[];       // 上過這些課（全部）
  session_keys?: { course_id: string; session_date: string }[]; // ← 新
  session_date_from?: string;      // YYYY-MM-DD（會轉 YYYY/MM/DD 比對）
  session_date_to?: string;
  enrollment_status?: string[];
  exclude_user_ids?: string[];
}
```

**比對邏輯**：
- `session_keys`：對每組 `(course_id, session_date)` 用 `OR` 串起來，session_date 用 `LIKE 'YYYY/MM/DD%'`（吃單日 + 跨日格式）
- `session_date_from/to`：把 ISO 轉成 `YYYY/MM/DD` 後做字串 `gte/lte`（因為格式固定 8+斜線排序正確）
- 預設過濾掉 `status = 'cancelled'`（除非使用者明確勾 cancelled）

### B. 前端 `RecipientSelector.tsx`

1. **梯次勾選改送 `session_keys`**（不送 session_ids，因 DB 沒這欄資料）
2. **報名狀態選項改成中文 + 對應正確 enum**：
   ```
   enrolled  → 已報名
   confirmed → 已確認
   completed → 已完成
   cancelled → 已取消（預設不勾，特別勾才包含）
   ```
3. **日期起／迄改名為「梯次日期範圍（選填）」** + 加說明文字：「不選梯次時，可用此區間批次抓某段時間所有梯次的學員」
4. 預覽區也把英文狀態翻成中文

### C. 預覽區提示「未啟用帳號」數量

呼叫 preview 時，後端額外回傳 `unactivated_count`（符合條件但 user_id IS NULL 的人數），UI 顯示：

> 符合條件 11 人，其中 2 人已啟用帳號可收訊息（9 人尚未註冊網站帳號，無法收訊息）

這樣你就不會以為「明明有報名卻 0 人」是 bug。

### D. Agent skill (admin-skill.ts) 同步

- filter 範例改用 `session_keys` 取代 `session_ids`
- 狀態列表更新成正確 4 個 enum
- 加註「session_date 是 YYYY/MM/DD 字串」與「未啟用帳號不會收到」的說明

---

## 三、要修改的檔案

| 檔案 | 異動 |
|---|---|
| `supabase/functions/_shared/resolve-recipients.ts` | session_keys 新邏輯、session_date 字串比對、回傳 unactivated_count |
| `supabase/functions/api-admin-agent-preview-recipients/index.ts` | 回傳 unactivated_count |
| `src/lib/broadcast/types.ts` | RecipientFilter 加 session_keys、PreviewResult 加 unactivated_count |
| `src/components/admin/broadcast/RecipientSelector.tsx` | 梯次改送 session_keys、狀態中文化、日期區間加說明 |
| `src/components/admin/broadcast/RecipientPreview.tsx` | 顯示啟用 / 未啟用人數、預覽狀態翻譯 |
| `src/lib/agent-skills/admin-skill.ts` | 文件同步 |

無需資料庫變更。

---

## 四、預期結果

修完後你選「入門課 + 4/16 梯次」應該看到：

> 符合條件 **11 人**，其中 **2 人** 已啟用帳號可收訊息（9 人尚未註冊）  
> 名單樣本：你的名字、741f8dbb 那位…

並且狀態 chips 顯示「已報名 / 已確認 / 已完成 / 已取消」，日期區間下方有說明文字。

