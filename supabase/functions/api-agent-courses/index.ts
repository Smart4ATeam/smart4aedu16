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
  const id = url.searchParams.get("id");
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");

  if (id) {
    const { data: course, error } = await admin
      .from("courses")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    if (!course) return jsonResponse({ error: "Course not found" }, 404);

    const { data: units } = await admin
      .from("course_units")
      .select("id, title, sort_order")
      .eq("course_id", id)
      .order("sort_order");

    const unitIds = (units ?? []).map((u) => u.id);
    const { data: sections } = unitIds.length
      ? await admin
          .from("unit_sections")
          .select("id, unit_id, type, sort_order, content_json")
          .in("unit_id", unitIds)
          .order("sort_order")
      : { data: [] as any[] };

    return jsonResponse({
      course,
      units: (units ?? []).map((u) => ({
        ...u,
        sections: (sections ?? []).filter((s: any) => s.unit_id === u.id),
      })),
    });
  }

  // 學員端 Agent 僅能查詢已上架課程
  let q = admin.from("courses").select("*").eq("status", "published").order("sort_order");
  if (category) q = q.eq("category", category);
  const { data, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);
  return jsonResponse({ courses: data });
});
