import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Download, FileSignature, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PaymentDocumentPDF, type PaymentDocumentData } from "@/components/payment/PaymentDocumentPDF";
import { SignaturePad } from "@/components/payment/SignaturePad";
import { pdf } from "@react-pdf/renderer";

export default function TaskPayment() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<PaymentDocumentData & { id: string; signed_file_url: string | null; doc_no: string } | null>(null);
  const [appStatus, setAppStatus] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId, user]);

  async function load() {
    if (!user || !applicationId) return;
    setLoading(true);
    const { data: app } = await supabase
      .from("task_applications")
      .select("id, status, user_id, task_id")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app || app.user_id !== user.id) {
      toast.error("找不到此任務或無權限");
      navigate("/tasks");
      return;
    }
    setAppStatus(app.status);

    const { data: task } = await supabase.from("tasks").select("title").eq("id", app.task_id).single();
    setTaskTitle(task?.title ?? "");

    const { data: d } = await supabase
      .from("task_payment_documents")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (!d) {
      toast.error("尚未產生勞報單");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("payee_profiles")
      .select("name, id_number, registered_address, bank_name, branch_name, account_number, account_name")
      .eq("user_id", user.id)
      .single();

    setDoc({
      id: d.id,
      doc_no: d.doc_no,
      generated_at: d.generated_at,
      service_period: d.service_period,
      service_description: d.service_description,
      gross_amount: Number(d.gross_amount),
      withholding_tax: Number(d.withholding_tax),
      nhi_supplement: Number(d.nhi_supplement),
      net_amount: Number(d.net_amount),
      payee: profile ?? { name: "", id_number: "", registered_address: "", bank_name: "", account_number: "", account_name: "" },
      signed_file_url: d.signed_file_url,
    });
    setLoading(false);
  }

  async function handleDownload() {
    if (!doc) return;
    const blob = await pdf(<PaymentDocumentPDF data={doc} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.doc_no}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmitSigned() {
    if (!doc || !user) return;
    if (!signature) return toast.error("請先簽名");
    setSubmitting(true);
    try {
      const signedDoc = { ...doc, signature_data_url: signature };
      const blob = await pdf(<PaymentDocumentPDF data={signedDoc} />).toBlob();
      const path = `${user.id}/${doc.doc_no}_signed_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("payment-signed-docs")
        .upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("task_payment_documents")
        .update({ signed_file_url: path, signed_at: new Date().toISOString() })
        .eq("id", doc.id);
      if (updErr) throw updErr;

      toast.success("已上傳簽回勞報單，等待管理員確認");
      navigate("/tasks");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("上傳失敗：" + msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!doc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/tasks")} className="gap-1"><ArrowLeft className="w-4 h-4" /> 返回</Button>
        <Card className="p-6">尚未產生勞報單，請等待系統處理。</Card>
      </div>
    );
  }

  const alreadySigned = !!doc.signed_file_url || appStatus === "payment_pending_review" || appStatus === "payment_processing" || appStatus === "paid";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader icon={<FileSignature className="w-6 h-6" />} title="勞報單簽回" description={`任務：${taskTitle} · 單號 ${doc.doc_no}`} />

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <KV k="應領金額" v={`NT$ ${doc.gross_amount.toLocaleString()}`} />
          <KV k="代扣稅" v={`NT$ ${doc.withholding_tax.toLocaleString()}`} />
          <KV k="二代健保" v={`NT$ ${doc.nhi_supplement.toLocaleString()}`} />
          <KV k="實付金額" v={`NT$ ${doc.net_amount.toLocaleString()}`} highlight />
        </div>
        <Button onClick={handleDownload} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> 下載勞報單 PDF（未簽名版）
        </Button>
      </Card>

      {alreadySigned ? (
        <Card className="p-6 flex items-center gap-3 text-emerald-600">
          <CheckCircle2 className="w-5 h-5" />
          <span>已完成簽回，等待管理員確認與付款。</span>
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">簽名後送出</h3>
          <p className="text-sm text-muted-foreground">系統會將您的簽名嵌入勞報單後產生最終版 PDF 上傳。</p>
          <SignaturePad onChange={setSignature} />
          <Button onClick={handleSubmitSigned} disabled={submitting || !signature} className="w-full gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}
            送出簽回
          </Button>
        </Card>
      )}
    </motion.div>
  );
}

function KV({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{k}</p>
      <p className={highlight ? "text-lg font-bold text-amber-600" : "font-medium"}>{v}</p>
    </div>
  );
}
