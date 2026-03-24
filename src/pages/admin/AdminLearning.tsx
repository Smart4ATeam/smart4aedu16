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
import { BookOpen, Users, Handshake, GraduationCap, CalendarDays, ClipboardCheck, Plus, Pencil, Trash2, FileText, ListPlus } from "lucide-react";
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
  const [contentCourse, setContentCourse] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", description: "", long_description: "", category: "basic", price: 0, total_hours: 0, instructor_id: "", status: "draft", cover_url: "", materials_url: "", registration_url: "https://dao.smart4a.tw/registration", detail_url: "" });

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

  const openCreate = () => { setEditing(null); setForm({ title: "", description: "", long_description: "", category: "basic", price: 0, total_hours: 0, instructor_id: "", status: "draft", cover_url: "", materials_url: "", registration_url: "https://dao.smart4a.tw/registration", detail_url: "" }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ title: c.title, description: c.description, long_description: c.long_description || "", category: c.category, price: c.price, total_hours: c.total_hours, instructor_id: c.instructor_id || "", status: c.status, cover_url: c.cover_url || "", materials_url: c.materials_url || "", registration_url: c.registration_url || "https://dao.smart4a.tw/registration", detail_url: c.detail_url || "" }); setOpen(true); };

  const statusLabels: Record<string, string> = { draft: "草稿", published: "已發佈", archived: "已封存" };
  const statusColors: Record<string, string> = { draft: "secondary", published: "default", archived: "outline" };

  if (contentCourse) {
    return <CourseContentEditor course={contentCourse} onBack={() => setContentCourse(null)} />;
  }

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
                    <Button size="icon" variant="ghost" title="管理內容" onClick={() => setContentCourse(c)}><FileText className="w-4 h-4 text-primary" /></Button>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "編輯課程" : "新增課程"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>課程名稱</Label><Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>簡短描述</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="顯示在課程卡片上的簡短介紹" /></div>
            <div><Label>詳細介紹</Label><Textarea value={form.long_description} onChange={(e) => setForm(f => ({ ...f, long_description: e.target.value }))} rows={6} placeholder="點開課程後看到的完整介紹，支援多段落（換行即分段）" /></div>
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
            <div><Label>封面圖片 URL</Label><Input value={form.cover_url} onChange={(e) => setForm(f => ({ ...f, cover_url: e.target.value }))} placeholder="https://example.com/image.png" /></div>
            <div><Label>報名連結</Label><Input value={form.registration_url} onChange={(e) => setForm(f => ({ ...f, registration_url: e.target.value }))} placeholder="https://dao.smart4a.tw/registration" /></div>
            <div><Label>課前教材連結</Label><Input value={form.materials_url} onChange={(e) => setForm(f => ({ ...f, materials_url: e.target.value }))} placeholder="https://example.com/materials" /></div>
            <div><Label>課程介紹頁連結（選填）</Label><Input value={form.detail_url} onChange={(e) => setForm(f => ({ ...f, detail_url: e.target.value }))} placeholder="https://dao.smart4a.tw/registration?course=wendao" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate({ ...form, instructor_id: form.instructor_id || null, cover_url: form.cover_url || null, materials_url: form.materials_url || null })} disabled={!form.title}>
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
  const [batchOpen, setBatchOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const defaultForm = { course_id: "", title_suffix: "", start_date: "", end_date: "", location: "", max_students: "", price: "", schedule_type: "recurring", status: "scheduled", registration_url: "https://dao.smart4a.tw/registration" };
  const [form, setForm] = useState(defaultForm);

  // Batch form state
  const [batchForm, setBatchForm] = useState({
    course_id: "",
    year: new Date().getFullYear().toString(),
    frequency: "monthly" as "monthly" | "bimonthly" | "quarterly" | "custom",
    selectedMonths: [] as number[],
    day: "15",
    duration: "1",
    location: "",
    max_students: "",
    status: "open",
    registration_url: "https://dao.smart4a.tw/registration",
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        course_id: form.course_id,
        title_suffix: form.title_suffix,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        location: form.location,
        max_students: form.max_students ? +form.max_students : null,
        price: form.price ? +form.price : null,
        schedule_type: form.schedule_type,
        status: form.status,
        registration_url: form.registration_url || "https://dao.smart4a.tw/registration",
      };
      if (editing) {
        const { error } = await supabase.from("course_sessions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_sessions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "已更新" : "梯次已建立"); queryClient.invalidateQueries({ queryKey: ["admin_sessions"] }); setOpen(false); },
    onError: () => toast.error("操作失敗"),
  });

  const getBatchMonths = () => {
    const f = batchForm.frequency;
    if (f === "monthly") return [1,2,3,4,5,6,7,8,9,10,11,12];
    if (f === "bimonthly") return [1,3,5,7,9,11];
    if (f === "quarterly") return [1,4,7,10];
    return batchForm.selectedMonths.sort((a,b) => a - b);
  };

  const batchMutation = useMutation({
    mutationFn: async () => {
      const year = +batchForm.year;
      const day = +batchForm.day;
      const dur = +batchForm.duration;
      const monthsList = getBatchMonths();
      const rows: any[] = [];
      for (const m of monthsList) {
        const lastDay = new Date(year, m, 0).getDate();
        const actualDay = Math.min(day, lastDay);
        const startDate = `${year}-${String(m).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`;
        let endDate: string | null = null;
        if (dur > 1) {
          const end = new Date(year, m - 1, actualDay + dur - 1);
          endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
        } else {
          endDate = startDate;
        }
        rows.push({
          course_id: batchForm.course_id,
          title_suffix: `${year}年${m}月班`,
          start_date: startDate,
          end_date: endDate,
          location: batchForm.location || "",
          max_students: batchForm.max_students ? +batchForm.max_students : null,
          schedule_type: "recurring",
          status: batchForm.status,
          registration_url: batchForm.registration_url || "https://dao.smart4a.tw/registration",
        });
      }
      const { error } = await supabase.from("course_sessions").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => { toast.success(`已批次建立 ${count} 個梯次`); queryClient.invalidateQueries({ queryKey: ["admin_sessions"] }); setBatchOpen(false); },
    onError: () => toast.error("批次建立失敗"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("course_sessions").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("狀態已更新"); queryClient.invalidateQueries({ queryKey: ["admin_sessions"] }); },
  });

  const statusLabels: Record<string, string> = { scheduled: "排程中", open: "開放報名", in_progress: "進行中", completed: "已結束", cancelled: "已停開" };
  const statusColors: Record<string, string> = { scheduled: "secondary", open: "default", in_progress: "default", completed: "outline", cancelled: "destructive" };

  const openCreate = () => { setEditing(null); setForm(defaultForm); setOpen(true); };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      course_id: s.course_id,
      title_suffix: s.title_suffix || "",
      start_date: s.start_date || "",
      end_date: s.end_date || "",
      location: s.location || "",
      max_students: s.max_students?.toString() || "",
      price: s.price?.toString() || "",
      schedule_type: s.schedule_type,
      status: s.status,
      registration_url: s.registration_url || "https://dao.smart4a.tw/registration",
    });
    setOpen(true);
  };

  const formatDate = (d: string | null) => d ? d.replace(/-/g, "/") : "-";

  const filtered = filterCourse === "all" ? sessions : sessions.filter((s: any) => s.course_id === filterCourse);
  const sorted = [...filtered].sort((a: any, b: any) => (a.start_date || "").localeCompare(b.start_date || ""));

  

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">梯次列表</h2>
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-40 h-8"><SelectValue placeholder="篩選課程" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部課程</SelectItem>
              {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)} className="gap-1"><ListPlus className="w-4 h-4" />批次新增</Button>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" />新增梯次</Button>
        </div>
      </div>
      <div className="glass-card rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>課程</TableHead>
              <TableHead>梯次</TableHead>
              <TableHead>開課日</TableHead>
              <TableHead>結束日</TableHead>
              <TableHead>地點</TableHead>
              <TableHead>人數上限</TableHead>
              <TableHead>費用覆寫</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s: any) => (
              <TableRow key={s.id} className={s.status === "cancelled" ? "opacity-50" : ""}>
                <TableCell className="font-medium">{s.courses?.title}</TableCell>
                <TableCell>{s.title_suffix || "-"}</TableCell>
                <TableCell className="text-sm font-mono">{formatDate(s.start_date)}</TableCell>
                <TableCell className="text-sm font-mono">{formatDate(s.end_date)}</TableCell>
                <TableCell className="text-sm">{s.location || "-"}</TableCell>
                <TableCell className="text-sm">{s.max_students || "不限"}</TableCell>
                <TableCell className="text-sm">{s.price ? `NT$ ${s.price}` : "-"}</TableCell>
                <TableCell><Badge variant={statusColors[s.status] as any}>{statusLabels[s.status] || s.status}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" title="編輯" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                    {s.status !== "cancelled" ? (
                      <Button size="icon" variant="ghost" title="停開" onClick={() => { if (confirm("確定停開此梯次？")) statusMutation.mutate({ id: s.id, status: "cancelled" }); }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => statusMutation.mutate({ id: s.id, status: "scheduled" })}>恢復</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">尚無梯次資料</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Single session dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "編輯梯次" : "新增梯次"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>所屬課程</Label>
              <Select value={form.course_id} onValueChange={(v) => setForm(f => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇課程" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>梯次名稱</Label><Input value={form.title_suffix} onChange={(e) => setForm(f => ({ ...f, title_suffix: e.target.value }))} placeholder="例如：2026年5月班" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>開課日</Label><Input type="date" value={form.start_date} onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>結束日</Label><Input type="date" value={form.end_date} onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>地點</Label><Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><Label>人數上限</Label><Input type="number" value={form.max_students} onChange={(e) => setForm(f => ({ ...f, max_students: e.target.value }))} placeholder="留空=不限" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>費用覆寫 (NT$)</Label><Input type="number" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="留空=用課程預設" /></div>
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
            <div>
              <Label>狀態</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">排程中</SelectItem>
                  <SelectItem value="open">開放報名</SelectItem>
                  <SelectItem value="in_progress">進行中</SelectItem>
                  <SelectItem value="completed">已結束</SelectItem>
                  <SelectItem value="cancelled">已停開</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>報名連結</Label><Input value={form.registration_url} onChange={(e) => setForm(f => ({ ...f, registration_url: e.target.value }))} placeholder="https://dao.smart4a.tw/registration" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.course_id}>{editing ? "更新" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch create dialog */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>批次新增梯次</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">為選定課程一次建立多個月份的梯次</p>
          <div className="space-y-4">
            <div>
              <Label>所屬課程</Label>
              <Select value={batchForm.course_id} onValueChange={(v) => setBatchForm(f => ({ ...f, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇課程" /></SelectTrigger>
                <SelectContent>{courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>年份</Label><Input type="number" value={batchForm.year} onChange={(e) => setBatchForm(f => ({ ...f, year: e.target.value }))} /></div>
              <div>
                <Label>開課頻率</Label>
                <Select value={batchForm.frequency} onValueChange={(v: any) => setBatchForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">每月</SelectItem>
                    <SelectItem value="bimonthly">每兩月</SelectItem>
                    <SelectItem value="quarterly">每季</SelectItem>
                    <SelectItem value="custom">自選月份</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {batchForm.frequency === "custom" && (
              <div>
                <Label className="mb-2 block">選擇月份</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const selected = batchForm.selectedMonths.includes(m);
                    return (
                      <button key={m} type="button"
                        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}
                        onClick={() => setBatchForm(f => ({
                          ...f,
                          selectedMonths: selected ? f.selectedMonths.filter(x => x !== m) : [...f.selectedMonths, m],
                        }))}
                      >{m}月</button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>每月開課日（幾號）</Label><Input type="number" min={1} max={31} value={batchForm.day} onChange={(e) => setBatchForm(f => ({ ...f, day: e.target.value }))} /></div>
              <div><Label>課程天數</Label><Input type="number" min={1} max={14} value={batchForm.duration} onChange={(e) => setBatchForm(f => ({ ...f, duration: e.target.value }))} placeholder="1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>預設狀態</Label>
                <Select value={batchForm.status} onValueChange={(v) => setBatchForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">排程中</SelectItem>
                    <SelectItem value="open">開放報名</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>人數上限</Label><Input type="number" value={batchForm.max_students} onChange={(e) => setBatchForm(f => ({ ...f, max_students: e.target.value }))} placeholder="留空=不限" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>地點</Label><Input value={batchForm.location} onChange={(e) => setBatchForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><Label>報名連結</Label><Input value={batchForm.registration_url} onChange={(e) => setBatchForm(f => ({ ...f, registration_url: e.target.value }))} /></div>
            </div>
            {batchForm.course_id && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">預覽：將建立 {getBatchMonths().length} 個梯次</p>
                <p className="text-muted-foreground">
                  {getBatchMonths().map(m => `${m}月`).join("、")}，每月{batchForm.day}號開課
                  {+batchForm.duration > 1 ? `（${batchForm.duration}天）` : ""}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>取消</Button>
            <Button onClick={() => batchMutation.mutate()} disabled={!batchForm.course_id || batchMutation.isPending || (batchForm.frequency === "custom" && batchForm.selectedMonths.length === 0)}>
              {batchMutation.isPending ? "建立中..." : "批次建立"}
            </Button>
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
