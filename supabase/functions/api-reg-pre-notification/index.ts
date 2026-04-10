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

  if (req.method !== "POST") {
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

    const body = await req.json();
    const { order_no, pre_notification_sent } = body;

    if (!order_no) {
      return new Response(JSON.stringify({ error: "缺少必要欄位: order_no" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof pre_notification_sent !== "boolean") {
      return new Response(JSON.stringify({ error: "pre_notification_sent 必須為 boolean (true/false)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find order by order_no
    const { data: order, error: oErr } = await adminClient
      .from("reg_orders")
      .select("id")
      .eq("order_no", order_no)
      .single();

    if (oErr || !order) {
      return new Response(JSON.stringify({ error: `找不到訂單編號: ${order_no}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update all enrollments under this order
    const { data: updated, error: uErr } = await adminClient
      .from("reg_enrollments")
      .update({ pre_notification_sent })
      .eq("order_id", order.id)
      .neq("status", "cancelled")
      .select("id");

    if (uErr) throw uErr;

    const count = updated?.length || 0;

    return new Response(JSON.stringify({
      success: true,
      data: {
        order_no,
        pre_notification_sent,
        updated_count: count,
        message: `已更新 ${count} 筆報名明細的行前通知狀態`,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("api-reg-pre-notification error:", err);
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
