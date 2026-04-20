import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminToken, logAdminAction, jsonResponse, corsHeaders } from "../_shared/verify-admin-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const v = await verifyAdminToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const userId = url.searchParams.get("user_id");
      const studentId = url.searchParams.get("student_id");
      const email = url.searchParams.get("email");

      // 列出所有 achievements
      const { data: achievements, error: achErr } = await admin.from("achievements").select("*").order("created_at");
      if (achErr) return jsonResponse({ error: achErr.message }, 500);

      // 若指定學員，附上該學員已獲得列表
      let resolvedUserId = userId;
      if (!resolvedUserId && (studentId || email)) {
        let pq = admin.from("profiles").select("id").limit(1);
        if (studentId) pq = pq.eq("student_id", studentId);
        else if (email) pq = pq.eq("email", email);
        const { data: p } = await pq.maybeSingle();
        if (p) resolvedUserId = p.id;
      }

      let user_achievements: any[] = [];
      if (resolvedUserId) {
        const { data } = await admin
          .from("user_achievements")
          .select("id, achievement_id, earned_at, achievements(name, icon, description)")
          .eq("user_id", resolvedUserId);
        user_achievements = data ?? [];
      }

      return jsonResponse({ achievements, user_achievements, user_id: resolvedUserId });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { action, confirm, confirm_delete, ...payload } = body;
      if (!confirm) return jsonResponse({ error: "需要 confirm:true（請先跟操作者確認）" }, 400);

      // 解析 user_id
      const resolveUserId = async (): Promise<string | null> => {
        if (payload.user_id) return payload.user_id;
        if (payload.student_id) {
          const { data } = await admin.from("profiles").select("id").eq("student_id", payload.student_id).maybeSingle();
          return data?.id ?? null;
        }
        if (payload.email) {
          const { data } = await admin.from("profiles").select("id").eq("email", payload.email).maybeSingle();
          return data?.id ?? null;
        }
        return null;
      };

      // 解析 achievement_id
      const resolveAchievementId = async (): Promise<{ id: string; name: string } | null> => {
        if (payload.achievement_id) {
          const { data } = await admin.from("achievements").select("id, name").eq("id", payload.achievement_id).maybeSingle();
          return data ?? null;
        }
        if (payload.achievement_name) {
          const { data } = await admin.from("achievements").select("id, name").eq("name", payload.achievement_name).maybeSingle();
          return data ?? null;
        }
        return null;
      };

      if (action === "award") {
        const userId = await resolveUserId();
        if (!userId) return jsonResponse({ error: "找不到對應學員（請提供 user_id / student_id / email）" }, 404);
        const ach = await resolveAchievementId();
        if (!ach) return jsonResponse({ error: "找不到成就（請提供 achievement_id 或 achievement_name）" }, 404);

        const { data: existing } = await admin.from("user_achievements").select("id").eq("user_id", userId).eq("achievement_id", ach.id).maybeSingle();
        if (existing) return jsonResponse({ error: "該學員已擁有此成就", award_id: existing.id }, 409);

        const { data, error } = await admin.from("user_achievements").insert({ user_id: userId, achievement_id: ach.id }).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({
          operatedBy: v.userId!,
          entityType: "achievement_award",
          entityId: data.id,
          action: "award",
          reason: payload.reason ?? `Agent 頒發成就：${ach.name}`,
          newValue: { user_id: userId, achievement_id: ach.id, achievement_name: ach.name },
        });
        return jsonResponse({ success: true, award: data, achievement_name: ach.name });
      }

      if (action === "revoke") {
        if (!payload.award_id) return jsonResponse({ error: "award_id 為必填" }, 400);
        if (!confirm_delete) return jsonResponse({ error: "撤銷需 confirm_delete:true（雙確認）" }, 400);
        const { data: oldRow } = await admin.from("user_achievements").select("*, achievements(name)").eq("id", payload.award_id).maybeSingle();
        if (!oldRow) return jsonResponse({ error: "Award not found" }, 404);
        const { error } = await admin.from("user_achievements").delete().eq("id", payload.award_id);
        if (error) return jsonResponse({ error: error.message }, 500);
        await logAdminAction({
          operatedBy: v.userId!,
          entityType: "achievement_award",
          entityId: payload.award_id,
          action: "revoke",
          reason: payload.reason ?? "Agent 撤銷成就",
          oldValue: oldRow,
        });
        return jsonResponse({ success: true });
      }

      return jsonResponse({ error: "Unknown action" }, 400);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
