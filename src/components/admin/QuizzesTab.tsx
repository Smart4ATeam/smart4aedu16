import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, ListPlus, ClipboardCheck, Upload } from "lucide-react";
import { toast } from "sonner";

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

const emptyQuestion: Question = {
  question_no: 1,
  content: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "A",
  points: 5,
  multi_select: false,
};

export function QuizzesTab({ courses }: { courses: any[] }) {
  const queryClient = useQueryClient();
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showQuestionsPanel, setShowQuestionsPanel] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importJson, setImportJson] = useState("");

  // Quiz form state
  const [form, setForm] = useState({
    title: "",
    course_id: "",
    passing_score: 60,
    time_limit_minutes: 30,
    allow_retake: true,
    description: "",
  });

  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin_quizzes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_quizzes")
        .select("*, courses(title)");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (quiz: any) => {
      if (quiz.id) {
        const { error } = await supabase
          .from("course_quizzes")
          .update({
            title: quiz.title,
            course_id: quiz.course_id,
            passing_score: quiz.passing_score,
            time_limit_minutes: quiz.time_limit_minutes,
            allow_retake: quiz.allow_retake,
            description: quiz.description,
          })
          .eq("id", quiz.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_quizzes").insert({
          title: quiz.title,
          course_id: quiz.course_id,
          passing_score: quiz.passing_score,
          time_limit_minutes: quiz.time_limit_minutes,
          allow_retake: quiz.allow_retake,
          description: quiz.description,
          questions: [],
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("測驗已儲存");
      queryClient.invalidateQueries({ queryKey: ["admin_quizzes"] });
      setShowDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("測驗已刪除");
      queryClient.invalidateQueries({ queryKey: ["admin_quizzes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveQuestionsMutation = useMutation({
    mutationFn: async ({ quizId, questions }: { quizId: string; questions: Question[] }) => {
      const { error } = await supabase
        .from("course_quizzes")
        .update({ questions: questions as any })
        .eq("id", quizId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("題目已儲存");
      queryClient.invalidateQueries({ queryKey: ["admin_quizzes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreateDialog = () => {
    setEditingQuiz(null);
    setForm({ title: "", course_id: "", passing_score: 60, time_limit_minutes: 30, allow_retake: true, description: "" });
    setShowDialog(true);
  };

  const openEditDialog = (quiz: any) => {
    setEditingQuiz(quiz);
    setForm({
      title: quiz.title,
      course_id: quiz.course_id,
      passing_score: quiz.passing_score,
      time_limit_minutes: quiz.time_limit_minutes || 30,
      allow_retake: quiz.allow_retake ?? true,
      description: quiz.description || "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.title || !form.course_id) {
      toast.error("請填寫標題與選擇課程");
      return;
    }
    saveMutation.mutate({ ...form, id: editingQuiz?.id });
  };

  // Questions management
  const currentQuiz = quizzes.find((q: any) => q.id === showQuestionsPanel);
  const currentQuestions: Question[] = (currentQuiz?.questions as unknown as Question[]) || [];

  const handleSaveQuestion = () => {
    if (!editingQuestion || !showQuestionsPanel) return;
    if (!editingQuestion.content.trim()) {
      toast.error("請填寫題目內容");
      return;
    }
    const updated = [...currentQuestions];
    if (editingQuestionIndex !== null) {
      updated[editingQuestionIndex] = editingQuestion;
    } else {
      updated.push({ ...editingQuestion, question_no: updated.length + 1 });
    }
    // Re-number
    updated.forEach((q, i) => (q.question_no = i + 1));
    saveQuestionsMutation.mutate({ quizId: showQuestionsPanel, questions: updated });
    setEditingQuestion(null);
    setEditingQuestionIndex(null);
  };

  const handleDeleteQuestion = (index: number) => {
    if (!showQuestionsPanel) return;
    const updated = currentQuestions.filter((_, i) => i !== index);
    updated.forEach((q, i) => (q.question_no = i + 1));
    saveQuestionsMutation.mutate({ quizId: showQuestionsPanel, questions: updated });
  };

  const handleImport = () => {
    if (!showQuestionsPanel) return;
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error("JSON 必須是陣列");
      const validated: Question[] = parsed.map((q: any, i: number) => ({
        question_no: q.question_no || i + 1,
        content: q.content || "",
        option_a: q.option_a || "",
        option_b: q.option_b || "",
        option_c: q.option_c || "",
        option_d: q.option_d || "",
        correct_answer: (q.correct_answer || "A").toUpperCase(),
        points: q.points || 5,
        multi_select: q.multi_select || false,
      }));
      // Merge: replace by question_no, append new
      const existing = [...currentQuestions];
      validated.forEach((q) => {
        const idx = existing.findIndex((e) => e.question_no === q.question_no);
        if (idx >= 0) existing[idx] = q;
        else existing.push(q);
      });
      existing.sort((a, b) => a.question_no - b.question_no);
      existing.forEach((q, i) => (q.question_no = i + 1));
      saveQuestionsMutation.mutate({ quizId: showQuestionsPanel, questions: existing });
      setShowImportDialog(false);
      setImportJson("");
      toast.success(`已匯入 ${validated.length} 題`);
    } catch (e: any) {
      toast.error("JSON 格式錯誤：" + e.message);
    }
  };

  // Questions panel view
  if (showQuestionsPanel) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => { setShowQuestionsPanel(null); setEditingQuestion(null); setEditingQuestionIndex(null); }}>
              ← 返回測驗列表
            </Button>
            <h2 className="font-semibold text-foreground mt-1">{currentQuiz?.title} — 題庫管理</h2>
            <p className="text-xs text-muted-foreground">共 {currentQuestions.length} 題，總分 {currentQuestions.reduce((s, q) => s + q.points, 0)} 分</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" />批次匯入
            </Button>
            <Button size="sm" onClick={() => { setEditingQuestion({ ...emptyQuestion, question_no: currentQuestions.length + 1 }); setEditingQuestionIndex(null); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />新增題目
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: question list */}
          <div className="glass-card rounded-xl p-4 space-y-2 max-h-[65vh] overflow-y-auto">
            {currentQuestions.length === 0 && (
              <p className="text-center text-muted-foreground py-8">尚無題目，請新增或批次匯入</p>
            )}
            {currentQuestions.map((q, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${editingQuestionIndex === idx ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onClick={() => { setEditingQuestion({ ...q }); setEditingQuestionIndex(idx); }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    第 {q.question_no} 題 · {q.content.slice(0, 30)}{q.content.length > 30 ? "..." : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{q.points} 分</Badge>
                    {q.multi_select && <Badge variant="secondary" className="text-xs">複選</Badge>}
                    <Badge className="text-xs">答：{q.correct_answer}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(idx); }}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="glass-card rounded-xl p-4">
            {editingQuestion ? (
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm">
                  {editingQuestionIndex !== null ? `編輯第 ${editingQuestion.question_no} 題` : "新增題目"}
                </h3>
                <div>
                  <Label>題目內容</Label>
                  <Textarea value={editingQuestion.content} onChange={(e) => setEditingQuestion({ ...editingQuestion, content: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {(["A", "B", "C", "D"] as const).map((opt) => (
                    <div key={opt}>
                      <Label>選項 {opt}</Label>
                      <Input
                        value={editingQuestion[`option_${opt.toLowerCase()}` as keyof Question] as string}
                        onChange={(e) => setEditingQuestion({ ...editingQuestion, [`option_${opt.toLowerCase()}`]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <Label>複選題</Label>
                  <Switch
                    checked={editingQuestion.multi_select || false}
                    onCheckedChange={(checked) => setEditingQuestion({
                      ...editingQuestion,
                      multi_select: checked,
                      correct_answer: checked ? "" : "A",
                    })}
                  />
                </div>
                <div>
                  <Label>正確答案{editingQuestion.multi_select ? "（可複選）" : ""}</Label>
                  {editingQuestion.multi_select ? (
                    <div className="flex gap-4 mt-1">
                      {["A", "B", "C", "D"].map((opt) => {
                        const selected = editingQuestion.correct_answer.split(",").includes(opt);
                        return (
                          <div key={opt} className="flex items-center gap-1">
                            <Checkbox
                              id={`ans-multi-${opt}`}
                              checked={selected}
                              onCheckedChange={(checked) => {
                                const current = editingQuestion.correct_answer ? editingQuestion.correct_answer.split(",").filter(Boolean) : [];
                                const next = checked
                                  ? [...current, opt].sort()
                                  : current.filter((v) => v !== opt);
                                setEditingQuestion({ ...editingQuestion, correct_answer: next.join(",") });
                              }}
                            />
                            <Label htmlFor={`ans-multi-${opt}`} className="text-sm">{opt}</Label>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <RadioGroup value={editingQuestion.correct_answer} onValueChange={(v) => setEditingQuestion({ ...editingQuestion, correct_answer: v })} className="flex gap-4 mt-1">
                      {["A", "B", "C", "D"].map((opt) => (
                        <div key={opt} className="flex items-center gap-1">
                          <RadioGroupItem value={opt} id={`ans-${opt}`} />
                          <Label htmlFor={`ans-${opt}`} className="text-sm">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </div>
                <div>
                  <Label>分數</Label>
                  <Input type="number" value={editingQuestion.points} onChange={(e) => setEditingQuestion({ ...editingQuestion, points: Number(e.target.value) || 5 })} className="w-24" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveQuestion} disabled={saveQuestionsMutation.isPending}>儲存題目</Button>
                  <Button variant="outline" onClick={() => { setEditingQuestion(null); setEditingQuestionIndex(null); }}>取消</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                <ClipboardCheck className="w-8 h-8 mr-2 opacity-30" />
                點選左側題目進行編輯，或新增題目
              </div>
            )}
          </div>
        </div>

        {/* Import dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>批次匯入題目 (JSON)</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">貼上 JSON 陣列，重複題號將覆蓋現有題目。</p>
              <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">{`[{
  "question_no": 1,
  "content": "題目內容",
  "option_a": "選項A",
  "option_b": "選項B",
  "option_c": "選項C",
  "option_d": "選項D",
  "correct_answer": "B",
  "points": 5
}]`}</pre>
              <Textarea value={importJson} onChange={(e) => setImportJson(e.target.value)} rows={8} placeholder="貼上 JSON..." />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>取消</Button>
              <Button onClick={handleImport} disabled={!importJson.trim()}>匯入</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Quiz list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">測驗管理</h2>
        <Button size="sm" onClick={openCreateDialog}><Plus className="w-3.5 h-3.5 mr-1" />新增測驗</Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>測驗標題</TableHead>
              <TableHead>所屬課程</TableHead>
              <TableHead>題數</TableHead>
              <TableHead>及格分</TableHead>
              <TableHead>時間限制</TableHead>
              <TableHead>重考</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quizzes.map((q: any) => {
              const qCount = Array.isArray(q.questions) ? q.questions.length : 0;
              return (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.title}</TableCell>
                  <TableCell className="text-sm">{q.courses?.title || "-"}</TableCell>
                  <TableCell className="text-sm">{qCount} 題</TableCell>
                  <TableCell className="text-sm">{q.passing_score} 分</TableCell>
                  <TableCell className="text-sm">{q.time_limit_minutes || "-"} 分鐘</TableCell>
                  <TableCell><Badge variant={q.allow_retake ? "default" : "secondary"} className="text-xs">{q.allow_retake ? "允許" : "不可"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => setShowQuestionsPanel(q.id)}>
                        <ListPlus className="w-3.5 h-3.5 mr-1" />題庫
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(q)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("確定刪除此測驗？")) deleteMutation.mutate(q.id); }}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {quizzes.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">尚未建立測驗</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit quiz dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingQuiz ? "編輯測驗" : "新增測驗"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>測驗標題</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例：AI Agent 實戰訓後測驗" />
            </div>
            <div>
              <Label>所屬課程</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                <SelectTrigger><SelectValue placeholder="選擇課程" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>測驗說明</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="測驗注意事項..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>及格分數</Label>
                <Input type="number" value={form.passing_score} onChange={(e) => setForm({ ...form, passing_score: Number(e.target.value) })} />
              </div>
              <div>
                <Label>時間限制（分鐘）</Label>
                <Input type="number" value={form.time_limit_minutes} onChange={(e) => setForm({ ...form, time_limit_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.allow_retake} onCheckedChange={(v) => setForm({ ...form, allow_retake: v })} />
              <Label>允許重考</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>{editingQuiz ? "更新" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
