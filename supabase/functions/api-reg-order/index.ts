import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  course_codes: string[];
  persons: PersonInfo[];
  payment_status?: string;
  total_amount?: number;
  discount_plan?: string;
  invoice_type?: string;
  invoice_title?: string;
  dealer_id?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("API_INTEGRATION_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();

    if (!body.order_no || !body.course_codes?.length || !body.persons?.length) {
      return new Response(JSON.stringify({
        error: "Missing required fields: order_no, course_codes, persons",
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

    if (body.course_codes.length > 4) {
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

    // Look up courses by course_code
    const { data: courses, error: courseErr } = await adminClient
      .from("reg_courses")
      .select("id, course_code, course_name, course_type, price")
      .in("course_code", body.course_codes);

    if (courseErr) throw courseErr;

    if (!courses || courses.length !== body.course_codes.length) {
      const foundCodes = courses?.map((c) => c.course_code) || [];
      const missing = body.course_codes.filter((c) => !foundCodes.includes(c));
      return new Response(JSON.stringify({
        error: `Courses not found: ${missing.join(", ")}`,
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build course snapshot
    const courseMap = new Map(courses.map((c) => [c.course_code, c]));
    const courseSnapshot = body.course_codes.map((code) => {
      const c = courseMap.get(code)!;
      return { course_code: c.course_code, course_name: c.course_name, price: c.price };
    });
    const courseIds = body.course_codes.map((code) => courseMap.get(code)!.id);

    // Build order insert (NO members, NO enrollments)
    const orderInsert: Record<string, unknown> = {
      order_no: body.order_no,
      course_ids: courseIds,
      course_snapshot: courseSnapshot,
      payment_status: body.payment_status || "pending",
      total_amount: body.total_amount || 0,
      discount_plan: body.discount_plan || null,
      invoice_type: body.invoice_type || null,
      invoice_title: body.invoice_title || null,
      dealer_id: body.dealer_id || null,
      notes: body.notes || null,
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
