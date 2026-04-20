import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyUserToken, jsonResponse, corsHeaders } from "./verify-user-token.ts";

export { jsonResponse, corsHeaders };

export interface AdminVerifyResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

/**
 * 驗證 Bearer token + 該 user 必須是 admin。
 */
export async function verifyAdminToken(req: Request): Promise<AdminVerifyResult> {
  const v = await verifyUserToken(req);
  if (!v.ok || !v.userId) {
    return { ok: false, status: v.status ?? 401, error: v.error ?? "Unauthorized" };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const { data, error } = await admin.rpc("has_role", {
    _user_id: v.userId,
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
