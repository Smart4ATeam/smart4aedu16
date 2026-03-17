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
    // Verify API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("ENROLL_API_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, student_id, display_name } = await req.json();
    if (!email || !student_id || !display_name) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, student_id, display_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if profile already exists with this email
    const { data: existing } = await adminClient
      .from("profiles")
      .select("id, activated")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      if (existing.activated) {
        return new Response(JSON.stringify({ error: "此 email 已有啟用的帳號", exists: true }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Update existing pre-built profile
      const { error } = await adminClient
        .from("profiles")
        .update({ student_id, display_name })
        .eq("id", existing.id);
      if (error) throw error;
      return new Response(JSON.stringify({ message: "學員資料已更新", id: existing.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert new pre-built profile (with random UUID, will be replaced on activation)
    const { data, error } = await adminClient
      .from("profiles")
      .insert({
        id: crypto.randomUUID(),
        email,
        student_id,
        display_name,
        activated: false,
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ message: "學員資料已建立", id: data.id }), {
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
