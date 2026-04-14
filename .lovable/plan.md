

## Plan: 測驗資格驗證 + 高分更新證書機制

### 問題總結

1. 未報名也能看到並進入測驗
2. 可選擇非自己的梯次
3. 可用不同姓名重複取得證書
4. 應在上課日之後才開放測驗
5. 重考拿更高分時，應允許更新證書並移除舊證書

### 不需要資料庫變更

所有邏輯皆為前端查詢調整，利用現有 `reg_members` + `reg_enrollments` + `certificates` 表。`certificates.status` 是 text 類型，新增 `'replaced'` 值不需 migration。

### 修改項目

#### 1. Learning.tsx — AvailableQuizzes 過濾

- 查詢用戶的 `reg_members`（by user_id）→ `member_id`
- 查詢 `reg_enrollments`（member_id, status != cancelled, payment_status = paid）→ 取得已報名的 course_id + session_date
- 只顯示 course_id 在已報名列表中 **且** session_date <= 今天的測驗
- 無符合條件時顯示「完成課程報名並上課後即可進行測驗」

#### 2. QuizEntry.tsx — 報名檢查 + 梯次過濾 + 姓名鎖定 + 日期檢查

- **報名檢查**：查 reg_members → reg_enrollments（member_id + course_id, status != cancelled, payment_status = paid）。無報名 → 顯示「您尚未報名此課程，無法進行測驗」
- **上課日期檢查**：所有 enrollment 的 session_date 都 > 今天 → 顯示「課程尚未開始，無法測驗」
- **梯次過濾**：訓練日期下拉選單只顯示用戶自己 enrollments 中 session_date <= 今天的項目
- **姓名鎖定**：從 `reg_members.name` 自動帶入，設為 readonly

#### 3. QuizResult.tsx — 高分更新證書 + 防重複

**證書檢查邏輯改為**：
- 查詢同一 `user_id` + `course_id` + `training_date` 的非 failed/replaced 證書
- **無舊證書** → 顯示「申請結訓證明」
- **有舊證書且新分數 <= 舊分數** → 顯示「查看現有證書」（不允許重新申請）
- **有舊證書但新分數 > 舊分數** → 顯示「更新證書（新高分 X 分）」

**申請/更新 mutation**：
- 將舊證書 status 更新為 `'replaced'`
- Insert 新證書 → 呼叫 Edge Function
- student_name 使用 reg_members.name（與 entry 一致）

#### 4. CertificateView.tsx — 處理 replaced 狀態

- 如果證書 status = `'replaced'`，顯示「此證書已被更高分的版本取代」
- 提供按鈕引導查看最新證書

### 影響檔案

| 檔案 | 變更 |
|------|------|
| `src/pages/Learning.tsx` | AvailableQuizzes 加入報名 + 日期過濾 |
| `src/pages/QuizEntry.tsx` | 報名檢查、梯次過濾、姓名鎖定、日期檢查 |
| `src/pages/QuizResult.tsx` | 證書查詢改為 course_id+training_date；高分更新邏輯 |
| `src/pages/CertificateView.tsx` | 處理 replaced 狀態顯示 |

