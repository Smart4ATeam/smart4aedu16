import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendWelcomeMessage(adminClient: any, userId: string, displayName: string) {
  try {
    const { data: settings } = await adminClient
      .from("notification_settings")
      .select("show_success")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings && settings.show_success === false) return;

    const { data: conv, error: convErr } = await adminClient
      .from("conversations")
      .insert({ title: "系統通知", category: "system" })
      .select("id")
      .single();

    if (convErr || !conv) return;

    await adminClient
      .from("conversation_participants")
      .insert({ conversation_id: conv.id, user_id: userId, unread: true });

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

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedSid = String(student_id).trim();

    let displayName = "";
    let organizationId: string | null = null;
    let prebuiltProfileId: string | null = null;
    let regMemberId: string | null = null;

    // Source A: pre-built profile (admin enrolled)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, display_name, email, student_id, organization_id")
      .ilike("email", normalizedEmail)
      .eq("student_id", normalizedSid)
      .eq("activated", false)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile) {
      displayName = profile.display_name;
      organizationId = profile.organization_id;
      prebuiltProfileId = profile.id;
    } else {
      // Source B: registration member (paid student) — match by email + member_no
      const { data: member, error: memberErr } = await adminClient
        .from("reg_members")
        .select("id, name, email, member_no, user_id")
        .ilike("email", normalizedEmail)
        .eq("member_no", normalizedSid)
        .maybeSingle();

      if (memberErr) throw memberErr;

      if (!member) {
        return new Response(JSON.stringify({ error: "找不到符合的學員資料，請確認 Email 與學員編號是否正確" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (member.user_id) {
        return new Response(JSON.stringify({ error: "此學員帳號已啟用，請直接登入" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      displayName = member.name;
      regMemberId = member.id;
    }

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        student_id: normalizedSid,
        ...(organizationId ? { organization_id: organizationId } : {}),
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

    const newUserId = authData?.user?.id;

    // If activating from a reg_member (no pre-built profile), bind member to new user
    // (this triggers sync_member_no_to_profile -> updates profiles.student_id)
    if (newUserId && regMemberId) {
      await adminClient
        .from("reg_members")
        .update({ user_id: newUserId })
        .eq("id", regMemberId);

      // Ensure profile has correct display_name & student_id
      await adminClient
        .from("profiles")
        .update({ display_name: displayName, student_id: normalizedSid, activated: true })
        .eq("id", newUserId);
    }

    if (newUserId) {
      await sendWelcomeMessage(adminClient, newUserId, displayName);
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
