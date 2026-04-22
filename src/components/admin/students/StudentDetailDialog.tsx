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

  const [showResetLogin, setShowResetLogin] = useState(false);
  const [resetLoginConfirm, setResetLoginConfirm] = useState("");
  const [resetLoginReason, setResetLoginReason] = useState("");
  const [resettingLogin, setResettingLogin] = useState(false);

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

  const closeResetLoginDialog = (open: boolean) => {
    setShowResetLogin(open);
    if (!open) {
      setResetLoginConfirm("");
      setResetLoginReason("");
    }
  };

  const handleResetLogin = async () => {
    if (resetLoginConfirm !== "重置") {
      toast.error('請輸入「重置」二字以確認');
      return;
    }
    if (!resetLoginReason.trim() || resetLoginReason.trim().length < 2) {
      toast.error("請填寫操作原因（至少 2 字）");
      return;
    }
    setResettingLogin(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            user_id: detail.profile.id,
            reason: resetLoginReason.trim(),
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "重置失敗");
      toast.success(
        `已重置登入帳號（刪除 ${result.deleted_email || "—"}，解綁 ${result.unbound_member_count} 筆報名）。請通知學員用新 Email 重新註冊。`,
        { duration: 8000 }
      );
      closeResetLoginDialog(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("重置失敗：" + err.message);
    } finally {
      setResettingLogin(false);
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

          {!isSelf(detail.profile.id) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="w-4 h-4" /> 危險操作
              </h4>
              <p className="text-xs text-muted-foreground">
                若學員需要更換登入 Email（如 Google 帳號 → 學校信箱），可使用「重置登入帳號」：
                會解除目前報名綁定、刪除舊登入帳號與個人資料，學員需用新 Email 重新註冊以重新啟用。
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowResetLogin(true)}
                className="gap-1.5 text-xs"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> 重置登入帳號
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Reset Login Account Dialog */}
      <Dialog open={showResetLogin} onOpenChange={closeResetLoginDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-1.5">
              <AlertTriangle className="w-5 h-5" /> 重置登入帳號
            </DialogTitle>
            <DialogDescription>
              此操作將不可復原地刪除以下資料：
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-xs space-y-1">
              <div>👤 <b>{detail.profile.display_name}</b>（{detail.profile.email || "—"}）</div>
              <div>學號：{detail.profile.student_id || "—"}</div>
              <ul className="mt-2 list-disc list-inside text-muted-foreground space-y-0.5">
                <li>解除其名下所有 reg_members 報名綁定（user_id 設為 null）</li>
                <li>刪除登入帳號（auth user）</li>
                <li>清除 profile / user_roles / notification_settings</li>
                <li>寫入操作日誌</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">操作原因（必填，會寫入日誌）</Label>
              <Textarea
                placeholder="例：學員更換為學校 Email，需重新以新 Email 註冊"
                value={resetLoginReason}
                onChange={(e) => setResetLoginReason(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">
                請輸入「<span className="text-destructive font-bold">重置</span>」二字以確認
              </Label>
              <Input
                value={resetLoginConfirm}
                onChange={(e) => setResetLoginConfirm(e.target.value)}
                placeholder="重置"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              💡 完成後請通知學員：使用新 Email 至登入頁註冊（系統會自動依學員編號 / Email 比對重新綁定）。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeResetLoginDialog(false)} disabled={resettingLogin}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetLogin}
              disabled={resettingLogin || resetLoginConfirm !== "重置" || resetLoginReason.trim().length < 2}
            >
              {resettingLogin ? "重置中…" : "確認重置"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
