import { motion } from "framer-motion";
import { DollarSign, ArrowRight, CheckCircle, Clock, Loader2, Calendar, Eye, AlertCircle, Hourglass, Send, Users, XCircle, Lock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { difficultyColors } from "@/lib/category-colors";

interface Task {
  id: string;
  title: string;
  description: string;
  amountMin: number;
  amountMax: number;
  category?: string;
  tags: string[];
  status: "available" | "pending" | "in-progress" | "pending-completion" | "completed" | "rejected" | "failed" | "closed";
  deadline: string;
  difficulty: string;
  rejectReason?: string;
  failedReason?: string;
  quotedAmount?: number;
  finalAmount?: number;
  applicantCount?: number;
}

interface TaskCardProps {
  task: Task;
  delay?: number;
  onApply?: (quotedAmount: number) => void;
  onReportComplete?: (deliverableUrl: string, deliverableNote: string) => void;
  applying?: boolean;
  reporting?: boolean;
}

export function TaskCard({ task, delay = 0, onApply, onReportComplete, applying, reporting }: TaskCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [quotedAmount, setQuotedAmount] = useState<number>(task.amountMin || 0);
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableNote, setDeliverableNote] = useState("");

  const difficultyColor = difficultyColors[task.difficulty] || "text-muted-foreground bg-muted/10 border-border";

  const amountRange = task.amountMin === task.amountMax
    ? `${task.amountMin.toLocaleString()}`
    : `${task.amountMin.toLocaleString()} ~ ${task.amountMax.toLocaleString()}`;

  const handleConfirmApply = () => {
    if (quotedAmount < task.amountMin || quotedAmount > task.amountMax) return;
    setShowApply(false);
    onApply?.(quotedAmount);
  };

  const handleConfirmReport = () => {
    setShowReport(false);
    onReportComplete?.(deliverableUrl.trim(), deliverableNote.trim());
    setDeliverableUrl(""); setDeliverableNote("");
  };

  const statusBadge = () => {
    switch (task.status) {
      case "pending":
        return <span className="text-xs text-chart-yellow font-medium flex items-center gap-1 border border-chart-yellow/30 px-3 py-1.5 rounded-lg bg-chart-yellow/10"><Hourglass className="w-3.5 h-3.5" />審核中</span>;
      case "in-progress":
        return <span className="text-xs text-secondary font-medium flex items-center gap-1 border border-secondary/30 px-3 py-1.5 rounded-lg bg-secondary/10"><Clock className="w-3.5 h-3.5" />進行中</span>;
      case "pending-completion":
        return <span className="text-xs text-chart-yellow font-medium flex items-center gap-1 border border-chart-yellow/30 px-3 py-1.5 rounded-lg bg-chart-yellow/10"><Send className="w-3.5 h-3.5" />已回報完成</span>;
      case "completed":
        return <span className="text-xs text-chart-green font-medium flex items-center gap-1 border border-chart-green/30 px-3 py-1.5 rounded-lg bg-chart-green/10"><CheckCircle className="w-3.5 h-3.5" />已完成</span>;
      case "rejected":
        return <span className="text-xs text-destructive font-medium flex items-center gap-1 border border-destructive/30 px-3 py-1.5 rounded-lg bg-destructive/10"><AlertCircle className="w-3.5 h-3.5" />已退回</span>;
      case "failed":
        return <span className="text-xs text-destructive font-medium flex items-center gap-1 border border-destructive/30 px-3 py-1.5 rounded-lg bg-destructive/10"><XCircle className="w-3.5 h-3.5" />已失敗</span>;
      case "closed":
        return <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 border border-border px-3 py-1.5 rounded-lg bg-muted"><Lock className="w-3.5 h-3.5" />已關閉</span>;
      default:
        return null;
    }
  };

  const quoteValid = quotedAmount >= task.amountMin && quotedAmount <= task.amountMax;

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay }} className="glass-card p-5 hover:border-primary/40 transition-all group">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1 rounded-md border ${difficultyColor}`}>{task.difficulty}任務</span>
            {task.category && task.category !== "general" && (
              <span className="text-xs font-medium px-3 py-1 rounded-md border border-primary/20 bg-primary/5 text-primary">{task.category}</span>
            )}
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-base font-bold text-primary">{amountRange}</span>
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

        {task.status === "failed" && task.failedReason && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-muted-foreground mb-1">失敗原因：</p>
            <p className="text-sm text-destructive">{task.failedReason}</p>
          </div>
        )}

        {(task.quotedAmount !== undefined && task.quotedAmount !== null) && task.status !== "available" && (
          <div className="mb-3 text-xs text-muted-foreground">
            您的報價：<span className="text-foreground font-semibold">${Number(task.quotedAmount).toLocaleString()}</span>
            {task.finalAmount !== undefined && task.finalAmount !== null && (
              <> · 最終金額：<span className="text-primary font-semibold">${Number(task.finalAmount).toLocaleString()}</span></>
            )}
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
                <Calendar className="w-3.5 h-3.5" />截止：{task.deadline}
              </span>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />{task.applicantCount || 0} 人已申請
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {task.status === "available" && (
            <button onClick={() => { setQuotedAmount(task.amountMin); setShowApply(true); }} disabled={applying} className="flex-1 bg-primary text-primary-foreground text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <>立即報價接案 <ArrowRight className="w-4 h-4" /></>}
            </button>
          )}
          {task.status === "in-progress" && (
            <button onClick={() => setShowReport(true)} disabled={reporting} className="flex-1 bg-chart-green/90 hover:bg-chart-green text-primary-foreground text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> 回報完成</>}
            </button>
          )}
          <button onClick={() => setShowDetail(true)} className={`${task.status === "available" || task.status === "in-progress" ? "flex-1" : "w-full"} text-sm font-semibold px-4 py-3 rounded-lg flex items-center justify-center gap-2 border border-primary/40 text-primary hover:bg-primary/10 transition-colors`}>
            <Eye className="w-4 h-4" />查看詳情
          </button>
        </div>
      </motion.div>

      {/* Detail */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>任務詳情</DialogTitle>
            <DialogDescription className="sr-only">查看任務完整資訊</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">任務：</span><span className="text-foreground">{task.title}</span></p>
            <p><span className="text-muted-foreground">描述：</span><span className="text-foreground whitespace-pre-wrap">{task.description}</span></p>
            <p><span className="text-muted-foreground">難度：</span><span className="text-foreground">{task.difficulty}</span></p>
            {task.category && task.category !== "general" && <p><span className="text-muted-foreground">類別：</span><span className="text-foreground">{task.category}</span></p>}
            {task.tags.length > 0 && <p><span className="text-muted-foreground">技術標籤：</span><span className="text-foreground">{task.tags.join("、")}</span></p>}
            {task.deadline && <p><span className="text-muted-foreground">截止日期：</span><span className="text-foreground">{task.deadline}</span></p>}
            <p><span className="text-muted-foreground">獎勵範圍：</span><span className="text-primary font-bold">${amountRange}</span></p>
            {task.failedReason && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-xs text-muted-foreground mb-1">失敗原因：</p>
                <p className="text-sm text-destructive">{task.failedReason}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowDetail(false)} className="w-full">確定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply with Quote */}
      <Dialog open={showApply} onOpenChange={setShowApply}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>報價接案</DialogTitle>
            <DialogDescription>請輸入您的報價（必須在 ${task.amountMin.toLocaleString()} ~ ${task.amountMax.toLocaleString()} 之間）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">您的報價（金額）</Label>
              <Input
                type="number"
                value={quotedAmount || ""}
                onChange={(e) => setQuotedAmount(Number(e.target.value))}
                min={task.amountMin}
                max={task.amountMax}
              />
              {!quoteValid && quotedAmount > 0 && (
                <p className="text-xs text-destructive mt-1">報價必須在 {task.amountMin.toLocaleString()} ~ {task.amountMax.toLocaleString()} 之間</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApply(false)}>取消</Button>
            <Button onClick={handleConfirmApply} disabled={!quoteValid}>送出報價</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Complete */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回報完成</DialogTitle>
            <DialogDescription>提交您的交付物，管理員審核後將正式結案。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">交付連結（作品網址 / 雲端連結，選填）</Label>
              <Input value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">交付說明（選填）</Label>
              <Textarea value={deliverableNote} onChange={(e) => setDeliverableNote(e.target.value)} placeholder="簡述您完成的內容..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReport(false)}>取消</Button>
            <Button onClick={handleConfirmReport}>確認回報</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
