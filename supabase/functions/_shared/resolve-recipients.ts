import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface SessionKey {
  course_id: string;
  session_date: string; // 可能是 "YYYY/MM/DD" 或 "YYYY/MM/DD-MM/DD"
}

export interface RecipientFilter {
  mode: "all" | "specific" | "filter";
  user_ids?: string[];
  member_ids?: string[];
  filters?: {
    course_ids?: string[];
    course_ids_all?: string[];
    session_keys?: SessionKey[];
    session_date_from?: string; // ISO YYYY-MM-DD
    session_date_to?: string;   // ISO YYYY-MM-DD
    enrollment_status?: string[];
    course_category?: string[];
    exclude_user_ids?: string[];
  };
}

export interface ResolveResult {
  user_ids: string[];
  preview: { user_id: string; name: string; email: string | null; member_no: string | null }[];
  unactivated_count: number;
}

export function getAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** ISO "YYYY-MM-DD" → "YYYY/MM/DD"（DB 內 session_date 字串格式） */
function isoToSlash(iso: string): string {
  return iso.replace(/-/g, "/");
}

/** 解析 recipient_filter → 已啟用學員 user_id 清單 + 預覽 + 未啟用人數。 */
export async function resolveRecipients(
  admin: SupabaseClient,
  filter: RecipientFilter,
): Promise<ResolveResult> {
  let userIds = new Set<string>();
  let unactivatedCount = 0;

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

    // 取得所有符合條件的 enrollment 列（含 user_id IS NULL 的，用來算 unactivated_count）
    let q = admin.from("reg_enrollments").select("user_id, course_id, session_id, status, session_date");

    if (f.course_ids?.length) q = q.in("course_id", f.course_ids);

    // status：未指定時預設排除 cancelled；指定則完全照使用者選的
    if (f.enrollment_status?.length) {
      q = q.in("status", f.enrollment_status);
    } else {
      q = q.neq("status", "cancelled");
    }

    // course_category 需要 join courses
    if (f.course_category?.length) {
      const { data: cs } = await admin.from("courses").select("id").in("category", f.course_category);
      const allowedCourseIds = (cs || []).map((c: { id: string }) => c.id);
      if (allowedCourseIds.length === 0) {
        return { user_ids: [], preview: [], unactivated_count: 0 };
      }
      q = q.in("course_id", allowedCourseIds);
    }

    // session_keys：用 (course_id, session_date LIKE) 配對。session_date 可能是 "YYYY/MM/DD" 或 "YYYY/MM/DD-MM/DD"
    if (f.session_keys?.length) {
      const orParts: string[] = [];
      for (const sk of f.session_keys) {
        // session_date 格式：開頭一定是 YYYY/MM/DD（單日或跨日字串都吃）
        orParts.push(`and(course_id.eq.${sk.course_id},session_date.like.${sk.session_date}%)`);
      }
      q = q.or(orParts.join(","));
    }

    // session_date_from / to：把 ISO 轉成 YYYY/MM/DD 後做字串比對（格式固定可以排序）
    if (f.session_date_from) q = q.gte("session_date", isoToSlash(f.session_date_from));
    if (f.session_date_to) {
      // 用 lte 比對到 "YYYY/MM/DD~"（斜線 / 後面任何字元，把跨日字串也含進來）
      q = q.lte("session_date", isoToSlash(f.session_date_to) + "~");
    }

    const { data: enrollments } = await q;
    const rows = (enrollments || []) as { user_id: string | null; course_id: string | null }[];

    // 統計未啟用 (user_id IS NULL) 的筆數，用 member 維度去重
    // 簡單算：直接以「user_id 為 null 的列數」回報（避免再多查），UI 顯示「另有 N 筆無法收訊息」
    let candidateRows = rows;

    if (f.course_ids_all?.length) {
      // 必須全部都上過。需要每個 user 的完整課程集合
      const { data: extra } = await admin
        .from("reg_enrollments")
        .select("user_id, course_id")
        .in("course_id", f.course_ids_all)
        .not("user_id", "is", null)
        .neq("status", "cancelled");
      const userToCourses = new Map<string, Set<string>>();
      (extra || []).forEach((r: { user_id: string | null; course_id: string | null }) => {
        if (!r.user_id || !r.course_id) return;
        if (!userToCourses.has(r.user_id)) userToCourses.set(r.user_id, new Set());
        userToCourses.get(r.user_id)!.add(r.course_id);
      });
      const required = new Set(f.course_ids_all);
      const ok = new Set<string>();
      for (const [uid, set] of userToCourses) {
        let pass = true;
        for (const c of required) if (!set.has(c)) { pass = false; break; }
        if (pass) ok.add(uid);
      }
      // 如果同時有其他條件，跟 candidateRows 取交集
      const candidateUserIds = new Set(
        candidateRows.filter((r) => r.user_id).map((r) => r.user_id as string),
      );
      const hasOtherFilters =
        (f.course_ids?.length || 0) > 0 ||
        (f.session_keys?.length || 0) > 0 ||
        !!f.session_date_from ||
        !!f.session_date_to ||
        (f.course_category?.length || 0) > 0;
      if (hasOtherFilters) {
        for (const uid of ok) if (candidateUserIds.has(uid)) userIds.add(uid);
      } else {
        ok.forEach((uid) => userIds.add(uid));
      }
      // unactivated 在 course_ids_all 模式下意義不大，仍以 candidateRows 為準
      unactivatedCount = candidateRows.filter((r) => !r.user_id).length;
    } else {
      candidateRows.forEach((r) => {
        if (r.user_id) userIds.add(r.user_id);
      });
      unactivatedCount = candidateRows.filter((r) => !r.user_id).length;
    }

    // 過濾出已啟用的 user
    if (userIds.size > 0) {
      const ids = [...userIds];
      const { data: prof } = await admin
        .from("profiles")
        .select("id")
        .in("id", ids)
        .eq("activated", true);
      const activated = new Set((prof || []).map((p: { id: string }) => p.id));
      const inactive = ids.filter((id) => !activated.has(id));
      unactivatedCount += inactive.length;
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

  return { user_ids: ids, preview, unactivated_count: unactivatedCount };
}
