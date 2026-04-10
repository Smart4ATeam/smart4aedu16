

## Plan: 建立成就勳章管理機制

### 目標
在管理後台的「學習中心」頁面新增「成就勳章」分頁，提供完整的 CRUD 管理功能，包括管理成就定義、查看學員獲得紀錄，以及手動頒發/撤銷勳章。

### 功能範圍

**1. 成就定義管理 (CRUD)**
- 列表顯示所有成就（圖示、名稱、類別、描述）
- 新增 / 編輯成就（名稱、圖示 emoji、類別、描述）
- 刪除成就（含確認提示）

**2. 學員勳章紀錄查看**
- 顯示已頒發的勳章記錄（學員名稱、成就名稱、獲得時間）

**3. 手動頒發 / 撤銷勳章**
- 選擇學員 + 選擇成就 → 手動頒發
- 從紀錄中撤銷已頒發的勳章
- 頒發時自動更新 `profiles.total_badges` 計數

### 技術細節

**修改檔案：**
- `src/pages/admin/AdminLearning.tsx` — 新增 `TabsTrigger` "成就勳章" 與對應的 `AchievementsTab` 組件

**AchievementsTab 組件內容：**
- 上半部：成就定義表格 + 新增/編輯/刪除 Dialog
- 下半部：已頒發紀錄表格 + 手動頒發 Dialog + 撤銷按鈕
- 使用 `@tanstack/react-query` 管理資料，與現有 Tab 風格一致
- 類別選項：learning, automation, task, community, revenue（對應現有資料）
- 撤銷勳章時透過 Supabase 刪除 `user_achievements` 記錄，`on_achievement_earned` trigger 會自動更新 `total_badges`

**需新增 trigger：** 目前 `on_achievement_earned` 只在 INSERT 時觸發，需補一個 DELETE trigger 來扣減 `total_badges`。

**資料庫遷移 (1 筆)：**
```sql
CREATE OR REPLACE FUNCTION public.on_achievement_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles
  SET total_badges = (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = OLD.user_id)
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_achievement_removed
AFTER DELETE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.on_achievement_removed();
```

### 不涉及的部分
- 不修改學員端顯示邏輯（`AchievementSection.tsx` 維持不變）
- 不修改 RLS 政策（現有 admin ALL 政策已足夠）

