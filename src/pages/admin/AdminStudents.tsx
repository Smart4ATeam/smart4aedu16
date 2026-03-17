import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Calendar, ShieldCheck, UserCog, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import type { Profile, UserRole, LearningProgress, StudentDetail } from "@/components/admin/students/types";
import { CreateUserDialog } from "@/components/admin/students/CreateUserDialog";
import { StudentDetailDialog } from "@/components/admin/students/StudentDetailDialog";
import { EditDataDialog } from "@/components/admin/students/EditDataDialog";

const AdminStudents = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = async () => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (profileRes.data) setProfiles(profileRes.data);
    if (roleRes.data) setRoles(roleRes.data as UserRole[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getRoles = (userId: string) => roles.filter(r => r.user_id === userId);
  const getPrimaryRole = (userId: string): Enums<"app_role"> => getRoles(userId)[0]?.role || "user";

  const managementTeam = profiles.filter(p => {
    const role = getPrimaryRole(p.id);
    return role === "admin" || role === "moderator";
  });

  const regularUsers = profiles.filter(p => getPrimaryRole(p.id) === "user");
  const activatedUsers = regularUsers.filter(p => p.activated);
  const pendingUsers = regularUsers.filter(p => !p.activated);

  const filteredActivated = activatedUsers.filter(p =>
    !search ||
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.student_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredPending = pendingUsers.filter(p =>
    !search ||
    p.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.student_id || "").toLowerCase().includes(search.toLowerCase())
  );

  const thisMonthUsers = regularUsers.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const openDetail = async (profile: Profile) => {
    const { data: progress } = await supabase
      .from("user_learning_progress")
      .select("*, learning_paths(title)")
      .eq("user_id", profile.id);
    const userRoles = getRoles(profile.id);
    setDetail({ profile, roles: userRoles, progress: (progress || []) as LearningProgress[] });
    setShowDetail(true);
  };

  const handleRoleChange = async (userId: string, newRole: Enums<"app_role">) => {
    if (userId === user?.id) {
      toast.error("無法變更自己的角色");
      return;
    }
    const { error } = await supabase.rpc("admin_set_user_role" as never, {
      _target_user_id: userId,
      _new_role: newRole,
    } as never);
    if (error) { toast.error("角色更新失敗：" + error.message); return; }
    toast.success("角色已更新");
    fetchData();
    if (detail && detail.profile.id === userId) {
      setDetail({ ...detail, roles: [{ user_id: userId, role: newRole }] });
    }
  };

  const roleBadge = (role: Enums<"app_role">) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      admin: { label: "管理員", variant: "default" },
      moderator: { label: "調解員", variant: "secondary" },
      user: { label: "學員", variant: "outline" },
    };
    const info = map[role] || map.user;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const isSelf = (profileId: string) => profileId === user?.id;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">使用者管理</h2>
          <p className="text-sm text-muted-foreground mt-1">查看所有使用者資料、角色與學習進度</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <UserPlus className="w-4 h-4" /> 新增使用者
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "總使用者數", value: profiles.length, icon: Users },
          { label: "管理團隊", value: managementTeam.length, icon: ShieldCheck },
          { label: "待啟用", value: pendingUsers.length, icon: UserCog },
          { label: "本月新增", value: thisMonthUsers, icon: Calendar },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <s.icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Management Team */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
          <UserCog className="w-5 h-5 text-primary" /> 管理團隊
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {managementTeam.map(p => {
            const role = getPrimaryRole(p.id);
            return (
              <div
                key={p.id}
                className="glass-card p-4 flex items-center gap-3 cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                onClick={() => openDetail(p)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                    {isSelf(p.id) && <Badge variant="outline" className="text-[10px] px-1.5 py-0">你</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.email || "—"}</p>
                </div>
                {roleBadge(role)}
              </div>
            );
          })}
          {managementTeam.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-4 text-center">尚無管理團隊成員</p>
          )}
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜尋姓名、Email 或學號…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Pending (not activated) users */}
      {filteredPending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <UserCog className="w-5 h-5 text-accent" /> 待啟用學員
            <Badge variant="secondary" className="ml-1">{filteredPending.length}</Badge>
          </h3>
          <div className="glass-card p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>姓名</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>學號</TableHead>
                  <TableHead>建立日期</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPending.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.display_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.student_id || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("zh-TW")}</TableCell>
                    <TableCell><Badge variant="secondary">未啟用</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openDetail(p)} className="text-xs">詳情</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* Active users */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-primary" /> 已啟用使用者
          <Badge variant="outline" className="ml-1">{filteredActivated.length}</Badge>
        </h3>
        <div className="glass-card p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>學號</TableHead>
                <TableHead>積分</TableHead>
                <TableHead>學習天數</TableHead>
                <TableHead>加入日期</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivated.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.display_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.email || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.student_id || "—"}</TableCell>
                  <TableCell className="text-xs">{p.total_points}</TableCell>
                  <TableCell className="text-xs">{p.learning_days} 天</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("zh-TW")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => openDetail(p)} className="text-xs">詳情</Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredActivated.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">沒有符合條件的使用者</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Dialogs */}
      <StudentDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        detail={detail}
        isSelf={isSelf}
        getPrimaryRole={getPrimaryRole}
        onRoleChange={handleRoleChange}
        onOpenEdit={() => setShowEdit(true)}
        roleBadge={roleBadge}
      />

      <EditDataDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        detail={detail}
        onSaved={(updated) => {
          setDetail(updated);
          setProfiles(prev => prev.map(p => p.id === updated.profile.id ? updated.profile : p));
        }}
      />

      <CreateUserDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={fetchData}
      />
    </div>
  );
};

export default AdminStudents;
