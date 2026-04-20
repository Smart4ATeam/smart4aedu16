import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status);

  const url = new URL(req.url);
  const memberNo = url.searchParams.get("member_no");
  const email = url.searchParams.get("email");
  if (!memberNo && !email) {
    return jsonResponse({ error: "需要提供 member_no 或 email" }, 400);
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, serviceKey);

  let q = admin.from("reg_members").select("*").limit(1);
  if (memberNo) q = q.eq("member_no", memberNo);
  else q = q.eq("email", email!);
  const { data: member, error: mErr } = await q.maybeSingle();
  if (mErr) return jsonResponse({ error: mErr.message }, 500);
  if (!member) return jsonResponse({ error: "找不到該學員" }, 404);

  const [{ data: txs }, { data: enrollments }] = await Promise.all([
    admin
      .from("reg_point_transactions")
      .select("created_at, points_delta, type, description")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("reg_enrollments")
      .select("course_id, session_date, status, payment_status, checked_in, test_score, certificate")
      .eq("member_id", member.id)
      .order("enrolled_at", { ascending: false })
      .limit(20),
  ]);

  return jsonResponse({
    member: {
      member_id: member.id,
      member_no: member.member_no,
      name: member.name,
      email: member.email,
      phone: member.phone,
      points: member.points,
      course_level: member.course_level,
      notes: member.notes,
      created_at: member.created_at,
      user_id: member.user_id,
      account_activated: !!member.user_id,
    },
    recent_point_transactions: txs ?? [],
    enrollments: enrollments ?? [],
  });
});
