import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyUserToken, corsHeaders, jsonResponse } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await verifyUserToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50") || 50, 200);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    let query = admin
      .from("resource_trials")
      .select(
        "id, resource_id, resource_category, app_id, member_no, organization_id, api_key, webhook_status, created_at, resources!inner(title)",
      )
      .eq("user_id", auth.userId!)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      const allowed = ["pending", "completed", "failed", "sent", "no_webhook"];
      if (!allowed.includes(status)) {
        return jsonResponse({ error: "Invalid status", allowed }, 400);
      }
      query = query.eq("webhook_status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const trials = (data ?? []).map((t: any) => ({
      trial_id: t.id,
      resource_id: t.resource_id,
      resource_title: t.resources?.title ?? null,
      resource_category: t.resource_category,
      app_id: t.app_id,
      member_no: t.member_no,
      organization_id: t.organization_id,
      api_key: t.api_key,
      webhook_status: t.webhook_status,
      created_at: t.created_at,
      note:
        t.resource_category === "templates" && t.api_key
          ? "範本下載連結 24 小時內有效"
          : undefined,
    }));

    return jsonResponse({ trials });
  } catch (err: unknown) {
    console.error("api-agent-my-trials error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
