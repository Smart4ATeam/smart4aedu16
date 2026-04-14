import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create user-scoped client to verify the JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { certificate_id } = body;

    if (!certificate_id) {
      return new Response(JSON.stringify({ error: "certificate_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use admin client to fetch certificate
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cert, error: certError } = await adminClient
      .from("certificates")
      .select("*")
      .eq("id", certificate_id)
      .eq("user_id", user.id)
      .single();

    if (certError || !cert) {
      console.error("Certificate lookup failed:", certError?.message, "cert_id:", certificate_id, "user_id:", user.id);
      return new Response(JSON.stringify({ error: "Certificate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If certificate has a quiz_attempt_id, check for _meta overrides
    if (cert.quiz_attempt_id) {
      const { data: attemptData } = await adminClient
        .from("quiz_attempts")
        .select("answers")
        .eq("id", cert.quiz_attempt_id)
        .maybeSingle();
      
      const meta = (attemptData?.answers as any)?._meta;
      if (meta) {
        const updates: any = {};
        if (meta.trainingDate && cert.training_date !== meta.trainingDate) {
          updates.training_date = meta.trainingDate;
        }
        if (meta.studentName && cert.student_name !== meta.studentName) {
          updates.student_name = meta.studentName;
        }
        if (Object.keys(updates).length > 0) {
          await adminClient.from("certificates").update(updates).eq("id", certificate_id);
          Object.assign(cert, updates);
        }
      }
    }

    // Fetch course total_hours and course_code
    const { data: course } = await adminClient
      .from("courses")
      .select("total_hours, course_code")
      .eq("id", cert.course_id)
      .maybeSingle();

    // Fetch student_id from profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("student_id")
      .eq("id", cert.user_id)
      .maybeSingle();

    if (cert.status !== "pending") {
      return new Response(JSON.stringify({ error: "Certificate already processed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read webhook URL from system_settings (cert_webhook_url)
    const { data: webhookSetting } = await adminClient
      .from("system_settings")
      .select("value")
      .eq("key_name", "cert_webhook_url")
      .maybeSingle();

    const webhookUrl = webhookSetting?.value?.trim() || Deno.env.get("MAKE_CERT_WEBHOOK_URL");

    if (!webhookUrl) {
      // No webhook configured — mark as failed
      await adminClient
        .from("certificates")
        .update({ status: "failed" })
        .eq("id", certificate_id);

      return new Response(JSON.stringify({ error: "Webhook URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URL for Make.com to call back
    const callbackUrl = `${supabaseUrl}/functions/v1/api-certificate-callback`;

    const webhookPayload = {
      action: "generate_certificate",
      certificate_id: cert.id,
      student_name: cert.student_name,
      student_id: profile?.student_id || null,
      course_name: cert.course_name,
      training_date: cert.training_date,
      total_hours: course?.total_hours || null,
      score: cert.score,
      suggested_filename: course?.course_code || "CERT",
      callback_url: callbackUrl,
    };

    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookRes.ok) {
      const errText = await webhookRes.text();
      console.error("Make.com webhook error:", errText);
      await adminClient
        .from("certificates")
        .update({ status: "failed" })
        .eq("id", certificate_id);

      return new Response(JSON.stringify({ error: "Webhook call failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume response body
    await webhookRes.text();

    return new Response(JSON.stringify({ success: true, certificate_id: cert.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("request-certificate error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
