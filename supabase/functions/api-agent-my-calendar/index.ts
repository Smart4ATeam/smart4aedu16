import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);
  const userId = v.userId!;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (req.method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const scope = (url.searchParams.get("scope") ?? "all").toLowerCase();

      let q = admin
        .from("calendar_events")
        .select("id, title, description, event_date, event_time, color, is_global, user_id, created_at")
        .order("event_date", { ascending: true });

      if (scope === "own") q = q.eq("is_global", false).eq("user_id", userId);
      else if (scope === "global") q = q.eq("is_global", true);
      else q = q.or(`is_global.eq.true,user_id.eq.${userId}`);

      if (from) q = q.gte("event_date", from);
      if (to) q = q.lte("event_date", to);

      const { data, error } = await q;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ events: data });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const title = String(body?.title ?? "").trim();
      const event_date = String(body?.event_date ?? "").trim();
      if (!title || !event_date) {
        return jsonResponse({ error: "title 與 event_date 為必填" }, 400);
      }
      const insertData: Record<string, unknown> = {
        user_id: userId,
        is_global: false,
        title,
        event_date,
        description: body?.description ?? "",
        color: body?.color ?? "gradient-orange",
      };
      if (body?.event_time) insertData.event_time = body.event_time;

      const { data, error } = await admin
        .from("calendar_events")
        .insert(insertData)
        .select("id, title, description, event_date, event_time, color, is_global, user_id, created_at")
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ event: data }, 201);
    }

    if (req.method === "PATCH") {
      if (!id) return jsonResponse({ error: "缺少 id 參數" }, 400);
      const body = await req.json().catch(() => ({}));

      // 確認事件存在且屬於本人 + 非全域
      const { data: existing, error: fetchErr } = await admin
        .from("calendar_events")
        .select("id, user_id, is_global")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) return jsonResponse({ error: fetchErr.message }, 500);
      if (!existing) return jsonResponse({ error: "事件不存在" }, 404);
      if (existing.is_global || existing.user_id !== userId) {
        return jsonResponse({ error: "無權限修改此事件" }, 403);
      }

      const updates: Record<string, unknown> = {};
      for (const k of ["title", "event_date", "event_time", "description", "color"]) {
        if (body?.[k] !== undefined) updates[k] = body[k];
      }
      if (Object.keys(updates).length === 0) {
        return jsonResponse({ error: "沒有可更新欄位" }, 400);
      }

      const { data, error } = await admin
        .from("calendar_events")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .eq("is_global", false)
        .select("id, title, description, event_date, event_time, color, is_global, user_id, created_at")
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ event: data });
    }

    if (req.method === "DELETE") {
      if (!id) return jsonResponse({ error: "缺少 id 參數" }, 400);

      const { data: existing, error: fetchErr } = await admin
        .from("calendar_events")
        .select("id, user_id, is_global")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) return jsonResponse({ error: fetchErr.message }, 500);
      if (!existing) return jsonResponse({ error: "事件不存在" }, 404);
      if (existing.is_global || existing.user_id !== userId) {
        return jsonResponse({ error: "無權限刪除此事件" }, 403);
      }

      const { error } = await admin
        .from("calendar_events")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("is_global", false);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
