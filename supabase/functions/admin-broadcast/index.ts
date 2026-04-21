import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ error: "Missing Bearer token" }, 401);
    }
    const token = authHeader.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return jsonResponse({ error: "Forbidden: admin role required" }, 403);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const { title, content, category } = body;
    if (!content) {
      return jsonResponse({ error: "Missing required field: content" }, 400);
    }

    // 1. Create system conversation
    const { data: conversation, error: convErr } = await admin
      .from("conversations")
      .insert({ title: title || "系統通知", category: category || "system" })
      .select("id")
      .single();
    if (convErr) throw convErr;

    // 2. Insert system message
    const { error: msgErr } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      content,
      is_system: true,
      sender_id: null,
    });
    if (msgErr) throw msgErr;

    // 3. Fetch all activated users
    const { data: users } = await admin
      .from("profiles")
      .select("id")
      .eq("activated", true);
    const userIds = (users || []).map((u: { id: string }) => u.id);

    // 4. Filter out users who disabled show_info
    let recipientIds = userIds;
    if (userIds.length > 0) {
      const { data: settings } = await admin
        .from("notification_settings")
        .select("user_id, show_info")
        .in("user_id", userIds);
      const disabled = new Set(
        (settings || [])
          .filter((s: { user_id: string; show_info: boolean }) => s.show_info === false)
          .map((s: { user_id: string }) => s.user_id)
      );
      recipientIds = userIds.filter((id: string) => !disabled.has(id));
    }

    // 5. Insert participants
    if (recipientIds.length > 0) {
      const participants = recipientIds.map((uid: string) => ({
        conversation_id: conversation.id,
        user_id: uid,
        unread: true,
      }));
      const { error: partErr } = await admin
        .from("conversation_participants")
        .insert(participants);
      if (partErr) throw partErr;
    }

    return jsonResponse({
      success: true,
      data: { conversation_id: conversation.id, recipients: recipientIds.length },
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
