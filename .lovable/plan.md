

## Plan: 訓後測驗系統

基於現有 `course_quizzes` 和 `quiz_attempts` 表，以及規格書的需求，進行適配設計。

### 現有 vs 規格書差異分析

| 項目 | 現有系統 | 規格書 | 決策 |
|------|---------|--------|------|
| 課程 ID | UUID (`courses` 表) | 字串 slug | **沿用 UUID**，不改現有結構 |
| 題庫存放 | `course_quizzes.questions` (JSONB) | 獨立 `questions` 表 | **沿用 JSONB**，結構夠用且簡單 |
| 角色判斷 | `user_roles` + `has_role()` | `profiles.role` | **沿用現有** `has_role()` |
| 及格判斷 | `quiz_attempts.passed` (普通欄位) | GENERATED ALWAYS | **沿用現有**，應用層寫入 |
| 訓練日期 | `course_sessions.start_date` | `courses.training_dates[]` | **沿用 sessions** |
| 證書 | 無 | `certificates` 表 + Make.com | **新建** |

### 需要新增的資料庫結構

#### 1. `course_quizzes` 表擴充
- 新增 `allow_retake boolean DEFAULT true`
- 新增 `description text DEFAULT ''`

#### 2. 新建 `certificates` 表
```sql
certificates (
  id uuid PK,
  user_id uuid NOT NULL,
  quiz_attempt_id uuid REFERENCES quiz_attempts(id),
  course_id uuid NOT NULL,
  course_name text NOT NULL,
  student_name text NOT NULL,
  training_date date NOT NULL,
  score integer NOT NULL,
  issued_at timestamptz DEFAULT now(),
  image_url text,
  status text DEFAULT 'pending'  -- pending | issued | failed
)
```
RLS: 學員看自己的 + Admin 全部管理

#### 3. 新建 `certificates` Storage bucket (private)

### 路由規劃（適配現有架構）

| 路由 | 說明 |
|------|------|
| `/learning` (測驗分頁) | 學員：可用測驗列表 |
| `/quiz/:quizId` | 測驗入口（填姓名、選訓練日期） |
| `/quiz/:quizId/exam` | 作答頁 |
| `/quiz/:quizId/result/:attemptId` | 結果頁 |
| `/certificate/:certificateId` | 證書查看/下載 |
| `/admin/learning` (測驗分頁) | Admin 測驗管理（題庫 CRUD + 批次匯入） |

### 實作分階段

#### Phase 1: Admin 測驗管理 (QuizzesTab 升級)
- 新增/編輯測驗（選課程、標題、及格分、是否重考、時間限制）
- 題目 CRUD（JSONB 內容：question_no, content, options A-D, correct_answer, points）
- 批次 JSON 匯入題目
- 題目列表 + 編輯表單（左右分欄布局）

#### Phase 2: 學員測驗流程
- 測驗入口頁：填姓名、選訓練日期（從 course_sessions 拉）、開始測驗
- 作答頁：進度條、全部題目一頁顯示、Radio 選項、未作答紅框提醒
- 結果頁：通過/未通過分情境顯示、申請證書按鈕

#### Phase 3: 證書系統
- Edge Function 呼叫 Make.com Webhook（需設定 `MAKE_CERT_WEBHOOK_URL` secret）
- 證書頁輪詢狀態、顯示/下載圖片
- Edge Function 供 Make.com 回調更新證書狀態（`api-certificate-callback`）

### 不變更
- 現有 `courses`、`course_sessions` 結構不動
- 現有 `quiz_attempts` 結構不動（已有 answers, score, passed）
- 現有 `on_quiz_passed` trigger 不動（通過自動加點數）
- Admin 權限檢查繼續用 `has_role()`

### 技術要點
- 題目存在 `course_quizzes.questions` JSONB 中，格式：
```json
[{
  "question_no": 1,
  "content": "題目內容",
  "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...",
  "correct_answer": "B",
  "points": 5
}]
```
- 前端計算分數後寫入 `quiz_attempts`
- 證書產生透過 Edge Function 呼叫 Make.com，Make.com 完成後透過回調 Edge Function 更新狀態
- `allow_retake = false` 時，前端檢查是否已有 `passed = true` 的紀錄

