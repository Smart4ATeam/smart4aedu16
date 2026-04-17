import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUserToken, corsHeaders, jsonResponse } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await verifyUserToken(req);
  if (!auth.ok) return jsonResponse({ error: auth.error, code: "UNAUTHORIZED" }, auth.status ?? 401);
  const userId = auth.userId!;

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const u = new URL(req.url);

    // ====== GET ======
    if (req.method === "GET") {
      const id = u.searchParams.get("id");

      // Single task with my application
      if (id) {
        const { data: task, error } = await admin.from("tasks").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (!task) return jsonResponse({ error: "Task not found", code: "TASK_NOT_FOUND" }, 404);
        const { data: myApp } = await admin
          .from("task_applications")
          .select("*")
          .eq("task_id", id)
          .eq("user_id", userId)
          .maybeSingle();
        const { data: stats } = await admin.rpc("get_user_task_stats", { _user_id: userId });
        return jsonResponse({ task, my_application: myApp, my_stats: stats?.[0] ?? null });
      }

      const filter = (u.searchParams.get("filter") || "available").toLowerCase();
      const q = u.searchParams.get("q")?.trim().toLowerCase();
      const category = u.searchParams.get("category")?.trim();
      const difficulty = u.searchParams.get("difficulty")?.trim();
      const limit = Math.min(Number(u.searchParams.get("limit") || 30), 100);

      let tasksQ = admin.from("tasks").select("*").order("created_at", { ascending: false }).limit(limit);
      if (filter === "available") tasksQ = tasksQ.eq("status", "available");
      if (category) tasksQ = tasksQ.eq("category", category);
      if (difficulty) tasksQ = tasksQ.eq("difficulty", difficulty);

      const { data: allTasks, error: tErr } = await tasksQ;
      if (tErr) throw tErr;

      const { data: myApps } = await admin.from("task_applications").select("*").eq("user_id", userId);
      const appByTask = new Map((myApps ?? []).map((a) => [a.task_id, a]));

      let result = (allTasks ?? []).map((t) => ({
        ...t,
        admin_notes: undefined, // never expose
        my_application: appByTask.get(t.id) ?? null,
      }));

      if (q) {
        result = result.filter((t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.tags || []).some((tag: string) => tag.toLowerCase().includes(q))
        );
      }

      // Filter by my application status
      const filterByMine = (s: string | null) => result.filter((t) => t.my_application?.status === s);
      switch (filter) {
        case "mine": result = result.filter((t) => !!t.my_application); break;
        case "in_progress": result = filterByMine("approved"); break;
        case "pending": result = filterByMine("applied"); break;
        case "pending_completion": result = filterByMine("pending_completion"); break;
        case "completed": result = filterByMine("completed"); break;
        case "failed": result = filterByMine("failed"); break;
        case "rejected": result = filterByMine("rejected"); break;
      }

      const { data: stats } = await admin.rpc("get_user_task_stats", { _user_id: userId });

      return jsonResponse({ tasks: result, total: result.length, my_stats: stats?.[0] ?? null });
    }

    // ====== POST: apply with quote ======
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { task_id, quoted_amount } = body;
      if (!task_id || typeof quoted_amount !== "number") {
        return jsonResponse({ error: "task_id and quoted_amount required", code: "INVALID_INPUT" }, 400);
      }

      const { data: task } = await admin.from("tasks").select("*").eq("id", task_id).maybeSingle();
      if (!task) return jsonResponse({ error: "Task not found", code: "TASK_NOT_FOUND" }, 404);
      if (task.status !== "available") return jsonResponse({ error: "Task not available", code: "TASK_NOT_AVAILABLE" }, 400);
      if (task.deadline && new Date(task.deadline) < new Date(new Date().toDateString())) {
        return jsonResponse({ error: "Deadline passed", code: "DEADLINE_PASSED" }, 400);
      }
      const min = Number(task.amount_min ?? task.amount);
      const max = Number(task.amount_max ?? task.amount);
      if (quoted_amount < min || quoted_amount > max) {
        return jsonResponse({ error: `報價必須在 ${min} ~ ${max} 之間`, code: "AMOUNT_OUT_OF_RANGE" }, 400);
      }

      const { data: existing } = await admin
        .from("task_applications")
        .select("id")
        .eq("task_id", task_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) return jsonResponse({ error: "已申請過此任務", code: "ALREADY_APPLIED" }, 400);

      const { data: created, error } = await admin
        .from("task_applications")
        .insert({ task_id, user_id: userId, quoted_amount })
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({ success: true, application: created, message: "報價已送出，等待管理員審核。" }, 201);
    }

    // ====== PATCH: report complete ======
    if (req.method === "PATCH") {
      const application_id = u.searchParams.get("application_id");
      if (!application_id) return jsonResponse({ error: "application_id required", code: "INVALID_INPUT" }, 400);

      const body = await req.json().catch(() => ({}));
      const { action, deliverable_url, deliverable_note } = body;
      if (action !== "report_complete") {
        return jsonResponse({ error: "Only action=report_complete allowed", code: "INVALID_ACTION" }, 400);
      }

      const { data: app } = await admin
        .from("task_applications")
        .select("*")
        .eq("id", application_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!app) return jsonResponse({ error: "Application not found", code: "NOT_FOUND" }, 404);
      if (app.status !== "approved") {
        return jsonResponse({ error: "只能在進行中的任務回報完成", code: "INVALID_STATUS" }, 400);
      }

      const updates: Record<string, unknown> = { status: "pending_completion" };
      if (deliverable_url) updates.deliverable_url = deliverable_url;
      if (deliverable_note) updates.deliverable_note = deliverable_note;

      const { data: updated, error } = await admin
        .from("task_applications")
        .update(updates)
        .eq("id", application_id)
        .select()
        .single();
      if (error) throw error;

      return jsonResponse({ success: true, application: updated, message: "已回報完成，等待管理員確認。" });
    }

    return jsonResponse({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" }, 405);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg, code: "INTERNAL_ERROR" }, 500);
  }
});
