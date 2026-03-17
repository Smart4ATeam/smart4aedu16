import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { TaskCard } from "@/components/TaskCard";
import { Target, Zap, CheckCircle, Clock, Loader2, Hourglass } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type FilterType = "all" | "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected";

const Tasks = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [tasks, setTasks] = useState<Tables<"tasks">[]>([]);
  const [applications, setApplications] = useState<Tables<"task_applications">[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [tasksRes, appsRes, countsRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("task_applications").select("*").eq("user_id", user.id),
      supabase.rpc("get_task_application_counts"),
    ]);
    if (tasksRes.error) toast.error("載入任務失敗");
    else setTasks(tasksRes.data ?? []);
    if (!appsRes.error) setApplications(appsRes.data ?? []);
    if (!countsRes.error && countsRes.data) {
      const counts: Record<string, number> = {};
      (countsRes.data as any[]).forEach((r: { task_id: string; count: number }) => {
        counts[r.task_id] = Number(r.count);
      });
      setAppCounts(counts);
    }
    setLoading(false);
  };

  const tasksWithUserStatus = useMemo(() => {
    const appMap = new Map(applications.map((a) => [a.task_id, a]));
    return tasks.map((task) => {
      const app = appMap.get(task.id);
      let effectiveStatus: "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected" = "available";
      let rejectReason: string | undefined;
      let applicationId: string | undefined = app?.id;

      if (app) {
        switch (app.status) {
          case "applied": effectiveStatus = "pending"; break;
          case "approved": effectiveStatus = "in-progress"; break;
          case "pending_completion": effectiveStatus = "pending-completion"; break;
          case "completed": effectiveStatus = "completed"; break;
          case "rejected":
            effectiveStatus = "rejected";
            rejectReason = (app as any).reject_reason || undefined;
            break;
          default: effectiveStatus = "pending";
        }
      }
      return { ...task, effectiveStatus, applicationId, rejectReason };
    });
  }, [tasks, applications]);

  const filtered = filter === "all" ? tasksWithUserStatus : tasksWithUserStatus.filter((t) => t.effectiveStatus === filter);

  const stats = useMemo(() => {
    const available = tasksWithUserStatus.filter((t) => t.effectiveStatus === "available").length;
    const pending = tasksWithUserStatus.filter((t) => t.effectiveStatus === "pending").length;
    const inProgress = tasksWithUserStatus.filter((t) => t.effectiveStatus === "in-progress").length;
    const completed = tasksWithUserStatus.filter((t) => t.effectiveStatus === "completed").length;
    const totalRevenue = tasksWithUserStatus
      .filter((t) => t.effectiveStatus === "completed")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return { available, pending, inProgress, completed, totalRevenue };
  }, [tasksWithUserStatus]);

  const handleApply = async (taskId: string) => {
    if (!user) return;
    setApplying(taskId);
    const { error } = await supabase.from("task_applications").insert({ task_id: taskId, user_id: user.id });
    setApplying(null);
    if (error) toast.error(error.message);
    else { toast.success("已送出申請，等待審核中！"); fetchData(); }
  };

  const handleReportComplete = async (applicationId: string) => {
    if (!user || !applicationId) return;
    setReporting(applicationId);
    const { error } = await supabase
      .from("task_applications")
      .update({ status: "pending_completion" } as any)
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
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground">任務中心</h2>
        <p className="text-sm text-muted-foreground mt-1">接案任務，提升技能並賺取收益</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Target className="w-5 h-5 text-primary-foreground" />} value={stats.available} label="可接任務" gradient="gradient-orange" delay={0} />
        <StatCard icon={<Hourglass className="w-5 h-5 text-primary-foreground" />} value={stats.pending} label="審核中" gradient="gradient-purple" delay={0.05} />
        <StatCard icon={<Zap className="w-5 h-5 text-primary-foreground" />} value={stats.inProgress} label="進行中" gradient="gradient-lime" delay={0.1} />
        <StatCard icon={<Clock className="w-5 h-5 text-primary-foreground" />} value={`$${stats.totalRevenue.toLocaleString()}`} label="累計收益" gradient="gradient-orange" delay={0.15} />
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
        <div className="space-y-3">
          {filtered.map((task, i) => (
            <TaskCard
              key={task.id}
              task={{
                id: task.id,
                title: task.title,
                description: task.description,
                amount: Number(task.amount),
                tags: task.tags,
                status: task.effectiveStatus,
                deadline: task.deadline ?? "",
                difficulty: task.difficulty,
                rejectReason: task.rejectReason,
                applicantCount: appCounts[task.id] || 0,
              }}
              delay={i * 0.05}
              onApply={() => handleApply(task.id)}
              onReportComplete={() => handleReportComplete(task.applicationId!)}
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
