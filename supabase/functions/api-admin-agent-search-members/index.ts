import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status);

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, serviceKey);

  let query = admin
    .from("reg_members")
    .select("id, member_no, name, email, phone, points, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q) {
    const safe = q.replace(/[%,]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,member_no.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 500);

  const members = (data ?? []).map((m) => ({
    member_id: m.id,
    member_no: m.member_no,
    name: m.name,
    email: m.email,
    phone: m.phone,
    points: m.points,
    user_id: m.user_id,
    account_activated: !!m.user_id,
  }));

  return jsonResponse({ members, count: members.length });
});
