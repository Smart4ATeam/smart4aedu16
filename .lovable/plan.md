

## 計劃：梯次管理強化 + 報名回呼 API

### 需求摘要

1. **梯次以日期為主要顯示**：一次排整年，日期為主要識別
2. **手動關閉/取消梯次**：人數不足時可停開
3. **外部報名回呼**：報名在 dao.smart4a.tw 進行，需要一個 HTTP callback endpoint 接收報名資料寫入系統

---

### 一、梯次管理 UI 強化（AdminLearning.tsx — SessionsTab）

**現有問題**：梯次只能新增，無法編輯或變更狀態。

**改進項目**：

- 新增「編輯」和「取消/恢復」按鈕到每筆梯次
- 新增狀態切換功能：`scheduled` → `open` → `in_progress` → `completed` / `cancelled`
- 新增快速「停開」按鈕（將狀態改為 `cancelled`）
- 表格日期欄位格式化為 `YYYY/MM/DD`，以日期排序（升序，最近的在前）
- 支援編輯現有梯次（開課日、結束日、地點、人數上限、狀態等）
- 新增「價格覆蓋」欄位（若本梯次價格與課程預設不同）

**學員端連動**：Learning.tsx 中「報名」按鈕改為導向外部報名連結 `https://dao.smart4a.tw/registration`

---

### 二、報名回呼 Edge Function（`api-enrollment-callback`）

建立新的 Edge Function，供外部報名系統（dao.smart4a.tw）在學員完成報名後，透過 HTTP POST 將資料回傳。

**認證方式**：`x-api-key` header，使用現有的 `API_INTEGRATION_KEY`

**Callback URL**：
```
POST https://clwruolkostoirdwnnuy.supabase.co/functions/v1/api-enrollment-callback
```

**請求資料結構（JSON Body）**：
```json
{
  "email": "student@example.com",
  "name": "王小明",
  "phone": "0912345678",
  "course_code": "wendao",
  "session_date": "2026-05-15",
  "paid": false,
  "notes": "素食"
}
```

**欄位說明**：
| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| email | string | 是 | 報名者信箱 |
| name | string | 是 | 姓名 |
| phone | string | 否 | 電話 |
| course_code | string | 是 | 課程代碼（對應 courses.category，如 `quest`, `basic` 等） |
| session_date | string | 否 | 開課日期（用於比對 session），若未提供則取最近一個 open 的梯次 |
| paid | boolean | 否 | 是否已繳費（預設 false） |
| notes | text | 否 | 備註 |

**處理邏輯**：
1. 用 email 查找 profiles，若無則自動建立未啟用的 profile
2. 用 course_code 查找 course，再用 session_date 或最近的 open session 比對 session_id
3. 寫入 `course_enrollments`（user_id, session_id, paid, status）
4. 回傳成功結果含 enrollment_id

---

### 三、資料庫變更

在 `course_sessions` 新增 `registration_url` 欄位，讓每個梯次可以自訂報名連結（預設為 dao.smart4a.tw/registration）。

```sql
ALTER TABLE public.course_sessions ADD COLUMN registration_url text DEFAULT 'https://dao.smart4a.tw/registration';
```

---

### 四、整合頁面更新（AdminIntegrations.tsx）

在 API 串接管理頁面新增 `api-enrollment-callback` 端點的文檔說明，包含：
- Callback URL
- 資料結構範例
- 認證方式
- 回傳格式

---

### 五、修改檔案清單

| 檔案 | 動作 |
|------|------|
| `supabase/migrations/新migration.sql` | 新增 `registration_url` 欄位 |
| `supabase/functions/api-enrollment-callback/index.ts` | 新建 — 報名回呼 API |
| `src/pages/admin/AdminLearning.tsx` | 修改 — SessionsTab 加入編輯/狀態切換/取消功能 |
| `src/pages/Learning.tsx` | 修改 — 報名按鈕導向外部連結 |
| `src/pages/admin/AdminIntegrations.tsx` | 修改 — 新增 callback 端點文檔 |

---

### 六、技術細節

- Edge Function 使用 `SUPABASE_SERVICE_ROLE_KEY` 跳過 RLS 寫入
- `verify_jwt = false`（外部系統呼叫，靠 x-api-key 認證）
- 回呼時若 email 對應的 profile 不存在，會建立一筆 `activated = false` 的 profile（與現有 enroll-student 邏輯一致）
- 梯次狀態 `cancelled` 的梯次不會在學員端顯示

