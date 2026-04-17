import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);
  const userId = v.userId!;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 取 profile 拿 email 作 fallback
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  // 先用 user_id 找
  let { data: member } = await admin
    .from("reg_members")
    .select("id, member_no, name, points, email")
    .eq("user_id", userId)
    .maybeSingle();

  // fallback：用 email 找
  if (!member && profile?.email) {
    const { data } = await admin
      .from("reg_members")
      .select("id, member_no, name, points, email")
      .eq("email", profile.email)
      .maybeSingle();
    member = data ?? null;
  }

  if (!member) {
    return jsonResponse({ member: null, balance: 0, transactions: [] });
  }

  const url = new URL(req.url);
  const wantHistory = url.searchParams.get("history") === "true";

  if (wantHistory) {
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(isNaN(limitRaw) ? 50 : limitRaw, 1), 200);

    const { data: txs, error } = await admin
      .from("reg_point_transactions")
      .select("id, points_delta, type, description, created_at, order_id")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({
      member: { member_no: member.member_no, name: member.name, points: member.points },
      balance: member.points,
      transactions: txs ?? [],
    });
  }

  return jsonResponse({
    member: { member_no: member.member_no, name: member.name, points: member.points },
    balance: member.points,
  });
});
