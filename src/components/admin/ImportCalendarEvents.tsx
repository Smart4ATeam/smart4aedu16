import { useState, useRef } from "react";
import { Upload, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ImportResult {
  success: number;
  failed: { row: number; title: string; reason: string }[];
}

const ImportCalendarEvents = ({ onComplete }: { onComplete: () => void }) => {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const csv = bom + "title,event_date,event_time,description,color,is_global\n" +
      "月會,2026-05-01,14:00,每月例行會議,gradient-orange,true\n" +
      "工作坊,2026-05-15,09:30,Dify 進階工作坊,gradient-purple,true\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar-events-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of lines[i]) {
        if (char === '"') { inQuotes = !inQuotes; }
        else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
        else { current += char; }
      }
      values.push(current.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
      rows.push(row);
    }
    return rows;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setImporting(true);
    setResult(null);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      toast.error("CSV 檔案無有效資料");
      setImporting(false);
      return;
    }

    const results: ImportResult = { success: 0, failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const title = r.title?.trim();
      const eventDate = r.event_date?.trim();

      if (!title) {
        results.failed.push({ row: i + 2, title: title || "(空)", reason: "缺少標題" });
        continue;
      }
      if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        results.failed.push({ row: i + 2, title, reason: "日期格式不正確（需 YYYY-MM-DD）" });
        continue;
      }

      const isGlobal = ["true", "1", "是", "yes"].includes((r.is_global || "true").toLowerCase());
      const color = r.color?.trim() || "gradient-orange";
      const eventTime = r.event_time?.trim() || null;
      const description = r.description?.trim() || null;

      const { error } = await supabase.from("calendar_events").insert({
        title,
        event_date: eventDate,
        event_time: eventTime,
        description,
        color,
        is_global: isGlobal,
        user_id: user.id,
      });

      if (error) {
        results.failed.push({ row: i + 2, title, reason: error.message });
      } else {
        results.success++;
      }
    }

    setResult(results);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
    if (results.success > 0) {
      toast.success(`成功匯入 ${results.success} 筆活動`);
      onComplete();
    }
    if (results.failed.length > 0) {
      toast.error(`${results.failed.length} 筆匯入失敗`);
    }
  };

  const downloadFailed = () => {
    if (!result?.failed.length) return;
    const bom = "\uFEFF";
    const csv = bom + "行號,標題,失敗原因\n" +
      result.failed.map(f => `${f.row},"${f.title}","${f.reason}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "calendar-events-import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <Download className="w-4 h-4" /> 下載範本
        </Button>
        <Button
          size="sm"
          className="gap-2"
          disabled={importing}
          onClick={() => fileRef.current?.click()}
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? "匯入中..." : "上傳 CSV"}
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      <div className="text-xs text-muted-foreground">
        CSV 欄位：title（必填）, event_date（必填，YYYY-MM-DD）, event_time（HH:MM）, description, color（gradient-orange/gradient-purple/gradient-lime/gradient-cyan）, is_global（true/false，預設 true）
      </div>

      {result && (
        <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
          <p>✅ 成功：{result.success} 筆</p>
          {result.failed.length > 0 && (
            <>
              <p>❌ 失敗：{result.failed.length} 筆</p>
              <Button variant="link" size="sm" onClick={downloadFailed} className="p-0 h-auto text-xs">
                下載失敗明細
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportCalendarEvents;
