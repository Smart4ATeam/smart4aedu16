// One-off admin tool: replay the first-time payee_profile_created webhook
// for a specific user (used when create webhook was missed before deployment).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Verify caller is admin
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Forbidden: admin only" }, 403);

    const { target_user_id } = await req.json();
    if (!target_user_id) return json({ error: "target_user_id required" }, 400);

    const { data: profile } = await admin.from("payee_profiles").select("*").eq("user_id", target_user_id).single();
    if (!profile) return json({ error: "Profile missing" }, 400);

    const { data: setting } = await admin.from("system_settings")
      .select("value").eq("key_name", "PAYMENT_WEBHOOK_URL").maybeSingle();
    const webhookUrl = setting?.value?.trim();
    if (!webhookUrl) return json({ error: "PAYMENT_WEBHOOK_URL not set" }, 400);

    const signed = async (p: string | null) => {
      if (!p) return null;
      const { data } = await admin.storage.from("payee-documents").createSignedUrl(p, 60 * 60 * 24);
      return data?.signedUrl ?? null;
    };
    const attachments = {
      id_card_front: await signed(profile.id_card_front_url),
      id_card_back: await signed(profile.id_card_back_url),
      bankbook_cover: await signed(profile.bankbook_cover_url),
    };

    const token = crypto.randomUUID();
    const { data: updRow, error: insErr } = await admin.from("payee_profile_updates").insert({
      user_id: target_user_id,
      changed_fields: ["id_card_front", "id_card_back", "bankbook_cover"],
      old_snapshot: {},
      new_snapshot: profile,
      reason: "首次建檔（管理員補送）",
      webhook_sent_at: new Date().toISOString(),
      webhook_callback_token: token,
    }).select("id").single();
    if (insErr) throw insErr;

    await admin.from("payee_profiles").update({
      last_updated_via: "initial",
      last_update_webhook_at: new Date().toISOString(),
    }).eq("user_id", target_user_id);

    const payload = {
      event: "payee_profile_created",
      callback_token: token,
      callback_url: `${url}/functions/v1/payment-webhook-callback`,
      update_id: updRow.id,
      payee: {
        user_id: profile.user_id, name: profile.name, id_number: profile.id_number,
        phone: profile.phone, email: profile.email, registered_address: profile.registered_address,
        bank_code: profile.bank_code, bank_name: profile.bank_name,
        branch_code: profile.branch_code, branch_name: profile.branch_name,
        account_number: profile.account_number, account_name: profile.account_name,
      },
      attachments_to_migrate: ["id_card_front", "id_card_back", "bankbook_cover"],
      attachments,
      company: { name: "禹動科技整合股份有限公司", brand: "Smart4A" },
    };

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await resp.text().catch(() => "");
    if (!resp.ok) return json({ error: `Webhook failed: ${resp.status} ${text}` }, 502);
    return json({ success: true, callback_token: token, update_id: updRow.id, webhook_status: resp.status, webhook_body: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
