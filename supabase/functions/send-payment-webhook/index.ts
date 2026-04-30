// Send labor-report (勞報單) data to external webhook for archiving.
// Triggered by admin clicking "確認簽回" in admin tasks tab.
//
// PURPOSE: 將學員上傳的「簽回勞報單 PDF」搬到外部雲端硬碟，搬完後
// 刪除 supabase storage 中的檔案以節省空間。
//
// Payload 只包含勞報單必要資料 + 簽回 PDF 的 signed url，不含個資與附件
// （個資/附件由 send-payee-update-webhook 獨立負責）。
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

    // Load doc + task title (only fields needed in payload)
    const { data: doc, error: docErr } = await admin
      .from("task_payment_documents")
      .select("*")
      .eq("id", document_id)
      .maybeSingle();
    if (docErr || !doc) return json({ error: "Document not found" }, 404);

    if (!doc.signed_file_url) {
      return json({ error: "尚未上傳簽回檔" }, 400);
    }

    const { data: app } = await admin
      .from("task_applications")
      .select("task_id, user_id")
      .eq("id", doc.application_id)
      .single();
    const { data: task } = await admin
      .from("tasks")
      .select("title")
      .eq("id", app.task_id)
      .single();

    // Load payee profile (needed for filename composition on external side)
    const { data: payee } = await admin
      .from("payee_profiles")
      .select("name, id_number, bank_name, branch_name, account_number, account_name")
      .eq("user_id", app.user_id)
      .maybeSingle();
    if (!payee) {
      return json({ error: "找不到收款人資料（payee_profiles）" }, 400);
    }

    // Get webhook URL from system_settings
    const { data: setting } = await admin
      .from("system_settings")
      .select("value")
      .eq("key_name", "PAYMENT_WEBHOOK_URL")
      .maybeSingle();
    const webhookUrl = setting?.value?.trim();
    if (!webhookUrl) return json({ error: "PAYMENT_WEBHOOK_URL 未設定" }, 400);

    // Generate signed URL for the signed labor report PDF (24h)
    const signedPdfSignedUrl = await signed(
      admin,
      "payment-signed-docs",
      doc.signed_file_url,
    );

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
      .eq("id", doc.application_id);

    // Build minimal payload — only what external端 needs to fetch & archive the PDF
    const payload = {
      event: "payment_document",
      callback_token: token,
      callback_url: `${url}/functions/v1/payment-webhook-callback`,
      document: {
        doc_no: doc.doc_no,
        application_id: doc.application_id,
        task_title: task?.title ?? null,
        gross_amount: Number(doc.gross_amount),
        tax_amount: Number(doc.withholding_tax),
        nhi_amount: Number(doc.nhi_supplement),
        net_amount: Number(doc.net_amount),
        generated_at: doc.generated_at,
        payee: {
          name: payee.name,
          id_number: payee.id_number,
          bank_name: payee.bank_name,
          branch_name: payee.branch_name,
          account_number: payee.account_number,
          account_name: payee.account_name,
        },
        signed_pdf_signed_url: signedPdfSignedUrl,
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
