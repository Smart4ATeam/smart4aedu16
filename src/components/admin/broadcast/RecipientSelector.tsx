import { useEffect, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ENROLLMENT_STATUS_LABELS, type RecipientFilter, type SessionKey } from "@/lib/broadcast/types";

interface Course { id: string; title: string; course_code: string | null; category: string }
interface Session { id: string; course_id: string; start_date: string | null; title_suffix: string | null }
interface MemberSearchResult { user_id: string; name: string; member_no: string | null; email: string | null }

const STATUS_OPTS = ["enrolled", "confirmed", "completed", "cancelled"];

/** 把 ISO "YYYY-MM-DD" 轉成 DB 中 session_date 用的 "YYYY/MM/DD" */
function isoToSlash(iso: string): string {
  return iso.replace(/-/g, "/");
}

export function RecipientSelector({
  value,
  onChange,
}: {
  value: RecipientFilter;
  onChange: (f: RecipientFilter) => void;
}) {
  const [tab, setTab] = useState<"all" | "filter" | "specific">(value.mode);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [requireAll, setRequireAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<MemberSearchResult[]>([]);

  useEffect(() => {
    supabase.from("courses").select("id,title,course_code,category").order("title")
      .then(({ data }) => setCourses(data || []));
    supabase.from("course_sessions").select("id,course_id,start_date,title_suffix").order("start_date", { ascending: false })
      .then(({ data }) => setSessions(data || []));
  }, []);

  useEffect(() => {
    setTab(value.mode);
  }, [value.mode]);

  const updateFilters = (patch: Partial<NonNullable<RecipientFilter["filters"]>>) => {
    const merged = { ...(value.filters || {}), ...patch };
    onChange({ mode: "filter", filters: merged });
  };

  const toggleCourse = (id: string) => {
    const key = requireAll ? "course_ids_all" : "course_ids";
    const current = value.filters?.[key] || [];
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    updateFilters({ [key]: next, [requireAll ? "course_ids" : "course_ids_all"]: [] });
  };

  const sessionKeyEq = (a: SessionKey, b: SessionKey) =>
    a.course_id === b.course_id && a.session_date === b.session_date;

  const toggleSession = (s: Session) => {
    if (!s.start_date) return;
    const key: SessionKey = {
      course_id: s.course_id,
      session_date: isoToSlash(s.start_date),
    };
    const current = value.filters?.session_keys || [];
    const exists = current.find((x) => sessionKeyEq(x, key));
    const next = exists ? current.filter((x) => !sessionKeyEq(x, key)) : [...current, key];
    updateFilters({ session_keys: next });
  };

  const toggleStatus = (s: string) => {
    const current = value.filters?.enrollment_status || [];
    const next = current.includes(s) ? current.filter((x) => x !== s) : [...current, s];
    updateFilters({ enrollment_status: next });
  };

  const doSearch = async () => {
    if (!searchTerm.trim()) return;
    const term = `%${searchTerm.trim()}%`;
    const { data } = await supabase
      .from("reg_members")
      .select("user_id,name,member_no,email")
      .or(`name.ilike.${term},email.ilike.${term},member_no.ilike.${term},phone.ilike.${term}`)
      .not("user_id", "is", null)
      .limit(20);
    setSearchResults((data || []) as MemberSearchResult[]);
  };

  const addMember = (m: MemberSearchResult) => {
    if (selectedMembers.find((x) => x.user_id === m.user_id)) return;
    const next = [...selectedMembers, m];
    setSelectedMembers(next);
    onChange({ mode: "specific", user_ids: next.map((x) => x.user_id) });
  };

  const removeMember = (uid: string) => {
    const next = selectedMembers.filter((m) => m.user_id !== uid);
    setSelectedMembers(next);
    onChange({ mode: "specific", user_ids: next.map((x) => x.user_id) });
  };

  return (
    <Tabs value={tab} onValueChange={(v) => {
      setTab(v as typeof tab);
      if (v === "all") onChange({ mode: "all" });
      else if (v === "filter") onChange({ mode: "filter", filters: value.filters || {} });
      else onChange({ mode: "specific", user_ids: selectedMembers.map((m) => m.user_id) });
    }}>
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="all">全體學員</TabsTrigger>
        <TabsTrigger value="filter">依課程／梯次</TabsTrigger>
        <TabsTrigger value="specific">手動指定</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="pt-3">
        <p className="text-sm text-muted-foreground">將發送給所有已啟用帳號的學員。</p>
      </TabsContent>

      <TabsContent value="filter" className="space-y-4 pt-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">課程（多選）</Label>
            <div className="flex items-center gap-2">
              <Checkbox id="all-courses" checked={requireAll} onCheckedChange={(v) => setRequireAll(!!v)} />
              <Label htmlFor="all-courses" className="text-xs cursor-pointer">必須全部都上過</Label>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-2 border rounded">
            {courses.map((c) => {
              const list = (requireAll ? value.filters?.course_ids_all : value.filters?.course_ids) || [];
              const active = list.includes(c.id);
              return (
                <Badge
                  key={c.id}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCourse(c.id)}
                >
                  {c.course_code ? `${c.course_code} ` : ""}{c.title}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs">梯次（多選）</Label>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto p-2 border rounded mt-1">
            {sessions.slice(0, 50).map((s) => {
              if (!s.start_date) return null;
              const key: SessionKey = { course_id: s.course_id, session_date: isoToSlash(s.start_date) };
              const active = (value.filters?.session_keys || []).some(
                (x) => sessionKeyEq(x, key),
              );
              const course = courses.find((c) => c.id === s.course_id);
              return (
                <Badge
                  key={s.id}
                  variant={active ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleSession(s)}
                >
                  {s.start_date} {course?.title}{s.title_suffix ? ` ${s.title_suffix}` : ""}
                </Badge>
              );
            })}
          </div>
        </div>

        <div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">梯次日期範圍 — 起（選填）</Label>
              <Input type="date" value={value.filters?.session_date_from || ""}
                onChange={(e) => updateFilters({ session_date_from: e.target.value || undefined })} />
            </div>
            <div>
              <Label className="text-xs">梯次日期範圍 — 迄（選填）</Label>
              <Input type="date" value={value.filters?.session_date_to || ""}
                onChange={(e) => updateFilters({ session_date_to: e.target.value || undefined })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            💡 不勾梯次時，可用此區間批次抓某段時間所有梯次的學員。
          </p>
        </div>

        <div>
          <Label className="text-xs">報名狀態（不選 = 預設排除「已取消」）</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STATUS_OPTS.map((s) => {
              const active = (value.filters?.enrollment_status || []).includes(s);
              return (
                <Badge key={s} variant={active ? "default" : "outline"}
                  className="cursor-pointer" onClick={() => toggleStatus(s)}>
                  {ENROLLMENT_STATUS_LABELS[s] || s}
                </Badge>
              );
            })}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="specific" className="space-y-3 pt-3">
        <div className="flex gap-2">
          <Input
            placeholder="搜尋姓名／email／編號／電話"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
          />
          <Button variant="outline" onClick={doSearch}><Search className="w-4 h-4" /></Button>
        </div>
        {searchResults.length > 0 && (
          <div className="border rounded max-h-40 overflow-auto">
            {searchResults.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between p-2 hover:bg-muted text-sm">
                <span>{m.name} <span className="text-muted-foreground text-xs">({m.member_no} / {m.email})</span></span>
                <Button size="sm" variant="ghost" onClick={() => addMember(m)}><Plus className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Label className="text-xs">已選 {selectedMembers.length} 位</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {selectedMembers.map((m) => (
              <Badge key={m.user_id} variant="default" className="gap-1">
                {m.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => removeMember(m.user_id)} />
              </Badge>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
