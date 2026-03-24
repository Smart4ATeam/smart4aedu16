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
    const expectedKey = Deno.env.get("API_INTEGRATION_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, name, phone, course_code, session_date, paid, notes } = body;

    if (!email || !name || !course_code) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, name, course_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find or create profile by email
    let userId: string;
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      userId = existingProfile.id;
    } else {
      // Create unactivated profile
      const newId = crypto.randomUUID();
      const { error: profileError } = await adminClient
        .from("profiles")
        .insert({
          id: newId,
          email,
          display_name: name,
          phone: phone || null,
          activated: false,
        });
      if (profileError) throw profileError;
      userId = newId;
    }

    // 2. Find course by category (course_code)
    const { data: course } = await adminClient
      .from("courses")
      .select("id")
      .eq("category", course_code)
      .maybeSingle();

    if (!course) {
      return new Response(JSON.stringify({ error: `Course not found for code: ${course_code}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Find session: by date if provided, otherwise nearest open session
    let sessionId: string | null = null;

    if (session_date) {
      const { data: sessionByDate } = await adminClient
        .from("course_sessions")
        .select("id")
        .eq("course_id", course.id)
        .eq("start_date", session_date)
        .neq("status", "cancelled")
        .maybeSingle();
      if (sessionByDate) sessionId = sessionByDate.id;
    }

    if (!sessionId) {
      const { data: openSession } = await adminClient
        .from("course_sessions")
        .select("id")
        .eq("course_id", course.id)
        .eq("status", "open")
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (openSession) sessionId = openSession.id;
    }

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "No matching session found for this course" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create enrollment
    const { data: enrollment, error: enrollError } = await adminClient
      .from("course_enrollments")
      .insert({
        user_id: userId,
        session_id: sessionId,
        status: "pending",
        paid: paid || false,
      })
      .select("id")
      .single();

    if (enrollError) {
      if (enrollError.message.includes("duplicate") || enrollError.message.includes("unique")) {
        return new Response(JSON.stringify({ error: "此學員已報名該梯次", exists: true }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw enrollError;
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        enrollment_id: enrollment.id,
        user_id: userId,
        session_id: sessionId,
        message: "報名資料已建立",
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Enrollment callback error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
