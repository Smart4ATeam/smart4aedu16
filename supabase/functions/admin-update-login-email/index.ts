import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, logAdminAction, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  let body: { user_id?: string; new_email?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

  const { user_id, new_email } = body;
  if (!user_id || !new_email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(new_email)) {
    return jsonResponse({ error: "user_id 與合法 new_email 為必填" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // 取得舊資料以便 log
  const { data: oldUser } = await admin.auth.admin.getUserById(user_id);
  const oldEmail = oldUser?.user?.email ?? null;

  // 1. 更新 auth.users.email（登入用）
  const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
    email: new_email,
    email_confirm: true,
  });
  if (authErr) return jsonResponse({ error: `更新登入 Email 失敗：${authErr.message}` }, 400);

  // 2. 同步 profiles.email
  await admin.from("profiles").update({ email: new_email, updated_at: new Date().toISOString() }).eq("id", user_id);

  // 3. 同步 reg_members.email（若有綁定）
  await admin.from("reg_members").update({ email: new_email }).eq("user_id", user_id);

  // 4. 寫操作日誌
  await logAdminAction({
    operatedBy: v.userId!,
    entityType: "auth_user",
    entityId: user_id,
    action: "update_login_email",
    reason: "後台變更登入 Email（三邊同步）",
    oldValue: { email: oldEmail },
    newValue: { email: new_email },
  });

  return jsonResponse({ ok: true, user_id, new_email });
});
