import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Send, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BroadcastConversation {
  id: string;
  title: string;
  category: string;
  created_at: string;
  last_message?: string;
}

const AdminBroadcast = () => {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<BroadcastConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBroadcast, setNewBroadcast] = useState({ title: "", content: "", priority: "一般" });

  const fetchBroadcasts = async () => {
    // Fetch system-category conversations as broadcasts
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("category", "system")
      .order("created_at", { ascending: false });
    if (data) setBroadcasts(data.map(c => ({ ...c, last_message: "" })));
    setLoading(false);
  };

  useEffect(() => { fetchBroadcasts(); }, []);

  const handleBroadcast = async () => {
    if (!newBroadcast.title || !newBroadcast.content || !user) return;

    // 1. Create system conversation
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ title: `[${newBroadcast.priority}] ${newBroadcast.title}`, category: "system" })
      .select()
      .single();
    if (convErr || !conv) {
      toast.error("廣播失敗：" + (convErr?.message || "未知錯誤"));
      return;
    }

    // 2. Insert system message
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: null,
      content: newBroadcast.content,
      is_system: true,
    });
    if (msgErr) {
      toast.error("訊息寫入失敗：" + msgErr.message);
      return;
    }

    // 3. Fetch all activated students
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("activated", true);
    if (profErr) {
      toast.error("讀取學員失敗：" + profErr.message);
      return;
    }
    const userIds = (profiles || []).map((p) => p.id);

    // 4. Filter out users who disabled show_info
    let recipientIds = userIds;
    if (userIds.length > 0) {
      const { data: settings } = await supabase
        .from("notification_settings")
        .select("user_id, show_info")
        .in("user_id", userIds);
      const disabled = new Set(
        (settings || []).filter((s) => s.show_info === false).map((s) => s.user_id)
      );
      recipientIds = userIds.filter((id) => !disabled.has(id));
    }

    // 5. Insert participants
    if (recipientIds.length > 0) {
      const participants = recipientIds.map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        unread: true,
      }));
      const { error: partErr } = await supabase
        .from("conversation_participants")
        .insert(participants);
      if (partErr) {
        toast.error("加入學員失敗：" + partErr.message);
        return;
      }
    }

    toast.success(`廣播已發送給 ${recipientIds.length} 位學員`);
    setNewBroadcast({ title: "", content: "", priority: "一般" });
    fetchBroadcasts();
  };

  const priorityColor = (title: string) => {
    if (title.includes("緊急")) return "bg-destructive/20 text-destructive";
    if (title.includes("重要")) return "bg-primary/20 text-primary";
    return "bg-muted text-muted-foreground";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">訊息廣播系統</h2>
        <p className="text-sm text-muted-foreground mt-1">向學員發送系統公告</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="glass-card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> 發布廣播
        </h3>
        <Input placeholder="標題" value={newBroadcast.title} onChange={(e) => setNewBroadcast({ ...newBroadcast, title: e.target.value })} />
        <Textarea placeholder="內容" value={newBroadcast.content} onChange={(e) => setNewBroadcast({ ...newBroadcast, content: e.target.value })} />
        <div className="flex gap-3">
          <Select value={newBroadcast.priority} onValueChange={(v) => setNewBroadcast({ ...newBroadcast, priority: v })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="一般">一般</SelectItem>
              <SelectItem value="重要">重要</SelectItem>
              <SelectItem value="緊急">緊急</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleBroadcast} className="gap-2"><Send className="w-4 h-4" /> 發送</Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">已發送廣播</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>重要程度</TableHead>
              <TableHead>日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">尚無廣播紀錄</TableCell></TableRow>
            ) : broadcasts.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell><Badge className={priorityColor(b.title)}>
                  {b.title.includes("緊急") ? "緊急" : b.title.includes("重要") ? "重要" : "一般"}
                </Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString("zh-TW")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
};

export default AdminBroadcast;
