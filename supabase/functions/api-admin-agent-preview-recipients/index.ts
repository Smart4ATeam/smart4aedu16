import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";
import { resolveRecipients, getAdminClient, type RecipientFilter } from "../_shared/resolve-recipients.ts";

async function verifyEither(req: Request): Promise<{ ok: boolean; status?: number; error?: string }> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const token = auth.slice(7).trim();

  // sk_ → use admin API token verifier
  if (token.startsWith("sk_")) {
    const r = await verifyAdminToken(req);
    return { ok: r.ok, status: r.status, error: r.error };
  }

  // Otherwise treat as Supabase JWT (admin user logged in via UI)
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return { ok: false, status: 401, error: "Invalid JWT" };

  const admin = createClient(url, service);
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr) return { ok: false, status: 500, error: "Role check failed" };
  if (!isAdmin) return { ok: false, status: 403, error: "Forbidden" };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await verifyEither(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  try {
    let filter: RecipientFilter;
    if (req.method === "POST") {
      const body = await req.json();
      filter = body.recipient_filter as RecipientFilter;
    } else {
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
      preview,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
