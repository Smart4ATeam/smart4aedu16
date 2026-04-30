# 任務付款 / 勞報單流程完整規劃（v3.2）

> 相對 v3.1 的差異：把 webhook「是否帶附件」的判斷從 `task_payment_documents.is_first_payment` 解耦，改由 `payee_profiles` 的雲端歸檔狀態決定，避免 promote 流程造成首次付款卻不帶附件的漏洞。

## 一、流程總覽

```
任務 completed (final_amount > 0)
  │
  ├─ payee_profiles.user_id 存在 AND first_submitted_at IS NOT NULL ?
  │     是 → 建立勞報單 → status=payment_pending_signature
  │     否 → status=payment_pending_info（請學員填表 / 等待首次歸檔）
  │
  ├─ 學員下載 PDF → 簽名 → 上傳簽回 → status=payment_pending_review
  ├─ admin「待確認簽回」→ 確認 → send-payment-webhook → status=payment_processing
  ├─ payment-webhook-callback → 寫雲端連結 → 刪 storage
  └─ admin「待匯款」→ 標記已付款 → status=paid → 通知學員

學員自助更新收款資料：
  /payee-form 點「申請修改」→ 必填新存摺封面 + 修改原因
  → send-payee-update-webhook → callback 寫雲端連結 → 刪新附件
```

## 二、核心設計決策

### 決策 1：第二次付款判斷（方案 B）
進入簽回流程的條件：
```
payee_profiles.user_id 存在 AND first_submitted_at IS NOT NULL
```
不滿足 → 停在 `payment_pending_info`，由 `on_payee_first_submitted` trigger 在首次 callback 後一次補升級。

# 任務付款 / 勞報單流程完整規劃（v3.3）

> 相對 v3.2 的差異：明確定位 webhook 的本質目的為「**檔案搬家服務**」（將 supabase storage 的檔案搬到外部雲端硬碟以節省空間）。`send-payment-webhook` 改為精簡 payload，只送勞報單資料 + 簽回 PDF signed url，不再帶任何個資與附件（個資/附件由 `send-payee-update-webhook` 獨立負責）。
**不讀 `task_payment_documents.is_first_payment`**，改用以下邏輯：

```ts
// send-payment-webhook 內部
const profile = await getPayeeProfile(userId);

const attachmentsArchived =
  !!profile.id_card_front_cloud_url &&
  !!profile.id_card_back_cloud_url &&
  !!profile.bankbook_cover_cloud_url;

const includeAttachments = !attachmentsArchived;
// 只要外部還沒歸檔過附件 → 一律帶（即便這已是這個用戶的第 N 份勞報單）
```

理由（你提的情境）：
1. 學員第一次填表 → 任務 A completed → `payment_pending_info`
2. callback 寫入 `first_submitted_at` → trigger promote 任務 A → 產生 doc（`is_first_payment=false`）
3. 外部系統其實**從未拿到任務 A 的附件**（首次歸檔的是「個資 update」事件，跟 doc 無關）
4. 若用 `is_first_payment` 判斷會跳過附件 → 外部端缺檔
5. 改用「`*_cloud_url` 是否齊備」直接反映外部端的真實歸檔狀態，**永遠不會缺**

進一步的好處：
- 學員自助修改個資後 callback 會更新 `*_cloud_url`，舊連結被新連結覆蓋；若中間有勞報單尚未送 webhook，下一次送出時會自動帶最新一輪附件（cloud url 仍存在 → 不重送 storage signed url），符合直覺。
- 即使外部端清掉雲端檔（極端情況），admin 在資料庫把 `*_cloud_url` 設回 null，下一次 webhook 自動補帶附件，不需改程式。

### 決策 3：`task_payment_documents.is_first_payment` 欄位的語意
保留欄位但**只當作審計用**，不作為流程判斷依據：
- 寫入時機：建立 doc 當下，若 `payee_profiles.first_submitted_at IS NULL` 則為 true，否則 false
- 用途：admin 端 UI 顯示「此筆為首次付款」標籤、報表分析
- **任何 webhook / 流程判斷都不得讀取此欄位**

### 決策 4：學員自助修改收款資料
- `/payee-form` 三狀態：空白 / 唯讀（含審核中橫幅）/ 編輯
- 強制重傳存摺封面 + 必填修改原因
- 寫 `payee_profile_updates` 變更歷史
- 觸發獨立 `send-payee-update-webhook`
- 進行中且尚未簽回的勞報單 admin 可手動「重新產生」

### 決策 5：流水號併發（v3.1 已定）
`promote_pending_info_apps()` 用 `FOR ... LOOP ... FOR UPDATE` 逐筆呼叫 `next_payment_doc_no()`，內部 `INSERT ... ON CONFLICT DO UPDATE RETURNING` 取 row-level lock。

### 決策 6：時區
PDF 與 SQL 一律用 `Asia/Taipei`：
- DB：`AT TIME ZONE 'Asia/Taipei'`
- PDF：`generated_at` + 8h offset → `getUTC*` 格式化

## 三、資料庫摘要

**status 新值**：`payment_pending_info`, `payment_pending_signature`, `payment_pending_review`, `payment_processing`, `paid`

**新表**
- `payee_profiles`：含 `first_submitted_at`、`id_card_front_url/back_url/bankbook_cover_url`（storage path）、`*_cloud_url`（外部歸檔連結，**這三個是 webhook 是否帶附件的真正判斷依據**）、`attachments_purged_at`、`last_updated_via`
- `payee_profile_updates`：變更歷史
- `task_payment_documents`：含 `is_first_payment`（審計用，不做流程判斷）、`signed_file_url`、`signed_file_cloud_url`、`webhook_callback_token`
- `payment_doc_sequences`：流水號

**新函式**
- `next_payment_doc_no(_ym int)` — atomic 取號
- `promote_pending_info_apps(_user_id uuid)` — FOR LOOP 逐筆升級

**新 trigger**
- 擴充 `on_task_application_completed`：依「`first_submitted_at IS NOT NULL`」判斷
- `on_payee_first_submitted` → 呼叫 `promote_pending_info_apps`
- 學員上傳簽回 → status → `payment_pending_review` + 通知 admin

**system_settings**：`PAYMENT_WEBHOOK_URL`

**Storage（私有）**：`payee-documents`、`payment-signed-docs`

## 四、Edge Functions

| Function | 觸發 | 帶附件判斷 | 動作 |
|---|---|---|---|
| `send-payment-webhook` | admin 確認簽回 | **由 `payee_profiles.*_cloud_url` 是否齊備決定**（v3.2） | 送勞報單 + 個資 |
| `send-payee-update-webhook` | 學員自助更新 | 一律帶新上傳的附件 | 送 `payee_profile_updated` |
| `payment-webhook-callback` | 外部回傳 | — | 依 event 寫雲端連結、刪 storage、首次寫 `first_submitted_at` |

**callback 區分（payload 帶 `event` 欄位）**
- `payment_document_archived` → 寫 doc 雲端連結 + 刪簽回檔
- `payee_profile_archived` → 寫三個 `*_cloud_url`、刪三個 storage 附件、若 `first_submitted_at IS NULL` 則寫入 `now()`
- 注意：寫 `first_submitted_at` 觸發 `on_payee_first_submitted` → 自動 promote → 那些被 promote 的 doc 之後送 webhook 時，由於 cloud_url 已齊 → 自動不帶附件，**符合外部期望**

## 五、前端

- `/payee-form`：空白 / 唯讀（含審核中橫幅）/ 編輯三態
- `/tasks/:id/payment`：PDF 預覽下載 + 簽回上傳
- `AdminTasks.tsx` 新增「待確認簽回」「待匯款」分頁
- `AdminIntegrations.tsx` 新增「勞報單 / 付款 Webhook」獨立區塊
- `PaymentDocumentPDF.tsx`：`@react-pdf/renderer`，禹動科技整合股份有限公司 Smart4A，日期取 `generated_at` 強制 UTC+8

## 六、稅務規則
- 單筆 < 20,010 → 代扣稅 = 0
- 單筆 < 20,000 → 二代健保 = 0

## 七、影響檔案

**新增**
- `supabase/migrations/<ts>_payment_workflow.sql`
- `supabase/functions/send-payment-webhook/index.ts`
- `supabase/functions/send-payee-update-webhook/index.ts`
- `supabase/functions/payment-webhook-callback/index.ts`
- `src/pages/PayeeForm.tsx`
- `src/pages/TaskPayment.tsx`
- `src/components/payment/PaymentDocumentPDF.tsx`
- `src/components/admin/PaymentReviewTab.tsx`
- `src/components/admin/PaymentPayoutTab.tsx`

**修改**
- `src/pages/admin/AdminTasks.tsx`
- `src/pages/admin/AdminIntegrations.tsx`
- `src/pages/Tasks.tsx`
- `src/App.tsx`
- `package.json`：`@react-pdf/renderer`

## 八、所有邊界處理總表

| 風險 | 處理方式 |
|---|---|
| 第二次付款 webhook 未回前又 completed | 方案 B：`first_submitted_at IS NOT NULL` 才走簽回；否則停 `payment_pending_info`，callback 後 trigger 補升 |
| **promote 出來的 doc 被外部當「非首次」漏附件**（v3.2） | webhook 改讀 `payee_profiles.*_cloud_url` 是否齊備來決定帶不帶附件，與 `is_first_payment` 解耦 |
| 流水號併發 | `next_payment_doc_no()` atomic + `promote_pending_info_apps()` FOR LOOP 逐筆呼叫，`FOR UPDATE` 鎖 |
| 學員修改銀行/個資 | 獨立「申請修改」流程：必傳新存摺封面 + 原因，寫變更歷史，獨立 webhook |
| 進行中勞報單想改個資 | 兩條流程獨立；admin 可對未簽回的勞報單按「重新產生」 |
| 時區 | DB 用 `AT TIME ZONE 'Asia/Taipei'`；PDF 用 `+8h offset → getUTC*` |
| Webhook URL 管理 | 存 `system_settings.PAYMENT_WEBHOOK_URL`，獨立欄位、不共用 |

確認後我會切到執行模式依此實作。
