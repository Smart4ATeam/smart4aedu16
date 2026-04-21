import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveRecipients, getAdminClient, type RecipientFilter } from "../_shared/resolve-recipients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing Bearer token" }, 401);
    }
    const token = authHeader.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = getAdminClient();

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return jsonResponse({ error: "Forbidden: admin role required" }, 403);

    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const body = await req.json();
    const { title, content, category, recipient_filter, confirm } = body as {
      title?: string;
      content?: string;
      category?: string;
      recipient_filter?: RecipientFilter;
      confirm?: boolean;
    };

    if (!content) return jsonResponse({ error: "Missing required field: content" }, 400);
    if (!recipient_filter?.mode) return jsonResponse({ error: "Missing recipient_filter.mode" }, 400);
    if (confirm !== true) return jsonResponse({ error: "confirm must be true" }, 400);

    // 1. resolve recipients
    const { user_ids } = await resolveRecipients(admin, recipient_filter);

    // 2. create conversation with audit fields
    const { data: conversation, error: convErr } = await admin
      .from("conversations")
      .insert({
        title: title || "系統通知",
        category: category || "system",
        broadcast_filter: recipient_filter as unknown as Record<string, unknown>,
        recipient_count: user_ids.length,
        created_by: userId,
      })
      .select("id")
      .single();
    if (convErr) throw convErr;

    // 3. insert system message
    const { error: msgErr } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      content,
      is_system: true,
      sender_id: null,
    });
    if (msgErr) throw msgErr;

    // 4. insert participants
    if (user_ids.length > 0) {
      const participants = user_ids.map((uid) => ({
        conversation_id: conversation.id,
        user_id: uid,
        unread: true,
      }));
      const { error: partErr } = await admin.from("conversation_participants").insert(participants);
      if (partErr) throw partErr;
    }

    return jsonResponse({
      success: true,
      data: { conversation_id: conversation.id, recipients: user_ids.length },
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
