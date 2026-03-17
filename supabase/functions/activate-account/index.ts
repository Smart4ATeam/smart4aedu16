import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, student_id, password } = await req.json();
    if (!email || !student_id || !password) {
      return new Response(JSON.stringify({ error: "請填寫所有欄位" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "密碼至少需要 6 個字元" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find pre-built profile matching email + student_id
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, display_name, email, student_id, organization_id")
      .eq("email", email)
      .eq("student_id", student_id)
      .eq("activated", false)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return new Response(JSON.stringify({ error: "找不到符合的學員資料，請確認 Email 與學員編號是否正確" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user (this will trigger handle_new_user which updates the profile)
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: profile.display_name,
        student_id: profile.student_id,
        organization_id: profile.organization_id,
      },
    });

    if (authError) {
      // If user already exists in auth
      if (authError.message?.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "此 Email 已經註冊過，請直接登入" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw authError;
    }

    return new Response(JSON.stringify({ message: "帳號啟用成功！請使用 Email 和密碼登入。" }), {
      status: 200,
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
