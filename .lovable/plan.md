

## Plan: 修正資源中心 UI 與補充 API 文件

### 問題清單
1. **ExtensionCard 重複領用按鈕** — 第 212 行有重複的 `TrialButton`
2. **卡片未顯示縮圖** — `thumbnail_url` 欄位存在但卡片元件未渲染圖片
3. **卡片排版改為兩欄** — 目前套件/模板為單欄 `space-y-4`，需改為 `grid grid-cols-2`
4. **領用確認流程不足** — 按下領用後應先確認組織編號、再彈出確認對話框（「今天確定要領用 XXX 套件嗎？」），確認後才送出
5. **API 文件缺少 Webhook 發送說明** — 管理端 API 串接頁面缺少「系統發送到 Webhook 的 Payload 格式」與「Webhook URL 設定說明」

---

### 1. 移除重複 TrialButton

**檔案**：`src/pages/Resources.tsx` 第 212 行

刪除第二個 `<TrialButton r={r} onClaim={onClaim} claiming={claiming} trialRecord={trialRecord} />`。

---

### 2. 卡片顯示縮圖

**檔案**：`src/pages/Resources.tsx`

在 `ExtensionCard`、`TemplateCard`、`PluginCard` 中，若 `r.thumbnail_url` 存在，在卡片頂部渲染圖片（`<img>` 圓角裁切），無圖片時不顯示。

---

### 3. 卡片改為兩欄排版

**檔案**：`src/pages/Resources.tsx` `renderCards()` 函式

- plugins、extensions、templates 改為 `grid grid-cols-1 md:grid-cols-2 gap-4`
- videos 維持三欄

---

### 4. 領用前確認對話框

**檔案**：`src/pages/Resources.tsx`

- 引入 `AlertDialog` 元件
- 在 `handleClaim` 中，先檢查組織編號（從 profiles 取得），若未設定則 toast 提示
- 組織編號確認後，彈出確認對話框顯示資源名稱：「今天確定要領用『XXX』套件嗎？每天只能領用一個套件（或模板），確認後將無法取消。」
- 使用者點擊「確認領用」後才呼叫 Edge Function

---

### 5. API 文件補充 Webhook 說明

**檔案**：`src/pages/admin/AdminIntegrations.tsx`

在認證方式說明區塊下方新增「Webhook 設定說明」區塊：
- 說明 Webhook URL 需在「管理設定」頁面配置（`system_settings` key: `trial_webhook_url`）
- 列出系統發送到 Webhook 的完整 Payload 格式與各欄位說明
- 提供收到 Payload 後應呼叫 `api-resource-trial-callback` 回傳金鑰的完整流程圖

同時在現有的 `api-resource-trial-callback` 端點文件中，補充更詳細的「Webhook 完整串接流程」說明。

---

### 技術細節
- 修改 `src/pages/Resources.tsx`：移除重複按鈕、加入縮圖、改兩欄 grid、加入 AlertDialog 確認流程
- 修改 `src/pages/admin/AdminIntegrations.tsx`：新增 Webhook 說明區塊

