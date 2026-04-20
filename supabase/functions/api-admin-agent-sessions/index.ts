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
      const courseId = url.searchParams.get("course_id");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const status = url.searchParams.get("status");

      if (id) {
        const { data, error } = await admin.from("course_sessions").select("*, courses(title, course_code)").eq("id", id).maybeSingle();
        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Session not found" }, 404);
        return jsonResponse({ session: data });
      }

      let query = admin.from("course_sessions").select("*, courses(title, course_code)").order("start_date", { ascending: false });
      if (courseId) query = query.eq("course_id", courseId);
      if (status) query = query.eq("status", status);
      if (dateFrom) query = query.gte("start_date", dateFrom);
      if (dateTo) query = query.lte("start_date", dateTo);
      const { data, error } = await query.limit(200);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ sessions: data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action, confirm, confirm_delete, ...payload } = body;
      if (!confirm) return jsonResponse({ error: "需要 confirm:true（請先跟操作者確認）" }, 400);

      if (action === "create") {
        if (!payload.course_id || !payload.start_date || !payload.end_date) {
          return jsonResponse({ error: "course_id, start_date, end_date 為必填" }, 400);
        }
        const { data, error } = await admin.from("course_sessions").insert(payload).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "session", entityId: data.id, action: "create", reason: payload.reason ?? "Agent 建立梯次", newValue: data });
        return jsonResponse({ success: true, session: data });
      }

      if (action === "update") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        const { id, reason, ...updates } = payload;
        const { data: oldRow } = await admin.from("course_sessions").select("*").eq("id", id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Session not found" }, 404);
        const { data, error } = await admin.from("course_sessions").update(updates).eq("id", id).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "session", entityId: id, action: "update", reason: reason ?? "Agent 修改梯次", oldValue: oldRow, newValue: data });
        return jsonResponse({ success: true, session: data });
      }

      if (action === "delete") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        if (!confirm_delete) return jsonResponse({ error: "刪除需 confirm_delete:true（雙確認）" }, 400);
        const { data: oldRow } = await admin.from("course_sessions").select("*").eq("id", payload.id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Session not found" }, 404);

        const { count: enrollCount } = await admin.from("reg_enrollments")
          .select("id", { count: "exact", head: true })
          .eq("session_id", payload.id)
          .neq("status", "cancelled");
        if ((enrollCount ?? 0) > 0) {
          return jsonResponse({
            error: "HAS_ENROLLMENTS",
            message: `無法刪除：該梯次有 ${enrollCount} 筆有效報名`,
            enrollment_count: enrollCount,
          }, 409);
        }

        const { error } = await admin.from("course_sessions").delete().eq("id", payload.id);
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "session", entityId: payload.id, action: "delete", reason: payload.reason ?? "Agent 刪除梯次", oldValue: oldRow });
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
