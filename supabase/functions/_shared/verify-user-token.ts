import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VerifyResult {
  ok: boolean;
  userId?: string;
  status?: number;
  error?: string;
}

/**
 * Verify a "Bearer sk_xxx" token in the Authorization header.
 * Uses SUPABASE_SERVICE_ROLE_KEY to look up + update the token row.
 */
export async function verifyUserToken(req: Request): Promise<VerifyResult> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const token = auth.slice(7).trim();
  if (!token.startsWith("sk_")) {
    return { ok: false, status: 401, error: "Invalid token format" };
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const tokenHash = await sha256Hex(token);

  const { data, error } = await admin
    .from("user_api_tokens")
    .select("id, user_id, expires_at, revoked")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, status: 401, error: "Invalid token" };
  }
  if (data.revoked) {
    return { ok: false, status: 401, error: "Token revoked" };
  }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Token expired" };
  }

  // best-effort update last_used_at
  admin
    .from("user_api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { ok: true, userId: data.user_id };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function sha256(input: string) {
  return sha256Hex(input);
}
