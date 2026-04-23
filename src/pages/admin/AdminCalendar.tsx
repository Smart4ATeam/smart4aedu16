import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Trash2, Link2, AlertTriangle, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

const EMPTY_FORM = {
  title: "",
  color: "gradient-orange",
  event_date: "",
  event_time: "",
  end_time: "",
  description: "",
  is_global: true,
};

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDayOfMonth(y: number, m: number) { return new Date(y, m, 1).getDay(); }
function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return "";
  const s = start.slice(0, 5);
  if (!end) return s;
  return `${s} ~ ${end.slice(0, 5)}`;
}

export default function AdminCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();

  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // filters
  const [filterType, setFilterType] = useState<"all" | "global" | "personal" | "session">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [scope, setScope] = useState<"month" | "range">("month");

  // linked-event warning dialog
  const [warning, setWarning] = useState<{ event: CalendarEvent; action: "edit" | "delete" } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true });
    if (error) toast.error("讀取失敗：" + error.message);
    if (data) setEvents(data);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const startEdit = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      color: ev.color,
      event_date: ev.event_date,
      event_time: ev.event_time ?? "",
      end_time: ev.end_time ?? "",
      description: ev.description ?? "",
      is_global: ev.is_global,
    });
    setShowDialog(true);
  };

  const handleEditClick = (ev: CalendarEvent) => {
    if (ev.session_id) {
      setWarning({ event: ev, action: "edit" });
      return;
    }
    startEdit(ev);
  };

  const startDelete = async (ev: CalendarEvent) => {
    if (!confirm(`確定要刪除「${ev.title}」嗎？`)) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", ev.id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("活動已刪除");
    fetchEvents();
  };

  const handleDeleteClick = (ev: CalendarEvent) => {
    if (ev.session_id) {
      setWarning({ event: ev, action: "delete" });
      return;
    }
    startDelete(ev);
  };

  const handleSave = async () => {
    if (!form.title || !form.event_date || !user) return;
    const payload = {
      title: form.title,
      color: form.color,
      event_date: form.event_date,
      event_time: form.event_time || null,
      end_time: form.end_time || null,
      description: form.description || null,
      is_global: form.is_global,
      user_id: form.is_global ? null : user.id,
    };
    if (editingId) {
      const { error } = await supabase.from("calendar_events").update(payload).eq("id", editingId);
      if (error) { toast.error("更新失敗：" + error.message); return; }
      toast.success("活動已更新");
    } else {
      const { error } = await supabase.from("calendar_events").insert(payload);
      if (error) { toast.error("新增失敗：" + error.message); return; }
      toast.success("活動已新增");
    }
    setShowDialog(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    fetchEvents();
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const formatKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const isToday = (day: number) =>
    year === now.getFullYear() && month === now.getMonth() && day === now.getDate();

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!matchesFilter(ev)) return acc;
    if (!acc[ev.event_date]) acc[ev.event_date] = [];
    acc[ev.event_date].push(ev);
    return acc;
  }, {});

  const matchesFilter = (ev: CalendarEvent) => {
    if (filterType === "global" && !(ev.is_global && !ev.session_id)) return false;
    if (filterType === "personal" && ev.is_global) return false;
    if (filterType === "session" && !ev.session_id) return false;
    if (filterFrom && ev.event_date < filterFrom) return false;
    if (filterTo && ev.event_date > filterTo) return false;
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase();
      const hay = `${ev.title} ${ev.description ?? ""}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  };

  const filteredEvents = events.filter(matchesFilter);

  const monthEvents = (scope === "range" && (filterFrom || filterTo || filterKeyword || filterType !== "all")
    ? filteredEvents
    : filteredEvents.filter((ev) => {
        const d = new Date(ev.event_date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
  ).sort((a, b) => a.event_date.localeCompare(b.event_date));

  const hasActiveFilter = filterType !== "all" || filterFrom || filterTo || filterKeyword;
  const clearFilters = () => {
    setFilterType("all");
    setFilterFrom("");
    setFilterTo("");
    setFilterKeyword("");
    setScope("month");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">行事曆管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理全域與課程梯次連動的活動</p>
        </div>
        <Button onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" />新增活動</Button>
      </div>

      {/* Month grid */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h3 className="text-base font-semibold text-foreground">{year} 年 {month + 1} 月</h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-2">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = formatKey(day);
            const dayEvents = eventsByDate[key] || [];
            return (
              <div
                key={i}
                className={`min-h-[80px] p-1.5 rounded-lg border transition-colors ${
                  isToday(day) ? "border-primary/50 bg-primary/5" : "border-transparent"
                }`}
              >
                <span className={`text-xs font-medium ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.map((ev) => {
                    const colorMap: Record<string, string> = {
                      "gradient-orange": "bg-accent/15 text-[hsl(37,58%,38%)] dark:text-accent border border-accent/20",
                      "gradient-purple": "bg-secondary/15 text-[hsl(210,18%,45%)] dark:text-secondary border border-secondary/20",
                      "gradient-lime": "bg-success/15 text-[hsl(168,42%,30%)] dark:text-success border border-success/20",
                      "gradient-cyan": "bg-chart-cyan/15 text-[hsl(200,35%,38%)] dark:text-chart-cyan border border-chart-cyan/20",
                    };
                    const colorClass = colorMap[ev.color] || colorMap["gradient-orange"];
                    return (
                      <div
                        key={ev.id}
                        onClick={() => handleEditClick(ev)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80 ${colorClass}`}
                        title={ev.title}
                      >
                        {ev.session_id ? "🔗 " : ""}{ev.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* List */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">本月活動清單</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>日期</TableHead>
              <TableHead>時段</TableHead>
              <TableHead>類型</TableHead>
              <TableHead>地點/說明</TableHead>
              <TableHead className="w-28">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthEvents.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">本月沒有活動</TableCell></TableRow>
            ) : monthEvents.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    {ev.session_id && <Link2 className="w-3.5 h-3.5 text-chart-cyan" />}
                    {ev.title}
                  </div>
                </TableCell>
                <TableCell className="text-sm font-mono">{ev.event_date}</TableCell>
                <TableCell className="text-sm font-mono">{formatTimeRange(ev.event_time, ev.end_time) || "-"}</TableCell>
                <TableCell>
                  {ev.session_id ? (
                    <Badge variant="outline" className="text-chart-cyan border-chart-cyan/30">課程連動</Badge>
                  ) : ev.is_global ? (
                    <Badge>全域</Badge>
                  ) : (
                    <Badge variant="secondary">個人</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{ev.description || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEditClick(ev)} title="編輯">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(ev)} title="刪除">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯活動" : "新增活動"}</DialogTitle>
            <DialogDescription>{editingId ? "修改行事曆活動資料" : "建立全域或個人行事曆活動"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>標題</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>說明 / 地點</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>顏色</Label>
                <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gradient-orange"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-accent" />金琥珀</span></SelectItem>
                    <SelectItem value="gradient-purple"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary" />鋼藍灰</span></SelectItem>
                    <SelectItem value="gradient-lime"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-success" />青綠色</span></SelectItem>
                    <SelectItem value="gradient-cyan"><span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-chart-cyan" />鋼鐵藍</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>類型</Label>
                <Select value={form.is_global ? "global" : "personal"} onValueChange={(v) => setForm({ ...form, is_global: v === "global" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">全域（所有人可見）</SelectItem>
                    <SelectItem value="personal">個人（僅自己可見）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>日期</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>開始時間（選填）</Label><Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /></div>
              <div><Label>結束時間（選填）</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); setEditingId(null); setForm(EMPTY_FORM); }}>取消</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.event_date}>{editingId ? "更新" : "建立"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 連動活動警示 dialog */}
      <Dialog open={!!warning} onOpenChange={(o) => { if (!o) setWarning(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent" /> 此活動為課程梯次連動建立
            </DialogTitle>
            <DialogDescription>
              {warning?.action === "edit"
                ? "直接編輯只會影響行事曆顯示，下次梯次資料更新時會被覆寫。建議至「學習中心 → 梯次管理」修改梯次本體。"
                : "刪除後，下次梯次資料更新（或狀態變更）時會自動重新建立。建議至「學習中心 → 梯次管理」將梯次狀態改為「排程中」或停開。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setWarning(null)}>取消</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setWarning(null); navigate("/admin/learning"); }}>
                前往修改梯次
              </Button>
              <Button
                variant={warning?.action === "delete" ? "destructive" : "default"}
                onClick={() => {
                  if (!warning) return;
                  const ev = warning.event;
                  const action = warning.action;
                  setWarning(null);
                  if (action === "edit") startEdit(ev);
                  else startDelete(ev);
                }}
              >
                仍要直接{warning?.action === "delete" ? "刪除" : "編輯"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
