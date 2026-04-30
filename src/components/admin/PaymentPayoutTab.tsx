import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, BadgeCheck, RotateCcw, Download } from "lucide-react";
import { toast } from "sonner";

type Row = {
  application_id: string;
  doc_id: string;
  doc_no: string;
  net_amount: number;
  gross_amount: number;
  withholding_tax: number;
  nhi_supplement: number;
  task_title: string;
  student_name: string;
  user_id: string;
  payee_name: string;
  id_number: string;
  phone: string;
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_number: string;
  account_name: string;
};

export function PaymentPayoutTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);

  useEffect(() => { load(); }, []);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.application_id)), [rows, selected]);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.application_id)) : new Set());
  }

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
      .select("id, application_id, doc_no, net_amount, gross_amount, withholding_tax, nhi_supplement")
      .in("application_id", ids);

    const userIds = [...new Set((apps ?? []).map((a) => a.user_id))];
    const taskIds = [...new Set((apps ?? []).map((a) => a.task_id))];
    const [{ data: profiles }, { data: tasks }, { data: payees }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").in("id", userIds),
      supabase.from("tasks").select("id, title").in("id", taskIds),
      supabase
        .from("payee_profiles")
        .select("user_id, name, id_number, phone, bank_name, bank_code, branch_name, branch_code, account_number, account_name")
        .in("user_id", userIds),
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
          gross_amount: Number(d.gross_amount),
          withholding_tax: Number(d.withholding_tax),
          nhi_supplement: Number(d.nhi_supplement),
          task_title: tMap.get(a.task_id) ?? "",
          student_name: pMap.get(a.user_id) ?? "",
          user_id: a.user_id,
          payee_name: py?.name ?? "",
          id_number: py?.id_number ?? "",
          phone: py?.phone ?? "",
          bank_name: py?.bank_name ?? "",
          bank_code: py?.bank_code ?? "",
          branch_name: py?.branch_name ?? "",
          branch_code: py?.branch_code ?? "",
          account_number: py?.account_number ?? "",
          account_name: py?.account_name ?? "",
        };
      }),
    );
    setLoading(false);
  }

  function downloadCsv() {
    if (rows.length === 0) {
      toast.error("沒有可下載的資料");
      return;
    }
    const headers = [
      "勞報單號", "任務名稱", "學員（系統）", "受款人姓名", "身分證號", "電話",
      "銀行代碼", "銀行", "分行代碼", "分行", "戶名", "帳號",
      "給付總額", "扣繳稅額", "健保補充保費", "實付金額",
    ];
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push([
        r.doc_no, r.task_title, r.student_name, r.payee_name, r.id_number, r.phone,
        r.bank_code, r.bank_name, r.branch_code, r.branch_name, r.account_name, r.account_number,
        r.gross_amount, r.withholding_tax, r.nhi_supplement, r.net_amount,
      ].map(escape).join(","));
    }
    // 加上 UTF-8 BOM 讓 Excel 正確顯示中文
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fname = `待匯款明細_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.csv`;
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`已下載 ${rows.length} 筆明細`);
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">共 {rows.length} 筆待匯款</p>
        <Button size="sm" variant="outline" onClick={downloadCsv} className="gap-1">
          <Download className="w-3.5 h-3.5" /> 下載匯款明細 CSV
        </Button>
      </div>
      {rows.map((r) => (
        <Card key={r.application_id} className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{r.task_title}</p>
              <Badge variant="outline">{r.doc_no}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              學員：{r.student_name} · 實付 NT${r.net_amount.toLocaleString()} · {r.bank_name || "-"} / {r.account_name || "-"} / {r.account_number || "-"}
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
