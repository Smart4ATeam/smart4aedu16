import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, jsonResponse, corsHeaders, logAdminAction } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status);

  const body = await req.json().catch(() => ({}));
  const memberNo = typeof body?.member_no === "string" ? body.member_no.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const newPassword = typeof body?.new_password === "string" ? body.new_password : "";
  const confirm = body?.confirm === true;

  if (!confirm) return jsonResponse({ error: "必須帶 confirm: true，且需先取得操作者確認" }, 400);
  if (!memberNo && !email) return jsonResponse({ error: "需要提供 member_no 或 email" }, 400);
  if (!newPassword || newPassword.length < 6) {
    return jsonResponse({ error: "new_password 至少 6 字元" }, 400);
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, serviceKey);

  let q = admin.from("reg_members").select("id, member_no, name, email, user_id").limit(1);
  if (memberNo) q = q.eq("member_no", memberNo);
  else q = q.eq("email", email);
  const { data: member, error: mErr } = await q.maybeSingle();
  if (mErr) return jsonResponse({ error: mErr.message }, 500);
  if (!member) return jsonResponse({ error: "找不到該學員" }, 404);
  if (!member.user_id) {
    return jsonResponse({ error: "該學員尚未啟用帳號（無對應登入用戶），無法重設密碼" }, 400);
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(member.user_id, {
    password: newPassword,
  });
  if (updErr) return jsonResponse({ error: "更新密碼失敗：" + updErr.message }, 500);

  await logAdminAction({
    operatedBy: v.userId!,
    entityType: "member",
    entityId: member.id,
    action: "password_reset",
    reason: "Admin Agent 重設密碼",
    newValue: { member_no: member.member_no, by_user_id: v.userId },
  });

  return jsonResponse({
    success: true,
    member_no: member.member_no,
    name: member.name,
    email: member.email,
    notice: "請主動通知學員新密碼，系統不會自動寄信。",
  });
});
