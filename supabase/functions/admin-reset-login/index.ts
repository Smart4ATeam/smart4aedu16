import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, logAdminAction, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  let body: { user_id?: string; reason?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, reason } = body;
  if (!user_id || !reason || reason.trim().length < 2) {
    return jsonResponse({ error: "user_id 與 reason 為必填（reason 至少 2 字）" }, 400);
  }

  if (user_id === v.userId) {
    return jsonResponse({ error: "不能重置自己的登入帳號" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // 取得舊資料以便 log
  const { data: oldUser } = await admin.auth.admin.getUserById(user_id);
  const oldEmail = oldUser?.user?.email ?? null;

  const { data: oldProfile } = await admin
    .from("profiles")
    .select("display_name, email, student_id")
    .eq("id", user_id)
    .maybeSingle();

  const { data: oldMembers } = await admin
    .from("reg_members")
    .select("id, member_no, name, email")
    .eq("user_id", user_id);

  // 1) 解除 reg_members.user_id 綁定（可能多筆）
  const { error: unbindErr } = await admin
    .from("reg_members")
    .update({ user_id: null })
    .eq("user_id", user_id);
  if (unbindErr) {
    return jsonResponse({ error: `解除報名綁定失敗：${unbindErr.message}` }, 500);
  }

  // 2) 清 user_roles
  await admin.from("user_roles").delete().eq("user_id", user_id);

  // 3) 清 notification_settings
  await admin.from("notification_settings").delete().eq("user_id", user_id);

  // 4) 清 profile
  const { error: profErr } = await admin.from("profiles").delete().eq("id", user_id);
  if (profErr) {
    // 不致命，繼續
    console.warn("delete profile failed:", profErr.message);
  }

  // 5) 刪除 auth user
  const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
  if (delErr) {
    return jsonResponse({ error: `刪除登入帳號失敗：${delErr.message}` }, 500);
  }

  // 6) 寫操作日誌
  await logAdminAction({
    operatedBy: v.userId!,
    entityType: "auth_user",
    entityId: user_id,
    action: "reset_login_account",
    reason,
    oldValue: {
      email: oldEmail,
      profile: oldProfile,
      reg_members: oldMembers,
    },
    newValue: { deleted: true, unbound_member_count: oldMembers?.length ?? 0 },
  });

  return jsonResponse({
    ok: true,
    deleted_user_id: user_id,
    deleted_email: oldEmail,
    unbound_member_count: oldMembers?.length ?? 0,
  });
});
