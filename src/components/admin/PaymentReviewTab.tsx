import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Doc = {
  id: string;
  doc_no: string;
  generated_at: string;
  gross_amount: number;
  net_amount: number;
  is_first_payment: boolean;
  signed_file_url: string | null;
  signed_at: string | null;
  application_id: string;
  task_title?: string;
  student_name?: string;
};

export function PaymentReviewTab() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: apps } = await supabase
      .from("task_applications")
      .select("id, user_id, task_id")
      .eq("status", "payment_pending_review");
    const ids = (apps ?? []).map((a) => a.id);
    if (ids.length === 0) { setDocs([]); setLoading(false); return; }

    const { data: ds } = await supabase
      .from("task_payment_documents")
      .select("*")
      .in("application_id", ids);

    const userIds = [...new Set((apps ?? []).map((a) => a.user_id))];
    const taskIds = [...new Set((apps ?? []).map((a) => a.task_id))];
    const [{ data: profiles }, { data: tasks }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").in("id", userIds),
      supabase.from("tasks").select("id, title").in("id", taskIds),
    ]);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.email || ""]));
    const tMap = new Map((tasks ?? []).map((t) => [t.id, t.title]));
    const aMap = new Map((apps ?? []).map((a) => [a.id, a]));

    setDocs(
      (ds ?? []).map((d) => {
        const a = aMap.get(d.application_id);
        return {
          ...d,
          gross_amount: Number(d.gross_amount),
          net_amount: Number(d.net_amount),
          task_title: a ? tMap.get(a.task_id) : "",
          student_name: a ? pMap.get(a.user_id) : "",
        } as Doc;
      }),
    );
    setLoading(false);
  }

  async function download(d: Doc) {
    if (!d.signed_file_url) return;
    const { data } = await supabase.storage.from("payment-signed-docs").createSignedUrl(d.signed_file_url, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function confirm(d: Doc) {
    setBusyId(d.id);
    try {
      const { error } = await supabase.functions.invoke("send-payment-webhook", { body: { document_id: d.id } });
      if (error) throw error;
      toast.success("已送出至外部系統，狀態變更為處理中");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("送出失敗：" + msg);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (docs.length === 0) return <Card className="p-6 text-sm text-muted-foreground text-center">目前沒有待確認的簽回勞報單</Card>;

  return (
    <div className="space-y-3">
      {docs.map((d) => (
        <Card key={d.id} className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{d.task_title}</p>
              <Badge variant="outline">{d.doc_no}</Badge>
              {d.is_first_payment && <Badge className="bg-amber-500 text-white">首次付款</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              學員：{d.student_name} · 應領 NT${d.gross_amount.toLocaleString()} · 實付 NT${d.net_amount.toLocaleString()} · 簽回 {d.signed_at ? new Date(d.signed_at).toLocaleString("zh-TW") : "-"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => download(d)} className="gap-1"><Download className="w-3.5 h-3.5" /> 下載</Button>
          <Button size="sm" onClick={() => confirm(d)} disabled={busyId === d.id} className="gap-1">
            {busyId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            確認並送出 Webhook
          </Button>
        </Card>
      ))}
      <Button variant="ghost" size="sm" onClick={load} className="gap-1"><RotateCcw className="w-3.5 h-3.5" /> 重新整理</Button>
    </div>
  );
}
