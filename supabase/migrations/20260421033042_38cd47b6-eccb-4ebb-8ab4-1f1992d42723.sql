-- 1. 回填現有 reg_enrollments.user_id（從 reg_members 帶過來）
UPDATE public.reg_enrollments e
SET user_id = m.user_id
FROM public.reg_members m
WHERE e.member_id = m.id
  AND e.user_id IS NULL
  AND m.user_id IS NOT NULL;

-- 2. 建立 trigger function：reg_members.user_id 一旦設定，自動同步到 enrollments
CREATE OR REPLACE FUNCTION public.sync_enrollments_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
     AND (OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    UPDATE public.reg_enrollments
    SET user_id = NEW.user_id
    WHERE member_id = NEW.id
      AND (user_id IS NULL OR user_id IS DISTINCT FROM NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollments_user_id ON public.reg_members;
CREATE TRIGGER trg_sync_enrollments_user_id
AFTER INSERT OR UPDATE OF user_id ON public.reg_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_enrollments_user_id();

-- 3. 同步 reg_orders 拆單流程未來新增的 enrollments 也要保險：
-- 當 enrollment 建立時若 user_id 為空，從 member 帶
CREATE OR REPLACE FUNCTION public.fill_enrollment_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.member_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.reg_members
    WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_enrollment_user_id ON public.reg_enrollments;
CREATE TRIGGER trg_fill_enrollment_user_id
BEFORE INSERT ON public.reg_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.fill_enrollment_user_id();