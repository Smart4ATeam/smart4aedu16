-- 1. course_sessions 新增時間欄位
ALTER TABLE public.course_sessions
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time;

-- 2. calendar_events 新增起訖時間 + 連動標記
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS session_day_index int;

CREATE INDEX IF NOT EXISTS idx_calendar_events_session ON public.calendar_events(session_id);

-- 3. 同步函式：梯次 → 行事曆
CREATE OR REPLACE FUNCTION public.sync_session_to_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_title text;
  v_course_code text;
  v_total_days int;
  v_day_idx int;
  v_current_date date;
  v_title_base text;
  v_title_final text;
  v_end_date date;
BEGIN
  -- 先清除此 session 既有的行事曆活動（避免殘留）
  DELETE FROM public.calendar_events WHERE session_id = NEW.id;

  -- 條件：status != 'scheduled' 且有 start_date
  IF NEW.status = 'scheduled' OR NEW.start_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- 取得課程資訊
  SELECT title, course_code INTO v_course_title, v_course_code
  FROM public.courses WHERE id = NEW.course_id;

  IF v_course_title IS NULL THEN
    RETURN NEW;
  END IF;

  -- 標題基底：課程名稱 + title_suffix（若有）
  v_title_base := v_course_title;
  IF NEW.title_suffix IS NOT NULL AND NEW.title_suffix <> '' THEN
    v_title_base := v_title_base || ' ' || NEW.title_suffix;
  END IF;

  -- 計算總天數
  v_end_date := COALESCE(NEW.end_date, NEW.start_date);
  v_total_days := (v_end_date - NEW.start_date) + 1;
  IF v_total_days < 1 THEN
    v_total_days := 1;
  END IF;

  -- 逐日建立行事曆活動
  v_day_idx := 1;
  v_current_date := NEW.start_date;
  WHILE v_current_date <= v_end_date LOOP
    IF v_total_days > 1 THEN
      v_title_final := v_title_base || '（Day ' || v_day_idx || '/' || v_total_days || '）';
    ELSE
      v_title_final := v_title_base;
    END IF;

    INSERT INTO public.calendar_events (
      title, event_date, event_time, end_time,
      description, color, is_global,
      session_id, session_day_index
    ) VALUES (
      v_title_final,
      v_current_date,
      NEW.start_time,
      NEW.end_time,
      COALESCE(NEW.location, ''),
      'gradient-cyan',
      true,
      NEW.id,
      v_day_idx
    );

    v_current_date := v_current_date + 1;
    v_day_idx := v_day_idx + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. 刪除函式：梯次刪除時清掉行事曆活動
CREATE OR REPLACE FUNCTION public.cleanup_session_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.calendar_events WHERE session_id = OLD.id;
  RETURN OLD;
END;
$$;

-- 5. 建立 triggers
DROP TRIGGER IF EXISTS trg_sync_session_to_calendar ON public.course_sessions;
CREATE TRIGGER trg_sync_session_to_calendar
AFTER INSERT OR UPDATE ON public.course_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_session_to_calendar();

DROP TRIGGER IF EXISTS trg_cleanup_session_calendar ON public.course_sessions;
CREATE TRIGGER trg_cleanup_session_calendar
BEFORE DELETE ON public.course_sessions
FOR EACH ROW EXECUTE FUNCTION public.cleanup_session_calendar();

-- 6. 回填：對所有現有非 scheduled 的梯次強制觸發一次同步
UPDATE public.course_sessions
SET status = status
WHERE status <> 'scheduled' AND start_date IS NOT NULL;