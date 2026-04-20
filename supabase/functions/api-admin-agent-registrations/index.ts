import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAdmin(req: Request): Promise<{ ok: boolean; userId?: string; status?: number; error?: string }> {
  const auth = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { ok: false, status: 401, error: "Missing bearer token" };
  const token = auth.slice(7);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);
  const { data: u, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !u?.user) return { ok: false, status: 401, error: "Invalid token" };
  const { data: hasRole, error: rErr } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (rErr) return { ok: false, status: 500, error: "Role check failed" };
  if (!hasRole) return { ok: false, status: 403, error: "Forbidden: admin role required" };
  return { ok: true, userId: u.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyAdmin(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "enrollments";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");
  const q = url.searchParams.get("q");

  try {
    if (type === "orders") {
      let query = admin.from("reg_orders").select("*", { count: "exact" }).order("created_at", { ascending: false });
      const paymentStatus = url.searchParams.get("payment_status");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      if (paymentStatus) query = query.eq("payment_status", paymentStatus);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);
      if (q) {
        query = query.or(
          `order_no.ilike.%${q}%,p1_name.ilike.%${q}%,p1_email.ilike.%${q}%,p1_phone.ilike.%${q}%,p2_name.ilike.%${q}%,p2_email.ilike.%${q}%,p3_name.ilike.%${q}%,p3_email.ilike.%${q}%`,
        );
      }
      const { data, error, count } = await query.range(offset, offset + limit - 1);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ orders: data, total: count, limit, offset });
    }

    // enrollments
    const courseId = url.searchParams.get("course_id");
    const courseCode = url.searchParams.get("course_code");
    const sessionDateFrom = url.searchParams.get("session_date_from");
    const sessionDateTo = url.searchParams.get("session_date_to");
    const status = url.searchParams.get("status");
    const paymentStatus = url.searchParams.get("payment_status");
    const checkedIn = url.searchParams.get("checked_in");
    const includeCancelled = url.searchParams.get("include_cancelled") === "true";

    let resolvedCourseId = courseId;
    if (!resolvedCourseId && courseCode) {
      const { data: c } = await admin.from("courses").select("id").eq("course_code", courseCode).maybeSingle();
      if (c) resolvedCourseId = c.id;
    }

    let query = admin
      .from("reg_enrollments")
      .select("*, reg_members(name, member_no, email, phone), courses(title, course_code), reg_orders(order_no)", { count: "exact" })
      .order("session_date", { ascending: false });

    if (!includeCancelled) query = query.neq("status", "cancelled");
    if (resolvedCourseId) query = query.eq("course_id", resolvedCourseId);
    if (status) query = query.eq("status", status);
    if (paymentStatus) query = query.eq("payment_status", paymentStatus);
    if (checkedIn !== null && checkedIn !== "") query = query.eq("checked_in", checkedIn === "true");
    if (sessionDateFrom) query = query.gte("session_date", sessionDateFrom);
    if (sessionDateTo) query = query.lte("session_date", sessionDateTo);

    if (q) {
      const [{ data: members }, { data: orders }] = await Promise.all([
        admin.from("reg_members").select("id").or(`name.ilike.%${q}%,member_no.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`),
        admin.from("reg_orders").select("id").ilike("order_no", `%${q}%`),
      ]);
      const memberIds = (members ?? []).map((m) => m.id);
      const orderIds = (orders ?? []).map((o) => o.id);
      if (memberIds.length === 0 && orderIds.length === 0) {
        return jsonResponse({ enrollments: [], total: 0, summary: { total: 0, by_status: {}, by_course: [] }, limit, offset });
      }
      const filters: string[] = [];
      if (memberIds.length) filters.push(`member_id.in.(${memberIds.join(",")})`);
      if (orderIds.length) filters.push(`order_id.in.(${orderIds.join(",")})`);
      query = query.or(filters.join(","));
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) return jsonResponse({ error: error.message }, 500);

    const flat = (data ?? []).map((e: any) => ({
      enrollment_id: e.id,
      member_name: e.reg_members?.name ?? null,
      member_no: e.reg_members?.member_no ?? null,
      email: e.reg_members?.email ?? null,
      phone: e.reg_members?.phone ?? null,
      course_title: e.courses?.title ?? null,
      course_code: e.courses?.course_code ?? null,
      order_no: e.reg_orders?.order_no ?? null,
      session_date: e.session_date,
      status: e.status,
      payment_status: e.payment_status,
      checked_in: e.checked_in,
      test_score: e.test_score,
      enrolled_at: e.enrolled_at,
    }));

    const by_status: Record<string, number> = {};
    const by_course_map: Record<string, number> = {};
    flat.forEach((r) => {
      by_status[r.status] = (by_status[r.status] ?? 0) + 1;
      const key = r.course_title ?? "(未知)";
      by_course_map[key] = (by_course_map[key] ?? 0) + 1;
    });
    const by_course = Object.entries(by_course_map).map(([title, n]) => ({ title, count: n }));

    return jsonResponse({
      enrollments: flat,
      total: count,
      summary: { total: count ?? flat.length, by_status, by_course },
      limit,
      offset,
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
