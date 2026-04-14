import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Clock, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function QuizEntry() {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const today = new Date().toISOString().split("T")[0];

  // Fetch quiz details
  const { data: quiz, isLoading: quizLoading } = useQuery({
    queryKey: ["quiz_detail", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_quizzes")
        .select("*, courses(id, title, category)")
        .eq("id", quizId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch reg_members for this user
  const { data: member } = useQuery({
    queryKey: ["reg_member_for_quiz", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reg_members" as any)
        .select("id, name")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data as unknown as { id: string; name: string } | null;
    },
  });

  // Fetch user's enrollments for this course
  const { data: courseEnrollments = [], isLoading: enrollLoading } = useQuery({
    queryKey: ["quiz_course_enrollments", member?.id, quiz?.course_id],
    enabled: !!member?.id && !!quiz?.course_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reg_enrollments")
        .select("id, session_date, status, payment_status")
        .eq("member_id", member!.id)
        .eq("course_id", quiz!.course_id)
        .neq("status", "cancelled")
        .eq("payment_status", "paid");
      return data || [];
    },
  });

  // Filter enrollments: only session_date <= today
  const eligibleEnrollments = courseEnrollments.filter((e: any) => {
    if (!e.session_date) return false;
    const firstDate = e.session_date.split("~")[0].trim();
    return firstDate <= today;
  });

  // Check if user already passed (for no-retake quizzes)
  const { data: existingPass } = useQuery({
    queryKey: ["quiz_pass_check", quizId, user?.id],
    enabled: !!quizId && !!user && quiz?.allow_retake === false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, score")
        .eq("quiz_id", quizId!)
        .eq("user_id", user!.id)
        .eq("passed", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Set name from reg_members (locked)
  useEffect(() => {
    if (member?.name) setStudentName(member.name);
  }, [member]);

  const questions = (quiz?.questions as any[]) || [];
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 5), 0);
  const alreadyPassed = !quiz?.allow_retake && !!existingPass;

  // Enrollment validation states
  const hasNoMember = !member && !enrollLoading && !!user;
  const hasNoEnrollment = !!member && courseEnrollments.length === 0 && !enrollLoading && !!quiz;
  const hasNoPastSession = !!member && courseEnrollments.length > 0 && eligibleEnrollments.length === 0 && !enrollLoading;
  const blocked = hasNoMember || hasNoEnrollment || hasNoPastSession;

  const handleStart = () => {
    if (!studentName.trim()) {
      toast.error("請填寫學員姓名");
      return;
    }
    if (!trainingDate) {
      toast.error("請選擇訓練日期");
      return;
    }
    if (questions.length === 0) {
      toast.error("此測驗尚無題目");
      return;
    }
    navigate(`/quiz/${quizId}/exam`, {
      state: { studentName, trainingDate },
    });
  };

  if (quizLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>找不到此測驗</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/learning")}>返回學習中心</Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Quiz Info Card */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <ClipboardCheck className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl">{quiz.title}</CardTitle>
          <CardDescription>{(quiz as any).courses?.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{quiz.description}</p>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="secondary">共 {questions.length} 題</Badge>
            <Badge variant="secondary">滿分 {totalPoints} 分</Badge>
            <Badge variant="secondary">及格 {quiz.passing_score} 分</Badge>
            {quiz.time_limit_minutes && (
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" /> {quiz.time_limit_minutes} 分鐘
              </Badge>
            )}
            {quiz.allow_retake && <Badge variant="outline">可重考</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Blocked: no enrollment */}
      {blocked ? (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
          <CardContent className="pt-6 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-orange-500 mx-auto" />
            <p className="font-semibold text-foreground">
              {hasNoPastSession ? "課程尚未開始，無法進行測驗" : "您尚未報名此課程，無法進行測驗"}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasNoPastSession ? "請在上課當天或之後再進行測驗" : "請先完成課程報名並繳費"}
            </p>
            <Button variant="outline" onClick={() => navigate("/learning")}>返回學習中心</Button>
          </CardContent>
        </Card>
      ) : alreadyPassed ? (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="font-semibold text-foreground">您已通過此測驗（{existingPass!.score} 分）</p>
            <p className="text-sm text-muted-foreground">此測驗不允許重考</p>
            <Button variant="outline" onClick={() => navigate("/learning")}>返回學習中心</Button>
          </CardContent>
        </Card>
      ) : (
        /* Entry Form */
        <Card>
          <CardHeader>
            <CardTitle className="text-base">填寫基本資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentName">學員姓名</Label>
              <Input
                id="studentName"
                value={studentName}
                readOnly
                className="bg-muted cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">姓名由報名資料自動帶入，無法修改</p>
            </div>
            <div className="space-y-2">
              <Label>訓練日期 *</Label>
              <Select value={trainingDate} onValueChange={setTrainingDate}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇訓練日期" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleEnrollments.map((e: any) => (
                    <SelectItem key={e.id} value={e.session_date}>
                      {e.session_date}
                    </SelectItem>
                  ))}
                  {eligibleEnrollments.length === 0 && (
                    <SelectItem value="no-session" disabled>尚無可選梯次</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full mt-2" size="lg" onClick={handleStart} disabled={questions.length === 0}>
              開始測驗
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
