import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyApiKey } from "../_shared/verify-api-key.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface PersonInfo {
  name: string;
  phone?: string;
  email?: string;
}

interface RequestBody {
  order_no: string;
  course_codes?: string[];
  course_names?: string[];
  session_dates?: string[];
  persons: PersonInfo[];
  payment_status?: string;
  payment_method?: string;
  total_amount?: number;
  discount_plan?: string;
  invoice_type?: string;
  invoice_title?: string;
  tax_id?: string;
  dealer_id?: string;
  notes?: string;
  is_retrain?: boolean;
  referrer?: string;
  person_count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!(await verifyApiKey(apiKey))) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();

    // Validate: must have either course_codes or course_names
    const hasCodes = body.course_codes && body.course_codes.length > 0;
    const hasNames = body.course_names && body.course_names.length > 0;

    if (!body.order_no || (!hasCodes && !hasNames) || !body.persons?.length) {
      return new Response(JSON.stringify({
        error: "Missing required fields: order_no, (course_codes or course_names), persons",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.persons.length > 3) {
      return new Response(JSON.stringify({ error: "Maximum 3 persons per order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const courseCount = hasCodes ? body.course_codes!.length : body.course_names!.length;
    if (courseCount > 4) {
      return new Response(JSON.stringify({ error: "Maximum 4 courses per order" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let i = 0; i < body.persons.length; i++) {
      if (!body.persons[i].name?.trim()) {
        return new Response(JSON.stringify({ error: `Person ${i + 1} must have a name` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up courses by course_code OR title
    let courses: any[];
    let lookupKeys: string[];

    if (hasCodes) {
      lookupKeys = body.course_codes!;
      const { data, error } = await adminClient
        .from("courses")
        .select("id, course_code, title, category, price")
        .in("course_code", lookupKeys);
      if (error) throw error;
      courses = data || [];

      // Check missing
      const foundCodes = courses.map((c) => c.course_code);
      const missing = lookupKeys.filter((c) => !foundCodes.includes(c));
      if (missing.length > 0) {
        return new Response(JSON.stringify({
          error: `課程代碼不存在: ${missing.join(", ")}`,
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      lookupKeys = body.course_names!;
      const { data, error } = await adminClient
        .from("courses")
        .select("id, course_code, title, category, price")
        .in("title", lookupKeys);
      if (error) throw error;
      courses = data || [];

      // Check missing
      const foundTitles = courses.map((c) => c.title);
      const missing = lookupKeys.filter((n) => !foundTitles.includes(n));
      if (missing.length > 0) {
        return new Response(JSON.stringify({
          error: `課程名稱不存在: ${missing.join(", ")}`,
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Build course snapshot
    const courseSnapshot = courses.map((c) => ({
      course_code: c.course_code,
      course_name: c.title,
      price: c.price,
    }));
    const courseIds = courses.map((c) => c.id);

    // Normalize session_dates: zero-pad month/day
    const normDatePart = (d: string) => {
      const parts = d.split("/");
      if (parts.length === 3) return `${parts[0]}/${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}`;
      if (parts.length === 2) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`;
      return d;
    };
    const normDate = (d: string): string => {
      const dashIdx = d.indexOf("-");
      if (dashIdx > 0) return normDatePart(d.slice(0, dashIdx)) + "-" + normDatePart(d.slice(dashIdx + 1));
      return normDatePart(d);
    };

    const sessionDates = (body.session_dates || []).map((d: string) => normDate(d));
    if (sessionDates.length > 0 && sessionDates.length !== courseIds.length) {
      return new Response(JSON.stringify({
        error: `session_dates 數量 (${sessionDates.length}) 必須與課程數量 (${courseIds.length}) 一致`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build order insert
    const orderInsert: Record<string, unknown> = {
      order_no: body.order_no,
      course_ids: courseIds,
      course_snapshot: courseSnapshot,
      session_dates: sessionDates,
      payment_status: body.payment_status || "pending",
      payment_method: body.payment_method || null,
      total_amount: body.total_amount || 0,
      discount_plan: body.discount_plan || null,
      invoice_type: body.invoice_type || null,
      invoice_title: body.invoice_title || null,
      tax_id: body.tax_id || null,
      dealer_id: body.dealer_id || null,
      notes: body.notes || null,
      is_retrain: body.is_retrain || false,
      referrer: body.referrer || null,
      person_count: body.person_count || body.persons.length,
    };

    // Map persons to p1/p2/p3
    for (let i = 0; i < body.persons.length; i++) {
      const p = body.persons[i];
      const idx = i + 1;
      orderInsert[`p${idx}_name`] = p.name.trim();
      orderInsert[`p${idx}_phone`] = p.phone || null;
      orderInsert[`p${idx}_email`] = p.email || null;
    }

    const { data: order, error: orderErr } = await adminClient
      .from("reg_orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (orderErr) {
      if (orderErr.message.includes("duplicate") || orderErr.message.includes("unique")) {
        return new Response(JSON.stringify({
          error: `訂單編號已存在: ${body.order_no}`,
          exists: true,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw orderErr;
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        order_id: order.id,
        order_no: body.order_no,
        payment_status: body.payment_status || "pending",
        courses: courseSnapshot,
        persons_count: body.persons.length,
        message: "訂單已建立，待付款後呼叫 api-reg-split 拆解",
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-reg-order error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
