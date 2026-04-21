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
  const includeCancelled = url.searchParams.get("include_cancelled") === "true";

  // 透過 reg_members 中介查詢，避免舊資料 user_id 為 NULL 找不到
  const { data: member } = await admin
    .from("reg_members")
    .select("id, member_no, name")
    .eq("user_id", v.userId!)
    .maybeSingle();

  if (!member) {
    return jsonResponse({ enrollments: [], member: null });
  }

  let q = admin
    .from("reg_enrollments")
    .select(
      "id, course_id, course_type, status, payment_status, session_date, checked_in, test_score, certificate, enrolled_at, paid_at, member_id, user_id",
    )
    .eq("member_id", member.id)
    .order("enrolled_at", { ascending: false });

  if (!includeCancelled) q = q.neq("status", "cancelled");

  const { data: enrollments, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  // 一次帶出對應課程資訊
  const courseIds = [...new Set((enrollments ?? []).map((e) => e.course_id).filter(Boolean))];
  const { data: courses } = courseIds.length
    ? await admin
        .from("courses")
        .select("id, title, course_code, category, total_hours")
        .in("id", courseIds as string[])
    : { data: [] as any[] };

  const enriched = (enrollments ?? []).map((e) => ({
    ...e,
    course: (courses ?? []).find((c: any) => c.id === e.course_id) ?? null,
  }));

  return jsonResponse({
    enrollments: enriched,
    member: { id: member.id, member_no: member.member_no, name: member.name },
  });
});
