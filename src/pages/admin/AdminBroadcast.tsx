import { useEffect, useState, useRef } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { RecipientSelector } from "@/components/admin/broadcast/RecipientSelector";
import { RecipientPreview } from "@/components/admin/broadcast/RecipientPreview";
import type { RecipientFilter, PreviewResult } from "@/lib/broadcast/types";

interface BroadcastConversation {
  id: string;
  title: string;
  category: string;
  created_at: string;
  recipient_count: number | null;
}

const AdminBroadcast = () => {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState<BroadcastConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", content: "", priority: "一般" });
  const [filter, setFilter] = useState<RecipientFilter>({ mode: "all" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const fetchBroadcasts = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("id,title,category,created_at,recipient_count")
      .eq("category", "system")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setBroadcasts(data);
    setLoading(false);
  };

  useEffect(() => { fetchBroadcasts(); }, []);

  // Debounced preview
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("api-admin-agent-preview-recipients", {
          body: { recipient_filter: filter },
        });
        if (error) throw error;
        setPreview(data as PreviewResult);
      } catch (e) {
        setPreview(null);
        console.error(e);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [filter]);

  const handleSend = async () => {
    if (!form.title || !form.content || !user) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-broadcast", {
        body: {
          title: `[${form.priority}] ${form.title}`,
          content: form.content,
          category: "system",
          recipient_filter: filter,
          confirm: true,
        },
      });
      if (error || (data && data.error)) {
        toast.error("廣播失敗：" + (error?.message || data?.error || "未知錯誤"));
        return;
      }
      toast.success(`已發送給 ${data?.data?.recipients ?? 0} 位學員`);
      setForm({ title: "", content: "", priority: "一般" });
      setConfirmOpen(false);
      fetchBroadcasts();
    } finally {
      setSending(false);
    }
  };

  const priorityColor = (title: string) => {
    if (title.includes("緊急")) return "bg-destructive/20 text-destructive";
    if (title.includes("重要")) return "bg-primary/20 text-primary";
    return "bg-muted text-muted-foreground";
  };

  const canSend = form.title && form.content && (preview?.total ?? 0) > 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">訊息廣播系統</h2>
        <p className="text-sm text-muted-foreground mt-1">向學員發送系統公告</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="glass-card p-5 space-y-5">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> 發布廣播
        </h3>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">1. 收件人</h4>
          <RecipientSelector value={filter} onChange={setFilter} />
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">2. 預覽</h4>
          <RecipientPreview result={preview} loading={previewLoading} />
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">3. 訊息內容</h4>
          <Input placeholder="標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea placeholder="內容" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="flex gap-3">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="一般">一般</SelectItem>
                <SelectItem value="重要">重要</SelectItem>
                <SelectItem value="緊急">緊急</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend} className="gap-2">
              <Send className="w-4 h-4" /> 發送
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">已發送廣播</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>重要程度</TableHead>
              <TableHead>收件人數</TableHead>
              <TableHead>日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">尚無廣播紀錄</TableCell></TableRow>
            ) : broadcasts.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.title}</TableCell>
                <TableCell><Badge className={priorityColor(b.title)}>
                  {b.title.includes("緊急") ? "緊急" : b.title.includes("重要") ? "重要" : "一般"}
                </Badge></TableCell>
                <TableCell className="text-xs">{b.recipient_count ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString("zh-TW")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認發送廣播？</AlertDialogTitle>
            <AlertDialogDescription>
              將以「{form.priority}」優先級發送「{form.title}」給 <b>{preview?.total ?? 0}</b> 位學員，發送後無法撤回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? "發送中…" : "確認發送"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBroadcast;
