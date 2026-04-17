import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, verifyUserToken } from "../_shared/verify-user-token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const v = await verifyUserToken(req);
  if (!v.ok) return jsonResponse({ error: v.error }, v.status ?? 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId");

  let q = admin
    .from("course_quizzes")
    .select("id, course_id, title, description, passing_score, time_limit_minutes, allow_retake, reward_points, questions");
  if (courseId) q = q.eq("course_id", courseId);

  const { data, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  // Strip correct answers from questions before returning
  const sanitized = (data ?? []).map((quiz: any) => ({
    ...quiz,
    questions: Array.isArray(quiz.questions)
      ? quiz.questions.map((q: any) => {
          const { correct_answer, answer, correct, ...rest } = q ?? {};
          return rest;
        })
      : [],
  }));

  return jsonResponse({ quizzes: sanitized });
});
