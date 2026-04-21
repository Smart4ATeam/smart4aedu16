import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const courseId = url.searchParams.get("course_id");
  const category = url.searchParams.get("category");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const status = url.searchParams.get("status") ?? "scheduled";
  const upcoming = url.searchParams.get("upcoming") === "true";

  // 先撈已上架課程，避免回傳草稿課
  let coursesQ = admin
    .from("courses")
    .select("id, title, course_code, category, price, total_hours, registration_url")
    .eq("status", "published");
  if (category) coursesQ = coursesQ.eq("category", category);
  if (courseId) coursesQ = coursesQ.eq("id", courseId);

  const { data: courses, error: cErr } = await coursesQ;
  if (cErr) return jsonResponse({ error: cErr.message }, 500);
  const courseIds = (courses ?? []).map((c) => c.id);
  if (!courseIds.length) return jsonResponse({ sessions: [] });

  let q = admin
    .from("course_sessions")
    .select("id, course_id, title_suffix, start_date, end_date, location, max_students, price, registration_url, status, schedule_type")
    .in("course_id", courseIds)
    .order("start_date", { ascending: true });

  if (status !== "all") q = q.eq("status", status);
  if (dateFrom) q = q.gte("start_date", dateFrom);
  if (dateTo) q = q.lte("start_date", dateTo);
  if (upcoming) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.gte("start_date", today);
  }

  const { data: sessions, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
  const enriched = (sessions ?? []).map((s: any) => ({
    ...s,
    course: courseMap.get(s.course_id) ?? null,
  }));

  return jsonResponse({ sessions: enriched, total: enriched.length });
});
