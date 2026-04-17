import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  corsHeaders,
  jsonResponse,
  verifyUserToken,
} from "../_shared/verify-user-token.ts";

const SERVER_LOCATIONS = ["US1", "US2", "US3", "EU1", "EU2", "EU3"];
const DIFFICULTIES = ["初級", "中級", "高級"];
const DAILY_TIMES = ["30 分鐘", "1 小時", "2 小時", "3 小時以上"];

const PROFILE_FIELDS = ["display_name", "phone", "bio"] as const;
const ENV_FIELDS = ["organization_id", "server_location"] as const;
const LEARNING_FIELDS = [
  "learning_goal",
  "difficulty_preference",
  "daily_learning_time",
] as const;

const ALL_ALLOWED = [
  ...PROFILE_FIELDS,
  ...ENV_FIELDS,
  ...LEARNING_FIELDS,
];

function shape(profile: any) {
  return {
    profile: {
      display_name: profile?.display_name ?? "",
      phone: profile?.phone ?? null,
      bio: profile?.bio ?? "",
      avatar_url: profile?.avatar_url ?? null,
      email: profile?.email ?? null,
      student_id: profile?.student_id ?? null,
    },
    environment: {
      organization_id: profile?.organization_id ?? null,
      server_location: profile?.server_location ?? "US1",
    },
    learning: {
      learning_goal: profile?.learning_goal ?? "",
      difficulty_preference: profile?.difficulty_preference ?? "初級",
      daily_learning_time: profile?.daily_learning_time ?? "1 小時",
    },
    server_location_options: SERVER_LOCATIONS,
    difficulty_options: DIFFICULTIES,
    daily_learning_time_options: DAILY_TIMES,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await verifyUserToken(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, auth.status ?? 401);
  }
  const userId = auth.userId!;

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  try {
    if (req.method === "GET") {
      const { data, error } = await admin
        .from("profiles")
        .select(
          "display_name, phone, bio, avatar_url, email, student_id, organization_id, server_location, learning_goal, difficulty_preference, daily_learning_time",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse(shape(data));
    }

    if (req.method === "PATCH") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return jsonResponse({ error: "Body 必須為 JSON 物件" }, 400);
      }

      // Reject any non-allowlisted top-level keys
      const rejected = Object.keys(body).filter(
        (k) => !ALL_ALLOWED.includes(k as any),
      );
      if (rejected.length > 0) {
        return jsonResponse(
          {
            error: "包含不允許的欄位",
            rejected,
            allowed: ALL_ALLOWED,
          },
          400,
        );
      }

      const update: Record<string, any> = {};

      // profile fields
      if (body.display_name !== undefined) {
        if (typeof body.display_name !== "string" || body.display_name.length > 50) {
          return jsonResponse(
            { error: "display_name 必須為字串且 ≤50 字" },
            400,
          );
        }
        update.display_name = body.display_name;
      }
      if (body.phone !== undefined) {
        if (body.phone !== null && (typeof body.phone !== "string" || body.phone.length > 20)) {
          return jsonResponse({ error: "phone 必須為字串且 ≤20 字" }, 400);
        }
        update.phone = body.phone;
      }
      if (body.bio !== undefined) {
        if (typeof body.bio !== "string" || body.bio.length > 500) {
          return jsonResponse({ error: "bio 必須為字串且 ≤500 字" }, 400);
        }
        update.bio = body.bio;
      }

      // environment
      if (body.organization_id !== undefined) {
        if (
          body.organization_id !== null &&
          (typeof body.organization_id !== "string" ||
            body.organization_id.length > 50)
        ) {
          return jsonResponse(
            { error: "organization_id 必須為字串且 ≤50 字" },
            400,
          );
        }
        update.organization_id = body.organization_id;
      }
      if (body.server_location !== undefined) {
        if (!SERVER_LOCATIONS.includes(body.server_location)) {
          return jsonResponse(
            {
              error: "server_location 不合法",
              allowed: SERVER_LOCATIONS,
            },
            400,
          );
        }
        update.server_location = body.server_location;
      }

      // learning
      if (body.learning_goal !== undefined) {
        if (typeof body.learning_goal !== "string" || body.learning_goal.length > 200) {
          return jsonResponse(
            { error: "learning_goal 必須為字串且 ≤200 字" },
            400,
          );
        }
        update.learning_goal = body.learning_goal;
      }
      if (body.difficulty_preference !== undefined) {
        if (!DIFFICULTIES.includes(body.difficulty_preference)) {
          return jsonResponse(
            {
              error: "difficulty_preference 不合法",
              allowed: DIFFICULTIES,
            },
            400,
          );
        }
        update.difficulty_preference = body.difficulty_preference;
      }
      if (body.daily_learning_time !== undefined) {
        if (!DAILY_TIMES.includes(body.daily_learning_time)) {
          return jsonResponse(
            {
              error: "daily_learning_time 不合法",
              allowed: DAILY_TIMES,
            },
            400,
          );
        }
        update.daily_learning_time = body.daily_learning_time;
      }

      if (Object.keys(update).length === 0) {
        return jsonResponse({ error: "沒有可更新的欄位" }, 400);
      }

      const { error: upErr } = await admin
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (upErr) return jsonResponse({ error: upErr.message }, 500);

      const { data } = await admin
        .from("profiles")
        .select(
          "display_name, phone, bio, avatar_url, email, student_id, organization_id, server_location, learning_goal, difficulty_preference, daily_learning_time",
        )
        .eq("id", userId)
        .maybeSingle();
      return jsonResponse(shape(data));
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
