// Send labor-report (勞報單) data to external webhook for archiving.
// Triggered by admin clicking "確認簽回" in admin tasks tab.
//
// Caller is the logged-in admin (uses their JWT to call this function).
// Internally we use service role to read all data + write callback token.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { document_id } = body as { document_id?: string };
    if (!document_id) return json({ error: "document_id required" }, 400);

    // Load doc + application + task + payee profile
    const { data: doc, error: docErr } = await admin
      .from("task_payment_documents")
      .select("*")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Document not found" }, 404);

    const { data: app } = await admin
      .from("task_applications")
      .select("*")
      .eq("id", doc.application_id)
      .single();
    const { data: task } = await admin
      .from("tasks")
      .select("*")
      .eq("id", app.task_id)
      .single();
    const { data: profile } = await admin
      .from("payee_profiles")
      .select("*")
      .eq("user_id", app.user_id)
      .single();

    if (!profile) return json({ error: "Payee profile not found" }, 400);

    // Get webhook URL from system_settings
    const { data: setting } = await admin
      .from("system_settings")
      .select("value")
      .eq("key_name", "PAYMENT_WEBHOOK_URL")
      .maybeSingle();
    const webhookUrl = setting?.value?.trim();
    if (!webhookUrl) return json({ error: "PAYMENT_WEBHOOK_URL 未設定" }, 400);

    // === v3.2 KEY LOGIC ===
    // Decide whether to attach payee identity files based on whether
    // they have already been archived (cloud_url present), NOT on is_first_payment.
    const attachmentsArchived =
      !!profile.id_card_front_cloud_url &&
      !!profile.id_card_back_cloud_url &&
      !!profile.bankbook_cover_cloud_url;
    const includeAttachments = !attachmentsArchived;

    // Generate signed URLs for the signed labor report PDF (always sent)
    const signedPdfUrl = doc.signed_file_url
      ? await signed(admin, "payment-signed-docs", doc.signed_file_url)
      : null;

    let attachments: Record<string, string | null> | undefined;
    if (includeAttachments) {
      attachments = {
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
    }

    // Generate callback token
    const token = crypto.randomUUID();

    await admin
      .from("task_payment_documents")
      .update({
        webhook_sent_at: new Date().toISOString(),
        webhook_callback_token: token,
        admin_confirmed_at: new Date().toISOString(),
        admin_confirmed_by: userRes.user.id,
      })
      .eq("id", document_id);

    await admin
      .from("task_applications")
      .update({ status: "payment_processing" })
      .eq("id", app.id);

    // Build payload
    const payload = {
      event: "payment_document_archive_request",
      callback_token: token,
      callback_url: `${url}/functions/v1/payment-webhook-callback`,
      document: {
        id: doc.id,
        doc_no: doc.doc_no,
        generated_at: doc.generated_at,
        service_period: doc.service_period,
        service_description: doc.service_description,
        gross_amount: Number(doc.gross_amount),
        withholding_tax: Number(doc.withholding_tax),
        nhi_supplement: Number(doc.nhi_supplement),
        net_amount: Number(doc.net_amount),
        is_first_payment: doc.is_first_payment, // audit only
        signed_pdf_url: signedPdfUrl,
      },
      task: {
        id: task.id,
        title: task.title,
        category: task.category,
      },
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
      attachments_included: includeAttachments,
      attachments: attachments ?? null,
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
      console.error("webhook failed", resp.status, text);
      return json({ error: `Webhook failed: ${resp.status} ${text}` }, 502);
    }

    return json({ success: true, callback_token: token });
  } catch (e) {
    console.error("send-payment-webhook error", e);
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
