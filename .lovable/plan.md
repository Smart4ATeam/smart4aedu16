

## 問題分析

從截圖看到三個匯入錯誤：

1. **批次 1 & 5**：`is_retrain` 欄位為 null，違反 NOT NULL 約束 — 因為 CSV 中該欄位為空時，`mapRow` 不會設值（第 121 行的 `if` 條件 `values[i]?.trim()` 為空就跳過），而預設值區塊（第 138-142 行）漏了 `is_retrain` 的預設值。
2. **批次 4**：日期欄位值為 `"45840.89514"` — 這是 Excel 序列日期數字（Excel 以 1900-01-01 為基準的天數），不是合法的 timestamp 格式。需要在 `mapRow` 中偵測並轉換。

## 修改計劃

### 檔案：`src/pages/admin/AdminImport.tsx`

#### 1. 新增 `is_retrain` 預設值
在第 142 行後加入：
```typescript
if (mapped.is_retrain === undefined) mapped.is_retrain = false;
```

#### 2. 新增 Excel 序列日期轉換函式
加入一個工具函式，偵測純數字的日期值並轉換為 ISO 日期字串：
```typescript
function excelDateToISO(value: string): string {
  const num = parseFloat(value);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    // Excel serial date: days since 1900-01-01 (with Excel's leap year bug)
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString();
  }
  return value; // 原本就是正常日期字串，直接回傳
}
```

#### 3. 在 `mapRow` 中對日期欄位套用轉換
對 `paid_at`、`invoice_date`、`invoice_void_at`、`invoice_reissued_at` 等日期欄位，呼叫 `excelDateToISO` 進行轉換。

### 涉及檔案
- `src/pages/admin/AdminImport.tsx`（唯一修改）

