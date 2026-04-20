

## 目標
管理員端新增「管理者 Agent」功能，讓 admin 可建立自己的 API Token + Skill 文件，並提供「使用者管理」相關 function 給 AI Agent 操作。

## 變動範圍

### 1. 前端 - 側欄與頁面
| 檔案 | 動作 |
|---|---|
| `src/components/admin/AdminSidebar.tsx` | API 串接下方新增「管理者 Agent」項目（icon: Bot） |
| `src/pages/admin/AdminAgent.tsx` | 新建頁面，仿 `src/pages/Agent.tsx` 結構（Token 管理 + Skill 檢視） |
| `src/components/settings/AdminAgentTokenManager.tsx` | 新建，仿 `AgentTokenManager.tsx`，但呼叫 admin 專屬的 token 管理 endpoint |
| `src/components/settings/AdminAgentSkillViewer.tsx` | 新建，顯示 admin Skill md |
| `src/lib/agent-skills/admin-skill.ts` | 新建，定義 admin agent 的 OpenAPI Skill 文件（繁中） |
| `src/App.tsx` | 加 `/admin/agent` 路由（AdminProtectedRoute） |

### 2. 後端 - Token 管理
複用現有 `user_api_tokens` 表（同表共用，因為 admin 也是 user，token 跟著帳號權限走）。  
複用現有 `supabase/functions/user-token-manager/index.ts` 即可，不需新表，因為：
- Token 是綁 `user_id`，當該 user 是 admin 時，Token 自然帶 admin 權限
- 在 admin agent endpoints 內以 `has_role(user_id, 'admin')` 驗證即可

### 3. 後端 - Admin Agent API Endpoints（新建 4 支 edge functions）

| Function | Method | 說明 |
|---|---|---|
| `api-admin-agent-search-members` | GET | 依姓名/Email/學員編號模糊搜尋 `reg_members` + `profiles`，回傳學員清單（含 member_no、name、email、phone、points、user_id、是否已啟用帳號） |
| `api-admin-agent-member-detail` | GET | 取得單一學員完整資料（個資、點數、課程紀錄、學習進度） |
| `api-admin-agent-set-password` | POST | 變更學員密碼，需 `member_no` 或 `email` + `new_password`（最少 6 字）+ `confirm: true`（Skill 中要求 Agent 必須先跟操作者口頭確認才送 confirm=true） |
| `api-admin-agent-adjust-points` | POST | 調整點數，必填 `member_no`、`points_delta`（正=加、負=扣）、`reason`、`confirm: true` |

**所有 endpoint 共用驗證流程**：
1. 從 `Authorization: Bearer sk_xxx` 取 token → SHA256 → 查 `user_api_tokens`（未撤銷、未過期）
2. 取得 `user_id` → `has_role(user_id, 'admin')` 驗證為 admin，否則 403
3. 更新 `last_used_at`
4. 操作完寫入 `reg_operation_logs`（entity_type=member, action=password_reset/points_adjust）

### 4. Skill 文件重點（`admin-skill.ts`）
要在文件中明確寫：

**安全規範（Agent 必讀）**
- 涉及變更類操作（改密碼、調點數）**必須**先跟操作者用自然語言確認所有欄位內容，操作者口頭同意後才呼叫 API 並帶 `confirm: true`
- 嚴禁未確認直接執行
- 變更密碼後要提醒操作者通知學員

**點數調整欄位說明**
- `member_no`（必填）：學員編號，例如 `SA26040160`
- `points_delta`（必填，整數）：
  - **正數 = 加點**（例：`50` 表示加 50 點）
  - **負數 = 扣點**（例：`-30` 表示扣 30 點）
  - 不可為 0
- `reason`（必填）：調整原因，會寫入 `reg_point_transactions.description` 與 `reg_operation_logs.reason`
- `confirm`（必填，bool）：必須為 `true`，且 Agent 必須在送出前用自然語言完整覆述「將對 XXX (SA編號) 加/扣 N 點，原因：YYY，確認執行嗎？」並等操作者明確同意

**範例對話流程**寫進 Skill：
```
使用者：幫王小明加 100 點，他完成了任務
Agent：我查到 王小明（SA26040160），目前點數 250。
       即將執行：對 王小明 (SA26040160) 加 100 點，原因「完成任務」
       確認執行嗎？
使用者：確認
Agent：[呼叫 adjust-points with confirm=true]
       已完成，目前點數 350。
```

### 5. 影響功能
- **不動**現有學員端 Agent 功能
- **不動**現有 admin 後台 UI（只多一個側欄項目與一個頁面）
- 共用 `user_api_tokens` 表 → admin 建的 Token 在學員端 Agent skill 也能用（但學員端 endpoint 本就只回自己資料），不衝突

## 需要你確認
1. **Token 是否區分學員/管理員兩種？** 我建議**共用同一張表**（一個 admin 用同一把 Token 也能呼叫學員端 endpoint 查自己資料，反正權限以 `has_role` 動態判定）。如果你想嚴格隔離（admin Token 不能呼叫學員端），我會加 `scope` 欄位區分。
2. **改密碼是否要記錄到訊息中心通知學員？** 預設只寫 `reg_operation_logs`，不主動通知學員。
3. **這次只先做這 4 個 function？** 之後要加（例如：建立學員、停用帳號、查訂單、查報名明細）我可以下一輪再擴充。

