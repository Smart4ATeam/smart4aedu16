import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  jsonResponse,
  verifyUserToken,
} from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await verifyUserToken(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status ?? 401);
  }
  const userId = auth.userId!;

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const u = new URL(req.url);
  const conversationId = u.searchParams.get("conversation_id");

  try {
    // ===== Single conversation detail =====
    if (req.method === "GET" && conversationId) {
      const { data: participant } = await admin
        .from("conversation_participants")
        .select("id, starred, unread, archived, joined_at")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!participant) {
        return jsonResponse({ error: "無權限存取此對話" }, 403);
      }

      const [{ data: conversation }, { data: messages }] = await Promise.all([
        admin
          .from("conversations")
          .select("id, title, category, created_at, updated_at")
          .eq("id", conversationId)
          .maybeSingle(),
        admin
          .from("messages")
          .select("id, content, sender_id, is_system, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true }),
      ]);

      return jsonResponse({
        conversation,
        participant,
        messages: messages ?? [],
      });
    }

    // ===== List conversations =====
    if (req.method === "GET") {
      const filter = (u.searchParams.get("filter") ?? "all").toLowerCase();
      const category = u.searchParams.get("category");
      const limit = Math.min(
        Math.max(parseInt(u.searchParams.get("limit") ?? "50", 10) || 50, 1),
        200,
      );

      let q = admin
        .from("conversation_participants")
        .select(
          "id, conversation_id, starred, unread, archived, joined_at, conversations!inner(id, title, category, created_at, updated_at)",
        )
        .eq("user_id", userId);

      if (filter === "unread") q = q.eq("unread", true).eq("archived", false);
      else if (filter === "starred") q = q.eq("starred", true).eq("archived", false);
      else if (filter === "archived") q = q.eq("archived", true);
      else q = q.eq("archived", false); // all = non-archived

      if (category) {
        q = q.eq("conversations.category", category);
      }

      const { data, error } = await q.limit(limit);
      if (error) return jsonResponse({ error: error.message }, 500);

      const rows = (data ?? []) as any[];
      const convIds = rows.map((r) => r.conversation_id);

      // Fetch latest message per conversation
      let latestMap: Record<string, any> = {};
      if (convIds.length > 0) {
        const { data: msgs } = await admin
          .from("messages")
          .select("id, conversation_id, content, sender_id, is_system, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false });
        for (const m of msgs ?? []) {
          if (!latestMap[m.conversation_id]) latestMap[m.conversation_id] = m;
        }
      }

      const conversations = rows
        .map((r) => ({
          conversation_id: r.conversation_id,
          title: r.conversations?.title,
          category: r.conversations?.category,
          created_at: r.conversations?.created_at,
          updated_at: r.conversations?.updated_at,
          starred: r.starred,
          unread: r.unread,
          archived: r.archived,
          joined_at: r.joined_at,
          last_message: latestMap[r.conversation_id]
            ? {
                content: latestMap[r.conversation_id].content,
                sender_id: latestMap[r.conversation_id].sender_id,
                is_system: latestMap[r.conversation_id].is_system,
                created_at: latestMap[r.conversation_id].created_at,
              }
            : null,
        }))
        .sort(
          (a, b) =>
            new Date(b.updated_at ?? 0).getTime() -
            new Date(a.updated_at ?? 0).getTime(),
        );

      return jsonResponse({ conversations });
    }

    // ===== Update participant state =====
    if (req.method === "PATCH") {
      if (!conversationId) {
        return jsonResponse({ error: "缺少 conversation_id" }, 400);
      }
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const update: Record<string, boolean> = {};
      for (const k of ["starred", "unread", "archived"] as const) {
        if (typeof body?.[k] === "boolean") update[k] = body[k];
      }
      if (Object.keys(update).length === 0) {
        return jsonResponse(
          { error: "請提供 starred / unread / archived 之一（boolean）" },
          400,
        );
      }

      const { data: existing } = await admin
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        return jsonResponse({ error: "無權限或對話不存在" }, 403);
      }

      const { data, error } = await admin
        .from("conversation_participants")
        .update(update)
        .eq("id", existing.id)
        .select("id, conversation_id, starred, unread, archived")
        .maybeSingle();

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ participant: data });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
