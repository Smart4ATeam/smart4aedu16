import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse, corsHeaders } from "./verify-user-token.ts";

export { jsonResponse, corsHeaders };

export interface AdminVerifyResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

/**
 * 驗證 Bearer Supabase session JWT + 該 user 必須是 admin。
 * 適用於前端用 session.access_token 呼叫的後台管理功能。
 */
export async function verifyAdminToken(req: Request): Promise<AdminVerifyResult> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const token = auth.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: "Empty token" };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // 用 service role 驗 JWT 取得 user
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid session token" };
  }
  const userId = userData.user.id;

  const { data, error } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    return { ok: false, status: 500, error: "Role check failed" };
  }
  if (!data) {
    return { ok: false, status: 403, error: "Forbidden: admin role required" };
  }

  return { ok: true, userId: v.userId };
}

export async function logAdminAction(params: {
  operatedBy: string;
  entityType: string;
  entityId: string;
  action: string;
  reason: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  await admin.from("reg_operation_logs").insert({
    operated_by: params.operatedBy,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    reason: params.reason,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
}
