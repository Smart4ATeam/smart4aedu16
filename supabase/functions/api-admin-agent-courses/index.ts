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
      const status = url.searchParams.get("status");

      if (id) {
        const { data, error } = await admin.from("courses").select("*").eq("id", id).maybeSingle();
        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Course not found" }, 404);
        return jsonResponse({ course: data });
      }

      let query = admin.from("courses").select("id, course_code, title, category, status, price, enrollment_points, sort_order").order("sort_order");
      if (status) query = query.eq("status", status);
      if (q) query = query.or(`title.ilike.%${q}%,course_code.ilike.%${q}%`);
      const { data, error } = await query.limit(200);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ courses: data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action, confirm, confirm_delete, ...payload } = body;

      if (!confirm) return jsonResponse({ error: "需要 confirm:true（請先跟操作者確認）" }, 400);

      if (action === "create") {
        if (!payload.title) return jsonResponse({ error: "title 為必填" }, 400);
        const { data, error } = await admin.from("courses").insert(payload).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "course", entityId: data.id, action: "create", reason: payload.reason ?? "Agent 建立課程", newValue: data });
        return jsonResponse({ success: true, course: data });
      }

      if (action === "update") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        const { id, reason, ...updates } = payload;
        const { data: oldRow } = await admin.from("courses").select("*").eq("id", id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Course not found" }, 404);
        const { data, error } = await admin.from("courses").update(updates).eq("id", id).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "course", entityId: id, action: "update", reason: reason ?? "Agent 修改課程", oldValue: oldRow, newValue: data });
        return jsonResponse({ success: true, course: data });
      }

      if (action === "delete") {
        if (!payload.id) return jsonResponse({ error: "id 為必填" }, 400);
        if (!confirm_delete) return jsonResponse({ error: "刪除需 confirm_delete:true（雙確認）" }, 400);
        const { data: oldRow } = await admin.from("courses").select("*").eq("id", payload.id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Course not found" }, 404);

        // 檢查引用
        const [{ count: sessionCount }, { count: enrollCount }] = await Promise.all([
          admin.from("course_sessions").select("id", { count: "exact", head: true }).eq("course_id", payload.id),
          admin.from("reg_enrollments").select("id", { count: "exact", head: true }).eq("course_id", payload.id),
        ]);
        if ((sessionCount ?? 0) > 0 || (enrollCount ?? 0) > 0) {
          return jsonResponse({
            error: "HAS_REFERENCES",
            message: `無法刪除：該課程有 ${sessionCount ?? 0} 個梯次、${enrollCount ?? 0} 筆報名紀錄`,
            session_count: sessionCount ?? 0,
            enrollment_count: enrollCount ?? 0,
          }, 409);
        }

        const { error } = await admin.from("courses").delete().eq("id", payload.id);
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({ operatedBy: v.userId!, entityType: "course", entityId: payload.id, action: "delete", reason: payload.reason ?? "Agent 刪除課程", oldValue: oldRow });
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
