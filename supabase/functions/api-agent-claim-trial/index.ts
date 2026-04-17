import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyUserToken, corsHeaders, jsonResponse } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await verifyUserToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const userId = auth.userId!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const resource_id = body?.resource_id;
    if (!resource_id) {
      return jsonResponse({ error: "resource_id is required", code: "MISSING_RESOURCE_ID" }, 400);
    }

    // 1. Resource
    const { data: resource } = await admin
      .from("resources")
      .select("id, title, category, app_id, trial_enabled, template_file_path, status")
      .eq("id", resource_id)
      .maybeSingle();

    if (!resource || resource.status !== "approved") {
      return jsonResponse({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, 404);
    }
    if (!resource.trial_enabled) {
      return jsonResponse({ error: "此資源未開放試用", code: "TRIAL_DISABLED" }, 400);
    }

    const isTemplate = resource.category === "templates";
    if (isTemplate && !resource.template_file_path) {
      return jsonResponse({ error: "此範本尚未上傳檔案", code: "NO_TEMPLATE_FILE" }, 400);
    }
    if (!isTemplate && !resource.app_id) {
      return jsonResponse({ error: "此資源尚未設定 APP ID", code: "NO_APP_ID" }, 400);
    }

    // 2. Profile
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id, student_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.organization_id) {
      return jsonResponse(
        {
          error: "請先在設定頁面填寫組織編號（Organization ID）",
          code: "MISSING_ORG_ID",
        },
        400,
      );
    }

    let memberNo = profile.student_id || null;
    if (!memberNo) {
      const { data: regMember } = await admin
        .from("reg_members")
        .select("member_no")
        .eq("user_id", userId)
        .maybeSingle();
      if (regMember?.member_no) memberNo = regMember.member_no;
    }

    // 3. Daily limit (Taiwan UTC+8)
    const now = new Date();
    const taiwanNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = taiwanNow.toISOString().slice(0, 10);
    const todayStartUTC = new Date(new Date(todayStr + "T00:00:00+08:00").getTime());
    const todayEndUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);

    const { count: todayCount } = await admin
      .from("resource_trials")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resource_category", resource.category)
      .gte("created_at", todayStartUTC.toISOString())
      .lt("created_at", todayEndUTC.toISOString());

    if (todayCount && todayCount > 0) {
      const catLabel = resource.category === "extensions" ? "套件" : "模板";
      return jsonResponse(
        {
          error: `今日已領用過一個${catLabel}，明天再來吧！`,
          code: "DAILY_LIMIT_REACHED",
        },
        429,
      );
    }

    // ─── Templates ───
    if (isTemplate) {
      const { data: signedUrlData, error: signedUrlErr } = await admin.storage
        .from("resource-templates")
        .createSignedUrl(resource.template_file_path!, 86400);

      if (signedUrlErr || !signedUrlData?.signedUrl) {
        console.error("Signed URL error:", signedUrlErr);
        return jsonResponse({ error: "無法產生下載連結", code: "SIGNED_URL_FAILED" }, 500);
      }

      const { data: trial, error: trialErr } = await admin
        .from("resource_trials")
        .insert({
          user_id: userId,
          resource_id: resource.id,
          member_no: memberNo,
          organization_id: profile.organization_id,
          app_id: resource.app_id || "template",
          resource_category: resource.category,
          api_key: signedUrlData.signedUrl,
          webhook_status: "completed",
        })
        .select("id")
        .single();

      if (trialErr) throw trialErr;

      // Notification
      try {
        const { data: notifSettings } = await admin
          .from("notification_settings")
          .select("show_success")
          .eq("user_id", userId)
          .maybeSingle();

        if (notifSettings?.show_success !== false) {
          const { data: conversation } = await admin
            .from("conversations")
            .insert({
              title: `📦 ${resource.title} 範本下載連結已到`,
              category: "system",
            })
            .select("id")
            .single();

          if (conversation) {
            await admin.from("messages").insert({
              conversation_id: conversation.id,
              content: `您領用的「${resource.title}」範本下載連結已備妥，請至資源中心「我的試用」分頁下載（24小時內有效）。`,
              is_system: true,
              sender_id: null,
            });
            await admin.from("conversation_participants").insert({
              conversation_id: conversation.id,
              user_id: userId,
              unread: true,
            });
          }
        }
      } catch (e) {
        console.error("Notification error:", e);
      }

      return jsonResponse(
        {
          success: true,
          trial_id: trial.id,
          resource_title: resource.title,
          resource_category: resource.category,
          app_id: resource.app_id || "template",
          api_key: signedUrlData.signedUrl,
          expires_in: 86400,
          webhook_status: "completed",
          message: "領用成功！下載連結 24 小時內有效。",
        },
        201,
      );
    }

    // ─── Extensions ───
    const { data: trial, error: trialErr } = await admin
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

    let webhookStatus = "no_webhook";
    try {
      const { data: setting } = await admin
        .from("system_settings")
        .select("value")
        .eq("key_name", "trial_webhook_url")
        .maybeSingle();

      if (setting?.value) {
        const resp = await fetch(setting.value, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: profile.organization_id,
            app_id: resource.app_id,
            member_no: memberNo,
            category: resource.category,
            resource_title: resource.title,
            trial_id: trial.id,
          }),
        });
        webhookStatus = resp.ok ? "sent" : "failed";
      }
    } catch (e) {
      console.error("Webhook error:", e);
      webhookStatus = "failed";
    }

    await admin
      .from("resource_trials")
      .update({ webhook_status: webhookStatus })
      .eq("id", trial.id);

    return jsonResponse(
      {
        success: true,
        trial_id: trial.id,
        resource_title: resource.title,
        resource_category: resource.category,
        app_id: resource.app_id,
        webhook_status: webhookStatus,
        message:
          "領用成功！序號將由 webhook 回拋，請稍後用 GET /api-agent-my-trials 查詢。",
      },
      201,
    );
  } catch (err: unknown) {
    console.error("api-agent-claim-trial error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message, code: "INTERNAL_ERROR" }, 500);
  }
});
