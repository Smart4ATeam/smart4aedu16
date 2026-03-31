

## 計劃：課程報名系統 — 資料表與管理功能（最終版 v2）

### 資料表設計（6 張表）

**1. `reg_courses`** — 課程主檔
- id, course_code, course_name, course_type (beginner/basic/intermediate/advanced/agent_skill), course_date (daterange), price, status, created_at

**2. `reg_orders`** — 訂單總表
- id, order_no (unique), course_ids (uuid[]), course_snapshot
- p1~p3 聯絡資訊 (name, phone, email)
- payment_status (pending/paid), paid_at, payment_method, total_amount, discount_plan
- invoice_type, invoice_title, invoice_number
- invoice_status (active/voided/reissued) — 支援作廢與重開
- invoice_void_reason, invoice_void_at
- invoice_reissued_number — 重開後的新發票號碼
- invoice_reissued_at
- dealer_id, notes, created_at

**3. `reg_members`** — 學員主檔
- id, member_no (auto SA25040001), name, phone, email, course_level, points, referral_code, notes, created_at

**4. `reg_enrollments`** — 報名明細（一張表，UI 分頁籤顯示）
- id, order_id, member_id, course_id, course_type
- status (enrolled/attended/absent/transferred)
- payment_status, paid_at, invoice_title
- dealer_id, referrer, checked_in
- post_survey, post_test, test_score, certificate, pre_notification_sent
- points_awarded, lovable_invite, notes, enrolled_at

**5. `reg_point_transactions`** — 點數流水帳
- id, member_id, order_id (nullable), points_delta, type, description, created_at
- type 值：`awarded`（課程給點）/ `redeemed`（兌換扣點）/ `adjusted`（手動調整）/ `referral`（推薦）/ `manual`（手動發放，獨立於訂單）

**6. `reg_operation_logs`** — 操作紀錄（append-only）
- id, entity_type, entity_id, action, old_value (jsonb), new_value (jsonb), reason, operated_by, created_at

### 發票流程設計

| 操作 | 欄位變更 | 操作紀錄 action |
|---|---|---|
| 發票作廢 | invoice_status → 'voided', 填入 void_reason + void_at | `void_invoice` |
| 發票重開 | invoice_status → 'reissued', 填入 reissued_number + reissued_at | `reissue_invoice` |

作廢與重開是兩步驟操作，管理員可以只作廢不重開，也可以作廢後立即重開。

### 手動給點數（獨立功能）

手動給點數**不綁定訂單或課程**，是獨立的管理功能：
- 寫入 `reg_point_transactions`，`order_id` 為 null，`type` = `'manual'`
- 同步更新 `reg_members.points` 快取值
- 寫入 `reg_operation_logs`（action = `manual_points`）
- 未來在後台管理介面會有獨立的「點數管理」區塊，可搜尋學員並手動加減點數

### 自動化
- Trigger: `reg_members` INSERT 自動產生 `member_no`（SA + YYMM + 4位流水號）
- Trigger: `reg_point_transactions` INSERT 後自動更新 `reg_members.points`
- RLS: Admin 完整讀寫，authenticated 可讀，Make.com 用 service_role 不受限

### 實作步驟
1. **Migration SQL** — 建立 6 張表 + 2 triggers + RLS + indexes
2. 暫不建前端管理頁面（先讓 Make.com 串接寫入）

