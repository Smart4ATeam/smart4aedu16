// Triggered when student self-updates payee profile (bank / personal info).
// Caller is the logged-in student.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userRes.user.id;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { update_id } = body as { update_id?: string };
    if (!update_id) return json({ error: "update_id required" }, 400);

    const { data: upd } = await admin
      .from("payee_profile_updates")
      .select("*")
      .eq("id", update_id)
      .single();
    if (!upd || upd.user_id !== userId)
      return json({ error: "Update not found" }, 404);

    const { data: profile } = await admin
      .from("payee_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!profile) return json({ error: "Profile missing" }, 400);

    const { data: setting } = await admin
      .from("system_settings")
      .select("value")
      .eq("key_name", "PAYMENT_WEBHOOK_URL")
      .maybeSingle();
    const webhookUrl = setting?.value?.trim();
    if (!webhookUrl) return json({ error: "PAYMENT_WEBHOOK_URL 未設定" }, 400);

    // For self-update, ALWAYS include the freshly uploaded attachments
    const attachments = {
      id_card_front: profile.id_card_front_url
        ? await signed(admin, "payee-documents", profile.id_card_front_url)
        : null,
      id_card_back: profile.id_card_back_url
        ? await signed(admin, "payee-documents", profile.id_card_back_url)
        : null,
      bankbook_cover: profile.bankbook_cover_url
        ? await signed(admin, "payee-documents", profile.bankbook_cover_url)
        : null,
    };

    const token = crypto.randomUUID();

    await admin
      .from("payee_profile_updates")
      .update({
        webhook_sent_at: new Date().toISOString(),
        webhook_callback_token: token,
      })
      .eq("id", update_id);

    await admin
      .from("payee_profiles")
      .update({
        last_updated_via: "self_update",
        last_update_webhook_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    const payload = {
      event: "payee_profile_update_request",
      callback_token: token,
      callback_url: `${url}/functions/v1/payment-webhook-callback`,
      update_id,
      reason: upd.reason,
      changed_fields: upd.changed_fields,
      payee: {
        user_id: profile.user_id,
        name: profile.name,
        id_number: profile.id_number,
        phone: profile.phone,
        email: profile.email,
        registered_address: profile.registered_address,
        bank_code: profile.bank_code,
        bank_name: profile.bank_name,
        branch_code: profile.branch_code,
        branch_name: profile.branch_name,
        account_number: profile.account_number,
        account_name: profile.account_name,
      },
      attachments,
      company: {
        name: "禹動科技整合股份有限公司",
        brand: "Smart4A",
      },
    };

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      console.error("update webhook failed", resp.status, text);
      return json({ error: `Webhook failed: ${resp.status} ${text}` }, 502);
    }

    return json({ success: true, callback_token: token });
  } catch (e) {
    console.error("send-payee-update-webhook error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

async function signed(admin: ReturnType<typeof createClient>, bucket: string, path: string) {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
