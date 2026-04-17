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

  const url = new URL(req.url);
  const completedParam = url.searchParams.get("completed");

  let q = admin
    .from("user_learning_progress")
    .select("id, learning_path_id, current_step, completed, completed_at, started_at")
    .eq("user_id", v.userId!);
  if (completedParam === "true") q = q.eq("completed", true);
  if (completedParam === "false") q = q.eq("completed", false);

  const { data: progress, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  const pathIds = [...new Set((progress ?? []).map((p) => p.learning_path_id))];
  const { data: paths } = pathIds.length
    ? await admin.from("learning_paths").select("*").in("id", pathIds)
    : { data: [] as any[] };

  return jsonResponse({
    progress: (progress ?? []).map((p) => ({
      ...p,
      learning_path: (paths ?? []).find((lp: any) => lp.id === p.learning_path_id) ?? null,
    })),
  });
});
