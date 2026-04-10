import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyApiKey } from "../_shared/verify-api-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!(await verifyApiKey(apiKey))) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const courseName = url.searchParams.get("course_name");
    const sessionDate = url.searchParams.get("session_date");

    if (!courseName && !sessionDate) {
      return new Response(JSON.stringify({ error: "至少需提供 course_name 或 session_date 其中一個查詢參數" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Build query
    let query = adminClient
      .from("reg_enrollments")
      .select("*, reg_members(id, member_no, name, phone, email), courses(id, course_code, title, category), reg_orders(order_no)");

    // Filter by course_name (fuzzy match via course lookup)
    if (courseName) {
      const { data: matchedCourses, error: cErr } = await adminClient
        .from("courses")
        .select("id")
        .ilike("title", `%${courseName}%`);
      if (cErr) throw cErr;

      if (!matchedCourses || matchedCourses.length === 0) {
        return new Response(JSON.stringify({ success: true, data: [], message: `找不到符合「${courseName}」的課程` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const courseIds = matchedCourses.map(c => c.id);
      query = query.in("course_id", courseIds);
    }

    // Filter by session_date
    if (sessionDate) {
      query = query.eq("session_date", sessionDate);
    }

    // Filter by pre_notification_sent
    const preNotification = url.searchParams.get("pre_notification_sent");
    if (preNotification !== null) {
      query = query.eq("pre_notification_sent", preNotification === "true");
    }

    // Only active enrollments
    query = query.neq("status", "cancelled");
    query = query.order("session_date", { ascending: true });

    const { data, error } = await query;
    if (error) throw error;

    // Flatten response for easier consumption
    const results = (data || []).map((e: any) => ({
      enrollment_id: e.id,
      order_no: e.reg_orders?.order_no || null,
      member_name: e.reg_members?.name || null,
      member_no: e.reg_members?.member_no || null,
      member_phone: e.reg_members?.phone || null,
      member_email: e.reg_members?.email || null,
      course_name: e.courses?.title || null,
      course_code: e.courses?.course_code || null,
      course_category: e.courses?.category || null,
      session_date: e.session_date,
      status: e.status,
      payment_status: e.payment_status,
      checked_in: e.checked_in,
      is_retrain: e.is_retrain,
      enrolled_at: e.enrolled_at,
      paid_at: e.paid_at,
      invoice_title: e.invoice_title,
      dealer_id: e.dealer_id,
      referrer: e.referrer,
      notes: e.notes,
      test_score: e.test_score,
      certificate: e.certificate,
      points_awarded: e.points_awarded,
      pre_notification_sent: e.pre_notification_sent,
    }));

    return new Response(JSON.stringify({ success: true, data: results, total: results.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-reg-enrollments error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
