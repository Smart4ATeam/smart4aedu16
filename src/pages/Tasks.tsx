import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { TaskCard } from "@/components/TaskCard";
import { Target, Zap, CheckCircle, Clock, Loader2, Hourglass, Search } from "lucide-react";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import { PaymentActionPanel } from "@/components/payment/PaymentActionPanel";

type FilterType = "all" | "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected" | "failed" | "closed";
type SortType = "newest" | "amount-desc" | "amount-asc" | "deadline";

const Tasks = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [keyword, setKeyword] = useState("");
  const [tasks, setTasks] = useState<Tables<"tasks">[]>([]);
  const [applications, setApplications] = useState<Tables<"task_applications">[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});

  useEffect(() => { fetchData(); }, [user]);

  // Debounced fetch：避免短時間內大量 realtime 事件觸發過多重刷
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      fetchData();
      debounceTimerRef.current = null;
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime: 任何人接案/狀態變動時即時刷新（已防抖）
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("tasks-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_applications" },
        () => { debouncedFetch(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => { debouncedFetch(); }
      )
      .subscribe();
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [takenTaskIds, setTakenTaskIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [tasksRes, appsRes, countsRes, takenRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_applications").select("*").eq("user_id", user.id),
      supabase.rpc("get_task_application_counts"),
      supabase
        .from("task_applications")
        .select("task_id")
        .in("status", ["approved", "pending_completion", "completed", "payment_pending_info", "payment_pending_signature", "payment_pending_review", "payment_processing", "paid"]),
    ]);
    if (tasksRes.error) toast.error("載入任務失敗");
    else setTasks(tasksRes.data ?? []);
    if (!appsRes.error) setApplications(appsRes.data ?? []);
    if (!countsRes.error && countsRes.data) {
      const counts: Record<string, number> = {};
      (countsRes.data as { task_id: string; count: number }[]).forEach((r) => {
        counts[r.task_id] = Number(r.count);
      });
      setAppCounts(counts);
    }
    if (!takenRes.error && takenRes.data) {
      setTakenTaskIds(new Set((takenRes.data as { task_id: string }[]).map((r) => r.task_id)));
    }
    setLoading(false);
  };

  type EffectiveStatus = "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected" | "failed" | "closed";

  const tasksWithUserStatus = useMemo(() => {
    const appMap = new Map(applications.map((a) => [a.task_id, a]));
    return tasks.map((task) => {
      const app = appMap.get(task.id);
      let effectiveStatus: EffectiveStatus = "available";
      let rejectReason: string | undefined;
      let failedReason: string | undefined;
      let quotedAmount: number | undefined;
      let finalAmount: number | undefined;
      const applicationId: string | undefined = app?.id;

      if (app) {
        const a = app as Tables<"task_applications">;
        switch (a.status) {
          case "applied": effectiveStatus = "pending"; break;
          case "approved": effectiveStatus = "in-progress"; break;
          case "pending_completion": effectiveStatus = "pending-completion"; break;
          case "completed":
          case "payment_pending_info":
          case "payment_pending_signature":
          case "payment_pending_review":
          case "payment_processing":
          case "paid":
            effectiveStatus = "completed";
            break;
          case "rejected":
            effectiveStatus = "rejected";
            rejectReason = a.reject_reason || undefined;
            break;
          case "failed":
            effectiveStatus = "failed";
            failedReason = a.failed_reason || undefined;
            break;
          default: effectiveStatus = "pending";
        }
        quotedAmount = a.quoted_amount ?? undefined;
        finalAmount = a.final_amount ?? undefined;
      } else if (task.status === "closed" || takenTaskIds.has(task.id)) {
        effectiveStatus = "closed";
      }

      return { ...task, effectiveStatus, applicationId, rejectReason, failedReason, quotedAmount, finalAmount };
    });
  }, [tasks, applications, takenTaskIds]);

  const filtered = useMemo(() => {
    let list = filter === "all"
      ? tasksWithUserStatus
      : tasksWithUserStatus.filter((t) => t.effectiveStatus === filter);

    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter((t) =>
        t.title.toLowerCase().includes(k) ||
        t.description.toLowerCase().includes(k) ||
        (t.tags || []).some((tag) => tag.toLowerCase().includes(k))
      );
    }

    const sorted = [...list];
    switch (sort) {
      case "amount-desc":
        sorted.sort((a, b) => Number(b.amount_max ?? b.amount) - Number(a.amount_max ?? a.amount));
        break;
      case "amount-asc":
        sorted.sort((a, b) => Number(a.amount_min ?? a.amount) - Number(b.amount_min ?? b.amount));
        break;
      case "deadline":
        sorted.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });
        break;
      default:
        sorted.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    return sorted;
  }, [tasksWithUserStatus, filter, keyword, sort]);

  const stats = useMemo(() => {
    const available = tasksWithUserStatus.filter((t) => t.effectiveStatus === "available").length;
    const pending = tasksWithUserStatus.filter((t) => t.effectiveStatus === "pending").length;
    const inProgress = tasksWithUserStatus.filter((t) => t.effectiveStatus === "in-progress").length;
    const totalRevenue = tasksWithUserStatus
      .filter((t) => t.effectiveStatus === "completed")
      .reduce((sum, t) => sum + Number(t.finalAmount ?? t.quotedAmount ?? t.amount), 0);
    return { available, pending, inProgress, totalRevenue };
  }, [tasksWithUserStatus]);

  const handleApply = async (taskId: string, quotedAmount: number, appliedNote: string) => {
    if (!user) return;
    setApplying(taskId);
    const payload: Record<string, unknown> = {
      task_id: taskId,
      user_id: user.id,
      quoted_amount: quotedAmount,
    };
    if (appliedNote) payload.applied_note = appliedNote;
    const { error } = await supabase.from("task_applications").insert(payload as never);
    setApplying(null);
    if (error) toast.error(error.message);
    else { toast.success("已送出報價，等待審核中！"); fetchData(); }
  };

  const handleReportComplete = async (applicationId: string, deliverableUrl: string, deliverableNote: string) => {
    if (!user || !applicationId) return;
    setReporting(applicationId);
    const updates: Partial<Tables<"task_applications">> = { status: "pending_completion" };
    if (deliverableUrl) updates.deliverable_url = deliverableUrl;
    if (deliverableNote) updates.deliverable_note = deliverableNote;
    const { error } = await supabase
      .from("task_applications")
      .update(updates)
      .eq("id", applicationId);
    setReporting(null);
    if (error) toast.error(error.message);
    else { toast.success("已回報完成，等待管理員確認！"); fetchData(); }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "available", label: "可接任務" },
    { key: "pending", label: "審核中" },
    { key: "in-progress", label: "進行中" },
    { key: "pending-completion", label: "待確認完成" },
    { key: "completed", label: "已完成" },
    { key: "rejected", label: "已退回" },
    { key: "failed", label: "已失敗" },
    { key: "closed", label: "已關閉" },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground">任務中心</h2>
        <p className="text-sm text-muted-foreground mt-1">接案任務、報價、提升技能並賺取收益</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Target className="w-5 h-5" />} value={stats.available} label="可接任務" variant="primary" delay={0} />
        <StatCard icon={<Hourglass className="w-5 h-5" />} value={stats.pending} label="審核中" variant="info" delay={0.05} />
        <StatCard icon={<Zap className="w-5 h-5" />} value={stats.inProgress} label="進行中" variant="success" delay={0.1} />
        <StatCard icon={<Clock className="w-5 h-5" />} value={`$${stats.totalRevenue.toLocaleString()}`} label="累計收益" variant="warning" delay={0.15} />
      </div>

      <PaymentActionPanel />

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋任務標題、描述、標籤..." className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">最新發布</SelectItem>
            <SelectItem value="amount-desc">金額由高到低</SelectItem>
            <SelectItem value="amount-asc">金額由低到高</SelectItem>
            <SelectItem value="deadline">截止日最近</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">目前沒有符合條件的任務</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((task, i) => (
            <TaskCard
              key={task.id}
              task={{
                id: task.id,
                title: task.title,
                description: task.description,
                amountMin: Number(task.amount_min ?? task.amount),
                amountMax: Number(task.amount_max ?? task.amount),
                category: task.category,
                tags: task.tags,
                status: task.effectiveStatus as "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected" | "failed" | "closed",
                deadline: task.deadline ?? "",
                difficulty: task.difficulty,
                rejectReason: task.rejectReason,
                failedReason: task.failedReason,
                quotedAmount: task.quotedAmount,
                finalAmount: task.finalAmount,
                applicantCount: appCounts[task.id] || 0,
                rewardPoints: Number((task as { reward_points?: number }).reward_points ?? 0),
              }}
              delay={i * 0.03}
              onApply={(q, note) => handleApply(task.id, q, note)}
              onReportComplete={(url, note) => handleReportComplete(task.applicationId!, url, note)}
              applying={applying === task.id}
              reporting={reporting === task.applicationId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Tasks;
