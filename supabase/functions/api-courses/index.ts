import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: x-api-key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("API_INTEGRATION_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const action = body.action || "create_course";

    if (action === "create_course") {
      const { title, description, category, tags, price, total_hours, instructor_id, status } = body;
      if (!title) return new Response(JSON.stringify({ error: "title is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data, error } = await supabase.from("courses").insert({
        title, description: description || "", category: category || "basic",
        tags: tags || [], price: price || 0, total_hours: total_hours || 0,
        instructor_id: instructor_id || null, status: status || "draft",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create_session") {
      const { course_id, title_suffix, start_date, end_date, location, max_students, schedule_type, status } = body;
      if (!course_id) return new Response(JSON.stringify({ error: "course_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data, error } = await supabase.from("course_sessions").insert({
        course_id, title_suffix: title_suffix || "", start_date, end_date,
        location: location || "", max_students: max_students || null,
        schedule_type: schedule_type || "recurring", status: status || "scheduled",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use 'create_course' or 'create_session'" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
