

## 計劃：報名明細改為按「個別課程」分頁籤（動態從資料庫讀取）

### 現狀問題

報名明細目前按 `course_type`（入門班/基礎班/中階班...）分頁籤，且是寫死的 `COURSE_TYPES` 常數。使用者希望每個課程（`reg_courses`）各自一個頁籤。

### 改動內容

#### 1. AdminRegistrations — 報名明細頁籤改為按課程分

- 移除寫死的 `COURSE_TYPES`
- 動態查詢 `reg_courses`（按 `course_type` 分組排序），每個課程產生一個頁籤
- 頁籤顯示課程名稱（如「基礎班 B2504」），value 用 course id
- 加上「全部」頁籤
- 篩選 enrollments 時改用 `course_id` 而非 `course_type`

#### 2. 移除「學員」和「點數」頁籤

根據先前討論，將 Members 和 Points 移至 AdminStudents，AdminRegistrations 只保留「訂單」和「報名明細」兩個主頁籤。

#### 3. AdminStudents — 新增報名學員 + 點數管理

- 將現有的三段式表格改為 Tabs 結構
- 新增「報名學員」頁籤（`reg_members`，僅顯示有付款紀錄者）
- 新增「點數管理」頁籤（含手動加減點數功能）

#### 4. category-colors.ts — 補齊 course_type

新增 `beginner` 和 `agent_skill` 的 label 和配色。

### 技術細節

```typescript
// 動態取得課程列表作為頁籤
const { data: regCourses = [] } = useQuery({
  queryKey: ["reg-courses"],
  queryFn: async () => {
    const { data } = await supabase
      .from("reg_courses")
      .select("id, course_code, course_name, course_type")
      .eq("status", "active")
      .order("course_type")
      .order("course_name");
    return data || [];
  },
});

// 頁籤：全部 + 每個課程一個
// value="all" | value={course.id}
```

### 實作步驟

1. 更新 `category-colors.ts`
2. 重構 `AdminRegistrations.tsx`：主頁籤改 2 個，報名明細子頁籤改為按 `reg_courses` 動態產生
3. 重構 `AdminStudents.tsx`：改 Tabs 結構，新增報名學員 + 點數管理頁籤
4. 建立 `api-reg-payment` Edge Function 供 Make.com 更新付款狀態

