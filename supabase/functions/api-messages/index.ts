import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("API_INTEGRATION_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, content, category, target_user_ids } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: "Missing required field: content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create conversation
    const { data: conversation, error: convError } = await adminClient
      .from("conversations")
      .insert({
        title: title || "系統通知",
        category: category || "system",
      })
      .select("id")
      .single();

    if (convError) throw convError;

    // Insert system message
    const { error: msgError } = await adminClient
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        content,
        is_system: true,
        sender_id: null,
      });

    if (msgError) throw msgError;

    // Add participants
    let userIds: string[] = target_user_ids || [];
    if (userIds.length === 0) {
      // Broadcast to all activated users
      const { data: users } = await adminClient
        .from("profiles")
        .select("id")
        .eq("activated", true);
      userIds = (users || []).map((u: { id: string }) => u.id);
    }

    if (userIds.length > 0) {
      const participants = userIds.map((uid: string) => ({
        conversation_id: conversation.id,
        user_id: uid,
        unread: true,
      }));

      const { error: partError } = await adminClient
        .from("conversation_participants")
        .insert(participants);

      if (partError) throw partError;
    }

    return new Response(JSON.stringify({
      success: true,
      data: { conversation_id: conversation.id, recipients: userIds.length },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
