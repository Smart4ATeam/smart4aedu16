import { motion } from "framer-motion";
import { DollarSign, ArrowRight, CheckCircle, Clock, Loader2, Calendar, Eye, AlertCircle, Hourglass, Send, Users } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface Task {
  id: string;
  title: string;
  description: string;
  amount: number;
  tags: string[];
  status: "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected";
  deadline: string;
  difficulty: string;
  rejectReason?: string;
  applicantCount?: number;
}

interface TaskCardProps {
  task: Task;
  delay?: number;
  onApply?: () => void;
  onReportComplete?: () => void;
  applying?: boolean;
  reporting?: boolean;
}

export function TaskCard({ task, delay = 0, onApply, onReportComplete, applying, reporting }: TaskCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const difficultyColor =
    task.difficulty === "初級"
      ? "text-chart-green bg-chart-green/15 border-chart-green/30"
      : task.difficulty === "中級" || task.difficulty === "中階"
      ? "text-chart-yellow bg-chart-yellow/15 border-chart-yellow/30"
      : "text-primary bg-primary/15 border-primary/30";

  const handleApplyClick = () => { setShowConfirm(true); };
  const handleConfirmApply = () => { setShowConfirm(false); onApply?.(); };
  const handleReportClick = () => { setShowReportConfirm(true); };
  const handleConfirmReport = () => { setShowReportConfirm(false); onReportComplete?.(); };

  const statusBadge = () => {
    switch (task.status) {
      case "pending":
        return (
          <span className="text-xs text-chart-yellow font-medium flex items-center gap-1 border border-chart-yellow/30 px-3 py-1.5 rounded-lg bg-chart-yellow/10">
            <Hourglass className="w-3.5 h-3.5" />
            審核中
          </span>
        );
      case "in-progress":
        return (
          <span className="text-xs text-secondary font-medium flex items-center gap-1 border border-secondary/30 px-3 py-1.5 rounded-lg bg-secondary/10">
            <Clock className="w-3.5 h-3.5" />
            進行中
          </span>
        );
      case "pending-completion":
        return (
          <span className="text-xs text-chart-yellow font-medium flex items-center gap-1 border border-chart-yellow/30 px-3 py-1.5 rounded-lg bg-chart-yellow/10">
            <Send className="w-3.5 h-3.5" />
            已回報完成
          </span>
        );
      case "completed":
        return (
          <span className="text-xs text-chart-green font-medium flex items-center gap-1 border border-chart-green/30 px-3 py-1.5 rounded-lg bg-chart-green/10">
            <CheckCircle className="w-3.5 h-3.5" />
            已完成
          </span>
        );
      case "rejected":
        return (
          <span className="text-xs text-destructive font-medium flex items-center gap-1 border border-destructive/30 px-3 py-1.5 rounded-lg bg-destructive/10">
            <AlertCircle className="w-3.5 h-3.5" />
            已退回
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay }}
        className="glass-card p-5 hover:border-primary/40 transition-all group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-3 py-1 rounded-md border ${difficultyColor}`}>
              {task.difficulty}任務
            </span>
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-lg font-bold text-primary">{task.amount.toLocaleString()}</span>
            </div>
          </div>
          {statusBadge()}
        </div>

        <h4 className="text-base font-bold text-foreground mb-2">{task.title}</h4>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{task.description}</p>

        {task.status === "rejected" && task.rejectReason && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">退回原因：</p>
            <p className="text-sm text-destructive">{task.rejectReason}</p>
          </div>
        )}

        {task.tags.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">技術要求：</p>
            <div className="flex items-center gap-2 flex-wrap">
              {task.tags.map((tag) => (
                <span key={tag} className="text-xs px-3 py-1 rounded-md bg-muted text-foreground border border-border font-medium">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {(task.deadline || task.applicantCount !== undefined) && (
          <div className="flex items-center gap-4 mb-4 pt-3 border-t border-border">
            {task.deadline && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                截止：{task.deadline}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {task.applicantCount || 0} 人已申請
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {task.status === "available" && (
            <button
              onClick={handleApplyClick}
              disabled={applying}
              className="flex-1 bg-primary text-primary-foreground text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>立即接案 <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          {task.status === "in-progress" && (
            <button
              onClick={handleReportClick}
              disabled={reporting}
              className="flex-1 bg-chart-green/90 hover:bg-chart-green text-primary-foreground text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> 回報完成</>}
            </button>
          )}
          <button
            onClick={() => setShowDetail(true)}
            className={`${task.status === "available" || task.status === "in-progress" ? "flex-1" : "w-full"} text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors`}
          >
            <Eye className="w-4 h-4" />
            查看詳情
          </button>
        </div>
      </motion.div>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>任務詳情</DialogTitle>
            <DialogDescription className="sr-only">查看任務完整資訊</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">任務：</span><span className="text-foreground">{task.title}</span></p>
            <p><span className="text-muted-foreground">描述：</span><span className="text-foreground">{task.description}</span></p>
            <p><span className="text-muted-foreground">難度：</span><span className="text-foreground">{task.difficulty}</span></p>
            {task.tags.length > 0 && (
              <p><span className="text-muted-foreground">技術標籤：</span><span className="text-foreground">{task.tags.join("、")}</span></p>
            )}
            {task.deadline && (
              <p><span className="text-muted-foreground">截止日期：</span><span className="text-foreground">{task.deadline}</span></p>
            )}
            <p><span className="text-muted-foreground">獎勵：</span><span className="text-primary font-bold">{task.amount.toLocaleString()} $</span></p>
            {task.status === "rejected" && task.rejectReason && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-muted-foreground mb-1">退回原因：</p>
                <p className="text-sm text-destructive">{task.rejectReason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetail(false)} className="w-full">確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Apply Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認接案</DialogTitle>
            <DialogDescription>您確定要接受「{task.title}」嗎？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleConfirmApply} className="w-full gradient-orange text-primary-foreground">確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Report Complete Dialog */}
      <Dialog open={showReportConfirm} onOpenChange={setShowReportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回報完成</DialogTitle>
            <DialogDescription>確認回報「{task.title}」已完成？管理員審核後將正式結案。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReportConfirm(false)}>取消</Button>
            <Button onClick={handleConfirmReport} className="gradient-orange text-primary-foreground">確認回報</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
