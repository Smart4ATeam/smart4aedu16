import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Search, Calendar, ShieldCheck, UserCog, UserPlus, Award, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import type { Profile, UserRole, LearningProgress, StudentDetail } from "@/components/admin/students/types";
import { CreateUserDialog } from "@/components/admin/students/CreateUserDialog";
import { StudentDetailDialog } from "@/components/admin/students/StudentDetailDialog";
import { EditDataDialog } from "@/components/admin/students/EditDataDialog";

// ── Reg types ──
type RegMember = {
  id: string; member_no: string | null; name: string; phone: string | null;
  email: string | null; course_level: string | null; points: number;
  referral_code: string | null; notes: string | null; created_at: string;
};

type RegPointTx = {
  id: string; member_id: string; order_id: string | null;
  points_delta: number; type: string; description: string | null; created_at: string;
  reg_members?: { name: string; member_no: string | null } | null;
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-TW");
}

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
  const [mainTab, setMainTab] = useState("platform");

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
          <p className="text-sm text-muted-foreground mt-1">管理平台使用者、報名學員與點數</p>
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

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="platform" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" />平台使用者</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs"><ShieldCheck className="w-3.5 h-3.5" />管理團隊</TabsTrigger>
          <TabsTrigger value="reg-members" className="gap-1.5 text-xs"><UserCog className="w-3.5 h-3.5" />報名學員</TabsTrigger>
          <TabsTrigger value="points" className="gap-1.5 text-xs"><Award className="w-3.5 h-3.5" />點數管理</TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
          <PlatformUsersTab
            search={search}
            setSearch={setSearch}
            filteredPending={filteredPending}
            filteredActivated={filteredActivated}
            openDetail={openDetail}
            isSelf={isSelf}
            roleBadge={roleBadge}
            getPrimaryRole={getPrimaryRole}
          />
        </TabsContent>

        <TabsContent value="team">
          <ManagementTeamTab
            managementTeam={managementTeam}
            openDetail={openDetail}
            isSelf={isSelf}
            roleBadge={roleBadge}
            getPrimaryRole={getPrimaryRole}
          />
        </TabsContent>

        <TabsContent value="reg-members">
          <RegMembersTab />
        </TabsContent>

        <TabsContent value="points">
          <PointsTab />
        </TabsContent>
      </Tabs>

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

// ═══════════════════════════════════════
// Platform Users Sub-Tab
// ═══════════════════════════════════════
function PlatformUsersTab({
  search, setSearch, filteredPending, filteredActivated, openDetail, isSelf, roleBadge, getPrimaryRole,
}: {
  search: string;
  setSearch: (s: string) => void;
  filteredPending: Profile[];
  filteredActivated: Profile[];
  openDetail: (p: Profile) => void;
  isSelf: (id: string) => boolean;
  roleBadge: (role: Enums<"app_role">) => JSX.Element;
  getPrimaryRole: (id: string) => Enums<"app_role">;
}) {
  return (
    <div className="space-y-6 mt-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="搜尋姓名、Email 或學號…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filteredPending.length > 0 && (
        <div>
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
        </div>
      )}

      <div>
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
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Management Team Sub-Tab
// ═══════════════════════════════════════
function ManagementTeamTab({
  managementTeam, openDetail, isSelf, roleBadge, getPrimaryRole,
}: {
  managementTeam: Profile[];
  openDetail: (p: Profile) => void;
  isSelf: (id: string) => boolean;
  roleBadge: (role: Enums<"app_role">) => JSX.Element;
  getPrimaryRole: (id: string) => Enums<"app_role">;
}) {
  return (
    <div className="mt-4">
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
    </div>
  );
}

// ═══════════════════════════════════════
// Reg Members Tab (paid only)
// ═══════════════════════════════════════
function RegMembersTab() {
  const [search, setSearch] = useState("");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["reg-members-paid"],
    queryFn: async () => {
      // Get members who have at least one paid enrollment
      const { data, error } = await supabase
        .from("reg_members" as any)
        .select("*, reg_enrollments!inner(payment_status)")
        .eq("reg_enrollments.payment_status" as any, "paid")
        .order("created_at", { ascending: false });
      if (error) {
        // Fallback: if inner join fails, just get all members
        const { data: fallback } = await supabase
          .from("reg_members" as any)
          .select("*")
          .order("created_at", { ascending: false });
        return (fallback || []) as unknown as RegMember[];
      }
      // Deduplicate (a member may have multiple paid enrollments)
      const seen = new Set<string>();
      const unique: RegMember[] = [];
      for (const m of (data || []) as any[]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          unique.push(m as RegMember);
        }
      }
      return unique;
    },
  });

  const filtered = members.filter(m => {
    if (!search) return true;
    const s = search.toLowerCase();
    return m.name?.toLowerCase().includes(s) || m.member_no?.toLowerCase().includes(s) || m.email?.toLowerCase().includes(s) || m.phone?.includes(s);
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜尋學員編號、姓名、信箱、電話..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Badge variant="outline">{filtered.length} 位學員（已付款）</Badge>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">學員編號</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>電話</TableHead>
              <TableHead>信箱</TableHead>
              <TableHead className="w-20">點數</TableHead>
              <TableHead className="w-28">建立日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">尚無已付款學員</TableCell></TableRow>
            ) : filtered.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">{m.member_no || "—"}</TableCell>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.phone || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.email || "—"}</TableCell>
                <TableCell><Badge variant="outline">{m.points}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(m.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Points Tab
// ═══════════════════════════════════════
function PointsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pointsDelta, setPointsDelta] = useState(0);
  const [pointType, setPointType] = useState("manual");
  const [pointDesc, setPointDesc] = useState("");
  const [reason, setReason] = useState("");

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["reg-point-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_point_transactions" as any)
        .select("*, reg_members(name, member_no)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as RegPointTx[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["reg-members-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_members" as any)
        .select("id, name, member_no, points")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as { id: string; name: string; member_no: string | null; points: number }[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId) throw new Error("請選擇學員");
      if (pointsDelta === 0) throw new Error("點數不可為 0");
      if (!reason.trim()) throw new Error("請填寫操作原因");

      const { error } = await supabase.from("reg_point_transactions" as any).insert({
        member_id: selectedMemberId,
        points_delta: pointsDelta,
        type: pointType,
        description: pointDesc || null,
      } as any);
      if (error) throw error;

      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "member", entity_id: selectedMemberId, action: "manual_points",
        new_value: { points_delta: pointsDelta, type: pointType, description: pointDesc },
        reason, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => {
      toast.success("點數已調整");
      queryClient.invalidateQueries({ queryKey: ["reg-point-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["reg-members-paid"] });
      queryClient.invalidateQueries({ queryKey: ["reg-members-list"] });
      setShowAddDialog(false);
      setSelectedMemberId("");
      setPointsDelta(0);
      setPointDesc("");
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeLabels: Record<string, string> = {
    manual: "手動發放",
    awarded: "課程給點",
    redeemed: "兌換扣點",
    adjusted: "手動調整",
    referral: "推薦獎勵",
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">{transactions.length} 筆紀錄（最近 200 筆）</Badge>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />手動調整點數
        </Button>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>學員</TableHead>
              <TableHead className="w-24">點數</TableHead>
              <TableHead className="w-24">類型</TableHead>
              <TableHead>說明</TableHead>
              <TableHead className="w-32">時間</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : transactions.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">尚無點數紀錄</TableCell></TableRow>
            ) : transactions.map(tx => (
              <TableRow key={tx.id}>
                <TableCell>
                  <div className="text-sm font-medium">{(tx.reg_members as any)?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{(tx.reg_members as any)?.member_no || ""}</div>
                </TableCell>
                <TableCell>
                  <span className={`text-sm font-mono font-bold ${tx.points_delta > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {tx.points_delta > 0 ? "+" : ""}{tx.points_delta}
                  </span>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{typeLabels[tx.type] || tx.type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Points Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>手動調整點數</DialogTitle>
            <DialogDescription>為學員增加或扣除點數</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">選擇學員</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="選擇學員..." /></SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.member_no || "無編號"}) — {m.points} 點
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm text-muted-foreground mb-1 block">點數（正數加、負數扣）</label>
                <Input type="number" value={pointsDelta} onChange={e => setPointsDelta(Number(e.target.value))} className="h-9" />
              </div>
              <div className="w-32">
                <label className="text-sm text-muted-foreground mb-1 block">類型</label>
                <Select value={pointType} onValueChange={setPointType}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">手動發放</SelectItem>
                    <SelectItem value="adjusted">手動調整</SelectItem>
                    <SelectItem value="awarded">課程給點</SelectItem>
                    <SelectItem value="referral">推薦獎勵</SelectItem>
                    <SelectItem value="redeemed">兌換扣點</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">說明</label>
              <Input value={pointDesc} onChange={e => setPointDesc(e.target.value)} placeholder="例：完課獎勵" className="h-9" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">操作原因（必填，會記錄在操作紀錄中）</label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="例：管理員手動補發活動獎勵點數" className="h-16" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>確認調整</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminStudents;
