

## 計劃：學習路徑改為依據 courses + enrollments 資料驅動

### 現狀
- `LearningPath.tsx` 依賴 `learning_paths` 和 `user_learning_progress` 表
- 實際課程資料已在 `courses` 表中（4 門主軸 + 3 門特訓）
- 報名資料在 `course_enrollments` + `course_sessions` 中

### 修改內容

**檔案：`src/components/LearningPath.tsx`** — 重寫

邏輯：
1. 查詢 `courses`（`category != 'special'`，按 `sort_order` 排序）取得主軸 4 階段
2. 查詢 `course_enrollments`（當前用戶）join `course_sessions` 取得已報名課程 ID
3. 狀態判定：
   - `done`：該課程有 `paid = true` 且 `status = 'confirmed'` 的報名記錄
   - `current`：按 sort_order 第一個尚未完成報名的課程
   - `locked`：在 current 之後的課程
4. 特訓課程（`category = 'special'`，`status = 'published'`）以小徽章列在路徑下方，已報名標為完成

顯示標籤使用課程簡稱（入門班、基礎班、中階班、高階班），從 title 中擷取「X班」部分。

無需資料庫變更，純前端組件重寫。

