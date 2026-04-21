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
  const completedParam = url.searchParams.get("completed");
  const source = url.searchParams.get("source") ?? "enrollments";

  // 舊路徑（自學 learning_paths）保留，預設不走
  if (source === "path") {
    let q = admin
      .from("user_learning_progress")
      .select("id, learning_path_id, current_step, completed, completed_at, started_at")
      .eq("user_id", v.userId!);
    if (completedParam === "true") q = q.eq("completed", true);
    if (completedParam === "false") q = q.eq("completed", false);

    const { data: progress, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);

    const pathIds = [...new Set((progress ?? []).map((p) => p.learning_path_id))];
    const { data: paths } = pathIds.length
      ? await admin.from("learning_paths").select("*").in("id", pathIds)
      : { data: [] as any[] };

    return jsonResponse({
      source: "path",
      progress: (progress ?? []).map((p) => ({
        ...p,
        learning_path: (paths ?? []).find((lp: any) => lp.id === p.learning_path_id) ?? null,
      })),
    });
  }

  // 預設：以 reg_enrollments 為事實來源
  const { data: member } = await admin
    .from("reg_members")
    .select("id, member_no, name")
    .eq("user_id", v.userId!)
    .maybeSingle();

  if (!member) {
    return jsonResponse({
      source: "enrollments",
      member: null,
      completed_courses: [],
      in_progress_courses: [],
    });
  }

  const { data: enrollments, error } = await admin
    .from("reg_enrollments")
    .select(
      "id, course_id, status, payment_status, session_date, test_score, certificate, enrolled_at, paid_at",
    )
    .eq("member_id", member.id)
    .neq("status", "cancelled");

  if (error) return jsonResponse({ error: error.message }, 500);

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id).filter(Boolean))];
  const { data: courses } = courseIds.length
    ? await admin
        .from("courses")
        .select("id, title, course_code, category, total_hours")
        .in("id", courseIds as string[])
    : { data: [] as any[] };

  const enrich = (e: any) => ({
    ...e,
    course: (courses ?? []).find((c: any) => c.id === e.course_id) ?? null,
  });

  const completed = (enrollments ?? [])
    .filter((e) => e.status === "completed")
    .map(enrich);
  const inProgress = (enrollments ?? [])
    .filter((e) => e.status === "enrolled" && e.payment_status === "paid")
    .map(enrich);

  if (completedParam === "true") {
    return jsonResponse({
      source: "enrollments",
      member: { id: member.id, member_no: member.member_no, name: member.name },
      completed_courses: completed,
    });
  }
  if (completedParam === "false") {
    return jsonResponse({
      source: "enrollments",
      member: { id: member.id, member_no: member.member_no, name: member.name },
      in_progress_courses: inProgress,
    });
  }

  return jsonResponse({
    source: "enrollments",
    member: { id: member.id, member_no: member.member_no, name: member.name },
    completed_courses: completed,
    in_progress_courses: inProgress,
  });
});
