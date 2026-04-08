-- Backfill course_snapshot for imported orders that have empty snapshot
UPDATE reg_orders o
SET course_snapshot = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'course_code', c.course_code,
      'course_name', c.title,
      'price', c.price
    )
  )
  FROM unnest(o.course_ids) AS uid(course_uuid)
  JOIN courses c ON c.id = uid.course_uuid
)
WHERE o.course_snapshot = '{}'::jsonb OR o.course_snapshot IS NULL;