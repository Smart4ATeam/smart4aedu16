

## 問題診斷

### 根因 1：Google OAuth 註冊抓不到姓名 → display_name 變成 email
`handle_new_user()` 寫的是：
```
COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
```
但 Google 給的 metadata key 是 `full_name` / `name`，不是 `display_name`，所以 fallback 全部變成 email。
（4 位受害者：dolomite2004 / poo19970403 / hankhuang / johnlee — Google 其實有給 `Irene Wu`、`POO`、`#125 Hank`、`李育強`，但被忽略。）

### 根因 2：reg_members 重複資料
`weilyyeh@weilyyeh.com` 同 email 有 2 筆（SA24120021「威業國際企業有限公司」、SA26030123「葉威志」），會讓啟用時 `email + member_no` 比對到不同筆，造成姓名混亂。

### 根因 3：啟用流程沒有「先匹配 reg_members 自動綁定」
目前 `activate-account` 只有「Email + 學員編號」嚴格匹配；如果學員用 Google 登入而非走啟用頁，就會走到 `handle_new_user` 的 ELSE 分支建立空 profile，永遠不會綁到 reg_member。

---

## 修復計畫

### Step 1：修補 `handle_new_user`（Migration）
- 取 display_name 優先序改為：`raw_user_meta_data->>'display_name'` → `'full_name'` → `'name'` → email 前綴（@ 之前）→ email
- ELSE 分支（找不到 reg_member 也沒 prebuilt profile）時，display_name 套用上述邏輯，**不再直接寫 email**

### Step 2：修補 `activate-account` Edge Function
- 啟用成功後，若 `reg_members` 中有同 email 的紀錄但 `user_id` 為空，自動回填 `user_id`（防止 Google 登入後 reg_member 永遠沒綁到）
- 同步把 `profiles.display_name` 用 reg_member.name 覆寫（修復「啟用後姓名沒帶進來」）

### Step 3：清掉 reg_members 重複資料
`weilyyeh@weilyyeh.com` 兩筆：保留較新且姓名正常的 `SA26030123 葉威志`，刪除 `SA24120021 威業國際企業有限公司`（先確認沒有關聯訂單／點數，有就轉移到保留那筆）。

### Step 4：修復 4 位受害者的 display_name
從 `auth.users.raw_user_meta_data` 取 `full_name` 或 `name` 回填到 `profiles.display_name`：
- `dolomite2004@gmail.com` → Irene Wu
- `poo19970403@gmail.com` → POO
- `hankhuang@pantaiwan.com.tw` → #125 Hank
- `johnlee@pantaiwan.com.tw` → 李育強

### Step 5：全表掃描自動綁定遺漏的 reg_members
所有 `reg_members.user_id IS NULL` 但 email 在 `auth.users` 找得到的，自動回填 `user_id`，並把 `profiles.student_id` 同步成 `member_no`、`display_name` 同步成 `name`（如果原本是 email）。

---

## 關於登入問題

> 這 4 位都是 **Google OAuth** 註冊（從未設過密碼），所以「用密碼登入」一定失敗。
> 修完後請通知他們：**用 Google 按鈕登入即可**；如要改用密碼登入，請走「忘記密碼」設一組。
> 走啟用頁（Email + 學員編號 + 密碼）建立的帳號，本來就可以用該密碼登入，這條路徑沒壞。

---

## 影響範圍
- **Migration**：修改 `public.handle_new_user()`、補資料（display_name、reg_members.user_id、profiles.student_id）、刪 1 筆重複 reg_member
- **Edge Function**：`supabase/functions/activate-account/index.ts`（啟用後自動綁 reg_member + 覆寫姓名）
- **不動前端 UI**

確認後我就執行。

