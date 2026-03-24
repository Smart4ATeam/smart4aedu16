import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Users, Handshake, GraduationCap, CalendarDays, ClipboardCheck, Plus, Pencil, Trash2, FileText } from "lucide-react";
import { CourseContentEditor } from "@/components/admin/CourseContentEditor";
import { toast } from "sonner";

// ===== Stat Card =====
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ===== Main Component =====
export default function AdminLearning() {
  const queryClient = useQueryClient();

  // ----- Data Queries -----
  const { data: courses = [] } = useQuery({
    queryKey: ["admin_courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*, instructors(name, partners(name))").order("sort_order");
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["admin_sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("course_sessions").select("*, courses(title), instructors(name)").order("start_date", { ascending: false });
      return data || [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["admin_partners"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: instructors = [] } = useQuery({
    queryKey: ["admin_instructors"],
    queryFn: async () => {
      const { data } = await supabase.from("instructors").select("*, partners(name)").order("name");
      return data || [];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin_enrollments"],
    queryFn: async () => {
      const { data } = await supabase.from("course_enrollments").select("*, course_sessions(title_suffix, courses(title)), profiles:user_id(display_name, email)").order("enrolled_at", { ascending: false });
      return data || [];
    },
  });

  const openSessions = sessions.filter((s: any) => ["open", "scheduled"].includes(s.status)).length;
  const totalEnrollments = enrollments.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">學習中心管理</h1>
        <p className="text-muted-foreground text-sm mt-1">管理課程、梯次、合作單位與學習進度</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="總課程數" value={courses.length} color="bg-primary/20 text-primary" />
        <StatCard icon={CalendarDays} label="開放中梯次" value={openSessions} color="bg-blue-500/20 text-blue-400" />
        <StatCard icon={Handshake} label="合作單位" value={partners.length} color="bg-accent/20 text-accent" />
        <StatCard icon={Users} label="總報名人數" value={totalEnrollments} color="bg-green-500/20 text-green-400" />
      </div>

      <Tabs defaultValue="courses" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="courses" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" />課程</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />梯次</TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5"><Handshake className="w-3.5 h-3.5" />合作單位</TabsTrigger>
          <TabsTrigger value="instructors" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" />講師</TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-1.5"><Users className="w-3.5 h-3.5" />報名與報到</TabsTrigger>
          <TabsTrigger value="quizzes" className="gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" />測驗</TabsTrigger>
        </TabsList>

        {/* ===== Tab: Courses ===== */}
        <TabsContent value="courses">
          <CoursesTab courses={courses} instructors={instructors} queryClient={queryClient} />
        </TabsContent>

        {/* ===== Tab: Sessions ===== */}
        <TabsContent value="sessions">
          <SessionsTab sessions={sessions} courses={courses} instructors={instructors} queryClient={queryClient} />
        </TabsContent>

        {/* ===== Tab: Partners ===== */}
        <TabsContent value="partners">
          <PartnersTab partners={partners} queryClient={queryClient} />
        </TabsContent>

        {/* ===== Tab: Instructors ===== */}
        <TabsContent value="instructors">
          <InstructorsTab instructors={instructors} partners={partners} queryClient={queryClient} />
        </TabsContent>

        {/* ===== Tab: Enrollments ===== */}
        <TabsContent value="enrollments">
          <EnrollmentsTab enrollments={enrollments} queryClient={queryClient} />
        </TabsContent>

        {/* ===== Tab: Quizzes ===== */}
        <TabsContent value="quizzes">
          <QuizzesTab courses={courses} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ========== Courses Tab ==========
function CoursesTab({ courses, instructors, queryClient }: { courses: any[]; instructors: any[]; queryClient: any }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "basic", price: 0, total_hours: 0, instructor_id: "", status: "draft" });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        const { error } = await supabase.from("courses").update(data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courses").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "已更新" : "已建立"); queryClient.invalidateQueries({ queryKey: ["admin_courses"] }); setOpen(false); },
    onError: () => toast.error("操作失敗"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已刪除"); queryClient.invalidateQueries({ queryKey: ["admin_courses"] }); },
  });

  const openCreate = () => { setEditing(null); setForm({ title: "", description: "", category: "basic", price: 0, total_hours: 0, instructor_id: "", status: "draft" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ title: c.title, description: c.description, category: c.category, price: c.price, total_hours: c.total_hours, instructor_id: c.instructor_id || "", status: c.status }); setOpen(true); };

  const statusLabels: Record<string, string> = { draft: "草稿", published: "已發佈", archived: "已封存" };
  const statusColors: Record<string, string> = { draft: "secondary", published: "default", archived: "outline" };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">課程列表</h2>
        <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" />新增課程</Button>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>課程名稱</TableHead>
              <TableHead>分類</TableHead>
              <TableHead>講師</TableHead>
              <TableHead>費用</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{c.category}</Badge></TableCell>
                <TableCell className="text-sm">{c.instructors?.name || "-"}</TableCell>
                <TableCell className="text-sm">{c.price === 0 ? "免費" : `NT$ ${c.price}`}</TableCell>
                <TableCell><Badge variant={statusColors[c.status] as any}>{statusLabels[c.status]}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("確定刪除？")) deleteMutation.mutate(c.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "編輯課程" : "新增課程"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>課程名稱</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>描述</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>分類</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quest">入門班</SelectItem>
                    <SelectItem value="basic">基礎班</SelectItem>
                    <SelectItem value="intermediate">中階班</SelectItem>
                    <SelectItem value="advanced">高階班</SelectItem>
                    <SelectItem value="special">特殊課程</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>狀態</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">發佈</SelectItem>
                    <SelectItem value="archived">封存</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>費用 (NT$)</Label><Input type="number" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: +e.target.value }))} /></div>
              <div><Label>總時數</Label><Input type="number" value={form.total_hours} onChange={(e) => setForm(f => ({ ...f, total_hours: +e.target.value }))} /></div>
            </div>
            <div>
              <Label>講師</Label>
              <Select value={form.instructor_id} onValueChange={(v) => setForm(f => ({ ...f, instructor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇講師" /></SelectTrigger>
                <SelectContent>
                  {instructors.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate({ ...form, instructor_id: form.instructor_id || null })} disabled={!form.title}>
              {editing ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Sessions Tab ==========
function SessionsTab({ sessions, courses, instructors, queryClient }: { sessions: any[]; courses: any[]; instructors: any[]; queryClient: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ course_id: "", title_suffix: "", start_date: "", end_date: "", location: "", max_students: "", schedule_type: "recurring", status: "scheduled" });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, max_students: form.max_students ? +form.max_students : null };
      const { error } = await supabase.from("course_sessions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("梯次已建立"); queryClient.invalidateQueries({ queryKey: ["admin_sessions"] }); setOpen(false); },
    onError: () => toast.error("建立失敗"),
  });

  const statusLabels: Record<string, string> = { scheduled: "排程中", open: "開放報名", in_progress: "進行中", completed: "已結束", cancelled: "已取消" };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">梯次列表</h2>
        <Button size="sm" onClick={() => { setForm({ course_id: "", title_suffix: "", start_date: "", end_date: "", location: "", max_students: "", schedule_type: "recurring", status: "scheduled" }); setOpen(true); }} className="gap-1"><Plus className="w-4 h-4" />新增梯次</Button>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>課程</TableHead>
              <TableHead>梯次</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>地點</TableHead>
              <TableHead>人數上限</TableHead>
              <TableHead>狀態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.courses?.title}</TableCell>
                <TableCell>{s.title_suffix || "-"}</TableCell>
                <TableCell className="text-sm">{s.start_date || "-"}</TableCell>
                <TableCell className="text-sm">{s.location || "-"}</TableCell>
                <TableCell className="text-sm">{s.max_students || "不限"}</TableCell>
                <TableCell><Badge variant="outline">{statusLabels[s.status] || s.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增梯次</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>所屬課程</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm(f => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇課程" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>梯次名稱</Label><Input value={form.title_suffix} onChange={(e) => setForm(f => ({ ...f, title_suffix: e.target.value }))} placeholder="例如：第三期" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>開課日</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>結束日</Label><Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>地點</Label><Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><Label>人數上限</Label><Input type="number" value={form.max_students} onChange={(e) => setForm(f => ({ ...f, max_students: e.target.value }))} placeholder="留空=不限" /></div>
            </div>
            <div>
              <Label>週期類型</Label>
              <Select value={form.schedule_type} onValueChange={(v) => setForm(f => ({ ...f, schedule_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">常態開課</SelectItem>
                  <SelectItem value="ondemand">需求開課</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.course_id}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Partners Tab ==========
function PartnersTab({ partners, queryClient }: { partners: any[]; queryClient: any }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", type: "internal", category: "", contact_name: "", contact_email: "", contract_status: "active", revenue_share: 0, description: "" });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        const { error } = await supabase.from("partners").update(data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("partners").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "已更新" : "已建立"); queryClient.invalidateQueries({ queryKey: ["admin_partners"] }); setOpen(false); },
    onError: () => toast.error("操作失敗"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已刪除"); queryClient.invalidateQueries({ queryKey: ["admin_partners"] }); },
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", type: "internal", category: "", contact_name: "", contact_email: "", contract_status: "active", revenue_share: 0, description: "" }); setOpen(true); };
  const openEdit = (p: any) => { setEditing(p); setForm({ name: p.name, type: p.type, category: p.category || "", contact_name: p.contact_name || "", contact_email: p.contact_email || "", contract_status: p.contract_status, revenue_share: p.revenue_share || 0, description: p.description || "" }); setOpen(true); };

  const typeLabels: Record<string, string> = { internal: "內部", external_org: "外部機構", individual: "個人" };
  const statusColors: Record<string, string> = { active: "text-green-500", expired: "text-destructive", pending: "text-amber-500", terminated: "text-muted-foreground" };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">合作單位</h2>
        <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" />新增單位</Button>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead>類型</TableHead>
              <TableHead>聯絡人</TableHead>
              <TableHead>合約狀態</TableHead>
              <TableHead>分潤 %</TableHead>
              <TableHead className="w-24">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">{typeLabels[p.type] || p.type}</Badge></TableCell>
                <TableCell className="text-sm">{p.contact_name || "-"}</TableCell>
                <TableCell><span className={`font-medium ${statusColors[p.contract_status] || ""}`}>{p.contract_status}</span></TableCell>
                <TableCell className="text-sm">{p.revenue_share}%</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("確定刪除？")) deleteMutation.mutate(p.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "編輯合作單位" : "新增合作單位"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>單位名稱</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>類型</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">內部</SelectItem>
                    <SelectItem value="external_org">外部機構</SelectItem>
                    <SelectItem value="individual">個人</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>合約狀態</Label>
                <Select value={form.contract_status} onValueChange={(v) => setForm(f => ({ ...f, contract_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">有效</SelectItem>
                    <SelectItem value="pending">待簽</SelectItem>
                    <SelectItem value="expired">已過期</SelectItem>
                    <SelectItem value="terminated">已終止</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>聯絡人</Label><Input value={form.contact_name} onChange={(e) => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div><Label>信箱</Label><Input value={form.contact_email} onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            </div>
            <div><Label>分潤比例 (%)</Label><Input type="number" value={form.revenue_share} onChange={(e) => setForm(f => ({ ...f, revenue_share: +e.target.value }))} /></div>
            <div><Label>簡介</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name}>{editing ? "更新" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Instructors Tab ==========
function InstructorsTab({ instructors, partners, queryClient }: { instructors: any[]; partners: any[]; queryClient: any }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", partner_id: "", bio: "" });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("instructors").insert({ ...form, partner_id: form.partner_id || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已建立"); queryClient.invalidateQueries({ queryKey: ["admin_instructors"] }); setOpen(false); },
    onError: () => toast.error("建立失敗"),
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground">講師列表</h2>
        <Button size="sm" onClick={() => { setForm({ name: "", partner_id: "", bio: "" }); setOpen(true); }} className="gap-1"><Plus className="w-4 h-4" />新增講師</Button>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>所屬單位</TableHead>
              <TableHead>簡介</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell className="text-sm">{i.partners?.name || "內部"}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{i.bio || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增講師</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>姓名</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div>
              <Label>所屬單位</Label>
              <Select value={form.partner_id} onValueChange={(v) => setForm(f => ({ ...f, partner_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇單位（可選）" /></SelectTrigger>
                <SelectContent>
                  {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>簡介</Label><Textarea value={form.bio} onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== Enrollments Tab ==========
function EnrollmentsTab({ enrollments, queryClient }: { enrollments: any[]; queryClient: any }) {
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("course_enrollments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已更新"); queryClient.invalidateQueries({ queryKey: ["admin_enrollments"] }); },
  });

  return (
    <>
      <h2 className="font-semibold text-foreground mb-4">報名與報到管理</h2>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>學員</TableHead>
              <TableHead>課程</TableHead>
              <TableHead>梯次</TableHead>
              <TableHead>繳費</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollments.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{(e.profiles as any)?.display_name || "-"}</TableCell>
                <TableCell className="text-sm">{e.course_sessions?.courses?.title || "-"}</TableCell>
                <TableCell className="text-sm">{e.course_sessions?.title_suffix || "-"}</TableCell>
                <TableCell>
                  <Switch checked={e.paid} onCheckedChange={(v) => updateMutation.mutate({ id: e.id, updates: { paid: v } })} />
                </TableCell>
                <TableCell>
                  <Select value={e.status} onValueChange={(v) => updateMutation.mutate({ id: e.id, updates: { status: v } })}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">待確認</SelectItem>
                      <SelectItem value="confirmed">已確認</SelectItem>
                      <SelectItem value="cancelled">已取消</SelectItem>
                      <SelectItem value="waitlisted">候補</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{new Date(e.enrolled_at).toLocaleDateString("zh-TW")}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// ========== Quizzes Tab ==========
function QuizzesTab({ courses }: { courses: any[] }) {
  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin_quizzes"],
    queryFn: async () => {
      const { data } = await supabase.from("course_quizzes").select("*, courses(title)");
      return data || [];
    },
  });

  return (
    <>
      <h2 className="font-semibold text-foreground mb-4">測驗管理</h2>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>測驗標題</TableHead>
              <TableHead>所屬課程</TableHead>
              <TableHead>及格分</TableHead>
              <TableHead>時間限制</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quizzes.map((q: any) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.title}</TableCell>
                <TableCell className="text-sm">{q.courses?.title || "-"}</TableCell>
                <TableCell className="text-sm">{q.passing_score} 分</TableCell>
                <TableCell className="text-sm">{q.time_limit_minutes} 分鐘</TableCell>
              </TableRow>
            ))}
            {quizzes.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">尚未建立測驗</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground mt-2">💡 測驗建立功能即將推出</p>
    </>
  );
}
