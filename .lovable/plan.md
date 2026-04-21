

# 訊息廣播系統規劃

## 一、目標與使用情境

支援管理員（電腦後台 + Agent）以彈性條件向學員群發訊息：

- **全體廣播**：所有已啟用學員
- **指定學員**：手動勾選一位或多位
- **條件群組**：例如「上過入門課的人」、「7/9 入門課梯次」、「上過入門 + 初階」、「指定狀態的報名者」

## 二、核心設計：「收件人選擇器」抽象層

不論前端勾選或 Agent 自然語言指令，最終都收斂成一個 **recipient_filter** 物件，由後端統一解析成 user_id 清單。這樣前端 UI 與 Agent API 共用同一套後端邏輯。

### recipient_filter 結構

```jsonc
{
  "mode": "all" | "specific" | "filter",

  // mode=specific: 直接給 user_id 或 member_id 清單
  "user_ids": ["uuid", ...],
  "member_ids": ["uuid", ...],

  // mode=filter: 條件組合
  "filters": {
    "course_ids": ["uuid"],           // 上過這些課程任一堂
    "course_ids_all": ["uuid"],       // 必須「全部都上過」（交集）
    "session_ids": ["uuid"],          // 報名特定梯次
    "session_date_from": "2025-01-01",
    "session_date_to":   "2025-03-31",
    "enrollment_status": ["enrolled", "completed"],  // 報名狀態
    "course_category": ["basic","intermediate"],     // 課程分類
    "exclude_user_ids": ["uuid"]      // 排除清單
  }
}
```

後端會：
1. 依 filters 從 `reg_enrollments` + `reg_members` 算出 user_id 清單
2. 過濾掉 `user_id IS NULL`（未啟用帳號）
3. 套用 `notification_settings`（系統廣播強制送、一般廣播尊重設定 — 由 `force` 參數控制）
4. 去重後寫入 `conversation_participants`

## 三、後端：3 個 Edge Functions

| Function | 用途 | 呼叫者 |
|---|---|---|
| `admin-broadcast` | 既有，重構為**接受 recipient_filter** | 後台 + Agent |
| `api-admin-agent-preview-recipients` | **預覽**符合條件的學員清單（不發送） | Agent + 後台 |
| `api-admin-agent-broadcast` | Agent 專用入口（Bearer admin token），內部轉呼 admin-broadcast 邏輯 | Agent |

**安全規範**：發送類動作必須 `confirm: true`；Agent 必須先呼叫 preview → 覆述「將發給 N 人，包含 XXX、YYY…」→ 等使用者確認 → 才帶 confirm 送出。

修掉先前的問題：移除 `show_info=false` 過濾（管理員廣播強制送達），保留 archived 狀態不過濾。

## 四、前端後台：AdminBroadcast 重構

`src/pages/admin/AdminBroadcast.tsx` 改為三段式：

**1. 收件人選擇區（Tab 切換）**
- **全體**：顯示「將發送給 N 位學員」
- **依課程／梯次**：
  - 多選課程（chips）
  - 切換「上過任一堂 / 全部都上過」
  - 多選梯次（依日期）
  - 報名狀態複選
- **手動指定**：搜尋框（姓名／email／編號）→ 勾選加入收件清單

**2. 即時預覽**
每次條件變更呼叫 `preview-recipients`，顯示：
- 收件人總數
- 前 10 位姓名 + 「還有 N 位…」可展開全部

**3. 訊息內容**
- 標題、優先級（一般／重要／緊急）、內容
- 「發送」按鈕 → 二次確認 dialog（顯示人數）→ 呼叫 `admin-broadcast`

下方保留「已發送廣播」歷史表格，新增「收件人數」欄位。

## 五、Agent 整合（admin-skill.ts）

新增兩個端點說明 + 工作流程指引：

```
### 廣播訊息

步驟（嚴格遵守）：
1. 解析使用者意圖 → 組出 recipient_filter
2. 呼叫 GET /api-admin-agent-preview-recipients 取得人數與名單樣本
3. 用自然語言覆述：標題、內容、優先級、收件人數、樣本姓名
4. 等待明確同意（「確認」「OK」「執行」）
5. 呼叫 POST /api-admin-agent-broadcast 帶 confirm: true
6. 回報實際送達人數
```

範例自然語言 → filter 對應：

| 使用者說 | recipient_filter |
|---|---|
| 「發給所有學員」 | `mode: "all"` |
| 「發給上過入門課的人」 | `mode: "filter", course_ids: [入門課 id]` |
| 「上過入門+初階的」 | `mode: "filter", course_ids_all: [入門, 初階]` |
| 「7/9 入門梯次的學員」 | `mode: "filter", session_ids: [梯次 id]` |
| 「8 月所有上課的人」 | `mode: "filter", session_date_from/to` |
| 「發給王小明跟陳大華」 | 先 search-members 拿 id → `mode: "specific"` |

## 六、資料庫

無需新表。僅在 `conversations` 上新增可選欄位以利日後審計：

```sql
ALTER TABLE conversations
  ADD COLUMN broadcast_filter jsonb,    -- 記錄當時的 filter
  ADD COLUMN recipient_count int,       -- 實際送達人數
  ADD COLUMN created_by uuid;           -- 發送的管理員
```

## 七、檔案清單

**新增**
- `supabase/functions/api-admin-agent-preview-recipients/index.ts`
- `supabase/functions/api-admin-agent-broadcast/index.ts`
- `src/components/admin/broadcast/RecipientSelector.tsx`
- `src/components/admin/broadcast/RecipientPreview.tsx`
- `src/lib/broadcast/resolve-recipients.ts`（前後端共用 filter → user_ids 邏輯，後端 Deno 版本獨立一份）

**修改**
- `supabase/functions/admin-broadcast/index.ts`（接受 recipient_filter、移除 show_info 強制過濾、寫入 broadcast_filter / recipient_count / created_by）
- `src/pages/admin/AdminBroadcast.tsx`（整頁重構）
- `src/lib/agent-skills/admin-skill.ts`（新增廣播段落 + 工作流程）

**Migration**
- 新增 conversations 三個審計欄位

## 八、實作順序建議

1. Migration（加欄位）
2. 後端：`admin-broadcast` 重構 + `preview-recipients` + `agent-broadcast`
3. 前端：RecipientSelector / Preview 元件
4. AdminBroadcast 頁面整合
5. Agent skill 文件更新
6. 端到端測試（後台手動 + Agent 對話）

