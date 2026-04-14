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
    // Verify API key
    const apiKey = req.headers.get("x-api-key");
    if (!(await verifyApiKey(apiKey))) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { certificate_id, image_url, status } = body;

    if (!certificate_id) {
      return new Response(JSON.stringify({ error: "certificate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalStatus = status === "failed" ? "failed" : "issued";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const updateData: Record<string, string> = { status: finalStatus };
    if (image_url) {
      updateData.image_url = image_url;
    }

    const { data, error } = await adminClient
      .from("certificates")
      .update(updateData)
      .eq("id", certificate_id)
      .select("id, user_id, course_name, status")
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: `Certificate not found: ${certificate_id}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send notification to student
    if (finalStatus === "issued") {
      try {
        const { data: notifSettings } = await adminClient
          .from("notification_settings")
          .select("show_success")
          .eq("user_id", data.user_id)
          .single();

        const shouldNotify = notifSettings?.show_success !== false;

        if (shouldNotify) {
          const { data: conversation } = await adminClient
            .from("conversations")
            .insert({
              title: `🎓 ${data.course_name} 結訓證明已產生`,
              category: "system",
            })
            .select("id")
            .single();

          if (conversation) {
            await adminClient.from("messages").insert({
              conversation_id: conversation.id,
              content: `您的「${data.course_name}」結訓證明已產生，請至學習中心查看或下載。`,
              is_system: true,
              sender_id: null,
            });

            await adminClient.from("conversation_participants").insert({
              conversation_id: conversation.id,
              user_id: data.user_id,
              unread: true,
            });
          }
        }
      } catch (e) {
        console.error("Failed to send certificate notification:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: { certificate_id: data.id, status: finalStatus },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-certificate-callback error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
