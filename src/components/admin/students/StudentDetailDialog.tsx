import { useState } from "react";
import { Mail, BookOpen, Pencil, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import type { StudentDetail } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: StudentDetail | null;
  isSelf: (id: string) => boolean;
  getPrimaryRole: (id: string) => Enums<"app_role">;
  onRoleChange: (userId: string, role: Enums<"app_role">) => void;
  onOpenEdit: () => void;
  roleBadge: (role: Enums<"app_role">) => React.ReactNode;
}

export function StudentDetailDialog({ open, onOpenChange, detail, isSelf, getPrimaryRole, onRoleChange, onOpenEdit, roleBadge }: Props) {
  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {getPrimaryRole(detail.profile.id) !== "user" ? "管理員詳情" : "使用者詳情"}
          </DialogTitle>
          <DialogDescription>{detail.profile.display_name} 的完整資料</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">姓名：</span>{detail.profile.display_name}</div>
            <div className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-muted-foreground" /> {detail.profile.email || "—"}</div>
            <div><span className="text-muted-foreground">學號：</span>{detail.profile.student_id || "—"}</div>
            <div><span className="text-muted-foreground">機構：</span>{detail.profile.organization_id || "—"}</div>
            <div><span className="text-muted-foreground">積分：</span>{detail.memberPoints?.toLocaleString() ?? 0}</div>
            <div><span className="text-muted-foreground">徽章：</span>{detail.profile.total_badges}</div>
            <div><span className="text-muted-foreground">學習天數：</span>{detail.profile.learning_days} 天</div>
            <div><span className="text-muted-foreground">營收：</span>NT${Number(detail.profile.total_revenue).toLocaleString()}</div>
            <div>
              <span className="text-muted-foreground">狀態：</span>
              <Badge variant={detail.profile.activated ? "default" : "secondary"} className="ml-1">
                {detail.profile.activated ? "已啟用" : "未啟用"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">角色：</span>
            {isSelf(detail.profile.id) ? (
              <div className="flex items-center gap-2">
                {roleBadge(detail.roles[0]?.role || "user")}
                <span className="text-xs text-muted-foreground">（無法變更自己的角色）</span>
              </div>
            ) : (
              <Select value={detail.roles[0]?.role || "user"} onValueChange={(v) => onRoleChange(detail.profile.id, v as Enums<"app_role">)}>
                <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">學員</SelectItem>
                  <SelectItem value="moderator">調解員</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={onOpenEdit} className="ml-auto gap-1.5 text-xs">
              <Pencil className="w-3.5 h-3.5" /> 手動調整數據
            </Button>
          </div>

          <div>
            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2"><BookOpen className="w-4 h-4" /> 學習進度</h4>
            {detail.progress.length === 0 ? (
              <p className="text-xs text-muted-foreground">尚無學習紀錄</p>
            ) : (
              <div className="space-y-2">
                {detail.progress.map(prog => (
                  <div key={prog.id} className="glass-card p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{prog.learning_paths?.title || "未知課程"}</p>
                      <p className="text-xs text-muted-foreground">步驟 {prog.current_step}</p>
                    </div>
                    <Badge variant={prog.completed ? "default" : "secondary"}>
                      {prog.completed ? "✅ 完成" : "進行中"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
