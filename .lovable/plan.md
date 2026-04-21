

# 報名學員 ↔ 平台使用者 整合方案（含 Backfill 與登入 Email 安全機制）

## 一、回答你的問題

**Q: profiles.email 與 auth.users.email 分離後，萬一使用者改了 reg_members.email 後無法登入怎麼辦？**

關鍵釐清：**改 reg_members.email 不會影響登入**，因為登入只認 `auth.users.email`。所以分離本身是安全的。

但要避免「使用者誤以為改了 email 就能用新 email 登入」造成混淆，方案如下：

1. **UI 明確標示**：後台編輯 reg_member 時，email 欄位旁顯示「此為通訊／顯示用 Email，不影響登入帳號」。若該 user 已綁定，另外顯示「目前登入 Email：xxx@xxx」。
2. **獨立「變更登入 Email」按鈕**：要改登入帳號必須走專屬流程（edge function `admin-update-login-email`），三邊（auth.users / profiles / reg_members）一起更新並寫 log。
3. **救援機制**：
   - 後台「重設密碼」功能維持（用 user_id 直接改，不靠 email）
   - 後台可查 `reg_operation_logs` 找到歷次 email 變更紀錄
   - 萬一真的改錯登入 email 鎖死自己 → 後台用「變更登入 Email」按鈕改回來即可（admin 用 service role 操作，不需要使用者本人）

---

## 二、整合策略總覽

```text
   reg_members (報名資料)              profiles (平台帳號顯示)        auth.users (登入)
   ─────────────────                   ────────────────────           ─────────────
   name        ◄──┐ trigger B          display_name                   email (登入用)
   phone       ◄──┤ (profile→member)   phone                          ──────────
   email       ──►│ trigger A          email (顯示用)                  獨立流程才動
   member_no   ──►│ (member→profile)   student_id                     edge function
   user_id     ───┴──────────────────► id ─────────────────────────► id
```

| 同步方向 | 觸發時機 | 同步欄位 | 不動 |
|---|---|---|---|
| reg_members → profiles | trigger A（reg_members UPDATE） | name→display_name、phone、email（顯示）、member_no→student_id | auth.users.email |
| profiles → reg_members | trigger B（profiles UPDATE） | display_name→name、phone | email（避免覆蓋報名 email） |
| 三邊登入 Email 同步 | edge function 手動觸發 | auth.users.email + profiles.email + reg_members.email | — |

---

## 三、實作清單

### A. DB Migration

1. **新增 trigger `sync_member_to_profile`**（reg_members AFTER UPDATE）
   - 條件：`user_id IS NOT NULL`
   - 同步 name / phone / email 到 profiles
2. **新增 trigger `sync_profile_to_member`**（profiles AFTER UPDATE）
   - 條件：對應 reg_members 存在
   - 同步 display_name / phone 到 reg_members（不動 email）
3. **修改 function `handle_new_user`**
   - 找不到對應 reg_member 時不再 raise exception
   - 仍建立 profile，並寫一筆 `reg_operation_logs`（action = `unmatched_signup`）
4. **一次性 Backfill SQL**（migration 內執行一次）
   ```sql
   UPDATE profiles p SET 
     display_name = COALESCE(NULLIF(m.name,''), p.display_name),
     phone = COALESCE(m.phone, p.phone),
     email = COALESCE(m.email, p.email),
     updated_at = now()
   FROM reg_members m
   WHERE m.user_id = p.id;
   ```

### B. Edge Function

5. **新增 `admin-update-login-email`**
   - 驗證 admin token
   - 用 `auth.admin.updateUserById` 更新登入 email
   - 連動更新 profiles.email + reg_members.email
   - 寫 `reg_operation_logs`

### C. 前端

6. **`RegMembersTab` 編輯 dialog**
   - email 欄位旁加說明文字「通訊／顯示用，不影響登入」
   - 若該 member 已綁定 user，顯示目前登入 email
   - 新增「變更登入 Email」獨立按鈕（呼叫 edge function）
7. **`RegMembersTab` 列表**
   - 新增綁定狀態徽章（已綁定平台帳號 / 未綁定）
   - 未綁定者顯示「綁定使用者」按鈕（搜尋 profiles 後手動綁）
8. **`StudentDetailDialog`**
   - 顯示對應 reg_member 資訊（若有），標示資料同步狀態

---

## 四、影響檔案

| 檔案 | 變更 |
|---|---|
| 新 migration | 2 個 trigger + 修改 handle_new_user + backfill |
| `supabase/functions/admin-update-login-email/index.ts` | 新增 |
| `src/pages/admin/AdminStudents.tsx`（RegMembersTab、PointsTab 共用檔） | 編輯 dialog、綁定徽章、變更登入 email 按鈕 |
| `src/components/admin/students/StudentDetailDialog.tsx` | 顯示 reg_member 連動資訊 |

---

## 五、驗收情境

1. 後台改 reg_member.name → profiles.display_name 自動更新 ✅
2. 使用者在 Settings 改 display_name → reg_members.name 自動更新 ✅
3. 後台改 reg_member.email → 登入 email 不變、profiles.email 顯示更新 ✅
4. 使用者用「舊 email」登入 → 仍可正常登入（auth.users.email 沒變）✅
5. 後台用「變更登入 Email」→ 三邊一起更新，使用者用新 email 登入 ✅
6. 新使用者用沒在 reg_members 的 email 註冊 → 不再被擋，profile 建立 + log 寫入待綁定清單 ✅
7. Backfill 後，所有已綁定 profiles 的 name/phone/email 與 reg_members 對齊 ✅

確認後切換執行模式依序實作。

