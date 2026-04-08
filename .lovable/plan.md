

## Plan: API 文件強化 - 複訓範例 + 完整欄位選項

### 修改檔案
`src/pages/admin/AdminIntegrations.tsx`

### 變更內容

**1. 擴展 `ApiEndpoint` 介面**
- 新增 `extraExamples?: { title: string; body: Record<string, unknown> }[]` 欄位，用於支援多個 cURL 範例區塊

**2. api-reg-order：新增複訓訂單 cURL 範例**
- 在現有 `exampleBody` 之外，加入 `extraExamples` 陣列，包含一個「複訓訂單範例」：
  - `is_retrain: true`
  - 使用標準課程代碼
  - 單人報名、含 `referrer`、`notes` 等欄位
- 選填欄位說明補充可選值：
  - `payment_method` 加上「信用卡 / 匯款 / 現金 / Line Pay」
  - `invoice_type` 加上「二聯式 / 三聯式 / 電子發票 / 免開發票」
  - `is_retrain` 補充「設為 true 即為複訓，使用相同課程代碼即可」

**3. api-reg-payment：補充完整欄位範例**
- `exampleBody` 加入 `paid_at`、`invoice_type` 欄位
- 選填欄位 `payment_method` desc 補充「信用卡 / 匯款 / 現金 / Line Pay」
- 選填欄位 `invoice_type` desc 補充「二聯式 / 三聯式 / 電子發票 / 免開發票」

**4. api-reg-split：新增錯誤回應範例**
- 加入 `extraExamples` 包含常見錯誤情境：未付款、已拆解過

**5. EndpointCard 元件更新**
- 在現有 cURL 範例區塊之後，渲染 `extraExamples` 陣列中每個額外範例的 cURL 區塊（含標題）

### 技術細節
- 僅修改一個檔案
- 不影響任何 API 邏輯，純 UI 文件更新

