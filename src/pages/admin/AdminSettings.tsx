import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Calendar } from "lucide-react";
import ImportCalendarEvents from "@/components/admin/ImportCalendarEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type CalendarEvent = Tables<"calendar_events">;

const AdminSettings = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", color: "gradient-orange", event_date: "", event_time: "", description: "" });
  const fetchEvents = async () => {
    const { data } = await supabase.from("calendar_events").select("*").order("event_date", { ascending: true });
    if (data) setEvents(data);
    setLoading(false);
  };


  useEffect(() => { fetchEvents(); }, []);

  const handleAdd = async () => {
    if (!newEvent.title || !newEvent.event_date) return;
    const { error } = await supabase.from("calendar_events").insert({
      title: newEvent.title,
      color: newEvent.color,
      event_date: newEvent.event_date,
      event_time: newEvent.event_time || null,
      description: newEvent.description || null,
      is_global: true,
      user_id: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error) { toast.error("新增失敗：" + error.message); return; }
    toast.success("活動已新增");
    setNewEvent({ title: "", color: "gradient-orange", event_date: "", event_time: "", description: "" });
    setShowDialog(false);
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("已刪除");
    setEvents(events.filter(e => e.id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">系統設定</h2>
        <p className="text-sm text-muted-foreground mt-1">全域行事曆排程與系統組態管理</p>
      </motion.div>




      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="space-y-4">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">全域行事曆活動</h3>
            <ImportCalendarEvents onComplete={fetchEvents} />
          </div>
          <Button onClick={() => setShowDialog(true)} className="gap-2"><Plus className="w-4 h-4" /> 新增活動</Button>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增全域活動</DialogTitle>
              <DialogDescription>此活動將顯示在所有學員的行事曆上</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="活動標題" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
              <Input placeholder="說明" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} />
              <Select value={newEvent.color} onValueChange={(v) => setNewEvent({ ...newEvent, color: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradient-orange">橘色</SelectItem>
                  <SelectItem value="gradient-purple">紫色</SelectItem>
                  <SelectItem value="gradient-lime">綠色</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-3">
                <Input type="date" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })} className="flex-1" />
                <Input type="time" value={newEvent.event_time} onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })} className="w-32" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button onClick={handleAdd}>新增</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="glass-card p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>活動</TableHead>
                <TableHead>日期</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>說明</TableHead>
                <TableHead>全域</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{e.event_date}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.event_time || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.description || "—"}</TableCell>
                  <TableCell><Badge variant={e.is_global ? "default" : "outline"}>{e.is_global ? "全域" : "個人"}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminSettings;
