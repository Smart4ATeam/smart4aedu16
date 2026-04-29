import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, FileSignature, BadgeCheck, Hourglass } from "lucide-react";

type Row = {
  id: string;
  status: string;
  task_id: string;
  task_title: string;
  doc_no?: string | null;
};

export function PaymentActionPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    if (!user) return;
    const { data: prof } = await supabase
      .from("payee_profiles")
      .select("id, first_submitted_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setHasProfile(!!prof);

    const { data: apps } = await supabase
      .from("task_applications")
      .select("id, status, task_id, tasks(title)")
      .eq("user_id", user.id)
      .in("status", ["payment_pending_info", "payment_pending_signature", "payment_pending_review", "payment_processing"]);

    if (!apps) return;

    const appIds = apps.map((a) => a.id);
    const { data: docs } = appIds.length
      ? await supabase.from("task_payment_documents").select("application_id, doc_no").in("application_id", appIds)
      : { data: [] as { application_id: string; doc_no: string }[] };
    const docMap = new Map((docs ?? []).map((d) => [d.application_id, d.doc_no]));

    setRows(
      apps.map((a) => ({
        id: a.id,
        status: a.status,
        task_id: a.task_id,
        task_title: (a as unknown as { tasks: { title: string } | null }).tasks?.title ?? "",
        doc_no: docMap.get(a.id),
      })),
    );
  }

  if (!user || rows.length === 0) return null;

  return (
    <Card className="p-4 space-y-3 border-amber-200/50 bg-amber-50/40 dark:bg-amber-950/10">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-amber-600" />
        <h3 className="text-sm font-semibold">付款流程進行中</h3>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-background rounded-md px-3 py-2 border border-border">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{r.task_title}</p>
              <p className="text-xs text-muted-foreground">{statusLabel(r.status)}{r.doc_no ? ` · ${r.doc_no}` : ""}</p>
            </div>
            {actionButton(r, navigate, hasProfile)}
          </div>
        ))}
      </div>
    </Card>
  );
}

function statusLabel(s: string) {
  switch (s) {
    case "payment_pending_info": return "請填收款資料";
    case "payment_pending_signature": return "請下載並簽回勞報單";
    case "payment_pending_review": return "已簽回，等待管理員確認";
    case "payment_processing": return "管理員處理中，等待付款";
    default: return s;
  }
}

function actionButton(r: Row, navigate: ReturnType<typeof useNavigate>, hasProfile: boolean | null) {
  if (r.status === "payment_pending_info") {
    return <Button size="sm" onClick={() => navigate("/payee-form")} className="gap-1"><Wallet className="w-3.5 h-3.5" /> 填收款資料</Button>;
  }
  if (r.status === "payment_pending_signature") {
    return <Button size="sm" onClick={() => navigate(`/tasks/${r.id}/payment`)} className="gap-1"><FileSignature className="w-3.5 h-3.5" /> 下載 / 簽回</Button>;
  }
  if (r.status === "payment_pending_review") {
    return <Button size="sm" variant="outline" disabled className="gap-1"><Hourglass className="w-3.5 h-3.5" /> 等待確認</Button>;
  }
  if (r.status === "payment_processing") {
    return <Button size="sm" variant="outline" disabled className="gap-1"><BadgeCheck className="w-3.5 h-3.5" /> 處理中</Button>;
  }
  return null;
}
