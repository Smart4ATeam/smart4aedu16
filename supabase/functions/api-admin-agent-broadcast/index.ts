import { verifyAdminToken, jsonResponse, corsHeaders, logAdminAction } from "../_shared/verify-admin-token.ts";
import { resolveRecipients, getAdminClient, type RecipientFilter } from "../_shared/resolve-recipients.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = await verifyAdminToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error }, auth.status ?? 401);

  try {
    const body = await req.json();
    const { title, content, category, priority, recipient_filter, confirm } = body as {
      title?: string;
      content?: string;
      category?: string;
      priority?: string;
      recipient_filter?: RecipientFilter;
      confirm?: boolean;
    };

    if (!content) return jsonResponse({ error: "Missing content" }, 400);
    if (!recipient_filter?.mode) return jsonResponse({ error: "recipient_filter.mode required" }, 400);
    if (confirm !== true) return jsonResponse({ error: "confirm must be true" }, 400);

    const admin = getAdminClient();
    const { user_ids } = await resolveRecipients(admin, recipient_filter);

    const finalTitle = priority ? `[${priority}] ${title || "系統通知"}` : (title || "系統通知");

    const { data: conversation, error: convErr } = await admin
      .from("conversations")
      .insert({
        title: finalTitle,
        category: category || "system",
        broadcast_filter: recipient_filter as unknown as Record<string, unknown>,
        recipient_count: user_ids.length,
        created_by: auth.userId,
      })
      .select("id")
      .single();
    if (convErr) throw convErr;

    const { error: msgErr } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      content,
      is_system: true,
      sender_id: null,
    });
    if (msgErr) throw msgErr;

    if (user_ids.length > 0) {
      const participants = user_ids.map((uid) => ({
        conversation_id: conversation.id,
        user_id: uid,
        unread: true,
      }));
      const { error: partErr } = await admin.from("conversation_participants").insert(participants);
      if (partErr) throw partErr;
    }

    await logAdminAction({
      operatedBy: auth.userId!,
      entityType: "conversation",
      entityId: conversation.id,
      action: "broadcast",
      reason: `Broadcast to ${user_ids.length} recipients`,
      newValue: { title: finalTitle, filter: recipient_filter, recipients: user_ids.length },
    });

    return jsonResponse({
      success: true,
      conversation_id: conversation.id,
      recipients: user_ids.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
