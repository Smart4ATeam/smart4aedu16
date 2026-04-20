import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, logAdminAction, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      const q = url.searchParams.get("q");

      if (id) {
        const { data, error } = await admin.from("partners").select("*").eq("id", id).maybeSingle();
        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Partner not found" }, 404);
        return jsonResponse({ partner: data });
      }

      let query = admin.from("partners").select("*").order("created_at", { ascending: false });
      if (q) query = query.or(`name.ilike.%${q}%,contact_name.ilike.%${q}%,contact_email.ilike.%${q}%`);
      const { data, error } = await query.limit(200);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ partners: data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action, confirm, confirm_delete, ...payload } = body;
      if (!confirm) return jsonResponse({ error: "需要 confirm:true（請先跟操作者確認）" }, 400);

      if (action === "create") {
        if (!payload.name) return jsonResponse({ error: "name 為必填" }, 400);
        const { data, error } = await admin.from("partners").insert(payload).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "partner", entityId: data.id, action: "create", reason: payload.reason ?? "Agent 建立合作單位", newValue: data });
        return jsonResponse({ success: true, partner: data });
      }

      if (action === "update") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        const { id, reason, ...updates } = payload;
        const { data: oldRow } = await admin.from("partners").select("*").eq("id", id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Partner not found" }, 404);
        const { data, error } = await admin.from("partners").update(updates).eq("id", id).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "partner", entityId: id, action: "update", reason: reason ?? "Agent 修改合作單位", oldValue: oldRow, newValue: data });
        return jsonResponse({ success: true, partner: data });
      }

      if (action === "delete") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        if (!confirm_delete) return jsonResponse({ error: "刪除需 confirm_delete:true（雙確認）" }, 400);
        const { data: oldRow } = await admin.from("partners").select("*").eq("id", payload.id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Partner not found" }, 404);

        const { count } = await admin.from("instructors").select("id", { count: "exact", head: true }).eq("partner_id", payload.id);
        if ((count ?? 0) > 0) {
          return jsonResponse({ error: "HAS_REFERENCES", message: `無法刪除：該合作單位有 ${count} 位講師`, instructor_count: count }, 409);
        }

        const { error } = await admin.from("partners").delete().eq("id", payload.id);
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "partner", entityId: payload.id, action: "delete", reason: payload.reason ?? "Agent 刪除合作單位", oldValue: oldRow });
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
