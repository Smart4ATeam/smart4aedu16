import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Question {
  question_no: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string; // single: "B", multi: "A,C"
  points: number;
  multi_select?: boolean;
}

export default function QuizExam() {
  const { quizId } = useParams<{ quizId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { studentName, trainingDate } = (location.state as any) || {};

  // For single-select: string value; for multi-select: comma-separated sorted string
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [unanswered, setUnanswered] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Redirect if no state
  useEffect(() => {
    if (!studentName || !trainingDate) {
      navigate(`/quiz/${quizId}`, { replace: true });
    }
  }, [studentName, trainingDate, quizId, navigate]);

  // Fetch quiz
  const { data: quiz } = useQuery({
    queryKey: ["quiz_exam", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_quizzes")
        .select("*, courses(id, title)")
        .eq("id", quizId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const questions: Question[] = ((quiz?.questions as any[]) || []).sort(
    (a, b) => a.question_no - b.question_no
  );

  // Timer
  useEffect(() => {
    if (quiz?.time_limit_minutes) {
      setTimeLeft(quiz.time_limit_minutes * 60);
    }
  }, [quiz?.time_limit_minutes]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft !== null]);

  const answeredCount = Object.keys(answers).length;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const toggleMultiAnswer = (questionNo: number, opt: string) => {
    setAnswers((prev) => {
      const current = prev[questionNo] ? prev[questionNo].split(",") : [];
      const next = current.includes(opt)
        ? current.filter((v) => v !== opt)
        : [...current, opt];
      next.sort();
      if (next.length === 0) {
        const { [questionNo]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [questionNo]: next.join(",") };
    });
    setUnanswered((prev) => {
      const next = new Set(prev);
      next.delete(questionNo);
      return next;
    });
  };

  const submitMutation = useMutation({
    mutationFn: async (forceSubmit: boolean) => {
      // Validate all answered
      if (!forceSubmit) {
        const missing = questions.filter((q) => !answers[q.question_no]);
        if (missing.length > 0) {
          setUnanswered(new Set(missing.map((q) => q.question_no)));
          const firstMissing = missing[0].question_no;
          questionRefs.current[firstMissing]?.scrollIntoView({ behavior: "smooth", block: "center" });
          throw new Error(`還有 ${missing.length} 題未作答`);
        }
      }

      // Calculate score
      let score = 0;
      const answerRecord: Record<string, string> = {};
      questions.forEach((q) => {
        const userAnswer = answers[q.question_no] || "";
        answerRecord[String(q.question_no)] = userAnswer;

        // Normalize: sort comma-separated values for comparison
        const normalize = (s: string) =>
          s.split(",").map((v) => v.trim().toUpperCase()).sort().join(",");

        if (normalize(userAnswer) === normalize(q.correct_answer)) {
          score += q.points || 5;
        }
      });

      const passed = score >= (quiz?.passing_score || 60);

      const { data, error } = await supabase
        .from("quiz_attempts")
        .insert({
          quiz_id: quizId!,
          user_id: user!.id,
          score,
          passed,
          answers: answerRecord,
        })
        .select("id")
        .single();

      if (error) throw error;
      return { attemptId: data.id, score, passed };
    },
    onSuccess: ({ attemptId }) => {
      navigate(`/quiz/${quizId}/result/${attemptId}`, { replace: true });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setSubmitting(false);
    },
  });

  const handleSubmit = (force = false) => {
    setSubmitting(true);
    setUnanswered(new Set());
    submitMutation.mutate(force);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!quiz || !studentName) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border pb-3 pt-1 -mx-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-foreground">{quiz.title}</h1>
            <p className="text-xs text-muted-foreground">{studentName} · {trainingDate}</p>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft !== null && (
              <Badge variant={timeLeft < 60 ? "destructive" : "outline"} className="gap-1 text-sm">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
              </Badge>
            )}
            <Badge variant="secondary">
              {answeredCount} / {questions.length} 題
            </Badge>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Questions */}
      {questions.map((q) => {
        const isMulti = !!q.multi_select;
        const selectedValues = answers[q.question_no]?.split(",") || [];

        return (
          <Card
            key={q.question_no}
            ref={(el) => { questionRefs.current[q.question_no] = el; }}
            className={cn(
              "transition-all",
              unanswered.has(q.question_no) && "ring-2 ring-destructive border-destructive"
            )}
          >
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="shrink-0 mt-0.5">{q.question_no}</Badge>
                <div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{q.content}</p>
                  {isMulti && (
                    <p className="text-xs text-primary mt-1">（複選題，可選擇多個答案）</p>
                  )}
                </div>
              </div>
              {unanswered.has(q.question_no) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 此題尚未作答
                </p>
              )}

              {isMulti ? (
                <div className="space-y-2 pl-8">
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const optionKey = `option_${opt.toLowerCase()}` as keyof Question;
                    const checked = selectedValues.includes(opt);
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          id={`q${q.question_no}-${opt}`}
                          checked={checked}
                          onCheckedChange={() => toggleMultiAnswer(q.question_no, opt)}
                        />
                        <Label htmlFor={`q${q.question_no}-${opt}`} className="text-sm cursor-pointer">
                          ({opt}) {q[optionKey] as string}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <RadioGroup
                  value={answers[q.question_no] || ""}
                  onValueChange={(val) => {
                    setAnswers((prev) => ({ ...prev, [q.question_no]: val }));
                    setUnanswered((prev) => {
                      const next = new Set(prev);
                      next.delete(q.question_no);
                      return next;
                    });
                  }}
                  className="space-y-2 pl-8"
                >
                  {(["A", "B", "C", "D"] as const).map((opt) => {
                    const optionKey = `option_${opt.toLowerCase()}` as keyof Question;
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`q${q.question_no}-${opt}`} />
                        <Label htmlFor={`q${q.question_no}-${opt}`} className="text-sm cursor-pointer">
                          ({opt}) {q[optionKey] as string}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 z-20">
        <div className="max-w-3xl mx-auto">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? "提交中..." : <><Send className="w-4 h-4" /> 送出測驗</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
