import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function CertificateView() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);

  const { data: cert, refetch } = useQuery({
    queryKey: ["certificate_view", certificateId],
    enabled: !!certificateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("id", certificateId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const handleRetry = async () => {
    if (!certificateId) return;
    setRetrying(true);
    try {
      const { error } = await supabase.functions.invoke("request-certificate", {
        body: { certificate_id: certificateId },
      });
      if (error) throw error;
      toast.success("已重新發送證書產生請求，完成後會發送通知");
    } catch (e: any) {
      console.error("Retry error:", e);
      toast.error("重新發送失敗：" + (e.message || "未知錯誤"));
    } finally {
      setRetrying(false);
    }
  };

  if (!cert) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          {cert.status === "pending" && (
            <>
              <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
              <p className="font-semibold text-foreground">證書產生中</p>
              <p className="text-sm text-muted-foreground">
                完成後會發送訊息通知您，您可以先離開此頁面
              </p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRetry} disabled={retrying}>
                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                重新發送請求
              </Button>
            </>
          )}

          {cert.status === "issued" && cert.image_url && (() => {
            const isPdf = cert.image_url!.toLowerCase().endsWith(".pdf") ||
              cert.image_url!.includes("/pdf") ||
              cert.image_url!.includes("content-type=application%2Fpdf");
            const fileName = `certificate-${cert.student_name}${isPdf ? ".pdf" : ".png"}`;
            return (
              <>
                <Badge className="bg-green-500">已發行</Badge>
                {isPdf ? (
                  <iframe
                    src={cert.image_url!}
                    title="結訓證書"
                    className="w-full rounded-lg border border-border shadow-sm"
                    style={{ height: "500px" }}
                  />
                ) : (
                  <img
                    src={cert.image_url!}
                    alt="結訓證書"
                    className="w-full rounded-lg border border-border shadow-sm"
                  />
                )}
                <div className="flex gap-2">
                  <Button className="flex-1 gap-2" asChild>
                    <a href={cert.image_url!} download={fileName} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" /> 下載證書
                    </a>
                  </Button>
                </div>
              </>
            );
          })()}

          {cert.status === "failed" && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="font-semibold text-foreground">證書產生失敗</p>
              <p className="text-sm text-muted-foreground">請嘗試重新發送或聯繫管理員</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRetry} disabled={retrying}>
                {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                重新發送請求
              </Button>
            </>
          )}

          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p>{cert.course_name}</p>
            <p>{cert.student_name} · {cert.training_date} · {cert.score} 分</p>
          </div>

          <Button variant="ghost" className="w-full gap-2" onClick={() => navigate("/learning")}>
            <ArrowLeft className="w-4 h-4" /> 返回學習中心
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
