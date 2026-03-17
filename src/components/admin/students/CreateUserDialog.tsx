import { useState } from "react";
import { UserPlus, BookOpen, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [tab, setTab] = useState<"enroll" | "admin" | "full">("enroll");
  const [creating, setCreating] = useState(false);

  // Enroll form (pre-register student, no password)
  const [enrollForm, setEnrollForm] = useState({ email: "", display_name: "", student_id: "" });

  // Admin email form
  const [adminEmail, setAdminEmail] = useState("");

  // Full account form (with password & role)
  const [fullForm, setFullForm] = useState({
    email: "", password: "", display_name: "", student_id: "", organization_id: "",
    role: "user" as "user" | "moderator" | "admin",
  });

  const resetForms = () => {
    setEnrollForm({ email: "", display_name: "", student_id: "" });
    setAdminEmail("");
    setFullForm({ email: "", password: "", display_name: "", student_id: "", organization_id: "", role: "user" });
  };

  const handleEnroll = async () => {
    const { email, display_name, student_id } = enrollForm;
    if (!email || !display_name || !student_id) {
      toast.error("請填寫姓名、Email 和學號");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enroll-student`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_ENROLL_API_KEY || "",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email, display_name, student_id }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "預先註冊失敗");
      toast.success(`已預先註冊學員 ${display_name}，等待學員自行啟用帳號`);
      onOpenChange(false);
      resetForms();
      onCreated();
    } catch (err: any) {
      toast.error("預先註冊失敗：" + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!adminEmail) {
      toast.error("請輸入 Email");
      return;
    }
    setCreating(true);
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from("admin_emails")
        .select("id")
        .eq("email", adminEmail)
        .maybeSingle();

      if (existing) {
        toast.error("此 Email 已在管理員名單中");
        setCreating(false);
        return;
      }

      const { error } = await supabase
        .from("admin_emails")
        .insert({ email: adminEmail });

      if (error) throw error;
      toast.success(`已將 ${adminEmail} 加入管理員名單，對方登入後將自動獲得管理員權限`);
      onOpenChange(false);
      resetForms();
      onCreated();
    } catch (err: any) {
      toast.error("新增失敗：" + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFull = async () => {
    const { email, password, display_name } = fullForm;
    if (!email || !password || !display_name) {
      toast.error("請填寫姓名、Email 和密碼");
      return;
    }
    if (password.length < 6) {
      toast.error("密碼至少需要 6 個字元");
      return;
    }
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(fullForm),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "建立失敗");
      toast.success(`已成功建立使用者 ${email}`);
      onOpenChange(false);
      resetForms();
      onCreated();
    } catch (err: any) {
      toast.error("建立使用者失敗：" + err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新增使用者</DialogTitle>
          <DialogDescription>選擇新增方式</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enroll" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> 註冊學員
            </TabsTrigger>
            <TabsTrigger value="admin" className="gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" /> 新增管理員
            </TabsTrigger>
            <TabsTrigger value="full" className="gap-1.5 text-xs">
              <UserPlus className="w-3.5 h-3.5" /> 完整帳號
            </TabsTrigger>
          </TabsList>

          <TabsContent value="enroll" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              預先建立學員資料（不含密碼），學員之後可透過「啟用帳號」頁面自行設定密碼並啟用。
            </p>
            {[
              { label: "姓名 *", key: "display_name", placeholder: "輸入姓名" },
              { label: "Email *", key: "email", placeholder: "student@example.com", type: "email" },
              { label: "學號 *", key: "student_id", placeholder: "輸入學號" },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={enrollForm[f.key as keyof typeof enrollForm]}
                  onChange={e => setEnrollForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleEnroll} disabled={creating}>
                {creating ? "建立中…" : "預先註冊"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="admin" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              輸入管理員的 Email，對方使用 Google 或其他方式登入後將自動獲得管理員權限。
            </p>
            <div className="space-y-1.5">
              <Label className="text-sm">Email *</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleAddAdmin} disabled={creating}>
                {creating ? "新增中…" : "新增管理員"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="full" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              直接建立完整帳號（含密碼），帳號建立後即可用 Email/密碼登入。
            </p>
            {[
              { label: "姓名 *", key: "display_name", type: "text", placeholder: "輸入姓名" },
              { label: "Email *", key: "email", type: "email", placeholder: "user@example.com" },
              { label: "密碼 *", key: "password", type: "password", placeholder: "至少 6 個字元" },
              { label: "組織編號", key: "organization_id", type: "text", placeholder: "選填" },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={fullForm[f.key as keyof typeof fullForm]}
                  onChange={e => setFullForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-sm">角色</Label>
              <Select value={fullForm.role} onValueChange={(v) => setFullForm(prev => ({ ...prev, role: v as typeof prev.role }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">學員</SelectItem>
                  <SelectItem value="moderator">調解員</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={handleCreateFull} disabled={creating}>
                {creating ? "建立中…" : "建立使用者"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
