-- Delete Zin Lee's test enrollment
DELETE FROM reg_enrollments WHERE id = 'f2663a04-c691-4332-8cb5-06304ae37b29';

-- Normalize session_date: pad single-digit month/day with leading zeros
-- Handle format like "2026/4/16" -> "2026/04/16"
-- Handle format like "2026/1/17-1/18" -> "2026/01/17-01/18"
-- Handle format like "2024/9/28" -> "2024/09/28"

-- Step 1: Normalize the main date part (before any dash suffix)
-- We use a function to do this cleanly
CREATE OR REPLACE FUNCTION pg_temp.normalize_session_date(input text)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  main_part text;
  suffix_part text;
  parts text[];
  result text;
  dash_pos int;
BEGIN
  IF input IS NULL OR input = '' THEN RETURN input; END IF;
  
  -- Check if there's a date range (e.g., "2026/1/17-1/18")
  dash_pos := position('-' in input);
  IF dash_pos > 0 THEN
    main_part := substring(input from 1 for dash_pos - 1);
    suffix_part := substring(input from dash_pos + 1);
  ELSE
    main_part := input;
    suffix_part := NULL;
  END IF;
  
  -- Normalize main part: split by /
  parts := string_to_array(main_part, '/');
  IF array_length(parts, 1) = 3 THEN
    result := parts[1] || '/' || lpad(parts[2], 2, '0') || '/' || lpad(parts[3], 2, '0');
  ELSIF array_length(parts, 1) = 2 THEN
    result := lpad(parts[1], 2, '0') || '/' || lpad(parts[2], 2, '0');
  ELSE
    result := main_part;
  END IF;
  
  -- Normalize suffix part if exists
  IF suffix_part IS NOT NULL THEN
    parts := string_to_array(suffix_part, '/');
    IF array_length(parts, 1) = 2 THEN
      result := result || '-' || lpad(parts[1], 2, '0') || '/' || lpad(parts[2], 2, '0');
    ELSE
      result := result || '-' || suffix_part;
    END IF;
  END IF;
  
  RETURN result;
END;
$$;

UPDATE reg_enrollments
SET session_date = pg_temp.normalize_session_date(session_date)
WHERE session_date IS NOT NULL
  AND session_date != pg_temp.normalize_session_date(session_date);