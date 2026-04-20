import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, jsonResponse, corsHeaders, logAdminAction } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status);

  const body = await req.json().catch(() => ({}));
  const memberNo = typeof body?.member_no === "string" ? body.member_no.trim() : "";
  const pointsDelta = body?.points_delta;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const confirm = body?.confirm === true;

  if (!confirm) return jsonResponse({ error: "必須帶 confirm: true，且需先取得操作者確認" }, 400);
  if (!memberNo) return jsonResponse({ error: "需要提供 member_no" }, 400);
  if (typeof pointsDelta !== "number" || !Number.isInteger(pointsDelta) || pointsDelta === 0) {
    return jsonResponse({ error: "points_delta 必須為非零整數（正=加、負=扣）" }, 400);
  }
  if (!reason || reason.length > 200) {
    return jsonResponse({ error: "reason 必填且不超過 200 字" }, 400);
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, serviceKey);

  const { data: member, error: mErr } = await admin
    .from("reg_members")
    .select("id, member_no, name, points")
    .eq("member_no", memberNo)
    .maybeSingle();
  if (mErr) return jsonResponse({ error: mErr.message }, 500);
  if (!member) return jsonResponse({ error: "找不到該學員" }, 404);

  const pointsBefore = member.points ?? 0;

  const { error: txErr } = await admin.from("reg_point_transactions").insert({
    member_id: member.id,
    points_delta: pointsDelta,
    type: pointsDelta > 0 ? "earned" : "adjusted",
    description: reason,
  });
  if (txErr) return jsonResponse({ error: "寫入點數紀錄失敗：" + txErr.message }, 500);

  // 觸發器會自動同步 reg_members.points，這裡讀回最新值
  const { data: after } = await admin
    .from("reg_members")
    .select("points")
    .eq("id", member.id)
    .maybeSingle();
  const pointsAfter = after?.points ?? pointsBefore + pointsDelta;

  await logAdminAction({
    operatedBy: v.userId!,
    entityType: "member",
    entityId: member.id,
    action: "points_adjust",
    reason,
    oldValue: { points: pointsBefore },
    newValue: { points: pointsAfter, delta: pointsDelta },
  });

  return jsonResponse({
    success: true,
    member_no: member.member_no,
    name: member.name,
    points_before: pointsBefore,
    points_after: pointsAfter,
    points_delta: pointsDelta,
  });
});
