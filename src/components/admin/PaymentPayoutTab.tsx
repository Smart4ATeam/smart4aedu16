import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BadgeCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Row = {
  application_id: string;
  doc_id: string;
  doc_no: string;
  net_amount: number;
  task_title: string;
  student_name: string;
  user_id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
};

export function PaymentPayoutTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: apps } = await supabase
      .from("task_applications")
      .select("id, user_id, task_id")
      .eq("status", "payment_processing");
    const ids = (apps ?? []).map((a) => a.id);
    if (!ids.length) { setRows([]); setLoading(false); return; }

    const { data: docs } = await supabase
      .from("task_payment_documents")
      .select("id, application_id, doc_no, net_amount")
      .in("application_id", ids);

    const userIds = [...new Set((apps ?? []).map((a) => a.user_id))];
    const taskIds = [...new Set((apps ?? []).map((a) => a.task_id))];
    const [{ data: profiles }, { data: tasks }, { data: payees }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").in("id", userIds),
      supabase.from("tasks").select("id, title").in("id", taskIds),
      supabase.from("payee_profiles").select("user_id, bank_name, account_number, account_name").in("user_id", userIds),
    ]);

    const pMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.email || ""]));
    const tMap = new Map((tasks ?? []).map((t) => [t.id, t.title]));
    const payeeMap = new Map((payees ?? []).map((p) => [p.user_id, p]));
    const aMap = new Map((apps ?? []).map((a) => [a.id, a]));

    setRows(
      (docs ?? []).map((d) => {
        const a = aMap.get(d.application_id)!;
        const py = payeeMap.get(a.user_id);
        return {
          application_id: d.application_id,
          doc_id: d.id,
          doc_no: d.doc_no,
          net_amount: Number(d.net_amount),
          task_title: tMap.get(a.task_id) ?? "",
          student_name: pMap.get(a.user_id) ?? "",
          user_id: a.user_id,
          bank_name: py?.bank_name ?? "-",
          account_number: py?.account_number ?? "-",
          account_name: py?.account_name ?? "-",
        };
      }),
    );
    setLoading(false);
  }

  async function markPaid(r: Row) {
    setBusy(r.application_id);
    try {
      const { error } = await supabase.from("task_applications").update({ status: "paid" }).eq("id", r.application_id);
      if (error) throw error;
      await supabase.from("task_payment_documents").update({ paid_notified_at: new Date().toISOString() }).eq("id", r.doc_id);
      // notify student
      await supabase.rpc("send_system_message", {
        _user_id: r.user_id,
        _title: "已完成付款",
        _content: `任務「${r.task_title}」之勞務報酬 NT$ ${r.net_amount.toLocaleString()} 已匯款（單號：${r.doc_no}），請查收。`,
        _category: "task",
      });
      toast.success("已標記為已付款並通知學員");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("處理失敗：" + msg);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (rows.length === 0) return <Card className="p-6 text-sm text-muted-foreground text-center">目前沒有待匯款項目</Card>;

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.application_id} className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{r.task_title}</p>
              <Badge variant="outline">{r.doc_no}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              學員：{r.student_name} · 實付 NT${r.net_amount.toLocaleString()} · {r.bank_name} / {r.account_name} / {r.account_number}
            </p>
          </div>
          <Button size="sm" onClick={() => markPaid(r)} disabled={busy === r.application_id} className="gap-1">
            {busy === r.application_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
            標記已付款並通知
          </Button>
        </Card>
      ))}
      <Button variant="ghost" size="sm" onClick={load} className="gap-1"><RotateCcw className="w-3.5 h-3.5" /> 重新整理</Button>
    </div>
  );
}
