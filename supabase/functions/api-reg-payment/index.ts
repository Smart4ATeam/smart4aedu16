import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("API_INTEGRATION_KEY");
    if (!apiKey || apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      order_no,
      payment_status,
      payment_method,
      paid_at,
      invoice_number,
      invoice_title,
      invoice_type,
    } = body;

    if (!order_no) {
      return new Response(
        JSON.stringify({ error: "order_no is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!payment_status || !["paid", "pending"].includes(payment_status)) {
      return new Response(
        JSON.stringify({ error: "payment_status must be 'paid' or 'pending'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the order
    const { data: order, error: findError } = await supabase
      .from("reg_orders")
      .select("id, order_no, payment_status")
      .eq("order_no", order_no)
      .single();

    if (findError || !order) {
      return new Response(
        JSON.stringify({ error: `Order not found: ${order_no}` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update order
    const updateData: Record<string, unknown> = {
      payment_status,
    };
    if (payment_status === "paid") {
      updateData.paid_at = paid_at || new Date().toISOString();
    }
    if (payment_method) updateData.payment_method = payment_method;
    if (invoice_number) updateData.invoice_number = invoice_number;
    if (invoice_title) updateData.invoice_title = invoice_title;
    if (invoice_type) updateData.invoice_type = invoice_type;

    const { error: updateError } = await supabase
      .from("reg_orders")
      .update(updateData)
      .eq("id", order.id);

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    // Update related enrollments
    const enrollUpdateData: Record<string, unknown> = {
      payment_status,
    };
    if (payment_status === "paid") {
      enrollUpdateData.paid_at = paid_at || new Date().toISOString();
    }
    if (invoice_title) enrollUpdateData.invoice_title = invoice_title;

    const { error: enrollError } = await supabase
      .from("reg_enrollments")
      .update(enrollUpdateData)
      .eq("order_id", order.id);

    if (enrollError) {
      console.error("Failed to update enrollments:", enrollError.message);
    }

    // Log the operation
    await supabase.from("reg_operation_logs").insert({
      entity_type: "order",
      entity_id: order.id,
      action: "payment_update",
      old_value: { payment_status: order.payment_status },
      new_value: updateData,
      reason: `Make.com payment update: ${payment_status}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_no: order.order_no,
        payment_status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("api-reg-payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
