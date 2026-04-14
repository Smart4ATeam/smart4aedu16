import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, Award, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function QuizResult() {
  const { quizId, attemptId } = useParams<{ quizId: string; attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Check existing certificate
  const { data: existingCert } = useQuery({
    queryKey: ["cert_check", attemptId],
    enabled: !!attemptId && !!attempt?.passed,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificates")
        .select("id, status")
        .eq("quiz_attempt_id", attemptId!)
        .maybeSingle();
      return data;
    },
  });

  // Apply for certificate
  const certMutation = useMutation({
    mutationFn: async () => {
      if (!attempt || !user) throw new Error("缺少資料");
      const quiz = attempt.course_quizzes as any;
      const answers = attempt.answers as Record<string, string>;
      // Get student name from answers metadata or profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase
        .from("certificates")
        .insert({
          user_id: user.id,
          quiz_attempt_id: attempt.id,
          course_id: quiz.course_id,
          course_name: quiz.courses?.title || quiz.title,
          student_name: profile?.display_name || "學員",
          training_date: new Date().toISOString().split("T")[0],
          score: attempt.score,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("已申請結訓證明！");
      queryClient.invalidateQueries({ queryKey: ["cert_check"] });
      navigate(`/certificate/${data.id}`);
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

  const quiz = attempt.course_quizzes as any;
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
              <p className="text-sm text-muted-foreground">恭喜通過！您可以申請結訓證明</p>
              {existingCert ? (
                <Button className="w-full gap-2" onClick={() => navigate(`/certificate/${existingCert.id}`)}>
                  <Eye className="w-4 h-4" /> 查看證書
                </Button>
              ) : (
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
