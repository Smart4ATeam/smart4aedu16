import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: ua, error } = await admin
    .from("user_achievements")
    .select("id, achievement_id, earned_at")
    .eq("user_id", v.userId!)
    .order("earned_at", { ascending: false });
  if (error) return jsonResponse({ error: error.message }, 500);

  const ids = [...new Set((ua ?? []).map((x) => x.achievement_id))];
  const { data: defs } = ids.length
    ? await admin.from("achievements").select("*").in("id", ids)
    : { data: [] as any[] };

  return jsonResponse({
    achievements: (ua ?? []).map((x) => ({
      ...x,
      achievement: (defs ?? []).find((d: any) => d.id === x.achievement_id) ?? null,
    })),
  });
});
