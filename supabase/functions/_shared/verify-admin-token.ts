import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse, corsHeaders, verifyUserToken } from "./verify-user-token.ts";

export { jsonResponse, corsHeaders };

export interface AdminVerifyResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

/**
 * 驗證 Admin token。支援兩種來源：
 * 1) sk_xxx：自家 user_api_tokens（與學員端相同），驗完再檢查 admin role
 * 2) Supabase session JWT：直接 auth.getUser()，再檢查 admin role
 *
 * 這樣管理員可以用同一組 sk_xxx token 同時操作學員端 + 管理員端 API。
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

  let userId: string | undefined;

  if (token.startsWith("sk_")) {
    // 走自家 token 表
    const r = await verifyUserToken(req);
    if (!r.ok) return { ok: false, status: r.status ?? 401, error: r.error ?? "Invalid token" };
    userId = r.userId;
  } else {
    // 當作 Supabase session JWT
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { ok: false, status: 401, error: "Invalid session token" };
    }
    userId = userData.user.id;
  }

  if (!userId) {
    return { ok: false, status: 401, error: "No user resolved from token" };
  }

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

  return { ok: true, userId };
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
