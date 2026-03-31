import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, Eye, User, CheckCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { difficultyColors } from "@/lib/category-colors";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type Profile = Tables<"profiles">;
type TaskApplication = Tables<"task_applications"> & {
  task_title?: string;
  applicant?: Profile | null;
};

const AdminTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [applications, setApplications] = useState<TaskApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", difficulty: "中階", amount: 0, tags: "", deadline: "" });
  const [editScore, setEditScore] = useState<{ id: string; comment: string } | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", difficulty: "", amount: 0, tags: "", deadline: "", status: "" });
  const [selectedApplicant, setSelectedApplicant] = useState<TaskApplication | null>(null);
  const [applicantHistory, setApplicantHistory] = useState<(Tables<"task_applications"> & { task_title?: string })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingTaskApplicants, setViewingTaskApplicants] = useState<string | null>(null);

  // Reject reason state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const openApplicantDetail = async (app: TaskApplication) => {
    setSelectedApplicant(app);
    setHistoryLoading(true);
    const { data: historyApps } = await supabase
      .from("task_applications")
      .select("*")
      .eq("user_id", app.user_id)
      .order("applied_at", { ascending: false });

    if (historyApps) {
      const enriched = historyApps.map(h => {
        const task = tasks.find(t => t.id === h.task_id);
        return { ...h, task_title: task?.title || "未知任務" };
      });
      setApplicantHistory(enriched);
    }
    setHistoryLoading(false);
  };

  const fetchData = async () => {
    const [tasksRes, appsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_applications").select("*").order("applied_at", { ascending: false }),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (appsRes.data) {
      const userIds = [...new Set(appsRes.data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      const enriched = appsRes.data.map(app => {
        const task = tasksRes.data?.find(t => t.id === app.task_id);
        const applicant = profiles?.find(p => p.id === app.user_id) || null;
        return { ...app, task_title: task?.title || "未知任務", applicant };
      });
      setApplications(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddTask = async () => {
    if (!newTask.title || !user) return;
    const { error } = await supabase.from("tasks").insert({
      title: newTask.title,
      difficulty: newTask.difficulty,
      amount: newTask.amount,
      tags: newTask.tags.split(",").map(t => t.trim()).filter(Boolean),
      deadline: newTask.deadline || null,
      created_by: user.id,
      status: "available",
    });
    if (error) { toast.error("新增失敗：" + error.message); return; }
    toast.success("任務已發布");
    setNewTask({ title: "", difficulty: "中階", amount: 0, tags: "", deadline: "" });
    setShowNewTask(false);
    fetchData();
  };

  const openEditTask = (t: Task) => {
    setEditingTask(t);
    setEditForm({
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      amount: Number(t.amount),
      tags: t.tags.join(", "),
      deadline: t.deadline || "",
      status: t.status,
    });
  };

  const handleEditTask = async () => {
    if (!editingTask) return;
    const { error } = await supabase.from("tasks").update({
      title: editForm.title,
      description: editForm.description,
      difficulty: editForm.difficulty,
      amount: editForm.amount,
      tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      deadline: editForm.deadline || null,
      status: editForm.status,
    }).eq("id", editingTask.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("任務已更新");
    setEditingTask(null);
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("已刪除");
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("task_applications").update({ status: "approved" }).eq("id", id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已通過");
    setSelectedApplicant(null);
    fetchData();
  };

  const handleConfirmComplete = async (id: string) => {
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已確認完成");
    setSelectedApplicant(null);
    fetchData();
  };

  const openRejectDialog = (id: string) => {
    setRejectTarget(id);
    setRejectReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("請填寫退回原因");
      return;
    }
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "rejected", reject_reason: rejectReason.trim() } as any)
      .eq("id", rejectTarget);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已退回");
    setRejectTarget(null);
    setRejectReason("");
    setSelectedApplicant(null);
    fetchData();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { available: "已發布", in_progress: "進行中", completed: "已結束", applied: "待審核", approved: "已通過", rejected: "已退回", pending_completion: "待確認完成" };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === "in_progress" || s === "applied") return "bg-primary/20 text-primary";
    if (s === "pending_completion") return "bg-chart-yellow/20 text-chart-yellow";
    if (s === "completed" || s === "approved") return "bg-success/20 text-success";
    if (s === "rejected") return "bg-destructive/20 text-destructive";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">任務與審核管理</h2>
        <p className="text-sm text-muted-foreground mt-1">發布任務、審核學員申請</p>
      </motion.div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">任務管理</TabsTrigger>
          <TabsTrigger value="review">申請審核</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewTask(true)} className="gap-2"><Plus className="w-4 h-4" /> 發布新任務</Button>
          </div>

          <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>發布新任務</DialogTitle>
                <DialogDescription>設定任務詳細資訊</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="任務標題" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                <Select value={newTask.difficulty} onValueChange={(v) => setNewTask({ ...newTask, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="初級">初級</SelectItem>
                    <SelectItem value="中階">中階</SelectItem>
                    <SelectItem value="高階">高階</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="金額" value={newTask.amount || ""} onChange={(e) => setNewTask({ ...newTask, amount: Number(e.target.value) })} />
                <Input placeholder="技術標籤（逗號分隔）" value={newTask.tags} onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })} />
                <Input type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewTask(false)}>取消</Button>
                <Button onClick={handleAddTask}>發布</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>標題</TableHead>
                  <TableHead>等級</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>標籤</TableHead>
                  <TableHead>截止日</TableHead>
                  <TableHead>申請人數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const taskApps = applications.filter(a => a.task_id === t.id);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell><Badge className={`text-xs border ${difficultyColors[t.difficulty] || ""}`}>{t.difficulty}</Badge></TableCell>
                      <TableCell>${Number(t.amount).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {t.tags.map((tag) => (<Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.deadline || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setViewingTaskApplicants(t.id)}
                          disabled={taskApps.length === 0}
                        >
                          <Users className="w-3.5 h-3.5" />
                          {taskApps.length} 人
                        </Button>
                      </TableCell>
                      <TableCell><Badge className={statusColor(t.status)}>{statusLabel(t.status)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditTask(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        <TabsContent value="review" className="space-y-4">
          <div className="flex gap-2">
            {[
              { value: "all", label: "全部" },
              { value: "applied", label: "待審核" },
              { value: "pending_completion", label: "待確認完成" },
              { value: "approved", label: "已通過" },
              { value: "rejected", label: "已退回" },
            ].map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={statusFilter === f.value ? "default" : "outline"}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任務</TableHead>
                  <TableHead>接案人員</TableHead>
                  <TableHead>學號</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>申請時間</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.filter(a => statusFilter === "all" || a.status === statusFilter).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">尚無申請</TableCell></TableRow>
                ) : applications.filter(a => statusFilter === "all" || a.status === statusFilter).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.task_title}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {a.applicant?.avatar_url ? (
                            <AvatarImage src={a.applicant.avatar_url} alt={a.applicant.display_name} />
                          ) : null}
                          <AvatarFallback className="text-[10px] bg-muted">
                            {a.applicant?.display_name?.slice(0, 1) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{a.applicant?.display_name || "未知"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.applicant?.student_id || "—"}</TableCell>
                    <TableCell><Badge className={statusColor(a.status)}>{statusLabel(a.status)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.applied_at).toLocaleDateString("zh-TW")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openApplicantDetail(a)} title="查看詳情">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {a.status === "applied" && (
                          <>
                            <Button size="sm" variant="ghost" className="text-success" onClick={() => handleApprove(a.id)}><Check className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openRejectDialog(a.id)}><X className="w-4 h-4" /></Button>
                          </>
                        )}
                        {a.status === "pending_completion" && (
                          <Button size="sm" variant="ghost" className="text-success" onClick={() => handleConfirmComplete(a.id)} title="確認完成">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯任務</DialogTitle>
            <DialogDescription>修改任務資訊</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">標題</label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">描述</label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">難度</label>
                <Select value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="初級">初級</SelectItem>
                    <SelectItem value="中階">中階</SelectItem>
                    <SelectItem value="高階">高階</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">金額</label>
                <Input type="number" value={editForm.amount || ""} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">標籤（逗號分隔）</label>
              <Input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">截止日</label>
                <Input type="date" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">狀態</label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">已發布</SelectItem>
                    <SelectItem value="in_progress">進行中</SelectItem>
                    <SelectItem value="completed">已結束</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>取消</Button>
            <Button onClick={handleEditTask}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applicant Detail Dialog */}
      <Dialog open={!!selectedApplicant} onOpenChange={(open) => !open && setSelectedApplicant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>接案人員詳細資料</DialogTitle>
            <DialogDescription>審核參考資訊</DialogDescription>
          </DialogHeader>
          {selectedApplicant?.applicant && (
            <div className="space-y-5">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  {selectedApplicant.applicant.avatar_url ? (
                    <AvatarImage src={selectedApplicant.applicant.avatar_url} alt={selectedApplicant.applicant.display_name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                    {selectedApplicant.applicant.display_name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-foreground">{selectedApplicant.applicant.display_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedApplicant.applicant.email || "無 Email"}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="學號" value={selectedApplicant.applicant.student_id || "—"} />
                <InfoItem label="組織" value={selectedApplicant.applicant.organization_id || "—"} />
                <InfoItem label="累計積分" value={`${selectedApplicant.applicant.total_points} 分`} />
                <InfoItem label="累計收益" value={`$${Number(selectedApplicant.applicant.total_revenue).toLocaleString()}`} />
                <InfoItem label="學習天數" value={`${selectedApplicant.applicant.learning_days} 天`} />
                <InfoItem label="徽章數" value={`${selectedApplicant.applicant.total_badges} 枚`} />
                <InfoItem label="難度偏好" value={selectedApplicant.applicant.difficulty_preference || "—"} />
                <InfoItem label="電話" value={selectedApplicant.applicant.phone || "—"} />
              </div>

              {/* Bio */}
              {selectedApplicant.applicant.bio && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">個人簡介</p>
                  <p className="text-sm text-foreground glass-card p-3">{selectedApplicant.applicant.bio}</p>
                </div>
              )}

              {/* Task Info */}
              <div className="glass-card p-3 space-y-1">
                <p className="text-xs text-muted-foreground">申請任務</p>
                <p className="text-sm font-medium text-foreground">{selectedApplicant.task_title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={statusColor(selectedApplicant.status)}>{statusLabel(selectedApplicant.status)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedApplicant.applied_at).toLocaleDateString("zh-TW")}
                  </span>
                </div>
                {/* Show reject reason if rejected */}
                {selectedApplicant.status === "rejected" && (selectedApplicant as any).reject_reason && (
                  <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-0.5">退回原因</p>
                    <p className="text-sm text-destructive">{(selectedApplicant as any).reject_reason}</p>
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">歷史接案紀錄</p>
                {historyLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : applicantHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">無歷史紀錄</p>
                ) : (
                  <div className="space-y-2">
                    {applicantHistory.map((h) => (
                      <div key={h.id} className="glass-card p-2.5 rounded-lg flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{h.task_title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(h.applied_at).toLocaleDateString("zh-TW")}
                          </p>
                        </div>
                        <Badge className={`ml-2 shrink-0 ${statusColor(h.status)}`}>{statusLabel(h.status)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedApplicant?.status === "applied" && (
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 text-destructive border-destructive/30" onClick={() => openRejectDialog(selectedApplicant.id)}>
                  <X className="w-4 h-4 mr-1" /> 退回
                </Button>
                <Button className="flex-1" onClick={() => handleApprove(selectedApplicant.id)}>
                  <Check className="w-4 h-4 mr-1" /> 通過
                </Button>
              </div>
            )}
            {selectedApplicant?.status === "pending_completion" && (
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 text-destructive border-destructive/30" onClick={() => openRejectDialog(selectedApplicant.id)}>
                  <X className="w-4 h-4 mr-1" /> 退回
                </Button>
                <Button className="flex-1" onClick={() => handleConfirmComplete(selectedApplicant.id)}>
                  <CheckCircle className="w-4 h-4 mr-1" /> 確認完成
                </Button>
              </div>
            )}
            {selectedApplicant?.status !== "applied" && selectedApplicant?.status !== "pending_completion" && (
              <Button variant="outline" onClick={() => setSelectedApplicant(null)}>關閉</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Applicants Dialog */}
      <Dialog open={!!viewingTaskApplicants} onOpenChange={(open) => !open && setViewingTaskApplicants(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>申請者列表</DialogTitle>
            <DialogDescription>
              {viewingTaskApplicants ? tasks.find(t => t.id === viewingTaskApplicants)?.title : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {viewingTaskApplicants && applications.filter(a => a.task_id === viewingTaskApplicants).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">尚無申請者</p>
            ) : (
              applications.filter(a => a.task_id === viewingTaskApplicants).map((a) => (
                <div key={a.id} className="glass-card p-3 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="w-8 h-8 shrink-0">
                      {a.applicant?.avatar_url ? (
                        <AvatarImage src={a.applicant.avatar_url} alt={a.applicant.display_name} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-muted">
                        {a.applicant?.display_name?.slice(0, 1) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.applicant?.display_name || "未知"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.applicant?.student_id || "無學號"} · {new Date(a.applied_at).toLocaleDateString("zh-TW")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={statusColor(a.status)}>{statusLabel(a.status)}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setViewingTaskApplicants(null); openApplicantDetail(a); }}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {a.status === "applied" && (
                      <>
                        <Button size="sm" variant="ghost" className="text-chart-green" onClick={() => handleApprove(a.id)}><Check className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openRejectDialog(a.id)}><X className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                    {a.status === "pending_completion" && (
                      <Button size="sm" variant="ghost" className="text-chart-green" onClick={() => handleConfirmComplete(a.id)}>
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingTaskApplicants(null)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退回原因</DialogTitle>
            <DialogDescription>請填寫退回此申請的原因，學員將會看到此說明。</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="請輸入退回原因..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmReject}>確認退回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-2.5 rounded-lg">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export default AdminTasks;
