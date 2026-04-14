import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, Award, Loader2, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function QuizResult() {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { studentName: entryName, trainingDate: entryTrainingDate } = (location.state as any) || {};
  const queryClient = useQueryClient();

  const getMetaField = (field: string) => {
    const meta = (attempt?.answers as any)?._meta;
    return meta?.[field] || null;
  };

  // Fetch attempt
  const { data: attempt, isLoading } = useQuery({
    queryKey: ["quiz_attempt_result", attemptId],
    enabled: !!attemptId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, course_quizzes(id, title, course_id, passing_score, allow_retake, courses(title))")
        .eq("id", attemptId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const quiz = attempt?.course_quizzes as any;
  const courseId = quiz?.course_id;
  const trainingDate = entryTrainingDate || getMetaField("trainingDate");

  // Check existing certificate for same user + course + training_date (not failed/replaced)
  const { data: existingCert } = useQuery({
    queryKey: ["cert_check_by_course", user?.id, courseId, trainingDate],
    enabled: !!user && !!courseId && !!trainingDate && !!attempt?.passed,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, status, score")
        .eq("user_id", user!.id)
        .eq("course_id", courseId)
        .eq("training_date", trainingDate)
        .not("status", "in", '("failed","replaced")')
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Get reg_members name for locked student name
  const { data: memberName } = useQuery({
    queryKey: ["reg_member_name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reg_members" as any)
        .select("name")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return (data as any)?.name || null;
    },
  });

  const resolvedName = memberName || entryName || getMetaField("studentName");
  const newScore = attempt?.score || 0;
  const oldScore = existingCert?.score || 0;
  const isHigherScore = existingCert && newScore > oldScore;
  const isLowerOrEqual = existingCert && newScore <= oldScore;

  // Apply / upgrade certificate
  const certMutation = useMutation({
    mutationFn: async () => {
      if (!attempt || !user) throw new Error("缺少資料");

      // If upgrading, mark old cert as replaced
      if (existingCert) {
        await supabase
          .from("certificates")
          .update({ status: "replaced" })
          .eq("id", existingCert.id);
      }

      // Get profile name as fallback
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      // Insert new certificate
      const { data: certData, error } = await supabase
        .from("certificates")
        .insert({
          user_id: user.id,
          quiz_attempt_id: attempt.id,
          course_id: courseId,
          course_name: quiz.courses?.title || quiz.title,
          student_name: resolvedName || profile?.display_name || "學員",
          training_date: trainingDate || new Date().toISOString().split("T")[0],
          score: newScore,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;

      // Call Edge Function
      const { error: fnError } = await supabase.functions.invoke("request-certificate", {
        body: { certificate_id: certData.id },
      });
      if (fnError) console.error("Edge function error:", fnError);

      return certData;
    },
    onSuccess: () => {
      toast.success(existingCert ? "已更新證書申請（新高分）！" : "已申請結訓證明，產生完成後會發送通知！");
      queryClient.invalidateQueries({ queryKey: ["cert_check_by_course"] });
    },
    onError: (e: Error) => {
      toast.error(e.message.includes("duplicate") ? "已申請過證書" : "申請失敗：" + e.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>找不到測驗結果</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/learning")}>返回學習中心</Button>
      </div>
    );
  }

  const passed = attempt.passed;

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <Card className="overflow-hidden">
        {/* Result Header */}
        <div className={cn(
          "p-8 text-center",
          passed
            ? "bg-gradient-to-b from-green-50 to-transparent dark:from-green-950/20"
            : "bg-gradient-to-b from-red-50 to-transparent dark:from-red-950/20"
        )}>
          {passed ? (
            <>
              <div className="text-4xl mb-3">🎉</div>
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
            </>
          ) : (
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-3" />
          )}
          <p className={cn(
            "text-5xl font-bold mb-2",
            passed ? "text-green-500" : "text-destructive"
          )}>
            {attempt.score} <span className="text-lg font-normal text-muted-foreground">分</span>
          </p>
          <Badge variant={passed ? "default" : "destructive"} className="text-sm">
            {passed ? "恭喜通過！" : "未通過"}
          </Badge>
        </div>

        <CardContent className="pt-6 space-y-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{quiz?.courses?.title}</p>
            <p className="font-semibold text-foreground">{quiz?.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              及格分數：{quiz?.passing_score || 60} 分 · {new Date(attempt.attempted_at).toLocaleString("zh-TW")}
            </p>
          </div>

          {passed ? (
            <div className="space-y-2">
              {isLowerOrEqual ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    您已有此梯次的證書（{oldScore} 分），本次分數未超過，無法更新
                  </p>
                  <Button className="w-full gap-2" onClick={() => navigate(`/certificate/${existingCert!.id}`)}>
                    <Eye className="w-4 h-4" /> 查看現有證書
                  </Button>
                </>
              ) : isHigherScore ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    🎉 新高分！舊證書 {oldScore} 分 → 新分數 {newScore} 分，可更新證書
                  </p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => certMutation.mutate()}
                    disabled={certMutation.isPending}
                  >
                    {certMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 更新中...</>
                    ) : (
                      <><TrendingUp className="w-4 h-4" /> 更新證書（新高分）</>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">恭喜通過！您可以申請結訓證明</p>
                  <Button
                    className="w-full gap-2"
                    onClick={() => certMutation.mutate()}
                    disabled={certMutation.isPending}
                  >
                    {certMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 申請中...</>
                    ) : (
                      <><Award className="w-4 h-4" /> 申請結訓證明</>
                    )}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">很遺憾，本次測驗未通過，請再加油！</p>
              {quiz?.allow_retake !== false && (
                <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/quiz/${quizId}`)}>
                  <RotateCcw className="w-4 h-4" /> 重新測驗
                </Button>
              )}
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={() => navigate("/learning")}>
            返回學習中心
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
