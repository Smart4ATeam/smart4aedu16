-- Clean up Zin Lee's test revenue records
DELETE FROM public.revenue_records
WHERE user_id = '9b036eda-69af-4078-b0a9-3a769c609d19';

-- Reset Zin Lee's total_revenue and total_points in profiles
UPDATE public.profiles
SET total_revenue = 0, total_points = 0
WHERE id = '9b036eda-69af-4078-b0a9-3a769c609d19';