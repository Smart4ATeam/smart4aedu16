

# 修正計畫：統一重新部署所有 admin agent edge functions

## 問題根因
- `_shared/verify-admin-token.ts` 已更新為支援 `sk_xxx`（上次已修）
- 但 Supabase Edge Function 部署時會把 `_shared` 內容 **inline 進各自 bundle**
- 上次我們只重新部署了 `api-admin-agent-calendar`
- 其餘 12 支 admin agent functions 仍跑舊 bundle，所以 `sk_xxx` token 一律被當無效 JWT → 401

## 受影響功能（全部需要重新部署）

| Edge Function | 對應功能 |
|---|---|
| `api-admin-agent-broadcast` | Agent 發送廣播 |
| `api-admin-agent-preview-recipients` | 廣播預覽收件人 |
| `api-admin-agent-search-members` | 搜尋學員 |
| `api-admin-agent-member-detail` | 學員詳情 |
| `api-admin-agent-set-password` | 重設學員密碼 |
| `api-admin-agent-adjust-points` | 調整點數 |
| `api-admin-agent-achievements` | 成就管理 |
| `api-admin-agent-courses` | 課程 CRUD |
| `api-admin-agent-sessions` | 梯次 CRUD |
| `api-admin-agent-registrations` | 報名管理 |
| `api-admin-agent-instructors` | 講師管理 |
| `api-admin-agent-partners` | 合作夥伴 |
| `api-admin-agent-calendar` | （已 OK，順手再部署確保一致） |

## 額外檢查
`api-admin-agent-preview-recipients` 內有自己一段 `verifyEither` 的客製驗證（同時接 sk_ 與 JWT），邏輯本身沒問題，但仍依賴 `verifyAdminToken` 的新版 → 重新部署即可。

## 執行步驟
1. **不修改任何程式碼**（共用模組已正確）
2. 一次呼叫 `supabase--deploy_edge_functions` 重新部署上表 13 支 functions，強制每支重打 bundle 拿到新版 `verify-admin-token.ts`
3. 若有部署 timeout（先前遇過 esm.sh lockfile 問題），刪除 `deno.lock` 後重試
4. 部署完用 `curl_edge_functions` 對 `api-admin-agent-search-members` 與 `api-admin-agent-broadcast`（preview）做煙霧測試，確認 200/正確錯誤碼，不再是 401

## 預期結果
管理員以同一組 `sk_xxx` token 即可呼叫所有學員端 + 管理員端 API；廣播、搜尋學員、調點數、課程/梯次管理…等 Agent 動作全部恢復。

