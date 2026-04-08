

## Plan: 報名點數系統 - 自動給點 + 學員查看

### 概要
四項工作：新增課程點數欄位、拆解訂單時自動給點、修復點數管理顯示、新增學員點數頁面。

---

### 1. 資料庫：courses 表新增 `enrollment_points` 欄位

新增 migration：
```sql
ALTER TABLE courses ADD COLUMN enrollment_points integer NOT NULL DEFAULT 0;
```

預設值為 0，管理員可在課程設定自行填寫（基礎 400、中階 500、高階 600 等）。

---

### 2. 課程編輯表單新增「報名點數」欄位

**檔案**：`src/pages/admin/AdminLearning.tsx`

- `form` state 加入 `enrollment_points: 0`
- `openEdit` 時讀取 `c.enrollment_points`
- 在費用/總時數的 grid 下方新增 `<Input type="number">` 欄位，標籤「報名點數」
- `saveMutation` 送出時包含 `enrollment_points`

---

### 3. api-reg-split 拆解時自動寫入點數異動

**檔案**：`supabase/functions/api-reg-split/index.ts`

- 查詢 courses 時加選 `enrollment_points`
- 建立 enrollments 後，為每筆 enrollment 產生 `reg_point_transactions` 記錄：
  - `member_id`、`points_delta` = course 的 `enrollment_points`、`type` = "awarded"、`description` = "報名課程：{course_title}"
- 跳過 `enrollment_points === 0` 的課程
- 由於 `sync_member_points` trigger 已存在，插入異動後 `reg_members.points` 會自動更新

---

### 4. 修復管理端點數管理分頁資料不顯示

**檔案**：`src/pages/admin/AdminStudents.tsx`

檢查 `PointsTab` 的查詢：目前使用 `reg_point_transactions as any`，可能是 RLS 或 join 問題。確認查詢邏輯正確，並檢查匯入資料的 `member_id` 是否有正確關聯。

---

### 5. 學員端：新增「我的點數」頁面

**新增檔案**：`src/pages/Points.tsx`
- 透過 `useAuth` 取得 user，查詢 `reg_members` 找到對應 member（by email 或 user_id）
- 顯示目前點數餘額（大數字卡片）
- 列出 `reg_point_transactions` 異動紀錄（時間、類型、說明、點數）

**修改檔案**：
- `src/App.tsx`：加入 `/points` 路由
- `src/components/AppSidebar.tsx`：在 navItems 加入「我的點數」項目（使用 `Coins` icon）

---

### 技術細節
- 修改檔案：`AdminLearning.tsx`、`AdminStudents.tsx`、`AppSidebar.tsx`、`App.tsx`、`api-reg-split/index.ts`
- 新增檔案：`src/pages/Points.tsx`
- Migration：courses 新增 `enrollment_points` 欄位
- Edge function 重新部署：`api-reg-split`

