

# 三項調整計畫

## 1. 新增兩個查詢 API + 文件更新

### 1A. Edge Function: `api-reg-order` 擴充 GET 查詢
在現有 `api-reg-order/index.ts` 中加入 GET 方法支援：
- **GET** `?order_no=ORD20250401001` → 回傳該筆訂單完整資料（所有欄位：p1~p3 姓名/電話/email、金額、付款方式/狀態、發票相關所有欄位、備註、經銷商、推薦人、課程快照、上課日期等）
- 驗證 `x-api-key`，找不到回 404

### 1B. 新建 Edge Function: `api-reg-enrollments`
- **GET** `?course_name=入門課-設計流程&session_date=2026/04/16`
- 以 `course_name` 模糊比對 `courses.title`，`session_date` 精確比對 `reg_enrollments.session_date`
- 回傳所有符合的報名明細，包含學員完整資料（姓名、學員編號、電話、email）、課程名稱、上課日期、報名狀態、付款狀態、報到狀態等
- 驗證 `x-api-key`
- 在 `supabase/config.toml` 加入 `[functions.api-reg-enrollments]` verify_jwt = false

### 1C. AdminIntegrations 文件更新
在 `endpoints` 陣列中新增兩個端點定義：
- **查詢報名訂單** (GET `/api-reg-order?order_no=...`)
- **查詢報名明細** (GET `/api-reg-enrollments?course_name=...&session_date=...`)

含完整的 requiredFields、optionalFields、exampleResponse

---

## 2. 報名明細日期篩選器 — 依課程動態過濾

**檔案**: `src/components/admin/RegistrationTabs.tsx` EnrollmentsTab

目前 `uniqueDates` 從所有 enrollments 取得所有日期。改為：
- 當 `selectedCourse !== "all"` 時，只從該課程的 enrollments 中提取日期選項
- 切換課程頁籤時，自動重設 `selectedDate` 為 `"all"`

修改 `uniqueDates` 的 useMemo，加入 `selectedCourse` 依賴：
```
const uniqueDates = useMemo(() => {
  const source = selectedCourse === "all" 
    ? enrollments 
    : enrollments.filter(e => e.course_id === selectedCourse);
  const dates = new Set<string>();
  source.forEach(e => { if (e.session_date) dates.add(e.session_date); });
  return [...dates].sort();
}, [enrollments, selectedCourse]);
```

並在課程選擇的 `onValueChange` 中加入 `setSelectedDate("all")`。

---

## 3. 訂單詳情 — 備註加標題 + 可編輯

**檔案**: `src/components/admin/RegistrationTabs.tsx` OrdersTab

目前備註區塊（約第 408-412 行）：
- 加上小標 `<p className="text-xs font-medium mb-1">備註</p>`
- 改為始終顯示（即使 notes 為空也顯示）
- 用 `Textarea` 取代純文字顯示，讓備註可編輯
- 新增 state: `editNotes`，在 `openOrderDetail` 時初始化
- 新增儲存按鈕，update `reg_orders.notes` 並記錄 `reg_operation_logs`

---

## 涉及的檔案

| 檔案 | 操作 |
|---|---|
| `supabase/functions/api-reg-order/index.ts` | 加入 GET 查詢 |
| `supabase/functions/api-reg-enrollments/index.ts` | 新建 |
| `supabase/config.toml` | 加入新 function 設定 |
| `src/pages/admin/AdminIntegrations.tsx` | 新增 2 個端點文件 |
| `src/components/admin/RegistrationTabs.tsx` | 日期篩選邏輯 + 備註編輯 |

