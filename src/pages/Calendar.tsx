import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

const DAYS = ["日", "一", "二", "三", "四", "五", "六"];

const EMPTY_FORM = { title: "", color: "gradient-orange", event_date: "", event_time: "", description: "" };

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const Calendar = () => {
  const { user } = useAuth();
  const now = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .order("event_date", { ascending: true });
    if (data) setEvents(data);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [user]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    if (ev.is_global || ev.user_id !== user?.id) return;
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      color: ev.color,
      event_date: ev.event_date,
      event_time: ev.event_time ?? "",
      description: ev.description ?? "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.event_date || !user) return;
    if (editingId) {
      const { error } = await supabase.from("calendar_events").update({
        title: form.title,
        color: form.color,
        event_date: form.event_date,
        event_time: form.event_time || null,
        description: form.description || null,
      }).eq("id", editingId).eq("user_id", user.id);
      if (error) { toast.error("更新失敗：" + error.message); return; }
      toast.success("活動已更新");
    } else {
      const { error } = await supabase.from("calendar_events").insert({
        title: form.title,
        color: form.color,
        event_date: form.event_date,
        event_time: form.event_time || null,
        description: form.description || null,
        is_global: false,
        user_id: user.id,
      });
      if (error) { toast.error("新增失敗：" + error.message); return; }
      toast.success("活動已新增");
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowDialog(false);
    fetchEvents();
  };

  const handleDelete = async () => {
    if (!editingId || !user) return;
    if (!confirm("確定要刪除這個活動嗎？")) return;
    const { error } = await supabase.from("calendar_events")
      .delete().eq("id", editingId).eq("user_id", user.id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("活動已刪除");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(false);
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
    const key = ev.event_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const upcomingEvents = events.filter(ev => ev.event_date >= todayStr).slice(0, 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isOwn = (ev: CalendarEvent) => !ev.is_global && ev.user_id === user?.id;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-foreground">行事曆</h2>
        <p className="text-sm text-muted-foreground mt-1">管理你的學習與任務排程</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <h3 className="text-base font-semibold text-foreground">
            {year} 年 {month + 1} 月
          </h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] text-muted-foreground font-medium py-2">
              {d}
            </div>
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
                <span
                  className={`text-xs font-medium ${
                    isToday(day) ? "text-primary" : "text-foreground"
                  }`}
                >
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
                    const editable = isOwn(ev);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => editable && openEdit(ev)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium truncate ${colorClass} ${editable ? "cursor-pointer hover:opacity-80" : ""}`}
                        title={editable ? "點擊編輯" : (ev.description || ev.title)}
                      >
                        {ev.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">近期活動</h3>
          <button
            onClick={openCreate}
            className="text-xs text-primary flex items-center gap-1 hover:opacity-80"
          >
            <Plus className="w-3.5 h-3.5" /> 新增
          </button>
        </div>
        <div className="space-y-2">
          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">近期沒有活動</p>
          ) : (
            upcomingEvents.map((ev) => {
              const editable = isOwn(ev);
              return (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className={`w-2 h-2 rounded-full ${
                    ev.color === "gradient-purple" ? "bg-secondary" :
                    ev.color === "gradient-lime" ? "bg-success" :
                    ev.color === "gradient-cyan" ? "bg-chart-cyan" :
                    "bg-accent"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.event_date}{ev.event_time ? ` ${ev.event_time}` : ""}
                      {ev.is_global && " · 全域"}
                    </p>
                  </div>
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(ev)}
                      className="h-7 w-7 p-0"
                      title="編輯"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); setEditingId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯個人活動" : "新增個人活動"}</DialogTitle>
            <DialogDescription>
              {editingId ? "修改或刪除你建立的行事曆活動" : "新增一個個人行事曆活動"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="活動標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="說明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient-orange">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-accent" />金琥珀</span>
                </SelectItem>
                <SelectItem value="gradient-purple">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary" />鋼藍灰</span>
                </SelectItem>
                <SelectItem value="gradient-lime">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-success" />青綠色</span>
                </SelectItem>
                <SelectItem value="gradient-cyan">
                  <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-chart-cyan" />鋼鐵藍</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="flex-1" />
              <Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} className="w-32" />
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            {editingId ? (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive gap-1.5">
                <Trash2 className="w-4 h-4" /> 刪除
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditingId(null); setForm(EMPTY_FORM); }}>取消</Button>
              <Button onClick={handleSave}>{editingId ? "儲存" : "新增"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
