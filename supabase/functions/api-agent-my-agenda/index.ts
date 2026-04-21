import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

type AgendaType = "course_session" | "calendar_global" | "calendar_personal";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);
  const userId = v.userId!;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);

  // ---- 解析日期區間（預設：今天 ~ +90 天）----
  const today = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const dateFrom = url.searchParams.get("date_from") ?? toIso(today);
  const defaultTo = new Date(today);
  defaultTo.setDate(defaultTo.getDate() + 90);
  const dateTo = url.searchParams.get("date_to") ?? toIso(defaultTo);

  // ---- 解析 types ----
  const allTypes: AgendaType[] = ["course_session", "calendar_global", "calendar_personal"];
  const typesParam = url.searchParams.get("types");
  const types: AgendaType[] = typesParam
    ? typesParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is AgendaType => allTypes.includes(s as AgendaType))
    : allTypes;
  if (types.length === 0) {
    return jsonResponse({ error: "types 參數無有效值，可選：course_session,calendar_global,calendar_personal" }, 400);
  }

  const courseIdFilter = url.searchParams.get("course_id");
  const categoryFilter = url.searchParams.get("category");

  // ---- 平行查詢 ----
  const tasks: Promise<any>[] = [];

  // 1. course_session
  const fetchSessions = async () => {
    if (!types.includes("course_session")) return [];
    let coursesQ = admin
      .from("courses")
      .select("id, title, course_code, category, price, total_hours, registration_url")
      .eq("status", "published");
    if (categoryFilter) coursesQ = coursesQ.eq("category", categoryFilter);
    if (courseIdFilter) coursesQ = coursesQ.eq("id", courseIdFilter);

    const { data: courses, error: cErr } = await coursesQ;
    if (cErr) throw new Error(`courses: ${cErr.message}`);
    const courseIds = (courses ?? []).map((c) => c.id);
    if (!courseIds.length) return [];

    const { data: sessions, error: sErr } = await admin
      .from("course_sessions")
      .select("id, course_id, title_suffix, start_date, end_date, location, max_students, price, registration_url, status, schedule_type")
      .in("course_id", courseIds)
      .in("status", ["open", "scheduled"])
      .gte("start_date", dateFrom)
      .lte("start_date", dateTo)
      .order("start_date", { ascending: true });

    if (sErr) throw new Error(`sessions: ${sErr.message}`);

    const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
    return (sessions ?? []).map((s: any) => {
      const c: any = courseMap.get(s.course_id) ?? null;
      const title = c
        ? `${c.title}${s.title_suffix ? `（${s.title_suffix}）` : ""}`
        : s.title_suffix ?? "(未命名梯次)";
      return {
        type: "course_session" as const,
        id: s.id,
        date: s.start_date,
        time: null,
        title,
        description: [s.location, s.end_date && s.end_date !== s.start_date ? `~${s.end_date}` : null]
          .filter(Boolean)
          .join(" ｜ "),
        location: s.location,
        registration_url: s.registration_url ?? c?.registration_url ?? null,
        course: c
          ? {
              id: c.id,
              title: c.title,
              course_code: c.course_code,
              category: c.category,
              price: c.price,
            }
          : null,
        extra: {
          status: s.status,
          schedule_type: s.schedule_type,
          end_date: s.end_date,
          max_students: s.max_students,
          session_price: s.price,
        },
      };
    });
  };

  // 2. calendar_global
  const fetchGlobal = async () => {
    if (!types.includes("calendar_global")) return [];
    const { data, error } = await admin
      .from("calendar_events")
      .select("id, title, description, event_date, event_time, color")
      .eq("is_global", true)
      .gte("event_date", dateFrom)
      .lte("event_date", dateTo)
      .order("event_date", { ascending: true });
    if (error) throw new Error(`global: ${error.message}`);
    return (data ?? []).map((e: any) => ({
      type: "calendar_global" as const,
      id: e.id,
      date: e.event_date,
      time: e.event_time,
      title: e.title,
      description: e.description ?? "",
      color: e.color,
    }));
  };

  // 3. calendar_personal
  const fetchPersonal = async () => {
    if (!types.includes("calendar_personal")) return [];
    const { data, error } = await admin
      .from("calendar_events")
      .select("id, title, description, event_date, event_time, color")
      .eq("is_global", false)
      .eq("user_id", userId)
      .gte("event_date", dateFrom)
      .lte("event_date", dateTo)
      .order("event_date", { ascending: true });
    if (error) throw new Error(`personal: ${error.message}`);
    return (data ?? []).map((e: any) => ({
      type: "calendar_personal" as const,
      id: e.id,
      date: e.event_date,
      time: e.event_time,
      title: e.title,
      description: e.description ?? "",
      color: e.color,
    }));
  };

  tasks.push(fetchSessions(), fetchGlobal(), fetchPersonal());

  let sessionItems: any[] = [];
  let globalItems: any[] = [];
  let personalItems: any[] = [];
  try {
    [sessionItems, globalItems, personalItems] = await Promise.all(tasks);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }

  // ---- 合併排序 ----
  const agenda = [...sessionItems, ...globalItems, ...personalItems].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    // 同日期，有時間的排前面
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time < b.time ? -1 : 1;
    return 0;
  });

  return jsonResponse({
    agenda,
    counts: {
      course_session: sessionItems.length,
      calendar_global: globalItems.length,
      calendar_personal: personalItems.length,
      total: agenda.length,
    },
    range: { date_from: dateFrom, date_to: dateTo },
  });
});
