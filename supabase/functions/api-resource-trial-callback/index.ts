import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyApiKey } from "../_shared/verify-api-key.ts";

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
    if (!(await verifyApiKey(apiKey))) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { trial_id, api_key } = body;

    if (!trial_id || !api_key) {
      return new Response(JSON.stringify({ error: "trial_id and api_key are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await adminClient
      .from("resource_trials")
      .update({ api_key, webhook_status: "completed" })
      .eq("id", trial_id)
      .select("id, resource_id, user_id")
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: `Trial not found: ${trial_id}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification to the student's message center
    try {
      // Get resource title
      const { data: resource } = await adminClient
        .from("resources")
        .select("title")
        .eq("id", data.resource_id)
        .single();

      const resourceTitle = resource?.title || "資源";

      // Create conversation
      const { data: conversation, error: convErr } = await adminClient
        .from("conversations")
        .insert({
          title: `🔑 ${resourceTitle} 金鑰已到`,
          category: "system",
        })
        .select("id")
        .single();

      if (conversation && !convErr) {
        // Insert system message
        await adminClient.from("messages").insert({
          conversation_id: conversation.id,
          content: `您領用的「${resourceTitle}」已收到 API Key，請至資源中心「我的試用」分頁查看。`,
          is_system: true,
          sender_id: null,
        });

        // Add student as participant
        await adminClient.from("conversation_participants").insert({
          conversation_id: conversation.id,
          user_id: data.user_id,
          unread: true,
        });
      }
    } catch (e) {
      console.error("Failed to send notification:", e);
    }

    return new Response(JSON.stringify({
      success: true,
      data: { trial_id: data.id, message: "API Key 已更新", key: api_key },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-resource-trial-callback error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
