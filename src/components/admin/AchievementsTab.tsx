import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Award, X, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "learning", label: "學習" },
  { value: "automation", label: "自動化" },
  { value: "task", label: "任務" },
  { value: "community", label: "社群" },
  { value: "revenue", label: "營收" },
  { value: "general", label: "一般" },
];

const categoryLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label ?? v;

type Achievement = {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  created_at: string;
};

type AwardedRecord = {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievements: { name: string; icon: string } | null;
  profiles: { display_name: string; email: string | null; student_id: string | null } | null;
};

export function AchievementsTab() {
  const qc = useQueryClient();

  // ---- Queries ----
  const { data: achievements = [] } = useQuery<Achievement[]>({
    queryKey: ["admin_achievements"],
    queryFn: async () => {
      const { data } = await supabase.from("achievements").select("*").order("category").order("name");
      return (data as Achievement[]) || [];
    },
  });

  const { data: awarded = [] } = useQuery<AwardedRecord[]>({
    queryKey: ["admin_user_achievements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_achievements")
        .select("id, user_id, achievement_id, earned_at, achievements(name, icon)")
        .order("earned_at", { ascending: false })
        .limit(200);
      if (!data || data.length === 0) return [];
      const userIds = [...new Set(data.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, email, student_id").in("id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return data.map((r: any) => ({ ...r, profiles: profileMap.get(r.user_id) || null }));
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin_profiles_for_award"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email, student_id").eq("activated", true).order("display_name");
      return data || [];
    },
  });

  // ---- Achievement CRUD ----
  const [defOpen, setDefOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [form, setForm] = useState({ name: "", icon: "🏆", category: "general", description: "" });

  const openCreate = () => { setEditing(null); setForm({ name: "", icon: "🏆", category: "general", description: "" }); setDefOpen(true); };
  const openEdit = (a: Achievement) => { setEditing(a); setForm({ name: a.name, icon: a.icon, category: a.category, description: a.description }); setDefOpen(true); };

  const saveDef = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("achievements").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("achievements").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "已更新" : "已建立"); qc.invalidateQueries({ queryKey: ["admin_achievements"] }); setDefOpen(false); },
    onError: (e: any) => toast.error("失敗：" + e.message),
  });

  const deleteDef = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("achievements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("已刪除"); qc.invalidateQueries({ queryKey: ["admin_achievements"] }); },
    onError: (e: any) => toast.error("刪除失敗：" + e.message),
  });

  // ---- Award / Revoke ----
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardForm, setAwardForm] = useState({ user_id: "", achievement_id: "" });

  const awardMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_achievements").insert({ user_id: awardForm.user_id, achievement_id: awardForm.achievement_id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已頒發勳章");
      qc.invalidateQueries({ queryKey: ["admin_user_achievements"] });
      setAwardOpen(false);
    },
    onError: (e: any) => toast.error("頒發失敗：" + e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_achievements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已撤銷勳章");
      qc.invalidateQueries({ queryKey: ["admin_user_achievements"] });
    },
    onError: (e: any) => toast.error("撤銷失敗：" + e.message),
  });

  return (
    <div className="space-y-8">
      {/* === Achievement Definitions === */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">成就定義</h2>
          <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" />新增成就</Button>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">圖示</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>類別</TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-24">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {achievements.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="text-2xl">{a.icon}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><Badge variant="secondary">{categoryLabel(a.category)}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{a.description}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("確定刪除此成就？相關已頒發紀錄也會被刪除。")) deleteDef.mutate(a.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {achievements.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">尚無成就定義</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* === Awarded Records === */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">已頒發紀錄</h2>
          <Button size="sm" onClick={() => { setAwardForm({ user_id: "", achievement_id: "" }); setAwardOpen(true); }} className="gap-1"><Award className="w-4 h-4" />手動頒發</Button>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>學員</TableHead>
                <TableHead>成就</TableHead>
                <TableHead>獲得時間</TableHead>
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {awarded.map(r => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{r.profiles?.display_name || "未知"}</span>
                      {r.profiles?.student_id && <span className="ml-2 text-xs text-muted-foreground">{r.profiles.student_id}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="mr-1">{r.achievements?.icon}</span>
                    {r.achievements?.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(r.earned_at).toLocaleString("zh-TW")}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("確定撤銷此勳章？")) revokeMut.mutate(r.id); }}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {awarded.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">尚無頒發紀錄</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* === Definition Dialog === */}
      <Dialog open={defOpen} onOpenChange={setDefOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "編輯成就" : "新增成就"}</DialogTitle>
            <DialogDescription>設定成就的名稱、圖示與分類</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>圖示</Label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="text-center text-xl" maxLength={4} />
              </div>
              <div className="col-span-3">
                <Label>名稱</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例: 學習達人" />
              </div>
            </div>
            <div>
              <Label>類別</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>描述</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="達成此成就的條件說明" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDefOpen(false)}>取消</Button>
            <Button onClick={() => saveDef.mutate()} disabled={!form.name}>{editing ? "更新" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Award Dialog === */}
      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手動頒發勳章</DialogTitle>
            <DialogDescription>選擇學員與成就進行頒發</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>學員</Label>
              <Select value={awardForm.user_id} onValueChange={v => setAwardForm(f => ({ ...f, user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇學員" /></SelectTrigger>
                <SelectContent>
                  {allProfiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.display_name}{p.student_id ? ` (${p.student_id})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>成就</Label>
              <Select value={awardForm.achievement_id} onValueChange={v => setAwardForm(f => ({ ...f, achievement_id: v }))}>
                <SelectTrigger><SelectValue placeholder="選擇成就" /></SelectTrigger>
                <SelectContent>
                  {achievements.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardOpen(false)}>取消</Button>
            <Button onClick={() => awardMut.mutate()} disabled={!awardForm.user_id || !awardForm.achievement_id}>頒發</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
