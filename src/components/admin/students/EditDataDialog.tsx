import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { StudentDetail } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: StudentDetail | null;
  onSaved: (updated: StudentDetail) => void;
}

export function EditDataDialog({ open, onOpenChange, detail, onSaved }: Props) {
  const [fields, setFields] = useState({
    total_badges: 0,
    learning_days: 0,
    total_revenue: 0,
    points: 0,
    task_points: 0,
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (detail && open) {
      setFields({
        total_badges: detail.profile.total_badges,
        learning_days: detail.profile.learning_days,
        total_revenue: Number(detail.profile.total_revenue),
        points: detail.memberPoints ?? 0,
        task_points: detail.memberTaskPoints ?? 0,
      });
      setReason("");
    }
  }, [detail, open]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      // 1) profiles 欄位
      const { error } = await supabase.from("profiles").update({
        total_badges: fields.total_badges,
        learning_days: fields.learning_days,
        total_revenue: fields.total_revenue,
      }).eq("id", detail.profile.id);
      if (error) throw error;

      // 2) 點數 / 積分 → 透過 transactions 寫入差額（觸發器會自動同步 reg_members）
      const oldPoints = detail.memberPoints ?? 0;
      const oldTaskPoints = detail.memberTaskPoints ?? 0;
      const pointsDelta = Math.round(fields.points - oldPoints);
      const taskDelta = Math.round(fields.task_points - oldTaskPoints);

      if ((pointsDelta !== 0 || taskDelta !== 0)) {
        // 找對應的 reg_members.id
        let memberId: string | null = null;
        const { data: m1 } = await supabase
          .from("reg_members")
          .select("id")
          .eq("user_id", detail.profile.id)
          .maybeSingle();
        memberId = m1?.id ?? null;
        if (!memberId && detail.profile.email) {
          const { data: m2 } = await supabase
            .from("reg_members")
            .select("id")
            .eq("email", detail.profile.email)
            .maybeSingle();
          memberId = m2?.id ?? null;
        }
        if (!memberId) {
          toast.error("此使用者沒有對應的學員資料，無法調整點數/積分");
          setSaving(false);
          return;
        }
        const desc = reason.trim() || "管理員手動調整";
        const inserts: any[] = [];
        if (pointsDelta !== 0) {
          inserts.push({
            member_id: memberId,
            points_delta: pointsDelta,
            type: pointsDelta > 0 ? "manual" : "adjusted",
            category: "points",
            description: desc,
          });
        }
        if (taskDelta !== 0) {
          inserts.push({
            member_id: memberId,
            points_delta: taskDelta,
            type: taskDelta > 0 ? "manual" : "adjusted",
            category: "task_points",
            description: desc,
          });
        }
        const { error: txErr } = await supabase.from("reg_point_transactions").insert(inserts);
        if (txErr) throw txErr;
      }

      toast.success("已手動調整數據");
      onOpenChange(false);
      const updatedProfile = {
        ...detail.profile,
        total_badges: fields.total_badges,
        learning_days: fields.learning_days,
        total_revenue: fields.total_revenue,
      };
      onSaved({
        ...detail,
        profile: updatedProfile,
        memberPoints: fields.points,
        memberTaskPoints: fields.task_points,
      });
    } catch (err: any) {
      toast.error("更新失敗：" + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>手動調整數據</DialogTitle>
          <DialogDescription>修改 {detail?.profile.display_name} 的點數、積分、徽章等數值</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {[
            { label: "點數（學習）", key: "points" as const },
            { label: "積分（接案）", key: "task_points" as const },
            { label: "徽章數", key: "total_badges" as const },
            { label: "學習天數", key: "learning_days" as const },
            { label: "收益 (NT$)", key: "total_revenue" as const },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-28">{f.label}</label>
              <Input
                type="number"
                className="h-9"
                value={fields[f.key]}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
          <div className="flex items-start gap-3 pt-1">
            <label className="text-sm text-muted-foreground w-28 pt-2">調整原因</label>
            <Input
              className="h-9"
              placeholder="（選填）會記入點數紀錄"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground pl-1">
            ⓘ 點數/積分以差額寫入交易紀錄，會自動同步學員餘額。
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "儲存中…" : "儲存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
