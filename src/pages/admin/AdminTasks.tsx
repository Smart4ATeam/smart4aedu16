import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, Eye, CheckCircle, Users, XCircle, TrendingUp, ClipboardList, Loader2, Clock, FileCheck, CalendarPlus, Coins, RotateCcw } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import ImportTasks from "@/components/admin/ImportTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import TaskOptionsManager from "@/components/admin/TaskOptionsManager";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { difficultyColors } from "@/lib/category-colors";
import { useTaskOptions } from "@/hooks/useTaskOptions";
import type { Tables } from "@/integrations/supabase/types";

type Task = Tables<"tasks">;
type Profile = Tables<"profiles">;
type TaskApplication = Tables<"task_applications"> & {
  task_title?: string;
  applicant?: Profile | null;
};

interface UserStats {
  total_applications: number;
  completed_count: number;
  failed_count: number;
  in_progress_count: number;
  success_rate: number;
}

const TASK_STATUSES = [
  { value: "available", label: "已發布" },
  { value: "in_progress", label: "進行中" },
  { value: "completed", label: "已結束" },
  { value: "closed", label: "已關閉" },
];

const AdminTasks = () => {
  const { user } = useAuth();
  const { activeDifficulties, activeCategories, categoryLabel } = useTaskOptions();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [applications, setApplications] = useState<TaskApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", description: "", difficulty: "中級",
    amount_min: 0, amount_max: 0, category: "general",
    tags: "", deadline: "", admin_notes: "", reward_points: 0,
  });
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", description: "", difficulty: "",
    amount_min: 0, amount_max: 0, category: "general",
    tags: "", deadline: "", status: "", admin_notes: "", reward_points: 0,
  });
  const [selectedApplicant, setSelectedApplicant] = useState<TaskApplication | null>(null);
  const [applicantStats, setApplicantStats] = useState<UserStats | null>(null);
  const [applicantHistory, setApplicantHistory] = useState<(Tables<"task_applications"> & { task_title?: string })[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingTaskApplicants, setViewingTaskApplicants] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Failed mark
  const [failTarget, setFailTarget] = useState<string | null>(null);
  const [failReason, setFailReason] = useState("");

  // Retry / 補件
  const [retryTarget, setRetryTarget] = useState<TaskApplication | null>(null);
  const [retryNote, setRetryNote] = useState("");

  // Final amount on confirm
  const [completeTarget, setCompleteTarget] = useState<TaskApplication | null>(null);
  const [finalAmount, setFinalAmount] = useState<number>(0);
  const [completeAdminNotes, setCompleteAdminNotes] = useState("");

  // Batch
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [batchRejectOpen, setBatchRejectOpen] = useState(false);
  const [batchRejectReason, setBatchRejectReason] = useState("");

  // Stats cache for review table
  const [statsCache, setStatsCache] = useState<Record<string, UserStats>>({});

  // 任務積分發放紀錄
  type PointLog = {
    id: string;
    points_delta: number;
    description: string | null;
    created_at: string;
    member_id: string;
    member_name?: string;
    member_no?: string;
    task_title?: string;
  };
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [pointLogsLoading, setPointLogsLoading] = useState(false);
  const [pointLogSearch, setPointLogSearch] = useState("");

  const fetchPointLogs = async () => {
    setPointLogsLoading(true);
    const { data, error } = await supabase
      .from("reg_point_transactions")
      .select("id, points_delta, description, created_at, member_id")
      .like("description", "任務完成積分獎勵%")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) { toast.error("載入失敗：" + error.message); setPointLogsLoading(false); return; }
    const memberIds = [...new Set((data ?? []).map(d => d.member_id))];
    const { data: members } = memberIds.length
      ? await supabase.from("reg_members").select("id, name, member_no").in("id", memberIds)
      : { data: [] as { id: string; name: string; member_no: string | null }[] };
    const memberMap = new Map((members ?? []).map(m => [m.id, m]));
    const enriched: PointLog[] = (data ?? []).map(d => {
      const m = memberMap.get(d.member_id);
      const title = (d.description || "").replace(/^任務完成積分獎勵：?/, "").trim();
      return {
        id: d.id, points_delta: d.points_delta, description: d.description, created_at: d.created_at,
        member_id: d.member_id, member_name: m?.name, member_no: m?.member_no || undefined,
        task_title: title || "—",
      };
    });
    setPointLogs(enriched);
    setPointLogsLoading(false);
  };

  useEffect(() => { fetchPointLogs(); }, []);

  const filteredPointLogs = useMemo(() => {
    const q = pointLogSearch.trim().toLowerCase();
    if (!q) return pointLogs;
    return pointLogs.filter(p =>
      (p.task_title || "").toLowerCase().includes(q) ||
      (p.member_name || "").toLowerCase().includes(q) ||
      (p.member_no || "").toLowerCase().includes(q)
    );
  }, [pointLogs, pointLogSearch]);

  // 統計卡片：日期區間
  const [statStart, setStatStart] = useState<string>("");
  const [statEnd, setStatEnd] = useState<string>("");

  const cardStats = useMemo(() => {
    const inRange = (iso: string | null | undefined) => {
      if (!iso) return false;
      const d = iso.slice(0, 10);
      if (statStart && d < statStart) return false;
      if (statEnd && d > statEnd) return false;
      return true;
    };
    const hasFilter = !!(statStart || statEnd);
    const tasksInRange = hasFilter ? tasks.filter(t => inRange(t.created_at)) : tasks;
    const appsInRange = hasFilter ? applications.filter(a => inRange(a.applied_at)) : applications;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthlyNew = tasks.filter(t => (t.created_at || "").slice(0, 10) >= monthStart).length;

    const totalPaid = appsInRange
      .filter(a => a.status === "completed")
      .reduce((sum, a) => sum + Number(a.final_amount ?? a.quoted_amount ?? 0), 0);

    return {
      total: tasksInRange.length,
      inProgress: appsInRange.filter(a => a.status === "approved" || a.status === "pending_completion").length,
      pending: appsInRange.filter(a => a.status === "applied").length,
      completed: appsInRange.filter(a => a.status === "completed").length,
      monthlyNew,
      totalPaid,
    };
  }, [tasks, applications, statStart, statEnd]);

  const fetchUserStats = async (userId: string) => {
    if (statsCache[userId]) return statsCache[userId];
    const { data } = await supabase.rpc("get_user_task_stats", { _user_id: userId });
    const stats = (data?.[0] || { total_applications: 0, completed_count: 0, failed_count: 0, in_progress_count: 0, success_rate: 0 }) as UserStats;
    setStatsCache((prev) => ({ ...prev, [userId]: stats }));
    return stats;
  };

  const openApplicantDetail = async (app: TaskApplication) => {
    setSelectedApplicant(app);
    setHistoryLoading(true);
    const stats = await fetchUserStats(app.user_id);
    setApplicantStats(stats);
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
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);
      const enriched = appsRes.data.map(app => {
        const task = tasksRes.data?.find(t => t.id === app.task_id);
        const applicant = profiles?.find(p => p.id === app.user_id) || null;
        return { ...app, task_title: task?.title || "未知任務", applicant };
      });
      setApplications(enriched);
      // Pre-fetch stats for all unique users
      userIds.forEach((uid) => fetchUserStats(uid));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddTask = async () => {
    if (!user) return;
    const tagsArr = newTask.tags.split(",").map(t => t.trim()).filter(Boolean);
    const missing: string[] = [];
    if (!newTask.title.trim()) missing.push("任務標題");
    if (!newTask.description.trim()) missing.push("任務說明");
    if (!newTask.difficulty) missing.push("任務等級");
    if (!newTask.category) missing.push("任務類別");
    if (!newTask.amount_min || newTask.amount_min <= 0) missing.push("最低金額");
    if (!newTask.amount_max || newTask.amount_max <= 0) missing.push("最高金額");
    if (tagsArr.length === 0) missing.push("技術標籤");
    if (!newTask.deadline) missing.push("截止日期");
    if (missing.length > 0) {
      toast.error(`請填寫必填欄位：${missing.join("、")}`);
      return;
    }
    if (newTask.amount_max < newTask.amount_min) {
      toast.error("最高金額不能小於最低金額");
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      title: newTask.title,
      description: newTask.description,
      difficulty: newTask.difficulty,
      amount: newTask.amount_min,
      amount_min: newTask.amount_min,
      amount_max: newTask.amount_max,
      category: newTask.category,
      admin_notes: newTask.admin_notes,
      tags: tagsArr,
      deadline: newTask.deadline || null,
      created_by: user.id,
      status: "available",
      reward_points: newTask.reward_points || 0,
    });
    if (error) { toast.error("新增失敗：" + error.message); return; }
    toast.success("任務已發布");
    setNewTask({ title: "", description: "", difficulty: "中級", amount_min: 0, amount_max: 0, category: "general", tags: "", deadline: "", admin_notes: "", reward_points: 0 });
    setShowNewTask(false);
    fetchData();
  };

  const openEditTask = (t: Task) => {
    setEditingTask(t);
    setEditForm({
      title: t.title,
      description: t.description,
      difficulty: t.difficulty,
      amount_min: Number(t.amount_min ?? t.amount),
      amount_max: Number(t.amount_max ?? t.amount),
      category: t.category || "general",
      tags: t.tags.join(", "),
      deadline: t.deadline || "",
      status: t.status,
      admin_notes: t.admin_notes || "",
      reward_points: Number((t as Task & { reward_points?: number }).reward_points ?? 0),
    });
  };

  const editingHasApplications = useMemo(
    () => !!editingTask && applications.some(a => a.task_id === editingTask.id),
    [editingTask, applications]
  );

  const handleEditTask = async () => {
    if (!editingTask) return;
    if (editingHasApplications) {
      // 已有人申請：僅允許更新 admin_notes 與 status
      const { error } = await supabase.from("tasks").update({
        admin_notes: editForm.admin_notes,
        status: editForm.status,
      }).eq("id", editingTask.id);
      if (error) { toast.error("更新失敗：" + error.message); return; }
      toast.success("已更新備註與狀態");
      setEditingTask(null);
      fetchData();
      return;
    }
    if (editForm.amount_max < editForm.amount_min) {
      toast.error("最高金額不能小於最低金額");
      return;
    }
    const { error } = await supabase.from("tasks").update({
      title: editForm.title,
      description: editForm.description,
      difficulty: editForm.difficulty,
      amount: editForm.amount_min,
      amount_min: editForm.amount_min,
      amount_max: editForm.amount_max,
      category: editForm.category,
      admin_notes: editForm.admin_notes,
      tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean),
      deadline: editForm.deadline || null,
      status: editForm.status,
      reward_points: editForm.reward_points || 0,
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
    toast.success("已通過（已自動發訊息給學員）");
    setSelectedApplicant(null);
    fetchData();
  };

  const openCompleteDialog = (app: TaskApplication) => {
    setCompleteTarget(app);
    setFinalAmount(Number(app.final_amount ?? app.quoted_amount ?? 0));
    setCompleteAdminNotes(app.admin_notes || "");
  };

  const handleConfirmComplete = async () => {
    if (!completeTarget) return;
    const { error } = await supabase
      .from("task_applications")
      .update({
        status: "completed",
        final_amount: finalAmount > 0 ? finalAmount : null,
        admin_notes: completeAdminNotes,
      })
      .eq("id", completeTarget.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已確認完成，獎勵已撥點");
    setCompleteTarget(null);
    setSelectedApplicant(null);
    setStatsCache({});
    fetchData();
  };

  const openRejectDialog = (id: string) => { setRejectTarget(id); setRejectReason(""); };

  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) { toast.error("請填寫退回原因"); return; }
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "rejected", reject_reason: rejectReason.trim() })
      .eq("id", rejectTarget);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已退回");
    setRejectTarget(null); setRejectReason("");
    setSelectedApplicant(null);
    fetchData();
  };

  const openFailDialog = (id: string) => { setFailTarget(id); setFailReason(""); };

  const handleConfirmFail = async () => {
    if (!failTarget) return;
    if (!failReason.trim()) { toast.error("請填寫失敗原因"); return; }
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "failed", failed_reason: failReason.trim() })
      .eq("id", failTarget);
    if (error) { toast.error("標記失敗：" + error.message); return; }
    toast.success("已標記為失敗");
    setFailTarget(null); setFailReason("");
    setSelectedApplicant(null);
    setStatsCache({});
    fetchData();
  };

  const openRetryDialog = (app: TaskApplication) => {
    setRetryTarget(app);
    setRetryNote("");
  };

  const handleConfirmRetry = async () => {
    if (!retryTarget) return;
    if (!retryNote.trim()) { toast.error("請填寫補件說明"); return; }
    const prevNotes = retryTarget.admin_notes ? retryTarget.admin_notes + "\n" : "";
    const stamp = new Date().toLocaleString("zh-TW");
    const { error } = await supabase
      .from("task_applications")
      .update({
        status: "approved",
        failed_at: null,
        failed_reason: null,
        admin_notes: prevNotes + `[${stamp}] 補件：${retryNote.trim()}`,
      })
      .eq("id", retryTarget.id);
    if (error) { toast.error("補件失敗：" + error.message); return; }
    toast.success("已轉回進行中（已通知學員補件）");
    setRetryTarget(null); setRetryNote("");
    setSelectedApplicant(null);
    setStatsCache({});
    fetchData();
  };

  // Batch actions
  const toggleSelectAll = (apps: TaskApplication[]) => {
    if (selectedAppIds.size === apps.length) {
      setSelectedAppIds(new Set());
    } else {
      setSelectedAppIds(new Set(apps.filter(a => a.status === "applied").map(a => a.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAppIds(next);
  };

  const handleBatchApprove = async () => {
    if (selectedAppIds.size === 0) return;
    const ids = [...selectedAppIds];
    const { error } = await supabase.from("task_applications").update({ status: "approved" }).in("id", ids);
    if (error) { toast.error("批次通過失敗：" + error.message); return; }
    toast.success(`已批次通過 ${ids.length} 筆`);
    setSelectedAppIds(new Set());
    fetchData();
  };

  const handleBatchReject = async () => {
    if (!batchRejectReason.trim()) { toast.error("請填寫退回原因"); return; }
    const ids = [...selectedAppIds];
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "rejected", reject_reason: batchRejectReason.trim() })
      .in("id", ids);
    if (error) { toast.error("批次退回失敗：" + error.message); return; }
    toast.success(`已批次退回 ${ids.length} 筆`);
    setSelectedAppIds(new Set());
    setBatchRejectOpen(false);
    setBatchRejectReason("");
    fetchData();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      available: "已發布", in_progress: "進行中", completed: "已結束",
      applied: "待審核", approved: "已通過", rejected: "已退回",
      pending_completion: "待確認完成", failed: "已失敗", closed: "已關閉",
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === "in_progress" || s === "applied" || s === "approved") return "bg-primary/20 text-primary";
    if (s === "pending_completion") return "bg-chart-yellow/20 text-chart-yellow";
    if (s === "completed") return "bg-chart-green/20 text-chart-green";
    if (s === "rejected" || s === "failed") return "bg-destructive/20 text-destructive";
    if (s === "closed") return "bg-muted text-muted-foreground";
    return "";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const filteredApps = applications.filter(a => statusFilter === "all" || a.status === statusFilter);
  const selectableApps = filteredApps.filter(a => a.status === "applied");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">任務管理</h2>
        <p className="text-sm text-muted-foreground mt-1">發布任務、審核學員報價、查看戰績</p>
      </motion.div>

      {/* 統計區：日期篩選 + 6 張卡 */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">統計起始日</Label>
            <Input type="date" value={statStart} onChange={(e) => setStatStart(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">統計結束日</Label>
            <Input type="date" value={statEnd} onChange={(e) => setStatEnd(e.target.value)} className="h-9 w-[160px]" />
          </div>
          {(statStart || statEnd) && (
            <Button variant="ghost" size="sm" onClick={() => { setStatStart(""); setStatEnd(""); }}>
              清除日期
            </Button>
          )}
          <p className="text-xs text-muted-foreground ml-auto">
            {(statStart || statEnd) ? "依日期區間統計" : "顯示全部資料"}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={<ClipboardList className="w-5 h-5" />} value={cardStats.total} label="總任務數" variant="primary" delay={0} />
          <StatCard icon={<Loader2 className="w-5 h-5" />} value={cardStats.inProgress} label="進行中" variant="info" delay={0.05} />
          <StatCard icon={<Clock className="w-5 h-5" />} value={cardStats.pending} label="待審核" variant="warning" delay={0.1} />
          <StatCard icon={<FileCheck className="w-5 h-5" />} value={cardStats.completed} label="已完成" variant="success" delay={0.15} />
          <StatCard icon={<CalendarPlus className="w-5 h-5" />} value={cardStats.monthlyNew} label="本月新增" variant="info" delay={0.2} />
          <StatCard icon={<Coins className="w-5 h-5" />} value={`$${cardStats.totalPaid.toLocaleString()}`} label="總發放金額" variant="warning" delay={0.25} />
        </div>
      </div>


      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">任務列表</TabsTrigger>
          <TabsTrigger value="review">申請審核</TabsTrigger>
          <TabsTrigger value="point-logs">積分發放紀錄</TabsTrigger>
          <TabsTrigger value="options">任務選項</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <ImportTasks onComplete={fetchData} />
            <Button onClick={() => setShowNewTask(true)} className="gap-2"><Plus className="w-4 h-4" /> 發布新任務</Button>
          </div>

          <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>發布新任務</DialogTitle>
                <DialogDescription>設定任務詳細資訊與金額範圍</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <FieldGroup label="任務標題 *" hint="學員列表上看到的主標題，請簡潔有力">
                  <Input placeholder="例：協助製作 LINE 官方帳號自動回覆機器人" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                </FieldGroup>
                <FieldGroup label="任務說明 *" hint="詳細需求、交付標準、可用工具等">
                  <Textarea placeholder="任務內容、預期交付物、驗收標準..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} rows={3} />
                </FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="任務等級 *" hint="影響推薦對象">
                    <Select value={newTask.difficulty} onValueChange={(v) => setNewTask({ ...newTask, difficulty: v })}>
                      <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                      <SelectContent>
                        {activeDifficulties.map(d => <SelectItem key={d.id} value={d.label}>{d.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                  <FieldGroup label="任務類別 *" hint="用於分類與篩選">
                    <Select value={newTask.category} onValueChange={(v) => setNewTask({ ...newTask, category: v })}>
                      <SelectTrigger><SelectValue placeholder="請選擇" /></SelectTrigger>
                      <SelectContent>
                        {activeCategories.map(c => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FieldGroup>
                </div>
                <FieldGroup label="報價區間 *" hint="學員報價需落在此範圍內，超出會被擋下">
                  <div className="grid grid-cols-2 gap-3">
                    <Input type="number" placeholder="最低金額" value={newTask.amount_min || ""} onChange={(e) => setNewTask({ ...newTask, amount_min: Number(e.target.value) })} />
                    <Input type="number" placeholder="最高金額" value={newTask.amount_max || ""} onChange={(e) => setNewTask({ ...newTask, amount_max: Number(e.target.value) })} />
                  </div>
                </FieldGroup>
                <FieldGroup label="技術標籤 *" hint="逗號分隔，例：Dify, Make.com, n8n">
                  <Input placeholder="Dify, Make.com" value={newTask.tags} onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })} />
                </FieldGroup>
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="截止日期 *" hint="過期後系統會自動關閉">
                    <Input type="date" value={newTask.deadline} onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })} />
                  </FieldGroup>
                  <FieldGroup label="完成積分" hint="完成後額外發給接案人員的積分">
                    <Input type="number" min={0} placeholder="例：50" value={newTask.reward_points || ""} onChange={(e) => setNewTask({ ...newTask, reward_points: Number(e.target.value) })} />
                  </FieldGroup>
                </div>
                <FieldGroup label="管理員備註（選填）" hint="僅後台可見，學員看不到">
                  <Textarea placeholder="例：客戶聯絡方式、預算來源、注意事項" value={newTask.admin_notes} onChange={(e) => setNewTask({ ...newTask, admin_notes: e.target.value })} rows={2} />
                </FieldGroup>
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
                  <TableHead>類別</TableHead>
                  <TableHead>等級</TableHead>
                  <TableHead>金額範圍</TableHead>
                  <TableHead>完成積分</TableHead>
                  <TableHead>截止日</TableHead>
                  <TableHead>申請</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const taskApps = applications.filter(a => a.task_id === t.id);
                  const min = Number(t.amount_min ?? t.amount);
                  const max = Number(t.amount_max ?? t.amount);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{categoryLabel(t.category || "general")}</Badge></TableCell>
                      <TableCell><Badge className={`text-xs border ${difficultyColors[t.difficulty] || ""}`}>{t.difficulty}</Badge></TableCell>
                      <TableCell className="text-sm">{min === max ? `$${min.toLocaleString()}` : `$${min.toLocaleString()} ~ $${max.toLocaleString()}`}</TableCell>
                      <TableCell className="text-sm">
                        {(t as Task & { reward_points?: number }).reward_points ? (
                          <span className="inline-flex items-center gap-1 text-chart-yellow font-semibold">
                            <Coins className="w-3.5 h-3.5" />+{(t as Task & { reward_points?: number }).reward_points}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{t.deadline || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setViewingTaskApplicants(t.id)} disabled={taskApps.length === 0}>
                          <Users className="w-3.5 h-3.5" />{taskApps.length}
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
          <div className="flex gap-2 flex-wrap items-center">
            {[
              { value: "all", label: "全部" },
              { value: "applied", label: "待審核" },
              { value: "pending_completion", label: "待確認完成" },
              { value: "approved", label: "已通過" },
              { value: "completed", label: "已完成" },
              { value: "rejected", label: "已退回" },
              { value: "failed", label: "已失敗" },
            ].map((f) => (
              <Button key={f.value} size="sm" variant={statusFilter === f.value ? "default" : "outline"} onClick={() => { setStatusFilter(f.value); setSelectedAppIds(new Set()); }}>
                {f.label}
              </Button>
            ))}
            {selectedAppIds.size > 0 && (
              <div className="ml-auto flex gap-2">
                <span className="text-xs text-muted-foreground self-center">已選 {selectedAppIds.size} 筆</span>
                <Button size="sm" onClick={handleBatchApprove}><Check className="w-3.5 h-3.5 mr-1" />批次通過</Button>
                <Button size="sm" variant="destructive" onClick={() => setBatchRejectOpen(true)}><X className="w-3.5 h-3.5 mr-1" />批次退回</Button>
              </div>
            )}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    {selectableApps.length > 0 && (
                      <Checkbox
                        checked={selectedAppIds.size > 0 && selectedAppIds.size === selectableApps.length}
                        onCheckedChange={() => toggleSelectAll(selectableApps)}
                      />
                    )}
                  </TableHead>
                  <TableHead>任務</TableHead>
                  <TableHead>接案人員</TableHead>
                  <TableHead>戰績（成/敗/率）</TableHead>
                  <TableHead>報價</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>申請時間</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApps.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">尚無申請</TableCell></TableRow>
                ) : filteredApps.map((a) => {
                  const stats = statsCache[a.user_id];
                  const isSelectable = a.status === "applied";
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        {isSelectable && (
                          <Checkbox checked={selectedAppIds.has(a.id)} onCheckedChange={() => toggleSelectOne(a.id)} />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{a.task_title}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            {a.applicant?.avatar_url ? <AvatarImage src={a.applicant.avatar_url} alt={a.applicant.display_name} /> : null}
                            <AvatarFallback className="text-[10px] bg-muted">{a.applicant?.display_name?.slice(0, 1) || "?"}</AvatarFallback>
                          </Avatar>
                          <div className="text-xs">
                            <div>{a.applicant?.display_name || "未知"}</div>
                            <div className="text-[10px] text-muted-foreground">{a.applicant?.student_id || "—"}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {stats ? (
                          <div className="flex items-center gap-1 text-xs">
                            <TrendingUp className="w-3 h-3 text-muted-foreground" />
                            <span className="text-chart-green">{stats.completed_count}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-destructive">{stats.failed_count}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="font-semibold">{stats.success_rate}%</span>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{a.quoted_amount ? `$${Number(a.quoted_amount).toLocaleString()}` : "—"}</TableCell>
                      <TableCell><Badge className={statusColor(a.status)}>{statusLabel(a.status)}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(a.applied_at).toLocaleDateString("zh-TW")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openApplicantDetail(a)} title="查看詳情"><Eye className="w-4 h-4" /></Button>
                          {a.status === "applied" && (
                            <>
                              <Button size="sm" variant="ghost" className="text-chart-green" onClick={() => handleApprove(a.id)} title="通過"><Check className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openRejectDialog(a.id)} title="退回"><X className="w-4 h-4" /></Button>
                            </>
                          )}
                          {a.status === "pending_completion" && (
                            <Button size="sm" variant="ghost" className="text-chart-green" onClick={() => openCompleteDialog(a)} title="確認完成"><CheckCircle className="w-4 h-4" /></Button>
                          )}
                          {(a.status === "approved" || a.status === "pending_completion") && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openFailDialog(a.id)} title="標記為失敗"><XCircle className="w-4 h-4" /></Button>
                          )}
                          {a.status === "failed" && (
                            <Button size="sm" variant="ghost" className="text-primary" onClick={() => openRetryDialog(a)} title="重試 / 補件"><RotateCcw className="w-4 h-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </motion.div>
        </TabsContent>

        <TabsContent value="options">
          <TaskOptionsManager />
        </TabsContent>
      </Tabs>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>編輯任務</DialogTitle>
            <DialogDescription>
              {editingHasApplications ? "此任務已有學員申請，僅能調整狀態與管理員備註" : "修改任務資訊"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {editingHasApplications && (
              <div className="rounded-md border border-chart-yellow/40 bg-chart-yellow/10 px-3 py-2 text-sm text-chart-yellow">
                ⚠️ 已有學員申請此任務，內容已鎖定。如需大幅修改，請關閉此任務後另開新任務。
              </div>
            )}
            <FieldGroup label="任務標題">
              <Input disabled={editingHasApplications} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </FieldGroup>
            <FieldGroup label="任務說明">
              <Textarea disabled={editingHasApplications} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="任務等級">
                <Select disabled={editingHasApplications} value={editForm.difficulty} onValueChange={(v) => setEditForm({ ...editForm, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeDifficulties.map(d => <SelectItem key={d.id} value={d.label}>{d.label}</SelectItem>)}
                    {editForm.difficulty && !activeDifficulties.find(d => d.label === editForm.difficulty) && (
                      <SelectItem value={editForm.difficulty}>{editForm.difficulty}（已停用）</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup label="任務類別">
                <Select disabled={editingHasApplications} value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeCategories.map(c => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
                    {editForm.category && !activeCategories.find(c => c.value === editForm.category) && (
                      <SelectItem value={editForm.category}>{categoryLabel(editForm.category)}（已停用）</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label="報價區間" hint="學員報價需落在此範圍內">
              <div className="grid grid-cols-2 gap-3">
                <Input disabled={editingHasApplications} type="number" placeholder="最低金額" value={editForm.amount_min || ""} onChange={(e) => setEditForm({ ...editForm, amount_min: Number(e.target.value) })} />
                <Input disabled={editingHasApplications} type="number" placeholder="最高金額" value={editForm.amount_max || ""} onChange={(e) => setEditForm({ ...editForm, amount_max: Number(e.target.value) })} />
              </div>
            </FieldGroup>
            <FieldGroup label="技術標籤" hint="逗號分隔">
              <Input disabled={editingHasApplications} value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="截止日期">
                <Input disabled={editingHasApplications} type="date" value={editForm.deadline} onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })} />
              </FieldGroup>
              <FieldGroup label="任務狀態">
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup label="完成積分" hint="完成後額外發給接案人員的積分">
              <Input disabled={editingHasApplications} type="number" min={0} placeholder="例：50" value={editForm.reward_points || ""} onChange={(e) => setEditForm({ ...editForm, reward_points: Number(e.target.value) })} />
            </FieldGroup>
            <FieldGroup label="管理員備註" hint="僅後台可見">
              <Textarea value={editForm.admin_notes} onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })} rows={2} />
            </FieldGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>取消</Button>
            <Button onClick={handleEditTask}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Applicant Detail */}
      <Dialog open={!!selectedApplicant} onOpenChange={(open) => !open && setSelectedApplicant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>接案人員詳細資料</DialogTitle>
            <DialogDescription>審核參考資訊與戰績</DialogDescription>
          </DialogHeader>
          {selectedApplicant?.applicant && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  {selectedApplicant.applicant.avatar_url ? <AvatarImage src={selectedApplicant.applicant.avatar_url} alt={selectedApplicant.applicant.display_name} /> : null}
                  <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">{selectedApplicant.applicant.display_name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-foreground">{selectedApplicant.applicant.display_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedApplicant.applicant.email || "無 Email"}</p>
                </div>
              </div>

              {/* Stats card */}
              {applicantStats && (
                <div className="glass-card p-4 grid grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">總接案</p>
                    <p className="text-lg font-bold text-foreground">{applicantStats.total_applications}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">成功</p>
                    <p className="text-lg font-bold text-chart-green">{applicantStats.completed_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">失敗</p>
                    <p className="text-lg font-bold text-destructive">{applicantStats.failed_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">成功率</p>
                    <p className="text-lg font-bold text-primary">{applicantStats.success_rate}%</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="學號" value={selectedApplicant.applicant.student_id || "—"} />
                <InfoItem label="組織" value={selectedApplicant.applicant.organization_id || "—"} />
                <InfoItem label="累計收益" value={`$${Number(selectedApplicant.applicant.total_revenue).toLocaleString()}`} />
                <InfoItem label="徽章數" value={`${selectedApplicant.applicant.total_badges} 枚`} />
              </div>

              {/* Application info */}
              <div className="glass-card p-3 space-y-2">
                <p className="text-xs text-muted-foreground">申請任務</p>
                <p className="text-sm font-medium text-foreground">{selectedApplicant.task_title}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={statusColor(selectedApplicant.status)}>{statusLabel(selectedApplicant.status)}</Badge>
                  {selectedApplicant.quoted_amount && (
                    <span className="text-xs">報價：<span className="font-semibold text-primary">${Number(selectedApplicant.quoted_amount).toLocaleString()}</span></span>
                  )}
                </div>
                {selectedApplicant.deliverable_url && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">交付連結：</span>
                    <a href={selectedApplicant.deliverable_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{selectedApplicant.deliverable_url}</a>
                  </div>
                )}
                {selectedApplicant.deliverable_note && (
                  <div className="text-xs"><span className="text-muted-foreground">交付說明：</span><span className="text-foreground whitespace-pre-wrap">{selectedApplicant.deliverable_note}</span></div>
                )}
                {selectedApplicant.status === "rejected" && selectedApplicant.reject_reason && (
                  <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-0.5">退回原因</p>
                    <p className="text-sm text-destructive">{selectedApplicant.reject_reason}</p>
                  </div>
                )}
                {selectedApplicant.status === "failed" && selectedApplicant.failed_reason && (
                  <div className="mt-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                    <p className="text-xs text-muted-foreground mb-0.5">失敗原因</p>
                    <p className="text-sm text-destructive">{selectedApplicant.failed_reason}</p>
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">歷史接案紀錄</p>
                {historyLoading ? (
                  <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                ) : applicantHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">無歷史紀錄</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {applicantHistory.map((h) => (
                      <div key={h.id} className="glass-card p-2.5 rounded-lg flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{h.task_title}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(h.applied_at).toLocaleDateString("zh-TW")}</p>
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
                <Button variant="outline" className="flex-1 text-destructive border-destructive/30" onClick={() => openFailDialog(selectedApplicant.id)}>
                  <XCircle className="w-4 h-4 mr-1" /> 標記失敗
                </Button>
                <Button className="flex-1" onClick={() => openCompleteDialog(selectedApplicant)}>
                  <CheckCircle className="w-4 h-4 mr-1" /> 確認完成
                </Button>
              </div>
            )}
            {selectedApplicant?.status === "approved" && (
              <Button variant="outline" className="w-full text-destructive border-destructive/30" onClick={() => openFailDialog(selectedApplicant.id)}>
                <XCircle className="w-4 h-4 mr-1" /> 標記為失敗
              </Button>
            )}
            {!["applied", "pending_completion", "approved"].includes(selectedApplicant?.status || "") && (
              <Button variant="outline" onClick={() => setSelectedApplicant(null)}>關閉</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Applicants */}
      <Dialog open={!!viewingTaskApplicants} onOpenChange={(open) => !open && setViewingTaskApplicants(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>申請者列表</DialogTitle>
            <DialogDescription>{viewingTaskApplicants ? tasks.find(t => t.id === viewingTaskApplicants)?.title : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {viewingTaskApplicants && applications.filter(a => a.task_id === viewingTaskApplicants).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">尚無申請者</p>
            ) : (
              applications.filter(a => a.task_id === viewingTaskApplicants).map((a) => (
                <div key={a.id} className="glass-card p-3 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className="w-8 h-8 shrink-0">
                      {a.applicant?.avatar_url ? <AvatarImage src={a.applicant.avatar_url} alt={a.applicant.display_name} /> : null}
                      <AvatarFallback className="text-xs bg-muted">{a.applicant?.display_name?.slice(0, 1) || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.applicant?.display_name || "未知"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.quoted_amount ? `報價 $${Number(a.quoted_amount).toLocaleString()}` : "未報價"} · {new Date(a.applied_at).toLocaleDateString("zh-TW")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={statusColor(a.status)}>{statusLabel(a.status)}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setViewingTaskApplicants(null); openApplicantDetail(a); }}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
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

      {/* Reject */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退回原因</DialogTitle>
            <DialogDescription>學員會看到此說明，並收到系統訊息通知。</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="請輸入退回原因..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmReject}>確認退回</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Failed */}
      <Dialog open={!!failTarget} onOpenChange={(open) => { if (!open) { setFailTarget(null); setFailReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>標記為失敗</DialogTitle>
            <DialogDescription>學員會看到失敗原因，並計入戰績。</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="請輸入失敗原因..." value={failReason} onChange={(e) => setFailReason(e.target.value)} className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFailTarget(null); setFailReason(""); }}>取消</Button>
            <Button variant="destructive" onClick={handleConfirmFail}>確認失敗</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retry / 補件 */}
      <Dialog open={!!retryTarget} onOpenChange={(open) => { if (!open) { setRetryTarget(null); setRetryNote(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重試 / 補件</DialogTitle>
            <DialogDescription>
              將此申請從「已失敗」轉回「已通過（進行中）」，學員可重新提交完成。請填寫補件說明。
            </DialogDescription>
          </DialogHeader>
          {retryTarget?.failed_reason && (
            <div className="text-xs bg-muted/50 rounded p-2">
              <span className="text-muted-foreground">原失敗原因：</span>
              <span className="text-foreground">{retryTarget.failed_reason}</span>
            </div>
          )}
          <Textarea
            placeholder="例如：交付檔案無法開啟，請於 2 天內重新提交完整內容"
            value={retryNote}
            onChange={(e) => setRetryNote(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRetryTarget(null); setRetryNote(""); }}>取消</Button>
            <Button onClick={handleConfirmRetry}>確認補件</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認完成</DialogTitle>
            <DialogDescription>確認任務完成後，獎勵將自動撥點到該學員。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              學員報價：<span className="text-foreground font-semibold">${Number(completeTarget?.quoted_amount ?? 0).toLocaleString()}</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">最終金額（可調整）</label>
              <Input type="number" value={finalAmount || ""} onChange={(e) => setFinalAmount(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">管理員備註（選填）</label>
              <Textarea value={completeAdminNotes} onChange={(e) => setCompleteAdminNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>取消</Button>
            <Button onClick={handleConfirmComplete}>確認完成並撥獎勵</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Reject */}
      <Dialog open={batchRejectOpen} onOpenChange={(open) => { if (!open) { setBatchRejectOpen(false); setBatchRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批次退回 {selectedAppIds.size} 筆申請</DialogTitle>
            <DialogDescription>所有選取的申請會收到相同的退回原因。</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="請輸入退回原因..." value={batchRejectReason} onChange={(e) => setBatchRejectReason(e.target.value)} className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBatchRejectOpen(false); setBatchRejectReason(""); }}>取消</Button>
            <Button variant="destructive" onClick={handleBatchReject}>確認批次退回</Button>
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

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

export default AdminTasks;
