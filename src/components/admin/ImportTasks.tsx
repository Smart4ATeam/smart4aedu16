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

const ImportTasks = ({ onComplete }: { onComplete: () => void }) => {
  const { user } = useAuth();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const csv = bom + "title,description,difficulty,amount_min,amount_max,category,tags,deadline,status,admin_notes\n" +
      "範例任務,任務描述說明,中級,3000,8000,開發,\"Dify,Make.com\",2026-05-01,available,內部備註(學員看不到)\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks-import-template.csv";
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
      if (!title) {
        results.failed.push({ row: i + 2, title: title || "(空)", reason: "缺少標題" });
        continue;
      }

      const tags = r.tags ? r.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const difficultyRaw = r.difficulty?.trim() || "中級";
      const difficulty = difficultyRaw.replace("初階", "初級").replace("中階", "中級").replace("高階", "高級");
      const amountMin = Number(r.amount_min ?? r.amount) || 0;
      const amountMax = Number(r.amount_max ?? r.amount) || amountMin;
      const status = r.status?.trim() || "available";
      const deadline = r.deadline?.trim() || null;
      const description = r.description?.trim() || "";
      const category = r.category?.trim() || "general";
      const adminNotes = r.admin_notes?.trim() || "";

      const { error } = await supabase.from("tasks").insert({
        title,
        description,
        difficulty,
        amount: amountMin,
        amount_min: amountMin,
        amount_max: amountMax,
        category,
        admin_notes: adminNotes,
        tags,
        deadline,
        status,
        created_by: user.id,
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
      toast.success(`成功匯入 ${results.success} 筆任務`);
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
    a.download = "tasks-import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <Download className="w-4 h-4" /> 下載範本
        </Button>
        <Button size="sm" className="gap-2" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {importing ? "匯入中..." : "上傳 CSV"}
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      <div className="text-xs text-muted-foreground">
        CSV 欄位：title（必填）, description, difficulty（初級/中級/高級）, amount_min, amount_max, category, tags（逗號分隔，用引號包覆）, deadline（YYYY-MM-DD）, status（available）, admin_notes
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

export default ImportTasks;
