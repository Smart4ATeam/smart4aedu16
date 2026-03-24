

## 最終整合計劃：學習中心完整模組

### 概述

建立完整的「學習中心」模組，涵蓋：課程定義與開課梯次分離、動態課程內容系統（JSONB）、報名/報到/測驗流程、合作單位與講師管理、管理後台，以及與現有系統的連動。從 [smart4aedu26](/projects/68b19ec3-563c-4dc5-8dfd-fbdbec9e559d) 匯入入門班完整內容。

---

### 一、資料庫設計（單一 Migration）

#### 1.1 合作單位 `partners`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| name | text | 單位名稱 |
| type | text | `internal` / `external_org` / `individual` |
| category | text | 分類（教育機構/企業/個人工作室等） |
| contact_name | text | 聯絡人 |
| contact_email | text | 聯絡信箱 |
| contact_phone | text | 電話 |
| logo_url | text | Logo |
| description | text | 簡介 |
| website_url | text | 官網 |
| contract_start | date | 合約起始 |
| contract_end | date | 合約結束 |
| contract_status | text | `active` / `expired` / `pending` / `terminated` |
| revenue_share | numeric | 分潤比例 (%) |
| notes | text | 備註 |
| created_at | timestamptz | |

#### 1.2 講師 `instructors`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| partner_id | uuid FK→partners | 所屬單位（nullable，內部講師可為 null） |
| name | text | 姓名 |
| avatar_url | text | 頭像 |
| bio | text | 簡介 |
| specialties | text[] | 專長標籤 |
| created_at | timestamptz | |

#### 1.3 課程定義 `courses`（不含日期）

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| instructor_id | uuid FK→instructors | 預設講師 |
| title | text | 課程名稱 |
| description | text | 描述 |
| category | text | `quest` / `basic` / `intermediate` / `advanced` / `special` |
| tags | text[] | 標籤 |
| cover_url | text | 封面圖 |
| price | numeric | 預設費用（0=免費） |
| total_hours | numeric | 預設總時數 |
| materials_url | text | 課前教材連結 |
| series_id | uuid | 預留：系列課程 |
| status | text | `draft` / `published` / `archived` |
| sort_order | int | 排序 |
| created_at / updated_at | timestamptz | |

#### 1.4 開課梯次 `course_sessions`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| course_id | uuid FK→courses | 所屬課程 |
| instructor_id | uuid FK→instructors | 本梯次講師（可覆寫，nullable） |
| title_suffix | text | 如「第三期」「2026年4月班」 |
| price | numeric | 本梯次費用（null 用課程預設） |
| max_students | int | 人數上限（null=不限） |
| location | text | 地點/線上 |
| start_date | date | 開課日 |
| end_date | date | 結束日 |
| schedule_type | text | `recurring` / `ondemand` |
| recurrence_rule | text | 週期描述（僅供顯示，如「每月第一週六」） |
| status | text | `scheduled` / `open` / `in_progress` / `completed` / `cancelled` |
| created_at | timestamptz | |

#### 1.5 課程單元 `course_units`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| course_id | uuid FK→courses | |
| title | text | 單元標題 |
| sort_order | int | 排序 |

#### 1.6 單元內容區塊 `unit_sections`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| unit_id | uuid FK→course_units | |
| type | text | `text` / `card_grid` / `highlight` / `link` / `list` / `image` |
| content_json | jsonb | 結構化內容 |
| sort_order | int | 排序 |

`content_json` 範例（依 type）：
- `text`：`{ "title": "...", "body": "..." }`
- `card_grid`：`{ "title": "...", "cards": [{ "icon": "●", "title": "參數", "desc": "...", "note": "..." }] }`
- `highlight`：`{ "title": "...", "body": "...", "link_url": "...", "link_text": "..." }`
- `link`：`{ "text": "...", "url": "...", "icon": "🔗" }`
- `list`：`{ "title": "...", "items": ["...", "..."], "ordered": false }`
- `image`：`{ "url": "...", "alt": "...", "caption": "..." }`

#### 1.7 報名 `course_enrollments`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK→profiles | |
| session_id | uuid FK→course_sessions | 報名的梯次 |
| status | text | `pending` / `confirmed` / `cancelled` / `waitlisted` |
| paid | boolean | 是否已繳費 |
| enrolled_at | timestamptz | |
| UNIQUE(user_id, session_id) | | |

#### 1.8 報到 `course_attendances`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| enrollment_id | uuid FK→course_enrollments | |
| session_date | date | 上課日期 |
| attended | boolean | 是否到場 |

#### 1.9 測驗 `course_quizzes`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| course_id | uuid FK→courses | 屬於課程（非梯次） |
| title | text | 測驗標題 |
| questions | jsonb | 題目（單選/多選/是非） |
| passing_score | int | 及格分數 |
| time_limit_minutes | int | 時間限制 |

#### 1.10 作答紀錄 `quiz_attempts`

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid PK | |
| quiz_id | uuid FK→course_quizzes | |
| user_id | uuid FK→profiles | |
| answers | jsonb | 作答內容 |
| score | int | 分數 |
| passed | boolean | |
| attempted_at | timestamptz | |

#### RLS 政策

- **partners / instructors / courses / course_units / unit_sections / course_sessions**：authenticated 可 SELECT，admin 可 ALL
- **course_enrollments**：學員可 SELECT/INSERT 自己的，admin 可 ALL
- **course_attendances**：學員可 SELECT 自己的（透過 enrollment），admin 可 ALL
- **course_quizzes / quiz_attempts**：學員可 SELECT/INSERT 自己的，admin 可 ALL

#### 觸發器

- `course_attendances` INSERT (attended=true) → `profiles.total_points` +10
- `quiz_attempts` INSERT (passed=true) → `profiles.total_points` +20 + 呼叫 `check_and_grant_achievements`

---

### 二、學員端

#### 2.1 Learning.tsx（`/learning`）— 三個 Tab

**Tab 1 — 課程總覽**
- 課程卡片列表：封面圖、課程名、講師、合作單位、費用、分類 Badge
- 篩選：分類、合作單位、費用（免費/付費）
- 點擊課程 → Dialog 顯示描述 + 可報名梯次列表（日期、地點、剩餘名額）
- 報名按鈕 → 寫入 `course_enrollments`

**Tab 2 — 我的課程**
- 已報名梯次列表，含繳費狀態 Badge、報到進度條
- 已繳費且有報到紀錄 → 可進入課程內容
- 點擊「查看內容」→ 導航至 `/learning/course/:courseId`

**Tab 3 — 測驗與成績**
- 列出可參加的測驗（已繳費且已上課的課程）
- 測驗介面（計時、逐題作答）
- 成績紀錄列表（分數、是否通過）
- 證書下載按鈕預留位置（顯示「即將推出」）

#### 2.2 CourseDetail.tsx（`/learning/course/:courseId`）

- 頂部：課程標題、講師、描述、封面圖
- 從 `course_units` + `unit_sections` 讀取資料
- 使用 Accordion 展開各單元（沿用 smart4aedu26 的 CourseLayout 互動模式）
- `ContentRenderer` 組件根據 `section.type` 分派渲染：
  - `text` → 標題 + 段落
  - `card_grid` → 卡片網格排列
  - `highlight` → 漸層背景重點區塊（含可選連結）
  - `link` → 外部連結
  - `list` → 條列式
  - `image` → 圖片
- 視覺風格：配合本系統主題（深色/亮色 + 橘色/青色 + 玻璃擬態）

---

### 三、管理端 — AdminLearning.tsx（`/admin/learning`）

#### Tab 1 — 課程管理
- 課程 CRUD 表格 + 新增/編輯 Dialog
- 狀態切換：草稿 → 發佈 → 封存
- 發佈時可選是否同步建立行事曆事件
- 點擊課程 → 進入「單元管理」子頁面（新增/編輯/排序單元與內容區塊）
- 內容區塊編輯：選擇 type → 對應表單欄位（非直接編輯 JSON）

#### Tab 2 — 梯次管理
- 依課程篩選 → 梯次列表
- 新增/編輯梯次（日期、地點、講師覆寫、人數上限、週期類型）
- 狀態管理：排程中 → 開放報名 → 進行中 → 已結束

#### Tab 3 — 合作單位管理
- 單位 CRUD 表格：名稱、類型 Badge、合約狀態、合約期間、分潤比例
- 篩選：類型（內部/外部機構/個人）、合約狀態
- 新增/編輯 Dialog：含合約欄位
- 合約到期提醒標示

#### Tab 4 — 講師管理
- 講師 CRUD 表格：姓名、所屬單位、課程數
- 新增時選擇所屬合作單位

#### Tab 5 — 報名與報到
- 依梯次篩選 → 報名學員列表
- 繳費確認、報到打勾、批次報到

#### Tab 6 — 測驗管理
- 為課程建立測驗（題目、選項、正確答案、及格分）
- 學員成績列表、通過率統計

**統計卡片（頂部）：** 總課程數、開放中梯次數、合作單位數、總報名人數

---

### 四、導航與路由

| 路由 | 頁面 | 保護 |
|------|------|------|
| `/learning` | Learning.tsx | ProtectedRoute |
| `/learning/course/:courseId` | CourseDetail.tsx | ProtectedRoute |
| `/admin/learning` | AdminLearning.tsx | AdminProtectedRoute |

- `AppSidebar.tsx`：新增「學習中心」項目，icon: `BookOpen`
- `AdminSidebar.tsx`：新增「學習中心」項目，icon: `BookOpen`

---

### 五、系統連動

| 項目 | 說明 |
|------|------|
| 積分 | 報到 +10、測驗通過 +20（SQL 觸發器） |
| 徽章 | 新增「首次上課」「學霸」成就，觸發 `check_and_grant_achievements` |
| 行事曆 | 梯次發佈時可自動建立 `calendar_events`（`is_global = true`） |
| 訊息 | 報名確認/繳費提醒/開課提醒（透過 conversations 系統訊息） |
| API 串接 | 新增 `api-courses` Edge Function（x-api-key 認證），Make.com 可寫入課程/梯次 |
| 儀表板 | Dashboard 可新增「即將開課」區塊 |

---

### 六、資料匯入

透過 INSERT 語句匯入：
- 1 筆 `partners` — Smart4A（internal）
- 1 筆 `instructors` — 預設內部講師
- 7 筆 `courses` — 入門班、基礎班、中階班、高階班、Postly、Lovable、個人助理
- 入門班 10 個 `course_units` + 對應 `unit_sections`（從 Quest.tsx 的 2099 行 JSX 轉為 JSONB）
- 其他課程先建立記錄，內容待後續補充

---

### 七、修改檔案清單

| 檔案 | 動作 |
|------|------|
| `supabase/migrations/新migration.sql` | 新建 10 張表 + RLS + 觸發器 + 成就 INSERT |
| `src/pages/Learning.tsx` | 新建 — 學員學習中心（三 Tab） |
| `src/pages/CourseDetail.tsx` | 新建 — 課程內容閱讀頁 |
| `src/components/learning/ContentRenderer.tsx` | 新建 — 內容區塊動態渲染器 |
| `src/pages/admin/AdminLearning.tsx` | 新建 — 管理端學習中心（六 Tab） |
| `src/components/AppSidebar.tsx` | 修改 — 新增學習中心導航 |
| `src/components/admin/AdminSidebar.tsx` | 修改 — 新增學習中心導航 |
| `src/App.tsx` | 修改 — 新增 3 條路由 |
| `supabase/functions/api-courses/index.ts` | 新建 — 外部寫入課程/梯次 API |
| `supabase/config.toml` | 修改 — 新增 api-courses 函數設定 |
| `src/pages/admin/AdminIntegrations.tsx` | 修改 — 新增 api-courses 端點說明 |

