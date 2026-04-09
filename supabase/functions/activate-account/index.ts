import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendWelcomeMessage(adminClient: any, userId: string, displayName: string) {
  try {
    // Check notification settings - welcome is a "success" type
    const { data: settings } = await adminClient
      .from("notification_settings")
      .select("show_success")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings && settings.show_success === false) return;

    // Create a system conversation for this user
    const { data: conv, error: convErr } = await adminClient
      .from("conversations")
      .insert({ title: "系統通知", category: "system" })
      .select("id")
      .single();

    if (convErr || !conv) return;

    // Add user as participant
    await adminClient
      .from("conversation_participants")
      .insert({ conversation_id: conv.id, user_id: userId, unread: true });

    // Send welcome message
    await adminClient.from("messages").insert({
      conversation_id: conv.id,
      content: `🎉 歡迎加入 Smart4A！\n\n${displayName} 您好，您的帳號已成功啟用。\n\n您現在可以開始使用系統的各項功能，包括學習課程、領取資源、接案任務等。\n\n祝您學習愉快！`,
      is_system: true,
      sender_id: null,
    });
  } catch (e) {
    console.error("Failed to send welcome message:", e);
  }
}

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
      if (authError.message?.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "此 Email 已經註冊過，請直接登入" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw authError;
    }

    // Send welcome message to the new user
    if (authData?.user) {
      await sendWelcomeMessage(adminClient, authData.user.id, profile.display_name);
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
