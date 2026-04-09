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

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!(await verifyApiKey(apiKey))) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { order_no } = body;

    if (!order_no) {
      return new Response(JSON.stringify({ error: "order_no is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find order
    const { data: order, error: orderErr } = await adminClient
      .from("reg_orders")
      .select("*")
      .eq("order_no", order_no)
      .single();

    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: `Order not found: ${order_no}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify payment
    if (order.payment_status !== "paid") {
      return new Response(JSON.stringify({
        error: "訂單尚未付款，無法拆解",
        payment_status: order.payment_status,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check if already split (enrollments exist for this order)
    const { count: existingCount } = await adminClient
      .from("reg_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);

    if (existingCount && existingCount > 0) {
      return new Response(JSON.stringify({
        error: "此訂單已拆解過",
        enrollments_count: existingCount,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Extract persons from p1~p3
    interface PersonInfo {
      name: string;
      phone: string | null;
      email: string | null;
    }
    const persons: PersonInfo[] = [];
    for (let i = 1; i <= 3; i++) {
      const name = order[`p${i}_name`];
      if (name) {
        persons.push({
          name,
          phone: order[`p${i}_phone`] || null,
          email: order[`p${i}_email`] || null,
        });
      }
    }

    if (persons.length === 0) {
      return new Response(JSON.stringify({ error: "訂單中無報名人員資料" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Look up courses
    const courseIds: string[] = order.course_ids || [];
    const sessionDates: string[] = order.session_dates || [];
    if (courseIds.length === 0) {
      return new Response(JSON.stringify({ error: "訂單中無課程資料" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: courses, error: courseErr } = await adminClient
      .from("courses")
      .select("id, course_code, category, title, enrollment_points")
      .in("id", courseIds);

    if (courseErr) throw courseErr;

    const courseMap = new Map(courses!.map((c: Record<string, unknown>) => [c.id, c]));

    // 6. Find or create reg_members for each person, auto-link user_id
    const memberIds: string[] = [];
    for (const person of persons) {
      let memberId: string | null = null;

      // Match by email first
      if (person.email) {
        const { data: existing } = await adminClient
          .from("reg_members")
          .select("id, user_id")
          .eq("email", person.email)
          .maybeSingle();
        if (existing) {
          memberId = existing.id;
          // Auto-link user_id if not yet bound
          if (!existing.user_id && person.email) {
            const { data: profile } = await adminClient
              .from("profiles")
              .select("id")
              .eq("email", person.email)
              .maybeSingle();
            if (profile) {
              await adminClient.from("reg_members").update({ user_id: profile.id }).eq("id", existing.id);
            }
          }
        }
      }

      // Then by name + phone
      if (!memberId && person.phone) {
        const { data: existing } = await adminClient
          .from("reg_members")
          .select("id")
          .eq("name", person.name)
          .eq("phone", person.phone)
          .maybeSingle();
        if (existing) memberId = existing.id;
      }

      // Create new member — try to auto-link user_id from profiles
      if (!memberId) {
        let linkedUserId: string | null = null;
        if (person.email) {
          const { data: profile } = await adminClient
            .from("profiles")
            .select("id")
            .eq("email", person.email)
            .maybeSingle();
          if (profile) linkedUserId = profile.id;
        }
        const { data: newMember, error: memberErr } = await adminClient
          .from("reg_members")
          .insert({
            name: person.name.trim(),
            phone: person.phone,
            email: person.email,
            user_id: linkedUserId,
          })
          .select("id")
          .single();
        if (memberErr) throw memberErr;
        memberId = newMember.id;
      }

      memberIds.push(memberId);
    }

    // Helper: normalize date strings to zero-padded format
    // "2026/4/16" -> "2026/04/16", "2026/1/17-1/18" -> "2026/01/17-01/18"
    const normDatePart = (d: string) => {
      const parts = d.split("/");
      if (parts.length === 3) return `${parts[0]}/${parts[1].padStart(2, "0")}/${parts[2].padStart(2, "0")}`;
      if (parts.length === 2) return `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}`;
      return d;
    };
    const normDate = (d: string | null): string | null => {
      if (!d) return null;
      const dashIdx = d.indexOf("-");
      if (dashIdx > 0) return normDatePart(d.slice(0, dashIdx)) + "-" + normDatePart(d.slice(dashIdx + 1));
      return normDatePart(d);
    };

    // 7. Create reg_enrollments: each person × each course
    const enrollments: Record<string, unknown>[] = [];
    for (const memberId of memberIds) {
      for (let ci = 0; ci < courseIds.length; ci++) {
        const courseId = courseIds[ci];
        const course = courseMap.get(courseId);
        const sessionDate = normDate(sessionDates[ci] || null);
        enrollments.push({
          order_id: order.id,
          member_id: memberId,
          course_id: courseId,
          session_date: sessionDate,
          course_type: (course as Record<string, unknown>)?.category || null,
          status: "enrolled",
          payment_status: "paid",
          paid_at: order.paid_at || new Date().toISOString(),
          invoice_title: order.invoice_title || null,
          dealer_id: order.dealer_id || null,
          is_retrain: order.is_retrain || false,
          referrer: order.referrer || null,
        });
      }
    }

    const { data: insertedEnrollments, error: enrollErr } = await adminClient
      .from("reg_enrollments")
      .insert(enrollments)
      .select("id, member_id, course_id");

    if (enrollErr) throw enrollErr;

    // 8. Auto-award points for each enrollment
    const pointTxns: Record<string, unknown>[] = [];
    for (const enrollment of (insertedEnrollments || [])) {
      const course = courseMap.get(enrollment.course_id) as Record<string, unknown> | undefined;
      const pts = (course?.enrollment_points as number) || 0;
      if (pts > 0) {
        pointTxns.push({
          member_id: enrollment.member_id,
          points_delta: pts,
          type: "awarded",
          description: `報名課程：${course?.title || ""}`,
          order_id: order.id,
        });
      }
    }
    if (pointTxns.length > 0) {
      const { error: ptErr } = await adminClient.from("reg_point_transactions").insert(pointTxns);
      if (ptErr) console.error("Points insert error:", ptErr);
    }

    // 8. Log operation
    await adminClient.from("reg_operation_logs").insert({
      entity_type: "order",
      entity_id: order.id,
      action: "split",
      old_value: { payment_status: order.payment_status },
      new_value: {
        member_ids: memberIds,
        enrollments_count: insertedEnrollments?.length || 0,
      },
      reason: `api-reg-split: 訂單 ${order_no} 拆解完成`,
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        order_id: order.id,
        order_no,
        member_ids: memberIds,
        enrollments_count: insertedEnrollments?.length || 0,
        message: "訂單拆解完成，學員與報名明細已建立",
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-reg-split error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
