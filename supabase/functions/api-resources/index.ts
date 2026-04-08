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

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { title, category, description, tags, author, difficulty, download_url, detail_url, thumbnail_url, duration, video_type, sub_category, version, flow_count, industry_tag, is_hot, status, hot_rank, usage_count, sort_order, app_id, trial_enabled } = body;

    if (!title) {
      return new Response(JSON.stringify({ error: "Missing required field: title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validCategories = ["extensions", "plugins", "templates", "videos"];
    if (category && !validCategories.includes(category)) {
      return new Response(JSON.stringify({ error: `Invalid category. Must be one of: ${validCategories.join(", ")}` }), {
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
      category: category || "plugins",
      description: description || "",
      tags: tags || [],
      author: author || "",
      difficulty: difficulty || "初級",
      status: status || "approved",
    };

    if (download_url) insertData.download_url = download_url;
    if (detail_url) insertData.detail_url = detail_url;
    if (thumbnail_url) insertData.thumbnail_url = thumbnail_url;
    if (app_id) insertData.app_id = app_id;
    if (trial_enabled !== undefined) insertData.trial_enabled = trial_enabled;
    if (duration) insertData.duration = duration;
    if (video_type) insertData.video_type = video_type;
    if (sub_category) insertData.sub_category = sub_category;
    if (version) insertData.version = version;
    if (flow_count !== undefined) insertData.flow_count = flow_count;
    if (industry_tag) insertData.industry_tag = industry_tag;
    if (is_hot !== undefined) insertData.is_hot = is_hot;
    if (hot_rank !== undefined) insertData.hot_rank = hot_rank;
    if (usage_count !== undefined) insertData.usage_count = usage_count;
    if (sort_order !== undefined) insertData.sort_order = sort_order;

    const { data, error } = await adminClient
      .from("resources")
      .insert(insertData)
      .select("id, title, category")
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
