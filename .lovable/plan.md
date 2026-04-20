
## 目標
訂單付款拆分後，通知「本次新建立學員編號」的人（排除舊學員），支援 P1~P3 多人團報，串接 Make.com。

## 現況分析
看了 `api-reg-split` 目前的回傳：
```json
{ "order_id", "order_no", "member_ids": [...], "enrollments_count" }
```
只回 `member_ids`，沒區分新舊、沒帶學員資料（姓名/email/編號）→ Make.com 無法直接拿來寄信。

新舊判斷邏輯：在 split 程式裡，每個 person 走「找 email → 找 name+phone → 都沒有才 insert」的流程。**只有走到 insert 那一支的才是新學員**，目前沒被標記出來。

## 規劃方案

### 1. 改造 `api-reg-split` 回傳結構
在現有 person 處理迴圈裡，記錄每位是 `existing` 還是 `new`，並把學員資料（含 P1~P3 的角色、email、phone、新生成的 member_no）回傳：

```json
{
  "success": true,
  "data": {
    "order_id": "...",
    "order_no": "NWS...",
    "enrollments_count": 3,
    "members": [
      {
        "position": "p1",
        "member_id": "...",
        "member_no": "SA26040160",
        "name": "王浩渝",
        "email": "...",
        "phone": "...",
        "is_new": true
      },
      { "position": "p2", ..., "is_new": false },
      { "position": "p3", ..., "is_new": true }
    ],
    "new_members_count": 2
  }
}
```

`is_new` 規則：在 `find or create reg_member` 流程中，若走到 `insert` 分支則為 `true`。

### 2. Make.com 串接設計（兩種做法擇一）

**方案 A：Make.com 主動拿回傳處理（推薦）**
- 你的付款 webhook 流程：`api-reg-payment` → `api-reg-split` → 拿到回傳 → Make.com 用 `Iterator` 跑 `members` 陣列 → `Filter` 只保留 `is_new = true` → 對每位寄通知信
- 優點：單一流程、好維護、好除錯、Make.com 端可彈性決定 P1/P2/P3 不同信件樣式
- 缺點：Make.com 場景要自己組

**方案 B：在 split 完成時，後端主動呼叫 Make.com webhook**
- 在 `api-reg-split` 結尾，若有 `new_members_count > 0`，POST 到 `MAKE_NEW_MEMBER_WEBHOOK_URL` 帶上 new members 名單
- 優點：後端自動推、Make.com 場景單純（只接 webhook 寄信）
- 缺點：要新增 secret、後端與 Make.com 耦合

### 3. 防呆機制
- `api-reg-split` 已有「重複拆解」擋下機制（409），所以不會重複通知
- 在 `reg_operation_logs` 的 `new_value` 補記 `new_member_ids`，留稽核軌跡

### 技術變動點
| 檔案 | 動作 |
|---|---|
| `supabase/functions/api-reg-split/index.ts` | 改 person 流程記 `isNew` 旗標、改回傳結構帶 members 完整資料、（方案B時）加 webhook POST |
| Supabase secrets | （方案B）新增 `MAKE_NEW_MEMBER_WEBHOOK_URL` |
| Make.com 場景 | （方案A）建 Iterator + Filter；（方案B）建 webhook receiver |

### 影響範圍
- `api-reg-split` 回傳結構改變 → 你之前批次拆解的腳本若有解析回傳要對應調整（但只是新增欄位，不刪舊欄位，向下相容）
- 不動資料表 schema、不動其他 API

## 需要你決定
1. **採方案 A 還是方案 B？**（A=Make.com 拿回傳；B=後端推 webhook）
2. **通知範圍：只通知 P1（主要報名者一封信內含全部學員編號），還是 P1~P3 各自獨立通知？** 你描述偏向後者，我預設「P1~P3 各自只要 is_new=true 就獨立通知一封」，要改的話告訴我。
3. **無 email 的新學員怎麼辦？** 訂單裡有些 person 沒填 email（純電話），這種要跳過、還是用 SMS 通知？
