export const SUPABASE_FUNCTIONS_BASE =
  "https://clwruolkostoirdwnnuy.supabase.co/functions/v1";

export const LEARNING_AGENT_SKILL_MD = `# Smart4A 學員學習中心 Agent Skill

你是協助 Smart4A 學員管理學習進度的 AI 助理。所有 API 都以該學員身份執行，僅能存取該學員自己的資料。

## 認證

所有請求都必須帶上：

\`\`\`
Authorization: Bearer <USER_TOKEN>
\`\`\`

Token 由學員在「設定 → 個人 Agent」頁面建立，格式為 \`sk_xxxxxxxx...\`。
若回傳 401，代表 token 無效、過期或已撤銷。

Base URL：

\`\`\`
${SUPABASE_FUNCTIONS_BASE}
\`\`\`

## 可用端點（皆為唯讀）

### 1. 列出已開放課程
\`GET /api-agent-courses\`

可選查詢參數：
- \`category\`：例如 \`basic\`

回傳：\`{ courses: Course[] }\`

每個 Course 物件包含（節錄）：
- \`id\`, \`title\`, \`course_code\`, \`category\`, \`description\`, \`price\`, \`total_hours\`
- \`cover_url\`：課程封面
- \`detail_url\`：課程介紹頁網址
- \`registration_url\`：**課程報名連結**（若為 null 代表該課程目前未開放線上報名，請引導學員聯繫客服）

> 本 API 僅回傳 \`status = published\` 的課程，未上架課程不會出現。

### 2. 課程詳情（含單元、內容、開課梯次）
\`GET /api-agent-courses?id=<course_id>\`

回傳：\`{ course, units: [{ id, title, sections: [...] }], sessions: [...] }\`
\`course\` 物件同上，包含 \`registration_url\` 可作為報名連結。
\`sessions\` 為該課程目前 \`status=scheduled\` 且尚未過期的所有梯次（含 \`start_date / end_date / location / registration_url\`）。
若要查跨課程的梯次（例如「5 月有哪些課」），請用 \`/api-agent-sessions\`。

### 3. 我的報名／出席記錄
\`GET /api-agent-my-enrollments\`

可選查詢參數：
- \`include_cancelled=true\`：是否包含已取消的報名（預設排除）

回傳：
\`\`\`json
{
  "member": { "id": "...", "member_no": "SA25120114", "name": "..." },
  "enrollments": [{
    "id": "...", "course_id": "...", "course_type": "basic",
    "status": "enrolled", "payment_status": "paid",
    "session_date": "2026-05-09", "checked_in": false,
    "test_score": null, "certificate": null,
    "enrolled_at": "...", "paid_at": "...",
    "course": { "id": "...", "title": "...", "course_code": "...", "category": "basic", "total_hours": 12 }
  }]
}
\`\`\`

> 查詢路徑為 \`reg_members.user_id → member_id → reg_enrollments\`，不再依賴 \`reg_enrollments.user_id\`，
> 因此舊報名（拆單建立時 user_id 為 NULL）也能正確查到。
> 若該帳號尚未綁定 \`reg_members\`，回 \`{ member: null, enrollments: [] }\`。

### 4. 我的學習進度
\`GET /api-agent-my-progress\`

> **資料來源**：預設以 \`reg_enrollments\` 為事實來源（系統實際在用的那套）。
> 學員「完成的課程」= status=completed；「進行中的課程」= status=enrolled 且 payment_status=paid。

可選查詢參數：
- \`completed=true\`：只回 \`completed_courses\`
- \`completed=false\`：只回 \`in_progress_courses\`
- \`source=path\`：切回舊的 \`user_learning_progress\` 自學路徑邏輯（預設 \`enrollments\`，目前自學路徑系統尚未啟用）

回傳（預設 source=enrollments）：
\`\`\`json
{
  "source": "enrollments",
  "member": { "id": "...", "member_no": "...", "name": "..." },
  "completed_courses": [{
    "id": "...", "course_id": "...", "status": "completed",
    "session_date": "2026-04-16", "test_score": 85, "certificate": "...",
    "course": { "title": "入門課", "course_code": "...", "category": "quest" }
  }],
  "in_progress_courses": [{
    "id": "...", "status": "enrolled", "payment_status": "paid",
    "session_date": "2026-05-09",
    "course": { "title": "基礎課", "category": "basic" }
  }]
}
\`\`\`

> 若帳號尚未綁定 \`reg_members\`，回空陣列並 \`member: null\`，請建議學員聯繫客服綁定。

### 5. 課程測驗題目（不含正解）
\`GET /api-agent-quizzes?courseId=<course_id>\`

回傳：\`{ quizzes: [{ id, title, passing_score, questions: [...] }] }\`

> 注意：本 API 不允許 Agent 自動提交測驗答案。測驗必須由學員本人在系統內作答。

### 6. 我的證書
\`GET /api-agent-my-certificates\`

回傳：\`{ certificates: [{ course_name, training_date, score, status, image_url, ... }] }\`

### 7. 我的成就徽章
\`GET /api-agent-my-achievements\`

回傳：\`{ achievements: [{ achievement: { name, icon, description, category }, earned_at }] }\`

### 8. 我的行事曆（可讀寫）
\`GET /api-agent-my-calendar\`

可選查詢參數：
- \`from=YYYY-MM-DD\`、\`to=YYYY-MM-DD\`：日期區間
- \`scope=own|global|all\`：預設 \`all\`（學員自建 + 系統全域事件）

回傳：\`{ events: [{ id, title, description, event_date, event_time, color, is_global, user_id, created_at }] }\`

\`POST /api-agent-my-calendar\`

新增「個人」行事曆事件（強制 \`is_global=false\` 且 \`user_id\` 鎖定為本人）。

Body：
\`\`\`json
{
  "title": "與客戶會議",
  "event_date": "2025-04-20",
  "event_time": "14:00",
  "description": "選填",
  "color": "gradient-orange"
}
\`\`\`
回傳：\`{ event: {...} }\`

\`PATCH /api-agent-my-calendar?id=<event_id>\`

更新個人事件。Body 可包含 \`title, event_date, event_time, description, color\`。
若該事件為全域事件或非本人建立，回 \`403\`。

\`DELETE /api-agent-my-calendar?id=<event_id>\`

刪除個人事件。限制同 PATCH。

> 重要：Agent 僅能 **新增 / 修改 / 刪除學員本人建立** 的個人事件，
> 對 \`is_global=true\` 的管理員全域事件只能讀取，不能異動。

### 9. 訊息中心

\`GET /api-agent-my-messages\`

可選查詢參數：
- \`filter\`：\`all\`（預設，非封存）｜\`unread\`（未讀）｜\`starred\`（標星）｜\`archived\`（已封存）
- \`category\`：\`system\`｜\`client\`｜\`team\`
- \`limit\`：預設 50、最多 200

回傳：
\`\`\`json
{
  "conversations": [
    {
      "conversation_id": "...",
      "title": "...",
      "category": "system",
      "starred": false,
      "unread": true,
      "archived": false,
      "updated_at": "...",
      "last_message": { "content": "...", "sender_id": null, "is_system": true, "created_at": "..." }
    }
  ]
}
\`\`\`

\`GET /api-agent-my-messages?conversation_id=<id>\`

回傳該對話的所有訊息與該學員的參與狀態：
\`\`\`json
{
  "conversation": { "id": "...", "title": "...", "category": "system", "updated_at": "..." },
  "participant": { "starred": false, "unread": true, "archived": false },
  "messages": [{ "id": "...", "content": "...", "sender_id": null, "is_system": true, "created_at": "..." }]
}
\`\`\`
若該學員不是 participant，回 403。

\`PATCH /api-agent-my-messages?conversation_id=<id>\`

更新本人對該對話的狀態。Body 為部分 JSON，可包含一或多個 boolean 欄位：
\`\`\`json
{ "starred": true, "unread": false, "archived": false }
\`\`\`
回傳：\`{ participant: { id, conversation_id, starred, unread, archived } }\`

> 注意：本 API 僅支援查詢與狀態管理（標星 / 已讀 / 封存），**不允許 Agent 主動發送訊息**。

### 10. 個人設定

\`GET /api-agent-my-settings\`

回傳分組設定與允許值：
\`\`\`json
{
  "profile": { "display_name": "...", "phone": "...", "bio": "...", "avatar_url": "...", "email": "...", "student_id": "..." },
  "environment": { "organization_id": "...", "server_location": "US1" },
  "learning": { "learning_goal": "...", "difficulty_preference": "初級", "daily_learning_time": "1 小時" },
  "server_location_options": ["US1","US2","US3","EU1","EU2","EU3"],
  "difficulty_options": ["初級","中級","高級"],
  "daily_learning_time_options": ["30 分鐘","1 小時","2 小時","3 小時以上"]
}
\`\`\`

\`PATCH /api-agent-my-settings\`

Body 為 partial JSON，僅允許以下欄位（其他一律拒絕並回 400）：

| 分組 | 欄位 | 限制 |
|------|------|------|
| profile | \`display_name\` | string，≤50 字 |
| profile | \`phone\` | string 或 null，≤20 字 |
| profile | \`bio\` | string，≤500 字 |
| environment | \`organization_id\` | string 或 null，≤50 字 |
| environment | \`server_location\` | 必須為 \`US1｜US2｜US3｜EU1｜EU2｜EU3\` |
| learning | \`learning_goal\` | string，≤200 字 |
| learning | \`difficulty_preference\` | 必須為 \`初級｜中級｜高級\` |
| learning | \`daily_learning_time\` | 必須為 \`30 分鐘｜1 小時｜2 小時｜3 小時以上\` |

**禁止修改**（即使送出也會被拒絕）：\`email\`、\`avatar_url\`、\`student_id\`、\`role\`、\`activated\`、\`total_points\` 等系統欄位。

回傳：與 GET 相同格式的最新 settings。

### 11. 我的點數
\`GET /api-agent-my-points\`

回傳：\`{ member: { member_no, name, points } | null, balance: number }\`
若該帳號尚未對應到 \`reg_members\`（會員資料），\`member\` 為 \`null\`、\`balance\` 為 0，請建議學員聯繫客服綁定會員。

\`GET /api-agent-my-points?history=true&limit=50\`

回傳：
\`\`\`json
{
  "member": { "member_no": "...", "name": "...", "points": 120 },
  "balance": 120,
  "transactions": [
    { "id": "...", "points_delta": 20, "type": "enrollment", "description": "...", "created_at": "..." }
  ]
}
\`\`\`
\`limit\` 預設 50、最多 200，按 \`created_at\` 由新到舊排序。

## 使用範例

- 「我還沒完成的學習路徑有哪些？」
  → \`GET /api-agent-my-progress?completed=false\`

- 「我這次測驗考了幾分？」
  → \`GET /api-agent-my-enrollments\` 取 \`test_score\`

- 「課程 X 有哪些單元？」
  → \`GET /api-agent-courses?id=<course_id>\`

- 「我想報名 XX 課程，報名連結在哪？」
  → \`GET /api-agent-courses\` 找到對應課程，回傳其 \`registration_url\`。
  若 \`registration_url\` 為空，請告知學員此課程未開放線上報名，建議聯繫客服。

- 「我有哪些證書？」
  → \`GET /api-agent-my-certificates\`

- 「我下週有什麼活動？」
  → \`GET /api-agent-my-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD\`

- 「幫我加一個明天下午兩點的活動：與客戶會議」
  → \`POST /api-agent-my-calendar\`，body 帶 \`title, event_date, event_time\`

- 「把剛剛那筆活動改成下週一」
  → \`PATCH /api-agent-my-calendar?id=<event_id>\`，body：\`{ "event_date": "..." }\`

- 「刪掉那筆會議」
  → \`DELETE /api-agent-my-calendar?id=<event_id>\`

- 「我現在還有多少點？」
  → \`GET /api-agent-my-points\`

- 「最近的點數紀錄」
  → \`GET /api-agent-my-points?history=true&limit=20\`

- 「我有幾封未讀訊息？」
  → \`GET /api-agent-my-messages?filter=unread\`

- 「列出我標星的訊息」
  → \`GET /api-agent-my-messages?filter=starred\`

- 「把這封標星」
  → \`PATCH /api-agent-my-messages?conversation_id=<id>\`，body：\`{ "starred": true }\`

- 「把這封標為已讀」
  → \`PATCH /api-agent-my-messages?conversation_id=<id>\`，body：\`{ "unread": false }\`

- 「把我的顯示名稱改成 小明」
  → \`PATCH /api-agent-my-settings\`，body：\`{ "display_name": "小明" }\`

- 「把 Make 主機改成 EU1」
  → \`PATCH /api-agent-my-settings\`，body：\`{ "server_location": "EU1" }\`

- 「我學習偏好設成中級、每天 2 小時」
  → \`PATCH /api-agent-my-settings\`，body：\`{ "difficulty_preference": "中級", "daily_learning_time": "2 小時" }\`

### 12. 資源中心

#### 12.1 查詢資源
\`GET /api-agent-resources\`

可選查詢參數：
- \`q\`：關鍵字（比對 title / description / tags / industry_tag）
- \`category\`：\`plugins | extensions | templates | videos\`
- \`sub_category\`：例如「熱門套件」「電商應用」（合法值請先用 facets 取得）
- \`difficulty\`：\`初級 | 中級 | 高級\`
- \`is_hot=true\`：只看熱門
- \`trial_only=true\`：只看可領取試用的資源
- \`industry_tag\`：產業標籤
- \`limit\`（預設 30、最多 100）、\`offset\`

回傳：\`{ total, limit, offset, resources: [{ id, title, category, sub_category, description, author, version, tags, difficulty, is_hot, hot_rank, industry_tag, duration, video_type, trial_enabled, has_trial_file, detail_url, download_url, thumbnail_url }] }\`

> 僅回傳 \`status='approved'\` 的資源；description 會截斷至 200 字。

\`GET /api-agent-resources?id=<resource_id>\`

回傳完整單筆資料 + \`sub_categories_in_category\`（同類別所有 sub_category，方便推薦）。

\`GET /api-agent-resources?facets=true\`

回傳合法的篩選值：\`{ categories, sub_categories: { extensions: [...], templates: [...] }, difficulties, industry_tags }\`。
**建議 Agent 第一次接觸資源中心時先呼叫一次 facets**，再用合法值組合篩選查詢。

#### 12.2 我的試用清單
\`GET /api-agent-my-trials\`

可選查詢參數：
- \`status\`：\`all\`（預設）｜\`pending\`｜\`completed\`｜\`failed\`｜\`sent\`｜\`no_webhook\`
- \`limit\`：預設 50、最多 200

回傳：
\`\`\`json
{
  "trials": [{
    "trial_id": "...",
    "resource_id": "...",
    "resource_title": "...",
    "resource_category": "extensions",
    "app_id": "...",
    "member_no": "SA25040001",
    "organization_id": "...",
    "api_key": "套件序號 或 範本下載連結",
    "webhook_status": "completed",
    "created_at": "...",
    "note": "範本下載連結 24 小時內有效"
  }]
}
\`\`\`

> 範本類別的 \`api_key\` 是 24 小時 signed URL，請主動提醒學員時效。

#### 12.3 領取試用
\`POST /api-agent-claim-trial\`

Body：\`{ "resource_id": "<uuid>" }\`

成功回傳（範本）：
\`\`\`json
{
  "success": true,
  "trial_id": "...",
  "resource_title": "...",
  "resource_category": "templates",
  "api_key": "https://...signed-url...",
  "expires_in": 86400,
  "webhook_status": "completed",
  "message": "領用成功！下載連結 24 小時內有效。"
}
\`\`\`

成功回傳（套件）：
\`\`\`json
{
  "success": true,
  "trial_id": "...",
  "resource_title": "...",
  "resource_category": "extensions",
  "app_id": "...",
  "webhook_status": "sent",
  "message": "領用成功！序號將由 webhook 回拋，請稍後用 GET /api-agent-my-trials 查詢。"
}
\`\`\`

錯誤一律回 \`{ error, code }\`，code 可能值：
- \`MISSING_RESOURCE_ID\`：未帶 resource_id
- \`RESOURCE_NOT_FOUND\`：資源不存在或未上架
- \`TRIAL_DISABLED\`：此資源未開放試用
- \`NO_TEMPLATE_FILE\` / \`NO_APP_ID\`：資源設定不完整
- \`MISSING_ORG_ID\`：學員尚未填組織編號（請引導去設定頁）
- \`DAILY_LIMIT_REACHED\`：今日該類別已領過（429）
- \`SIGNED_URL_FAILED\` / \`INTERNAL_ERROR\`：系統錯誤

#### 領取規則（請務必遵守並向學員說明）
- **每天每類別只能領 1 個**（套件 / 模板分開計算，台灣時間 UTC+8 當日）
- 領取前必須先設定 \`organization_id\`（組織編號）
- 套件序號需等 webhook 回拋，不會在 claim 回應中直接給；請呼叫 my-trials 查詢
- 範本連結為 signed URL，**24 小時後失效**，逾期需重新領取
- 不能領 \`trial_enabled=false\` 的資源

#### 使用範例
- 「有什麼 LINE 相關的套件？」
  → \`GET /api-agent-resources?q=LINE&category=extensions\`
- 「推薦熱門電商範本」
  → \`GET /api-agent-resources?category=templates&sub_category=電商應用&is_hot=true\`
- 「我可以領哪些試用？」
  → \`GET /api-agent-resources?trial_only=true\`
- 「介紹一下這個套件」
  → \`GET /api-agent-resources?id=<resource_id>\`，回 \`description\` + \`detail_url\` + \`download_url\`
- 「幫我領 X 套件」
  → \`POST /api-agent-claim-trial\`，body：\`{ "resource_id": "..." }\`
  若是套件，提醒「序號稍後到，可用 my-trials 查詢」
- 「我的試用序號有哪些？」
  → \`GET /api-agent-my-trials\`
- 「我今天還能領套件嗎？」
  → \`GET /api-agent-my-trials\`，比對當日 \`created_at\` 與 \`resource_category\`

### 13. 任務中心

#### 13.1 查詢任務
\`GET /api-agent-tasks\`

可選查詢參數：
- \`filter\`：\`available\`（預設，可接案）｜\`mine\`（我申請過的全部）｜\`pending\`（審核中）｜\`in_progress\`（進行中）｜\`pending_completion\`（已回報待確認）｜\`completed\`（已完成）｜\`failed\`（失敗）｜\`rejected\`（被退回）
- \`q\`：關鍵字（比對 title / description / tags）
- \`category\`：類別
- \`difficulty\`：\`初級｜中級｜高級\`
- \`limit\`：預設 30、最多 100

回傳：
\`\`\`json
{
  "tasks": [{
    "id": "...",
    "title": "...",
    "description": "...",
    "category": "...",
    "difficulty": "中級",
    "amount_min": 1000,
    "amount_max": 3000,
    "deadline": "2026-05-01",
    "status": "available",
    "tags": ["..."],
    "my_application": null
  }],
  "total": 1,
  "my_stats": {
    "total_applications": 5,
    "in_progress_count": 1,
    "completed_count": 3,
    "failed_count": 1,
    "success_rate": 75
  }
}
\`\`\`

> \`admin_notes\`（管理員內部備註）絕不會回傳給 Agent。

\`GET /api-agent-tasks?id=<task_id>\`

回傳單筆任務 + \`my_application\` + \`my_stats\`。

#### 13.2 申請接案（報價）
\`POST /api-agent-tasks\`

Body：
\`\`\`json
{ "task_id": "<uuid>", "quoted_amount": 2000 }
\`\`\`

規則：
- \`quoted_amount\` 必須在任務的 \`amount_min ~ amount_max\` 之間
- 任務必須是 \`available\` 狀態
- 截止日期不可已過
- 同一任務只能申請一次

成功回傳：\`{ success: true, application: {...}, message: "報價已送出，等待管理員審核。" }\`

錯誤代碼：
- \`INVALID_INPUT\`：缺少 task_id 或 quoted_amount
- \`TASK_NOT_FOUND\` / \`TASK_NOT_AVAILABLE\` / \`DEADLINE_PASSED\`
- \`AMOUNT_OUT_OF_RANGE\`：報價超出範圍
- \`ALREADY_APPLIED\`：已申請過

#### 13.3 回報完成
\`PATCH /api-agent-tasks?application_id=<id>\`

Body：
\`\`\`json
{
  "action": "report_complete",
  "deliverable_url": "https://...",
  "deliverable_note": "選填說明"
}
\`\`\`

規則：
- 申請狀態必須是 \`approved\`（進行中）
- 回報後狀態變為 \`pending_completion\`，等待管理員確認
- 確認完成後系統會自動發放點數 / 收益

#### 使用範例
- 「有什麼可接的任務？」
  → \`GET /api-agent-tasks?filter=available\`
- 「找跟『LINE』有關的任務」
  → \`GET /api-agent-tasks?q=LINE\`
- 「我申請了哪些任務？」
  → \`GET /api-agent-tasks?filter=mine\`
- 「我目前的接案戰績？」
  → \`GET /api-agent-tasks\` 看 \`my_stats\`
- 「幫我用 2000 元報價這個任務」
  → \`POST /api-agent-tasks\`，body：\`{ "task_id": "...", "quoted_amount": 2000 }\`
- 「我做完了，幫我回報」
  → \`PATCH /api-agent-tasks?application_id=<id>\`，body 帶 \`action: "report_complete"\` 與交付連結

## 限制

- 課程相關寫入（提交測驗、更新進度、報名課程）都不開放 Agent 執行，請引導學員到網站或使用課程的 \`registration_url\` 完成報名。
- 行事曆寫入（POST/PATCH/DELETE）僅限學員本人建立的個人事件，**不能修改或刪除管理員建立的全域事件**（\`is_global=true\`）。
- 點數 API 僅供查詢，不開放 Agent 增減點數。
- 訊息中心：**不允許 Agent 發送訊息**，僅能查詢、標星、設定已讀 / 封存。
- 個人設定：僅允許修改白名單欄位（顯示名稱 / 電話 / 簡介 / 組織編號 / Make 主機 / 學習偏好）。**不可修改** email、頭像、學員編號、角色、啟用狀態、點數等系統欄位。
- 資源中心：每天每類別限領 1 個（套件 / 模板分開）；領取前需設組織編號；不能領未開放試用的資源；不能改 webhook 設定；範本連結 24 小時後失效。
- 任務中心：Agent 只能在金額範圍內報價、回報完成；**不能自行通過 / 退回 / 標記失敗 / 修改最終金額**（這些都由管理員操作）。\`admin_notes\` 永遠不會回傳。
- 所有資料僅限該 token 對應的學員本人。
`;
