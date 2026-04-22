import { useState } from "react";
import { Mail, BookOpen, Pencil, KeyRound, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  if (!detail) return null;

  const closeResetDialog = (open: boolean) => {
    setShowResetPwd(open);
    if (!open) {
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("密碼至少 6 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("兩次密碼輸入不一致");
      return;
    }
    if (!detail.profile.email) {
      toast.error("此使用者沒有 Email，無法重設密碼");
      return;
    }
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-set-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: detail.profile.email,
            password: newPassword,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "重設失敗");
      toast.success(`已重設 ${detail.profile.email} 的密碼`);
      setShowResetPwd(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error("重設失敗：" + err.message);
    } finally {
      setResetting(false);
    }
  };

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
            <div><span className="text-muted-foreground">點數：</span>{detail.memberPoints?.toLocaleString() ?? 0}</div>
            <div><span className="text-muted-foreground">積分：</span>{detail.memberTaskPoints?.toLocaleString() ?? 0}</div>
            <div><span className="text-muted-foreground">收益：</span>NT${Number(detail.profile.total_revenue).toLocaleString()}</div>
            <div><span className="text-muted-foreground">徽章：</span>{detail.profile.total_badges}</div>
            <div><span className="text-muted-foreground">學習天數：</span>{detail.profile.learning_days} 天</div>
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
            <Button variant="outline" size="sm" onClick={() => setShowResetPwd(true)} className="ml-auto gap-1.5 text-xs">
              <KeyRound className="w-3.5 h-3.5" /> 重設密碼
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenEdit} className="gap-1.5 text-xs">
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

      {/* Reset Password Dialog */}
      <Dialog open={showResetPwd} onOpenChange={closeResetDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>重設密碼</DialogTitle>
            <DialogDescription>
              為 {detail.profile.display_name}（{detail.profile.email}）設定新密碼
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">新密碼</Label>
              <Input
                type="text"
                placeholder="至少 6 個字元"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">確認新密碼</Label>
              <Input
                type="text"
                placeholder="再次輸入新密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">兩次密碼輸入不一致</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              ⚠️ 請務必告知使用者新密碼，並建議盡快自行變更。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeResetDialog(false)}>取消</Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetting || !newPassword || newPassword !== confirmPassword}
            >
              {resetting ? "重設中…" : "確認重設"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
