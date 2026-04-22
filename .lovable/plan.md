

## 啟用後無法登入：問題分析與一次性修復計畫

### 根因
資料庫上原本應該掛在 `auth.users` 的 `on_auth_user_created` trigger（呼叫 `handle_new_user()`）**目前不存在**。任何透過 Google OAuth 或 Email 註冊／啟用的新帳號，都不會自動建立 `profiles`、`user_roles`、`notification_settings`，也不會自動綁定到 `reg_members`。結果：
- 用戶能登入 auth，但前端讀 `profiles` 為空 → 看起來「登入失敗 / 無法進入系統」
- `reg_members.user_id` 沒被回填 → 訂單、積分、課程通通對不上

### 受影響帳號（已查到 5 個 auth user 完全沒 profile）
| Email | Auth ID 後綴 | 對應 reg_member |
|---|---|---|
| gfrise25@gmail.com（謝億華） | …b67607d | SA25110108 ✅ 有 |
| dolomite2004@gmail.com | …e790c8 | ❌ 無 |
| hankhuang@pantaiwan.com.tw | …fca3e6 | ❌ 無 |
| johnlee@pantaiwan.com.tw | …43b2f3 | ❌ 無 |
| poo19970403@gmail.com | …8bdea0 | ❌ 無 |

### 修復步驟（一次性 migration）

**Step 1：重新建立 auth.users → handle_new_user 的 trigger（治本）**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Step 2：修補 handle_new_user 的 email 比對邏輯（防呆）**
- `WHERE email = NEW.email` → 改用 `LOWER(email) = LOWER(NEW.email)`，避免大小寫造成找不到 reg_member（正是 Google OAuth 常踩的雷，例如 `Syichg@gmail.com`）。

**Step 3：補齊 5 位現有受影響帳號的資料**
對每位用 `handle_new_user` 同樣的邏輯一次補齊：
1. 若有對應 `reg_members`（例如謝億華 SA25110108）→ 建立 profile + 綁 user_id + 設 student_id = member_no
2. 若無 reg_member → 建立基本 profile（display_name 用 email），並寫入 `reg_operation_logs` 標記為 unmatched_signup 待後台手動綁定
3. 全部加上 `user_roles=user`、初始化 `notification_settings`

**Step 4：全表掃描其他可能漏網之魚**
```sql
-- 找出所有 auth.users 中沒 profile 的，自動補建
INSERT INTO profiles (id, display_name, email, activated)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', u.email), u.email, true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);
-- 補 user_roles、notification_settings 同理
```

### 驗收
1. 修補後查詢 `auth.users LEFT JOIN profiles` 應為 0 筆缺漏
2. 受影響的 5 位學員直接用原密碼或 Google 登入即可進入系統
3. 之後新註冊／啟用會自動跑 trigger，不再遺失資料

### 對使用者
完成後請通知 5 位學員直接登入即可，不需要重設密碼。其中 4 位（除謝億華外）目前在系統內沒有對應的報名學員資料，會以「未綁定學員」狀態存在，你可以到後台手動綁定到對應的 reg_member。

