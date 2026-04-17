import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyUserToken, corsHeaders, jsonResponse } from "../_shared/verify-user-token.ts";

const VALID_CATEGORIES = ["plugins", "extensions", "templates", "videos"];

function truncate(s: string | null | undefined, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function pickListFields(r: any) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    sub_category: r.sub_category,
    description: truncate(r.description, 200),
    author: r.author,
    version: r.version,
    tags: r.tags,
    difficulty: r.difficulty,
    is_hot: r.is_hot,
    hot_rank: r.hot_rank,
    industry_tag: r.industry_tag,
    duration: r.duration,
    video_type: r.video_type,
    trial_enabled: r.trial_enabled,
    has_trial_file: r.category === "templates" ? !!r.template_file_path : !!r.app_id,
    detail_url: r.detail_url,
    download_url: r.download_url,
    thumbnail_url: r.thumbnail_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await verifyUserToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Facets mode
    if (url.searchParams.get("facets") === "true") {
      const { data: subs } = await admin
        .from("resource_sub_categories")
        .select("category, label, sort_order")
        .order("sort_order", { ascending: true });

      const { data: rows } = await admin
        .from("resources")
        .select("industry_tag")
        .eq("status", "approved")
        .not("industry_tag", "is", null);

      const subMap: Record<string, string[]> = {};
      (subs ?? []).forEach((s: any) => {
        subMap[s.category] = subMap[s.category] || [];
        if (!subMap[s.category].includes(s.label)) subMap[s.category].push(s.label);
      });

      const tags = Array.from(
        new Set((rows ?? []).map((r: any) => r.industry_tag).filter(Boolean)),
      );

      return jsonResponse({
        categories: VALID_CATEGORIES,
        sub_categories: subMap,
        difficulties: ["初級", "中級", "高級"],
        industry_tags: tags,
      });
    }

    // Detail mode
    const id = url.searchParams.get("id");
    if (id) {
      const { data: resource, error } = await admin
        .from("resources")
        .select("*")
        .eq("id", id)
        .eq("status", "approved")
        .maybeSingle();

      if (error || !resource) {
        return jsonResponse({ error: "Resource not found", code: "RESOURCE_NOT_FOUND" }, 404);
      }

      const { data: subs } = await admin
        .from("resource_sub_categories")
        .select("label")
        .eq("category", resource.category)
        .order("sort_order", { ascending: true });

      // strip storage path from response
      const { template_file_path, ...rest } = resource as any;
      return jsonResponse({
        resource: {
          ...rest,
          has_trial_file:
            resource.category === "templates" ? !!template_file_path : !!resource.app_id,
        },
        sub_categories_in_category: (subs ?? []).map((s: any) => s.label),
      });
    }

    // List mode
    const q = url.searchParams.get("q")?.trim();
    const category = url.searchParams.get("category");
    const subCategory = url.searchParams.get("sub_category");
    const difficulty = url.searchParams.get("difficulty");
    const isHot = url.searchParams.get("is_hot");
    const trialOnly = url.searchParams.get("trial_only");
    const industryTag = url.searchParams.get("industry_tag");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30") || 30, 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0") || 0, 0);

    let query = admin
      .from("resources")
      .select("*", { count: "exact" })
      .eq("status", "approved");

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return jsonResponse({ error: "Invalid category", allowed: VALID_CATEGORIES }, 400);
      }
      query = query.eq("category", category);
    }
    if (subCategory) query = query.eq("sub_category", subCategory);
    if (difficulty) query = query.eq("difficulty", difficulty);
    if (isHot === "true") query = query.eq("is_hot", true);
    if (trialOnly === "true") query = query.eq("trial_enabled", true);
    if (industryTag) query = query.eq("industry_tag", industryTag);

    if (q) {
      const safe = q.replace(/[%,]/g, " ");
      query = query.or(
        `title.ilike.%${safe}%,description.ilike.%${safe}%,industry_tag.ilike.%${safe}%`,
      );
    }

    query = query
      .order("is_hot", { ascending: false })
      .order("hot_rank", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    let resources = (data ?? []).map(pickListFields);

    // Tag filter (post-query, since tags is array)
    if (q) {
      const ql = q.toLowerCase();
      const tagMatched = (data ?? []).filter((r: any) =>
        (r.tags ?? []).some((t: string) => t.toLowerCase().includes(ql)),
      );
      const ids = new Set(resources.map((r) => r.id));
      tagMatched.forEach((r: any) => {
        if (!ids.has(r.id)) resources.push(pickListFields(r));
      });
    }

    return jsonResponse({
      total: count ?? resources.length,
      limit,
      offset,
      resources,
    });
  } catch (err: unknown) {
    console.error("api-agent-resources error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
