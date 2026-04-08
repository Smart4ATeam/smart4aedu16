

## 兩個功能改進

### 功能一：梯次列表顯示已報名人數

在「梯次」頁籤的表格中，新增「已報名」欄位，顯示每個梯次目前有多少人報名。

因為目前報名資料（`reg_enrollments`）大部分沒有填 `session_id`，而是用 `course_id` + `session_date`（文字格式）來對應梯次，所以需要用兩種方式比對：
- 如果 `session_id` 有值，直接用 `session_id` 匹配
- 否則用 `course_id` + `session_date` 與梯次的 `start_date`/`end_date` 做文字比對

實作方式：在 `SessionsTab` 中額外查詢 `reg_enrollments`，按 `course_id` + `session_date` 分組統計，然後在表格中對每個梯次算出對應的報名人數，以 `已報名 / 上限` 格式顯示。

**會動到的檔案：** `src/pages/admin/AdminLearning.tsx`（SessionsTab 元件）

---

### 功能二：報名明細可編輯上課日期

在「報名明細」表格中，讓「上課日期」欄位可以直接點擊編輯。點擊後彈出小對話框，可修改 `session_date` 值，儲存時同步寫入 `reg_operation_logs` 記錄變更。

實作方式：
- 在每筆報名的「上課日期」旁加一個編輯按鈕
- 點擊後開啟 Dialog，顯示目前日期，提供輸入框修改（文字格式，因為要支援「2025/04/19-04/20」這種跨日格式）
- 需填寫變更原因，儲存後更新 `reg_enrollments.session_date` 並寫入操作紀錄

**會動到的檔案：** `src/components/admin/RegistrationTabs.tsx`（EnrollmentsTab 元件）

