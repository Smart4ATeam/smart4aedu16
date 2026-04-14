import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, ArrowLeft, AlertCircle, RefreshCw } from "lucide-react";

export default function CertificateView() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const navigate = useNavigate();
  const [pollCount, setPollCount] = useState(0);

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

  // Poll for pending certificates
  useEffect(() => {
    if (cert?.status !== "pending" || pollCount >= 20) return;
    const timer = setTimeout(() => {
      refetch();
      setPollCount((c) => c + 1);
    }, 5000);
    return () => clearTimeout(timer);
  }, [cert?.status, pollCount, refetch]);

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
              <p className="font-semibold text-foreground">證書產生中，請稍候...</p>
              <p className="text-sm text-muted-foreground">
                {pollCount >= 20
                  ? "產生時間較長，請稍後至學習中心查看"
                  : `正在處理中（${pollCount}/20）`}
              </p>
            </>
          )}

          {cert.status === "issued" && cert.image_url && (
            <>
              <Badge className="bg-green-500">已發行</Badge>
              <img
                src={cert.image_url}
                alt="結訓證書"
                className="w-full rounded-lg border border-border shadow-sm"
              />
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" asChild>
                  <a href={cert.image_url} download={`certificate-${cert.student_name}.png`} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" /> 下載證書
                  </a>
                </Button>
              </div>
            </>
          )}

          {cert.status === "failed" && (
            <>
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <p className="font-semibold text-foreground">證書產生失敗</p>
              <p className="text-sm text-muted-foreground">請聯繫管理員或重新申請</p>
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
