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
    // Auth via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json();
    const { resource_id } = body;
    if (!resource_id) {
      return new Response(JSON.stringify({ error: "resource_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch resource
    const { data: resource, error: resErr } = await adminClient
      .from("resources")
      .select("id, title, category, app_id, trial_enabled")
      .eq("id", resource_id)
      .single();

    if (resErr || !resource) {
      return new Response(JSON.stringify({ error: "Resource not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resource.trial_enabled) {
      return new Response(JSON.stringify({ error: "此資源未開放試用" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!resource.app_id) {
      return new Response(JSON.stringify({ error: "此資源尚未設定 APP ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check user profile for organization_id and student_id
    const { data: profile } = await adminClient
      .from("profiles")
      .select("organization_id, student_id")
      .eq("id", userId)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "請先在設定頁面填寫組織編號（Organization ID）" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2b. Resolve member_no: prefer profile.student_id, fallback to reg_members.member_no
    let memberNo = profile.student_id || null;
    if (!memberNo) {
      const { data: regMember } = await adminClient
        .from("reg_members")
        .select("member_no")
        .eq("user_id", userId)
        .single();
      if (regMember?.member_no) {
        memberNo = regMember.member_no;
      }
    }

    // 3. Check daily limit (1 per category per day, Taiwan time UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000;
    const taiwanNow = new Date(now.getTime() + taiwanOffset);
    const todayStr = taiwanNow.toISOString().slice(0, 10);
    // Start of today in UTC
    const todayStartUTC = new Date(new Date(todayStr + "T00:00:00+08:00").getTime());
    const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);

    const { count: todayCount } = await adminClient
      .from("resource_trials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resource_category", resource.category)
      .gte("created_at", todayStartUTC.toISOString())
      .lt("created_at", todayEndUTC.toISOString());

    if (todayCount && todayCount > 0) {
      const catLabel = resource.category === "extensions" ? "套件" : "模板";
      return new Response(JSON.stringify({ error: `今日已領用過一個${catLabel}，明天再來吧！` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Insert trial record
    const { data: trial, error: trialErr } = await adminClient
      .from("resource_trials")
      .insert({
        user_id: userId,
        resource_id: resource.id,
        member_no: memberNo,
        organization_id: profile.organization_id,
        app_id: resource.app_id,
        resource_category: resource.category,
      })
      .select("id")
      .single();

    if (trialErr) throw trialErr;

    // 6. Send webhook
    let webhookStatus = "no_webhook";
    try {
      const { data: setting } = await adminClient
        .from("system_settings")
        .select("value")
        .eq("key_name", "trial_webhook_url")
        .single();

      if (setting?.value) {
        const webhookPayload = {
          organization_id: profile.organization_id,
          app_id: resource.app_id,
          member_no: profile.student_id || null,
          category: resource.category,
          resource_title: resource.title,
          trial_id: trial.id,
        };

        const resp = await fetch(setting.value, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload),
        });

        webhookStatus = resp.ok ? "sent" : "failed";
      }
    } catch (e) {
      console.error("Webhook error:", e);
      webhookStatus = "failed";
    }

    // Update webhook status
    await adminClient
      .from("resource_trials")
      .update({ webhook_status: webhookStatus })
      .eq("id", trial.id);

    return new Response(JSON.stringify({
      success: true,
      data: {
        trial_id: trial.id,
        resource_title: resource.title,
        app_id: resource.app_id,
        webhook_status: webhookStatus,
        message: "領用成功！等待金鑰回傳中",
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-resource-trial error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
