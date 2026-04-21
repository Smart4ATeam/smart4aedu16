import { verifyAdminToken, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";
import { resolveRecipients, getAdminClient, type RecipientFilter } from "../_shared/resolve-recipients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await verifyAdminToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  try {
    let filter: RecipientFilter;
    if (req.method === "POST") {
      const body = await req.json();
      filter = body.recipient_filter as RecipientFilter;
    } else {
      // GET with query string ?filter=<json>
      const url = new URL(req.url);
      const raw = url.searchParams.get("filter");
      if (!raw) return jsonResponse({ error: "Missing filter" }, 400);
      filter = JSON.parse(raw);
    }
    if (!filter?.mode) return jsonResponse({ error: "recipient_filter.mode required" }, 400);

    const admin = getAdminClient();
    const { user_ids, preview } = await resolveRecipients(admin, filter);

    return jsonResponse({
      total: user_ids.length,
      sample: preview.slice(0, 10),
      preview, // full list for UI; agent should usually use sample
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
