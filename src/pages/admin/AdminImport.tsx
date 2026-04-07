import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertTriangle, Download, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

// CSV column mapping: CSV header → reg_orders column
const COLUMN_MAP: Record<string, string> = {
  order_no: "order_no",
  訂單編號: "order_no",
  total_amount: "total_amount",
  總金額: "total_amount",
  payment_status: "payment_status",
  付款狀態: "payment_status",
  payment_method: "payment_method",
  付款方式: "payment_method",
  paid_at: "paid_at",
  付款日期: "paid_at",
  discount_plan: "discount_plan",
  優惠方案: "discount_plan",
  invoice_type: "invoice_type",
  發票類型: "invoice_type",
  invoice_title: "invoice_title",
  發票抬頭: "invoice_title",
  invoice_number: "invoice_number",
  發票號碼: "invoice_number",
  invoice_status: "invoice_status",
  發票狀態: "invoice_status",
  invoice_date: "invoice_date",
  發票日期: "invoice_date",
  tax_id: "tax_id",
  統一編號: "tax_id",
  dealer_id: "dealer_id",
  經銷商: "dealer_id",
  referrer: "referrer",
  推薦人: "referrer",
  notes: "notes",
  備註: "notes",
  p1_name: "p1_name",
  報名人1姓名: "p1_name",
  p1_phone: "p1_phone",
  報名人1電話: "p1_phone",
  p1_email: "p1_email",
  報名人1信箱: "p1_email",
  p2_name: "p2_name",
  報名人2姓名: "p2_name",
  p2_phone: "p2_phone",
  報名人2電話: "p2_phone",
  p2_email: "p2_email",
  報名人2信箱: "p2_email",
  p3_name: "p3_name",
  報名人3姓名: "p3_name",
  p3_phone: "p3_phone",
  報名人3電話: "p3_phone",
  p3_email: "p3_email",
  報名人3信箱: "p3_email",
  course_ids: "course_ids",
  課程ID: "course_ids",
  course_codes: "course_codes",
  課程代碼: "course_codes",
  is_retrain: "is_retrain",
  複訓: "is_retrain",
};

const REQUIRED_FIELDS = ["order_no"];

interface ParsedRow {
  raw: Record<string, string>;
  mapped: Record<string, unknown>;
  errors: string[];
  rowIndex: number;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function mapRow(headers: string[], values: string[], rowIndex: number): ParsedRow {
  const raw: Record<string, string> = {};
  const mapped: Record<string, unknown> = {};
  const errors: string[] = [];

  headers.forEach((h, i) => {
    raw[h] = values[i] || "";
    const dbCol = COLUMN_MAP[h];
    if (dbCol && values[i]?.trim()) {
      let val: unknown = values[i].trim();
      if (dbCol === "total_amount") val = parseFloat(val as string) || 0;
      if (dbCol === "is_retrain") val = ["true", "1", "是", "yes"].includes((val as string).toLowerCase());
      if (dbCol === "course_ids" || dbCol === "course_codes") {
        // Accept comma/semicolon/pipe-separated values
        val = (val as string).split(/[;|,]/).map((s) => s.trim()).filter(Boolean);
      }
      mapped[dbCol] = val;
    }
  });

  // Validate required
  for (const field of REQUIRED_FIELDS) {
    if (!mapped[field]) errors.push(`缺少必要欄位: ${field}`);
  }

  // Default values
  if (!mapped.payment_status) mapped.payment_status = "pending";
  if (!mapped.total_amount) mapped.total_amount = 0;
  if (!mapped.invoice_status) mapped.invoice_status = "pending";
  if (!mapped.course_ids) mapped.course_ids = [];

  return { raw, mapped, errors, rowIndex };
}

const BATCH_SIZE = 50;

export default function AdminImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows } = parseCSV(text);
      setHeaders(h);

      const mapped = rows
        .filter((r) => r.some((v) => v.trim()))
        .map((r, i) => mapRow(h, r, i + 2)); // +2 for 1-indexed + header row
      setParsedRows(mapped);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const validRows = parsedRows.filter((r) => r.errors.length === 0);
  const errorRows = parsedRows.filter((r) => r.errors.length > 0);

  const importMutation = useMutation({
    mutationFn: async () => {
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      // Collect all unique course_codes that need resolving
      const allCodes = new Set<string>();
      for (const r of validRows) {
        const codes = r.mapped.course_codes as string[] | undefined;
        if (codes?.length) codes.forEach((c) => allCodes.add(c));
      }

      // Resolve course_codes → course_ids
      let codeToId: Record<string, string> = {};
      if (allCodes.size > 0) {
        const { data: courses, error: courseErr } = await supabase
          .from("courses")
          .select("id, course_code")
          .in("course_code", Array.from(allCodes));
        if (courseErr) throw courseErr;
        codeToId = Object.fromEntries((courses || []).map((c) => [c.course_code, c.id]));
        const missing = Array.from(allCodes).filter((c) => !codeToId[c]);
        if (missing.length > 0) {
          errors.push(`找不到課程代碼: ${missing.join(", ")}`);
        }
      }

      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const inserts = batch.map((r) => {
          const row = { ...r.mapped };
          // Resolve course_codes to course_ids
          if (row.course_codes) {
            const codes = row.course_codes as string[];
            const ids = codes.map((c) => codeToId[c]).filter(Boolean);
            row.course_ids = [...((row.course_ids as string[] | undefined) || []), ...ids];
            delete row.course_codes;
          }
          return row;
        });

        const { error } = await supabase.from("reg_orders").insert(inserts as any);
        if (error) {
          failed += batch.length;
          errors.push(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          success += batch.length;
        }
        setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
      }

      return { success, failed, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      if (result.failed === 0) {
        toast.success(`成功匯入 ${result.success} 筆訂單`);
      } else {
        toast.warning(`匯入完成：${result.success} 成功 / ${result.failed} 失敗`);
      }
    },
    onError: (err: Error) => {
      toast.error(`匯入失敗: ${err.message}`);
    },
  });

  const handleClear = () => {
    setParsedRows([]);
    setHeaders([]);
    setFileName("");
    setImportResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const templateHeaders = [
      "order_no", "total_amount", "payment_status", "payment_method", "paid_at",
      "discount_plan", "invoice_type", "invoice_title", "invoice_number", "invoice_status",
      "invoice_date", "tax_id", "dealer_id", "referrer", "notes",
      "p1_name", "p1_phone", "p1_email", "p2_name", "p2_phone", "p2_email",
      "p3_name", "p3_phone", "p3_email", "course_codes", "is_retrain",
    ];
    const csv = templateHeaders.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Display columns for preview
  const previewCols = ["order_no", "p1_name", "total_amount", "payment_status", "course_codes", "notes"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">資料匯入</h1>
        <p className="text-muted-foreground text-sm mt-1">匯入舊訂單資料至報名管理系統</p>
      </div>

      {/* Upload area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-foreground">上傳 CSV 檔案</h2>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" />
            下載範本
          </Button>
        </div>

        {!fileName ? (
          <label className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">點擊或拖曳 CSV 檔案至此</p>
            <p className="text-xs text-muted-foreground">支援 UTF-8 編碼的 CSV 檔案</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  共 {parsedRows.length} 筆資料，{validRows.length} 筆有效，{errorRows.length} 筆有誤
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClear}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Column mapping info */}
        {headers.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border">
            <p className="text-xs font-medium text-foreground mb-2">欄位對應</p>
            <div className="flex flex-wrap gap-1.5">
              {headers.map((h) => {
                const mapped = COLUMN_MAP[h];
                return (
                  <Badge
                    key={h}
                    variant={mapped ? "default" : "outline"}
                    className={`text-[10px] px-1.5 py-0 ${!mapped ? "border-destructive text-destructive" : ""}`}
                  >
                    {h} → {mapped || "❌ 未識別"}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Error rows */}
      {errorRows.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <p className="font-medium mb-2">{errorRows.length} 筆資料有錯誤，將不會匯入：</p>
            <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {errorRows.slice(0, 20).map((r) => (
                <li key={r.rowIndex}>第 {r.rowIndex} 行：{r.errors.join(", ")}</li>
              ))}
              {errorRows.length > 20 && <li>⋯ 還有 {errorRows.length - 20} 筆錯誤</li>}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Preview table */}
      {validRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl overflow-hidden"
        >
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">預覽（前 20 筆）</h2>
            </div>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || !!importResult}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              匯入 {validRows.length} 筆訂單
            </Button>
          </div>

          {importMutation.isPending && (
            <div className="px-5 pb-3">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">匯入中 {progress}%</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">#</TableHead>
                  {previewCols.map((col) => (
                    <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {validRows.slice(0, 20).map((row) => (
                  <TableRow key={row.rowIndex}>
                    <TableCell className="text-xs text-muted-foreground">{row.rowIndex}</TableCell>
                    {previewCols.map((col) => (
                      <TableCell key={col} className="text-xs max-w-[200px] truncate">
                        {String(row.mapped[col] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* Import result */}
      {importResult && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-foreground">匯入完成</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
              <p className="text-xs text-muted-foreground">成功匯入</p>
            </div>
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
              <p className="text-2xl font-bold text-destructive">{importResult.failed}</p>
              <p className="text-xs text-muted-foreground">匯入失敗</p>
            </div>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-4 text-xs text-destructive space-y-1">
              {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <Button variant="outline" className="mt-4" onClick={handleClear}>
            匯入新檔案
          </Button>
        </motion.div>
      )}

      {/* Help info */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6"
      >
        <h3 className="font-semibold text-foreground mb-3">使用說明</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>1. 下載 CSV 範本，依照欄位格式填入資料</p>
          <p>2. 必填欄位：<code className="px-1.5 py-0.5 rounded bg-muted text-xs">order_no</code>（訂單編號）</p>
          <p>3. 支援中英文欄位名稱（如 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">訂單編號</code> 或 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">order_no</code>）</p>
          <p>4. 付款狀態預設為 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">pending</code>，可填入 paid / pending / refunded</p>
          <p>5. <code className="px-1.5 py-0.5 rounded bg-muted text-xs">course_codes</code> 欄位填入課程代碼，多個課程以 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">,</code> 或 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">;</code> 分隔，系統會自動轉換為課程 ID</p>
          <p>6. 也可直接使用 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">course_ids</code> 欄位填入 UUID</p>
          <p>7. 匯入僅寫入訂單資料，如需拆解為學員與報名明細，請至報名管理頁面操作</p>
        </div>
      </motion.div>
    </div>
  );
}
