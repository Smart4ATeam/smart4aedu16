import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Download, RotateCcw, Search, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

type Row = {
  application_id: string;
  doc_id: string;
  doc_no: string;
  net_amount: number;
  gross_amount: number;
  withholding_tax: number;
  nhi_supplement: number;
  paid_notified_at: string | null;
  task_title: string;
  student_name: string;
  user_id: string;
  payee_name: string;
  bank_name: string;
  bank_code: string;
  branch_name: string;
  branch_code: string;
  account_number: string;
  account_name: string;
};

export function PaymentHistoryTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: apps } = await supabase
      .from("task_applications")
      .select("id, user_id, task_id, completed_at")
      .eq("status", "paid")
      .order("completed_at", { ascending: false })
      .limit(1000);
    const ids = (apps ?? []).map((a) => a.id);
    if (!ids.length) { setRows([]); setLoading(false); return; }

    const { data: docs } = await supabase
      .from("task_payment_documents")
      .select("id, application_id, doc_no, net_amount, gross_amount, withholding_tax, nhi_supplement, paid_notified_at")
      .in("application_id", ids);

    const userIds = [...new Set((apps ?? []).map((a) => a.user_id))];
    const taskIds = [...new Set((apps ?? []).map((a) => a.task_id))];
    const [{ data: profiles }, { data: tasks }, { data: payees }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, email").in("id", userIds),
      supabase.from("tasks").select("id, title").in("id", taskIds),
      supabase
        .from("payee_profiles")
        .select("user_id, name, bank_name, bank_code, branch_name, branch_code, account_number, account_name")
        .in("user_id", userIds),
    ]);

    const pMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.email || ""]));
    const tMap = new Map((tasks ?? []).map((t) => [t.id, t.title]));
    const payeeMap = new Map((payees ?? []).map((p) => [p.user_id, p]));
    const aMap = new Map((apps ?? []).map((a) => [a.id, a]));

    const list: Row[] = (docs ?? []).map((d) => {
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
        paid_notified_at: d.paid_notified_at,
        task_title: tMap.get(a.task_id) ?? "",
        student_name: pMap.get(a.user_id) ?? "",
        user_id: a.user_id,
        payee_name: py?.name ?? "",
        bank_name: py?.bank_name ?? "",
        bank_code: py?.bank_code ?? "",
        branch_name: py?.branch_name ?? "",
        branch_code: py?.branch_code ?? "",
        account_number: py?.account_number ?? "",
        account_name: py?.account_name ?? "",
      };
    });
    list.sort((a, b) => (b.paid_notified_at ?? "").localeCompare(a.paid_notified_at ?? ""));
    setRows(list);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) =>
      [r.doc_no, r.task_title, r.student_name, r.payee_name, r.account_number, r.bank_name]
        .some((v) => (v ?? "").toLowerCase().includes(k))
    );
  }, [rows, keyword]);

  const totalAmount = useMemo(() => filtered.reduce((s, r) => s + r.net_amount, 0), [filtered]);

  function downloadCsv() {
    if (filtered.length === 0) {
      toast.error("沒有可下載的資料");
      return;
    }
    const headers = [
      "付款時間", "勞報單號", "任務名稱", "學員（系統）", "受款人姓名",
      "銀行代碼", "銀行", "分行代碼", "分行", "戶名", "帳號",
      "給付總額", "扣繳稅額", "健保補充保費", "實付金額",
    ];
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        r.paid_notified_at ? new Date(r.paid_notified_at).toLocaleString("zh-TW") : "",
        r.doc_no, r.task_title, r.student_name, r.payee_name,
        r.bank_code, r.bank_name, r.branch_code, r.branch_name, r.account_name, r.account_number,
        r.gross_amount, r.withholding_tax, r.nhi_supplement, r.net_amount,
      ].map(escape).join(","));
    }
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `匯款紀錄_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`已下載 ${filtered.length} 筆紀錄`);
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜尋單號 / 任務 / 學員 / 帳號"
              className="pl-7 h-9 w-72"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            共 {filtered.length} 筆 · 實付總額 NT$ {totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadCsv} className="gap-1">
            <Download className="w-3.5 h-3.5" /> 下載匯款紀錄 CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> 重新整理
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground text-center">尚無匯款紀錄</Card>
      ) : (
        filtered.map((r) => (
          <Card key={r.doc_id} className="p-4 flex items-center gap-3 flex-wrap">
            <BadgeCheck className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{r.task_title}</p>
                <Badge variant="outline">{r.doc_no}</Badge>
                <Badge className="bg-green-600/10 text-green-700 border-green-600/20">已付款</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                學員：{r.student_name} · 實付 NT$ {r.net_amount.toLocaleString()} · {r.bank_name || "-"} / {r.account_name || "-"} / {r.account_number || "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                付款通知時間：{r.paid_notified_at ? new Date(r.paid_notified_at).toLocaleString("zh-TW") : "—"}
              </p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
