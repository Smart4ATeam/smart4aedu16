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

  const adminUserId = v.userId!;

  const enrichLinked = async (ev: any) => {
    if (!ev?.session_id) return ev;
    const { data: sess } = await admin
      .from("course_sessions")
      .select("id, start_date, end_date, title_suffix, course_id, courses(title, course_code)")
      .eq("id", ev.session_id)
      .maybeSingle();
    return { ...ev, linked: true, session: sess ?? null };
  };

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const action = url.searchParams.get("action") ?? "list";

      if (action === "get") {
        const id = url.searchParams.get("id");
        if (!id) return jsonResponse({ error: "id 為必填" }, 400);
        const { data, error } = await admin.from("calendar_events").select("*").eq("id", id).maybeSingle();
        if (error) return jsonResponse({ error: error.message }, 500);
        if (!data) return jsonResponse({ error: "Event not found" }, 404);
        return jsonResponse({ event: await enrichLinked(data) });
      }

      // list
      const scope = (url.searchParams.get("scope") ?? "all").toLowerCase();
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const q = url.searchParams.get("q");
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100"), 500);
      const offset = parseInt(url.searchParams.get("offset") ?? "0");

      let query = admin.from("calendar_events").select("*", { count: "exact" }).order("event_date", { ascending: true });

      if (scope === "global") {
        query = query.eq("is_global", true).is("session_id", null);
      } else if (scope === "personal") {
        query = query.eq("user_id", adminUserId).eq("is_global", false);
      } else if (scope === "session") {
        query = query.not("session_id", "is", null);
      } else if (scope === "all") {
        // 全域 + 自己個人 + 連動：用 OR
        query = query.or(`and(is_global.eq.true,session_id.is.null),and(user_id.eq.${adminUserId},is_global.eq.false),session_id.not.is.null`);
      } else {
        return jsonResponse({ error: "scope 必須為 global|personal|session|all" }, 400);
      }

      if (dateFrom) query = query.gte("event_date", dateFrom);
      if (dateTo) query = query.lte("event_date", dateTo);
      if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) return jsonResponse({ error: error.message }, 500);

      const events = await Promise.all((data ?? []).map(enrichLinked));
      return jsonResponse({
        total: count ?? events.length,
        events,
        summary: {
          global: events.filter((e) => e.is_global && !e.session_id).length,
          personal: events.filter((e) => !e.is_global).length,
          linked: events.filter((e) => e.session_id).length,
        },
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action, confirm, confirm_delete, ...payload } = body;
      if (!action) return jsonResponse({ error: "action 為必填" }, 400);
      if (!confirm) return jsonResponse({ error: "需要 confirm:true（請先跟操作者確認）" }, 400);

      if (action === "create") {
        const { title, event_date, scope, event_time, end_time, description, color, reason } = payload;
        if (!title || !event_date || !scope) {
          return jsonResponse({ error: "title, event_date, scope 為必填" }, 400);
        }
        if (!["global", "personal"].includes(scope)) {
          return jsonResponse({ error: "scope 必須為 global 或 personal" }, 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
          return jsonResponse({ error: "event_date 必須為 YYYY-MM-DD" }, 400);
        }

        const insertRow: Record<string, unknown> = {
          title,
          event_date,
          event_time: event_time || null,
          end_time: end_time || null,
          description: description || null,
          color: color || "gradient-orange",
          is_global: scope === "global",
          user_id: scope === "personal" ? adminUserId : null,
          session_id: null,
        };

        const { data, error } = await admin.from("calendar_events").insert(insertRow).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({
          operatedBy: adminUserId,
          entityType: "calendar_event",
          entityId: data.id,
          action: "create",
          reason: reason ?? `Agent 建立行事曆活動 (${scope})`,
          newValue: data,
        });
        return jsonResponse({ success: true, event: data });
      }

      if (action === "update") {
        const { id, reason, scope, ...updates } = payload;
        if (!id) return jsonResponse({ error: "id 為必填" }, 400);

        const { data: oldRow } = await admin.from("calendar_events").select("*").eq("id", id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Event not found" }, 404);

        if (oldRow.session_id) {
          const enriched = await enrichLinked(oldRow);
          return jsonResponse({
            error: "LINKED_TO_SESSION",
            message: "此活動由課程梯次連動建立，請改至梯次管理 (api-admin-agent-sessions) 修改",
            event: enriched,
          }, 409);
        }

        // 允許修改的欄位
        const patch: Record<string, unknown> = {};
        for (const k of ["title", "event_date", "event_time", "end_time", "description", "color"]) {
          if (k in updates) patch[k] = updates[k] === "" ? null : updates[k];
        }
        if (scope) {
          if (!["global", "personal"].includes(scope)) {
            return jsonResponse({ error: "scope 必須為 global 或 personal" }, 400);
          }
          patch.is_global = scope === "global";
          patch.user_id = scope === "personal" ? adminUserId : null;
        }
        if (patch.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(patch.event_date))) {
          return jsonResponse({ error: "event_date 必須為 YYYY-MM-DD" }, 400);
        }
        if (Object.keys(patch).length === 0) {
          return jsonResponse({ error: "沒有提供任何要更新的欄位" }, 400);
        }

        const { data, error } = await admin.from("calendar_events").update(patch).eq("id", id).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({
          operatedBy: adminUserId,
          entityType: "calendar_event",
          entityId: id,
          action: "update",
          reason: reason ?? "Agent 修改行事曆活動",
          oldValue: oldRow,
          newValue: data,
        });
        return jsonResponse({ success: true, event: data });
      }

      if (action === "delete") {
        const { id, reason } = payload;
        if (!id) return jsonResponse({ error: "id 為必填" }, 400);
        if (!confirm_delete) return jsonResponse({ error: "刪除需 confirm_delete:true（雙確認）" }, 400);

        const { data: oldRow } = await admin.from("calendar_events").select("*").eq("id", id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Event not found" }, 404);

        if (oldRow.session_id) {
          const enriched = await enrichLinked(oldRow);
          return jsonResponse({
            error: "LINKED_TO_SESSION",
            message: "此活動由課程梯次連動建立，請改至梯次管理 (api-admin-agent-sessions) 將狀態改為 scheduled 或刪除整個梯次",
            event: enriched,
          }, 409);
        }

        const { error } = await admin.from("calendar_events").delete().eq("id", id);
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({
          operatedBy: adminUserId,
          entityType: "calendar_event",
          entityId: id,
          action: "delete",
          reason: reason ?? "Agent 刪除行事曆活動",
          oldValue: oldRow,
        });
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
