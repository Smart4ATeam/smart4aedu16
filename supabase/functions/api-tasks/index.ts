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
    const { title, description, difficulty, amount, deadline, tags, status } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "Missing required field: title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const insertData: Record<string, unknown> = {
      title,
      description: description || "",
      difficulty: difficulty || "初級",
      amount: amount || 0,
      tags: tags || [],
      status: status || "available",
    };

    if (deadline) insertData.deadline = deadline;

    const { data, error } = await adminClient
      .from("tasks")
      .insert(insertData)
      .select("id, title, status")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
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
