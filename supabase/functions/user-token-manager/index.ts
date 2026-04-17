import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, sha256 } from "../_shared/verify-user-token.ts";

const ALLOWED_DAYS = new Set([7, 30, 60, 90]);

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `sk_${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;
  const admin = createClient(url, serviceKey);

  const path = new URL(req.url).pathname.split("/").pop() ?? "";

  try {
    if (req.method === "GET" && (path === "user-token-manager" || path === "list")) {
      const { data, error } = await admin
        .from("user_api_tokens")
        .select("id, name, token_prefix, expires_at, last_used_at, revoked, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ tokens: data });
    }

    if (req.method === "POST" && path === "create") {
      const body = await req.json().catch(() => ({}));
      const name = String(body?.name ?? "").trim();
      const days = body?.days; // number or null (永久)

      if (!name || name.length > 100) {
        return jsonResponse({ error: "Token 名稱必填（最多 100 字）" }, 400);
      }
      let expiresAt: string | null = null;
      if (days !== null && days !== undefined) {
        if (typeof days !== "number" || !ALLOWED_DAYS.has(days)) {
          return jsonResponse({ error: "無效的有效期" }, 400);
        }
        expiresAt = new Date(Date.now() + days * 86400_000).toISOString();
      }

      const plain = generateToken();
      const tokenHash = await sha256(plain);
      const tokenPrefix = plain.slice(0, 11); // sk_ + 8 chars

      const { data, error } = await admin
        .from("user_api_tokens")
        .insert({
          user_id: userId,
          name,
          token_hash: tokenHash,
          token_prefix: tokenPrefix,
          expires_at: expiresAt,
        })
        .select("id, name, token_prefix, expires_at, created_at")
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);

      return jsonResponse({ token: plain, record: data });
    }

    if (req.method === "POST" && path === "revoke") {
      const body = await req.json().catch(() => ({}));
      const id = String(body?.id ?? "");
      if (!id) return jsonResponse({ error: "缺少 token id" }, 400);

      const { error } = await admin
        .from("user_api_tokens")
        .update({ revoked: true })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Not found" }, 404);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
