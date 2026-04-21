import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface RecipientFilter {
  mode: "all" | "specific" | "filter";
  user_ids?: string[];
  member_ids?: string[];
  filters?: {
    course_ids?: string[];
    course_ids_all?: string[];
    session_ids?: string[];
    session_date_from?: string;
    session_date_to?: string;
    enrollment_status?: string[];
    course_category?: string[];
    exclude_user_ids?: string[];
  };
}

export interface ResolveResult {
  user_ids: string[];
  preview: { user_id: string; name: string; email: string | null; member_no: string | null }[];
}

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** 解析 recipient_filter → 已啟用學員 user_id 清單 + 預覽資料。 */
export async function resolveRecipients(
  admin: SupabaseClient,
  filter: RecipientFilter,
): Promise<ResolveResult> {
  let userIds = new Set<string>();

  if (filter.mode === "all") {
    const { data } = await admin.from("profiles").select("id").eq("activated", true);
    (data || []).forEach((r: { id: string }) => userIds.add(r.id));
  } else if (filter.mode === "specific") {
    (filter.user_ids || []).forEach((id) => id && userIds.add(id));
    if (filter.member_ids?.length) {
      const { data } = await admin
        .from("reg_members")
        .select("user_id")
        .in("id", filter.member_ids)
        .not("user_id", "is", null);
      (data || []).forEach((r: { user_id: string | null }) => r.user_id && userIds.add(r.user_id));
    }
  } else if (filter.mode === "filter") {
    const f = filter.filters || {};

    // Build base enrollments query
    let q = admin.from("reg_enrollments").select("user_id, course_id, session_id, status, session_date");

    if (f.course_ids?.length) q = q.in("course_id", f.course_ids);
    if (f.session_ids?.length) q = q.in("session_id", f.session_ids);
    if (f.enrollment_status?.length) q = q.in("status", f.enrollment_status);
    if (f.session_date_from) q = q.gte("session_date", f.session_date_from);
    if (f.session_date_to) q = q.lte("session_date", f.session_date_to);

    // course_category needs course join
    let allowedCourseIds: string[] | null = null;
    if (f.course_category?.length) {
      const { data: cs } = await admin.from("courses").select("id").in("category", f.course_category);
      allowedCourseIds = (cs || []).map((c: { id: string }) => c.id);
      q = q.in("course_id", allowedCourseIds);
    }

    const { data: enrollments } = await q.not("user_id", "is", null);
    const rows = (enrollments || []) as { user_id: string; course_id: string | null }[];

    if (f.course_ids_all?.length) {
      // require user has enrollment in EVERY course in course_ids_all
      const userToCourses = new Map<string, Set<string>>();
      for (const r of rows) {
        if (!r.user_id || !r.course_id) continue;
        if (!userToCourses.has(r.user_id)) userToCourses.set(r.user_id, new Set());
        userToCourses.get(r.user_id)!.add(r.course_id);
      }
      // we need ALL courses → fetch separately if course_ids was empty
      let extraRows = rows;
      if (!f.course_ids?.length) {
        const { data: extra } = await admin
          .from("reg_enrollments")
          .select("user_id, course_id")
          .in("course_id", f.course_ids_all)
          .not("user_id", "is", null);
        extraRows = (extra || []) as { user_id: string; course_id: string | null }[];
        for (const r of extraRows) {
          if (!r.user_id || !r.course_id) continue;
          if (!userToCourses.has(r.user_id)) userToCourses.set(r.user_id, new Set());
          userToCourses.get(r.user_id)!.add(r.course_id);
        }
      }
      const required = new Set(f.course_ids_all);
      for (const [uid, set] of userToCourses) {
        let ok = true;
        for (const c of required) if (!set.has(c)) { ok = false; break; }
        if (ok) userIds.add(uid);
      }
    } else {
      rows.forEach((r) => r.user_id && userIds.add(r.user_id));
    }

    // Filter to activated users only
    if (userIds.size > 0) {
      const ids = [...userIds];
      const { data: prof } = await admin
        .from("profiles")
        .select("id")
        .in("id", ids)
        .eq("activated", true);
      const activated = new Set((prof || []).map((p: { id: string }) => p.id));
      userIds = new Set([...ids].filter((id) => activated.has(id)));
    }

    (f.exclude_user_ids || []).forEach((id) => userIds.delete(id));
  }

  const ids = [...userIds];
  let preview: ResolveResult["preview"] = [];
  if (ids.length > 0) {
    const { data: members } = await admin
      .from("reg_members")
      .select("user_id, name, email, member_no")
      .in("user_id", ids);
    const byUser = new Map<string, { name: string; email: string | null; member_no: string | null }>();
    (members || []).forEach((m: { user_id: string; name: string; email: string | null; member_no: string | null }) => {
      if (m.user_id) byUser.set(m.user_id, { name: m.name, email: m.email, member_no: m.member_no });
    });
    // fallback to profiles for names
    const missing = ids.filter((id) => !byUser.has(id));
    if (missing.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, display_name, email, student_id")
        .in("id", missing);
      (profs || []).forEach((p: { id: string; display_name: string; email: string | null; student_id: string | null }) => {
        byUser.set(p.id, { name: p.display_name, email: p.email, member_no: p.student_id });
      });
    }
    preview = ids.map((uid) => ({
      user_id: uid,
      name: byUser.get(uid)?.name || "(未知)",
      email: byUser.get(uid)?.email || null,
      member_no: byUser.get(uid)?.member_no || null,
    }));
  }

  return { user_ids: ids, preview };
}
