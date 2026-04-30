// Webhook callback from external system after archiving.
// Authenticated by callback_token (one per outgoing request).
// Two events supported:
//   - payment_document_archived  → write doc cloud url + delete signed PDF storage
//   - payee_profile_archived     → write profile cloud urls + delete payee storage
//                                    + (if first time) write first_submitted_at
//                                      → DB trigger auto-promotes pending tasks

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-callback-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = await req.json().catch(() => ({}));
    const { event, callback_token } = body as {
      event?: string;
      callback_token?: string;
    };

    if (!callback_token) return json({ error: "callback_token required" }, 401);

    if (event === "payment_document_archived") {
      const { signed_pdf_cloud_url } = body as { signed_pdf_cloud_url?: string };
      if (!signed_pdf_cloud_url) return json({ error: "signed_pdf_cloud_url required" }, 400);

      const { data: doc } = await admin
        .from("task_payment_documents")
        .select("*")
        .eq("webhook_callback_token", callback_token)
        .maybeSingle();
      if (!doc) return json({ error: "Invalid callback_token" }, 401);

      // Update record with cloud url
      await admin
        .from("task_payment_documents")
        .update({
          signed_file_cloud_url: signed_pdf_cloud_url,
          purged_at: new Date().toISOString(),
        })
        .eq("id", doc.id);

      // Delete the signed pdf from storage
      if (doc.signed_file_url) {
        await admin.storage.from("payment-signed-docs").remove([doc.signed_file_url]);
        await admin
          .from("task_payment_documents")
          .update({ signed_file_url: null })
          .eq("id", doc.id);
      }

      return json({ success: true });
    }

    // payee_profile_created  → first-time archive (always all 3 attachments)
    // payee_profile_updated  → only the attachments listed in attachments_to_migrate
    // payee_profile_archived → legacy alias, treated like updated (back-compat)
    if (
      event === "payee_profile_created" ||
      event === "payee_profile_updated" ||
      event === "payee_profile_archived"
    ) {
      const {
        id_card_front_cloud_url,
        id_card_back_cloud_url,
        bankbook_cover_cloud_url,
      } = body as Record<string, string | undefined>;

      // For updated event, external should echo back which keys it migrated.
      // If absent, infer from which *_cloud_url fields are present.
      const echoedKeys = (body as { attachments_migrated?: string[] }).attachments_migrated;
      const migratedKeys: Set<string> = new Set(
        Array.isArray(echoedKeys) && echoedKeys.length > 0
          ? echoedKeys
          : [
              id_card_front_cloud_url ? "id_card_front" : null,
              id_card_back_cloud_url ? "id_card_back" : null,
              bankbook_cover_cloud_url ? "bankbook_cover" : null,
            ].filter(Boolean) as string[],
      );

      // Locate user via update token
      const { data: upd } = await admin
        .from("payee_profile_updates")
        .select("user_id")
        .eq("webhook_callback_token", callback_token)
        .maybeSingle();
      let userId: string | null = upd?.user_id ?? null;

      // Fallback: legacy payment_document path
      if (!userId) {
        const { data: doc } = await admin
          .from("task_payment_documents")
          .select("application_id")
          .eq("webhook_callback_token", callback_token)
          .maybeSingle();
        if (doc) {
          const { data: app } = await admin
            .from("task_applications")
            .select("user_id")
            .eq("id", doc.application_id)
            .single();
          userId = app?.user_id ?? null;
        }
      }

      if (!userId) return json({ error: "Invalid callback_token" }, 401);

      const { data: profile } = await admin
        .from("payee_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (!profile) return json({ error: "Profile not found" }, 404);

      const updates: Record<string, unknown> = {
        attachments_purged_at: new Date().toISOString(),
      };
      if (id_card_front_cloud_url) updates.id_card_front_cloud_url = id_card_front_cloud_url;
      if (id_card_back_cloud_url) updates.id_card_back_cloud_url = id_card_back_cloud_url;
      if (bankbook_cover_cloud_url) updates.bankbook_cover_cloud_url = bankbook_cover_cloud_url;

      // First time: stamp first_submitted_at → triggers promote
      if (!profile.first_submitted_at) {
        updates.first_submitted_at = new Date().toISOString();
      }

      // Only delete the storage files that were actually migrated
      const toDelete: string[] = [];
      if (migratedKeys.has("id_card_front") && profile.id_card_front_url) {
        toDelete.push(profile.id_card_front_url);
        updates.id_card_front_url = null;
      }
      if (migratedKeys.has("id_card_back") && profile.id_card_back_url) {
        toDelete.push(profile.id_card_back_url);
        updates.id_card_back_url = null;
      }
      if (migratedKeys.has("bankbook_cover") && profile.bankbook_cover_url) {
        toDelete.push(profile.bankbook_cover_url);
        updates.bankbook_cover_url = null;
      }
      if (toDelete.length > 0) {
        await admin.storage.from("payee-documents").remove(toDelete);
      }

      await admin.from("payee_profiles").update(updates).eq("user_id", userId);

      // Mark update record purged
      await admin
        .from("payee_profile_updates")
        .update({ purged_at: new Date().toISOString() })
        .eq("webhook_callback_token", callback_token);

      return json({
        success: true,
        first_archive: !profile.first_submitted_at,
        deleted: Array.from(migratedKeys),
      });
    }

    return json({ error: "Unknown event" }, 400);
  } catch (e) {
    console.error("payment-webhook-callback error", e);
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
