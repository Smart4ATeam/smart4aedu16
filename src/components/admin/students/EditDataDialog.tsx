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
  const [fields, setFields] = useState({ total_points: 0, total_badges: 0, learning_days: 0, total_revenue: 0 });

  useEffect(() => {
    if (detail && open) {
      setFields({
        total_points: detail.profile.total_points,
        total_badges: detail.profile.total_badges,
        learning_days: detail.profile.learning_days,
        total_revenue: Number(detail.profile.total_revenue),
      });
    }
  }, [detail, open]);

  const handleSave = async () => {
    if (!detail) return;
    const { error } = await supabase.from("profiles").update({
      total_points: fields.total_points,
      total_badges: fields.total_badges,
      learning_days: fields.learning_days,
      total_revenue: fields.total_revenue,
    }).eq("id", detail.profile.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已手動調整數據");
    onOpenChange(false);
    const updated = { ...detail.profile, ...fields };
    onSaved({ ...detail, profile: updated });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>手動調整數據</DialogTitle>
          <DialogDescription>修改 {detail?.profile.display_name} 的積分、徽章等數值</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {[
            { label: "積分", key: "total_points" as const },
            { label: "徽章數", key: "total_badges" as const },
            { label: "學習天數", key: "learning_days" as const },
            { label: "營收 (NT$)", key: "total_revenue" as const },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground w-24">{f.label}</label>
              <Input
                type="number"
                className="h-9"
                value={fields[f.key]}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>儲存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
