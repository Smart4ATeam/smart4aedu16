import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Printer,
  FileSignature,
  ArrowLeft,
  User,
  DollarSign,
  Briefcase,
  PenLine,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  PaymentDocumentPDF,
  type PaymentDocumentData,
} from "@/components/payment/PaymentDocumentPDF";
import {
  SignatureDialog,
  type SignaturePayload,
} from "@/components/payment/SignatureDialog";
import { pdf } from "@react-pdf/renderer";

type DocRow = PaymentDocumentData & {
  id: string;
  signed_file_url: string | null;
  doc_no: string;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
};

type PayeeRow = {
  name: string;
  id_number: string;
  registered_address: string;
  phone?: string | null;
  bank_name: string;
  branch_name?: string | null;
  account_number: string;
  account_name: string;
};

export default function TaskPayment() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [appStatus, setAppStatus] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [serviceDate, setServiceDate] = useState<string>("");
  const [creatorName, setCreatorName] = useState<string>("");
  const [payee, setPayee] = useState<PayeeRow | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [applicationId, user]);

  async function load() {
    if (!user || !applicationId) return;
    setLoading(true);

    const { data: app } = await supabase
      .from("task_applications")
      .select("id, status, user_id, task_id, applied_at")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app || app.user_id !== user.id) {
      toast.error("找不到此任務或無權限");
      navigate("/tasks");
      return;
    }
    setAppStatus(app.status);

    const { data: task } = await supabase
      .from("tasks")
      .select("title, deadline, created_by")
      .eq("id", app.task_id)
      .single();
    setTaskTitle(task?.title ?? "");
    setServiceDate(task?.deadline ?? "");

    if (task?.created_by) {
      const { data: creator } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", task.created_by)
        .maybeSingle();
      setCreatorName(creator?.display_name ?? "");
    }

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
      .select(
        "name, id_number, registered_address, phone, bank_name, branch_name, account_number, account_name",
      )
      .eq("user_id", user.id)
      .single();

    const payeeData: PayeeRow = (profile as PayeeRow) ?? {
      name: "",
      id_number: "",
      registered_address: "",
      phone: "",
      bank_name: "",
      account_number: "",
      account_name: "",
    };
    setPayee(payeeData);

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
      payee: payeeData,
      signed_file_url: d.signed_file_url,
      signed_at: d.signed_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
    });

    if (d.signed_file_url) {
      const { data: signed } = await supabase.storage
        .from("payment-signed-docs")
        .createSignedUrl(d.signed_file_url, 60 * 10);
      setSignatureUrl(signed?.signedUrl ?? null);
    }

    setLoading(false);
  }

  async function buildBlob(signatureDataUrl?: string | null) {
    if (!doc) return null;
    const data: PaymentDocumentData = {
      ...doc,
      signature_data_url: signatureDataUrl ?? null,
    };
    return await pdf(<PaymentDocumentPDF data={data} />).toBlob();
  }

  async function handleDownload() {
    if (!doc) return;
    try {
      const blob = await buildBlob(null);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.doc_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("已開始下載");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("下載失敗：" + msg);
    }
  }

  async function handleSubmitSignature(payload: SignaturePayload) {
    if (!doc || !user) return;
    try {
      let blob: Blob;
      let suffix = "signed";
      if (payload.kind === "pdf") {
        blob = payload.pdfFile;
        suffix = "uploaded";
      } else {
        const built = await buildBlob(payload.signatureDataUrl);
        if (!built) throw new Error("PDF 產生失敗");
        blob = built;
      }
      const path = `${user.id}/${doc.doc_no}_${suffix}_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("payment-signed-docs")
        .upload(path, blob, {
          upsert: true,
          contentType: "application/pdf",
        });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("task_payment_documents")
        .update({
          signed_file_url: path,
          signed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      if (updErr) throw updErr;

      toast.success("已上傳簽回勞報單，等待管理員確認");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("上傳失敗：" + msg);
      throw e;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc || !payee) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/tasks")} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> 返回
        </Button>
        <Card className="p-6">尚未產生勞報單，請等待系統處理。</Card>
      </div>
    );
  }

  const alreadySigned =
    !!doc.signed_file_url ||
    appStatus === "payment_pending_review" ||
    appStatus === "payment_processing" ||
    appStatus === "paid";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        icon={<FileSignature className="w-6 h-6" />}
        title="勞報單"
        description={`任務：${taskTitle} · 單號 ${doc.doc_no}`}
      />

      {/* 工具列 */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="gap-2">
          <FileText className="w-4 h-4" /> 詳細資料
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
          <Printer className="w-4 h-4" /> 列印 / 下載
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 受款人資訊 */}
          <Card className="p-6 space-y-4">
            <SectionTitle icon={<User className="w-5 h-5" />} title="受款人資訊" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="姓名" value={payee.name} bold />
              <Field label="身分證號" value={payee.id_number} bold />
              <Field label="電話" value={payee.phone || "-"} />
              <Field
                label="地址"
                value={payee.registered_address || "-"}
              />
            </div>
          </Card>

          {/* 所得明細 */}
          <Card className="p-6 space-y-4">
            <SectionTitle icon={<DollarSign className="w-5 h-5" />} title="所得明細" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">所得類別</p>
                <Badge variant="outline" className="font-normal">
                  9A 執行業務所得
                </Badge>
              </div>
              <Field label="所得月份" value={doc.service_period} bold />
            </div>
            <div className="border-t border-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Money label="給付總額" amount={doc.gross_amount} />
              <Money
                label="扣繳稅額 (10%)"
                amount={-doc.withholding_tax}
                tone="negative"
              />
              <Money
                label="健保補充保費 (2.11%)"
                amount={-doc.nhi_supplement}
                tone="negative"
              />
              <Money label="實付金額" amount={doc.net_amount} tone="positive" />
            </div>
          </Card>

          {/* 勞務內容 */}
          <Card className="p-6 space-y-4">
            <SectionTitle icon={<Briefcase className="w-5 h-5" />} title="勞務內容" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="勞務日期"
                value={serviceDate ? formatDate(serviceDate) : "-"}
              />
              <Field
                label="建立人"
                value={creatorName ? `👤 ${creatorName}` : "-"}
              />
              <Field
                label="勞務說明"
                value={doc.service_description || "-"}
                full
              />
              <Field
                label="建立時間"
                value={formatDateTime(doc.created_at)}
              />
              <Field
                label="更新時間"
                value={formatDateTime(doc.updated_at)}
              />
            </div>
          </Card>
        </div>

        {/* 右側：收款人簽名 */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <SectionTitle icon={<PenLine className="w-5 h-5" />} title="收款人簽名" />
            {alreadySigned ? (
              <div className="space-y-3 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">已完成簽回</span>
                </div>
                {doc.signed_at && (
                  <p className="text-xs text-muted-foreground">
                    簽回時間：{formatDateTime(doc.signed_at)}
                  </p>
                )}
                {signatureUrl && (
                  <a
                    href={signatureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4" /> 檢視簽回文件
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">尚未取得收款人簽名</p>
                <Button
                  onClick={() => setDialogOpen(true)}
                  className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <PenLine className="w-4 h-4" /> 收款人簽名
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <SignatureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payeeName={payee.name}
        onDownloadBlank={handleDownload}
        onSubmit={handleSubmitSignature}
      />
    </motion.div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-foreground">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  );
}

function Field({
  label,
  value,
  bold,
  full,
}: {
  label: string;
  value: string;
  bold?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={bold ? "font-semibold" : "text-sm"}>{value}</p>
    </div>
  );
}

function Money({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone?: "positive" | "negative";
}) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const color =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
        ? "text-destructive"
        : "";
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${color}`}>
        {sign}${abs.toLocaleString()}
      </p>
    </div>
  );
}

function formatDate(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatDateTime(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
