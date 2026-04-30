import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "./SignaturePad";
import {
  PenLine,
  ImageUp,
  FileUp,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

export type SignaturePayload =
  | { kind: "drawn"; signatureDataUrl: string }
  | { kind: "image"; signatureDataUrl: string }
  | { kind: "pdf"; pdfFile: File };

type Method = "draw" | "image" | "pdf";

export function SignatureDialog({
  open,
  onOpenChange,
  payeeName,
  onDownloadBlank,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payeeName: string;
  onDownloadBlank: () => Promise<void> | void;
  onSubmit: (payload: SignaturePayload) => Promise<void>;
}) {
  const [method, setMethod] = useState<Method | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setMethod(null);
    setDrawn(null);
    setImageDataUrl(null);
    setPdfFile(null);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("圖片大小請小於 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("請上傳 PDF 檔案");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("PDF 大小請小於 10MB");
      return;
    }
    setPdfFile(f);
  }

  async function handleSubmit() {
    try {
      setSubmitting(true);
      if (method === "draw") {
        if (!drawn) return toast.error("請先簽名");
        await onSubmit({ kind: "drawn", signatureDataUrl: drawn });
      } else if (method === "image") {
        if (!imageDataUrl) return toast.error("請先上傳簽名圖片");
        await onSubmit({ kind: "image", signatureDataUrl: imageDataUrl });
      } else if (method === "pdf") {
        if (!pdfFile) return toast.error("請先上傳已簽名 PDF");
        await onSubmit({ kind: "pdf", pdfFile });
      }
      handleClose(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" /> 收款人簽名
          </DialogTitle>
          <DialogDescription>
            請讓收款人 <span className="font-semibold text-foreground">{payeeName}</span> 簽名確認
          </DialogDescription>
        </DialogHeader>

        {method === null && (
          <div className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">請選擇簽名方式</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MethodCard
                icon={<PenLine className="w-6 h-6" />}
                title="手寫簽名"
                desc="在螢幕上直接簽名"
                onClick={() => setMethod("draw")}
              />
              <MethodCard
                icon={<ImageUp className="w-6 h-6" />}
                title="上傳簽名檔"
                desc="上傳簽名圖片檔案"
                onClick={() => setMethod("image")}
              />
              <MethodCard
                icon={<FileUp className="w-6 h-6" />}
                title="上傳簽名文件"
                desc="下載 PDF、簽完後上傳"
                onClick={() => setMethod("pdf")}
              />
            </div>
          </div>
        )}

        {method === "draw" && (
          <div className="space-y-3">
            <SignaturePad onChange={setDrawn} />
          </div>
        )}

        {method === "image" && (
          <div className="space-y-3">
            <Label>選擇簽名圖片（PNG / JPG，建議透明背景）</Label>
            <Input type="file" accept="image/*" onChange={handleImageChange} />
            {imageDataUrl && (
              <div className="rounded-md border border-border bg-white p-3 flex items-center justify-center">
                <img src={imageDataUrl} alt="簽名預覽" className="max-h-40 object-contain" />
              </div>
            )}
          </div>
        )}

        {method === "pdf" && (
          <div className="space-y-3">
            <Card className="p-3 bg-muted/40 text-sm space-y-2">
              <p className="font-medium">步驟：</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>下載未簽名的勞報單 PDF</li>
                <li>列印或在裝置上簽名</li>
                <li>將整份簽好的 PDF 上傳回此處</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 mt-1"
                onClick={() => onDownloadBlank()}
              >
                下載未簽名 PDF
              </Button>
            </Card>
            <Label>上傳已簽名 PDF</Label>
            <Input type="file" accept="application/pdf" onChange={handlePdfChange} />
            {pdfFile && (
              <p className="text-sm text-muted-foreground">
                已選擇：{pdfFile.name}（{(pdfFile.size / 1024).toFixed(0)} KB）
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {method !== null && (
            <Button
              variant="ghost"
              onClick={reset}
              disabled={submitting}
              className="gap-1 mr-auto"
            >
              <ArrowLeft className="w-4 h-4" /> 重選方式
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
            取消
          </Button>
          {method !== null && (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              送出簽回
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MethodCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/40 transition p-4 flex flex-col items-center gap-2 text-center"
    >
      <div className="text-primary">{icon}</div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
