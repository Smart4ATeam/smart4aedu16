

# 課程梯次 ↔ 行事曆 整合連動規劃

## 目標
梯次只要狀態非「排程中」就自動在行事曆建立對應活動；多日課程拆成多個單日活動；雙向提示連動關係。

---

## 一、資料庫變更

### 1. `course_sessions` 新增時間欄位
```sql
ALTER TABLE course_sessions
  ADD COLUMN start_time time,
  ADD COLUMN end_time time;
```

### 2. `calendar_events` 新增起訖時間 + 連動標記
```sql
ALTER TABLE calendar_events
  ADD COLUMN end_time time,                      -- 既有 event_time 當開始時間
  ADD COLUMN session_id uuid,                    -- 連動的梯次 id（NULL = 一般活動）
  ADD COLUMN session_day_index int;              -- 多日課程第幾天（1, 2, ...）
CREATE INDEX idx_calendar_events_session ON calendar_events(session_id);
```
> `session_id` 不設 FK cascade，改用觸發器邏輯掌控刪除/同步行為，避免手動刪行事曆活動連帶炸掉梯次。

### 3. 觸發器：梯次 → 行事曆 自動同步
建立 `sync_session_to_calendar()` 觸發器，AFTER INSERT/UPDATE 於 `course_sessions`：

- **同步條件**：`status <> 'scheduled'` 且有 `start_date`
- **流程**：
  1. 先刪除此 `session_id` 既有的 `calendar_events`（避免日期/時間/狀態變更後殘留舊活動）
  2. 從 `start_date` 到 `end_date` 逐日建立活動（單日 = 1 筆，雙日 = 2 筆，依此類推）
  3. 標題：`courses.title + (title_suffix)`，第 N 天會加 `（Day N/總天數）`
  4. `is_global = true`、`color = 'gradient-cyan'`、帶入 `session_id`、`session_day_index`、`event_time = start_time`、`end_time = end_time`
  5. 若狀態改回 `scheduled` 或被刪除 → 連動刪除 `session_id` 對應的所有 `calendar_events`

---

## 二、後端 Edge Function 不需改動
Calendar 操作目前用 RLS 直連 supabase-js，現有 RLS 已支援 admin 全域 CRUD，不需加 function。

---

## 三、前端變更

### A. `src/pages/admin/AdminLearning.tsx`（梯次管理）
1. 梯次表單新增「開始時間 / 結束時間」兩個欄位（type=time，非必填）
2. 批次建立梯次表單同步加上時間欄位
3. 表格欄位顯示時段（若有時間）
4. 提交 payload 加 `start_time` / `end_time`

### B. `src/pages/Calendar.tsx`（學員行事曆，已有編輯）
1. 表單時間欄位拆成「開始時間 / 結束時間」（非必填）
2. 顯示時間時改成 `09:00 ~ 17:00` 格式
3. 點擊連動活動（`session_id != null`）時，顯示 readonly 提示：「此活動由課程梯次連動建立，請至『學習中心 → 梯次管理』修改」並停用編輯/刪除按鈕

### C. 新增 `src/pages/admin/AdminCalendar.tsx`（管理員行事曆）
> 目前行事曆只有學員側 `/calendar`，沒有 admin 專屬頁。需加一個讓 admin 管理「全域活動」的頁面：
1. 顯示所有 `is_global = true` + admin 個人活動
2. 可新增 / 修改 / 刪除全域活動（之前只有新增、刪除 → 補上修改）
3. 起訖時間皆可填
4. 編輯或刪除「`session_id != null`」活動時：
   - 跳出警示 Dialog：「⚠️ 此活動為課程梯次『XXX』連動建立。直接修改僅影響行事曆顯示，下次梯次更新時會被覆寫。建議至『學習中心 → 梯次管理』修改梯次本體。」
   - 提供兩個選項：「前往修改梯次」（跳轉 AdminLearning） / 「仍要直接編輯/刪除」
5. 列表中連動活動加圖示標記（例如 🔗）區分

### D. `AdminSidebar.tsx` / 路由
- 在 admin sidebar 加入「行事曆」項目，路由 `/admin/calendar` → `AdminCalendar`

---

## 四、現有資料處理
針對已存在、狀態非 `scheduled` 的梯次：migration 內跑一次回填，呼叫同樣邏輯把它們補建到 `calendar_events`。

---

## 五、檔案清單

**新增**
- `src/pages/admin/AdminCalendar.tsx`
- migration：欄位新增 + 觸發器 + 回填

**修改**
- `src/pages/admin/AdminLearning.tsx`（梯次表單加時間欄位）
- `src/pages/Calendar.tsx`（時間拆起訖、連動活動唯讀提示）
- `src/components/admin/AdminSidebar.tsx`（加行事曆入口）
- `src/App.tsx`（加 `/admin/calendar` 路由）
- `src/integrations/supabase/types.ts` 會由 Supabase 自動更新

---

## 六、影響範圍
- **梯次管理**：新增時間欄位，原有資料 `start_time/end_time` 為 NULL 不影響顯示
- **學員行事曆**：會看到所有狀態非排程中的梯次活動（is_global），原個人活動不受影響
- **多日課程**：例如 2026/05/09–05/10 的兩日課，會自動產生 2 筆獨立行事曆活動
- **狀態回到「排程中」**：對應行事曆活動會被自動清掉，避免顯示不該公開的梯次

確認規劃 OK 嗎？OK 我就切換到實作模式執行。

