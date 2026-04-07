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

// CSV column mapping: CSV header → reg_enrollments column
const COLUMN_MAP: Record<string, string> = {
  member_no: "member_no",
  學員編號: "member_no",
  member_name: "member_name",
  學員姓名: "member_name",
  member_email: "member_email",
  學員信箱: "member_email",
  order_no: "order_no",
  訂單編號: "order_no",
  course_code: "course_code",
  課程代碼: "course_code",
  course_type: "course_type",
  課程類型: "course_type",
  session_date: "session_date",
  上課日期: "session_date",
  status: "status",
  狀態: "status",
  payment_status: "payment_status",
  付款狀態: "payment_status",
  paid_at: "paid_at",
  付款日期: "paid_at",
  invoice_title: "invoice_title",
  發票抬頭: "invoice_title",
  dealer_id: "dealer_id",
  經銷商: "dealer_id",
  referrer: "referrer",
  推薦人: "referrer",
  is_retrain: "is_retrain",
  複訓: "is_retrain",
  checked_in: "checked_in",
  已簽到: "checked_in",
  certificate: "certificate",
  證書: "certificate",
  test_score: "test_score",
  測驗成績: "test_score",
  points_awarded: "points_awarded",
  獲得點數: "points_awarded",
  notes: "notes",
  備註: "notes",
  enrolled_at: "enrolled_at",
  報名日期: "enrolled_at",
};

const REQUIRED_FIELDS = ["member_no", "course_code"];

// Lookup fields that need resolving
const LOOKUP_FIELDS = ["member_no", "member_name", "member_email", "order_no", "course_code"];

const DATE_FIELDS = ["paid_at", "session_date", "enrolled_at"];

function excelDateToISO(value: string): string | null {
  if (!value || value.startsWith("#") || value.toLowerCase() === "n/a") {
    return null;
  }
  const num = parseFloat(value);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString();
  }
  // Convert slash dates to ISO
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    return value.replace(/\//g, "-");
  }
  return value;
}

function excelDateToDate(value: string): string | null {
  // Handle invalid values like #N/A
  if (!value || value.startsWith("#") || value.toLowerCase() === "n/a") {
    return null;
  }
  // Excel serial date number
  const num = parseFloat(value);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString().split("T")[0];
  }
  // Date range like "2025/05/17-05/18" or "2024/08/24-08/25" → take first date
  const rangeMatch = value.match(/^(\d{4}\/\d{2}\/\d{2})-/);
  if (rangeMatch) {
    return rangeMatch[1].replace(/\//g, "-");
  }
  // Normal date string "2025/05/17" → convert slashes
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    return value.replace(/\//g, "-");
  }
  return value;
}

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
      if (dbCol === "is_retrain" || dbCol === "checked_in") {
        val = ["true", "1", "是", "yes"].includes((val as string).toLowerCase());
      }
      if (dbCol === "test_score" || dbCol === "points_awarded") {
        val = parseFloat(val as string) || 0;
      }
      if (dbCol === "session_date") {
        val = excelDateToDate(val as string);
      } else if (DATE_FIELDS.includes(dbCol)) {
        val = excelDateToISO(val as string);
      }
      mapped[dbCol] = val;
    }
  });

  for (const field of REQUIRED_FIELDS) {
    if (!mapped[field]) errors.push(`缺少必要欄位: ${field}`);
  }

  // Defaults
  if (!mapped.status) mapped.status = "enrolled";
  if (mapped.is_retrain === undefined) mapped.is_retrain = false;
  if (mapped.checked_in === undefined) mapped.checked_in = false;
  if (mapped.points_awarded === undefined) mapped.points_awarded = 0;

  return { raw, mapped, errors, rowIndex };
}

const BATCH_SIZE = 50;

export default function ImportEnrollments() {
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
        .map((r, i) => mapRow(h, r, i + 2));
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

      // 1. Resolve member_no → member_id
      const allMemberNos = new Set<string>();
      for (const r of validRows) {
        const no = r.mapped.member_no as string | undefined;
        if (no) allMemberNos.add(no);
      }

      let memberNoToId: Record<string, string> = {};
      if (allMemberNos.size > 0) {
        const { data: members, error: mErr } = await supabase
          .from("reg_members")
          .select("id, member_no")
          .in("member_no", Array.from(allMemberNos));
        if (mErr) throw mErr;
        memberNoToId = Object.fromEntries((members || []).map((m) => [m.member_no!, m.id]));
        const missing = Array.from(allMemberNos).filter((n) => !memberNoToId[n]);
        if (missing.length > 0) {
          errors.push(`找不到學員編號: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` ...等 ${missing.length} 筆` : ""}`);
        }
      }

      // 2. Resolve course_code → course_id
      const allCodes = new Set<string>();
      for (const r of validRows) {
        const code = r.mapped.course_code as string | undefined;
        if (code) allCodes.add(code);
      }

      let codeToId: Record<string, string> = {};
      if (allCodes.size > 0) {
        const { data: courses, error: cErr } = await supabase
          .from("courses")
          .select("id, course_code")
          .in("course_code", Array.from(allCodes));
        if (cErr) throw cErr;
        codeToId = Object.fromEntries((courses || []).map((c) => [c.course_code!, c.id]));
        const missing = Array.from(allCodes).filter((c) => !codeToId[c]);
        if (missing.length > 0) {
          errors.push(`找不到課程代碼: ${missing.join(", ")}`);
        }
      }

      // 3. Resolve order_no → order_id
      const allOrderNos = new Set<string>();
      for (const r of validRows) {
        const no = r.mapped.order_no as string | undefined;
        if (no) allOrderNos.add(no);
      }

      let orderNoToId: Record<string, string> = {};
      if (allOrderNos.size > 0) {
        const { data: orders, error: oErr } = await supabase
          .from("reg_orders")
          .select("id, order_no")
          .in("order_no", Array.from(allOrderNos));
        if (oErr) throw oErr;
        orderNoToId = Object.fromEntries((orders || []).map((o) => [o.order_no, o.id]));
        const missing = Array.from(allOrderNos).filter((n) => !orderNoToId[n]);
        if (missing.length > 0) {
          errors.push(`找不到訂單編號: ${missing.slice(0, 10).join(", ")}${missing.length > 10 ? ` ...等 ${missing.length} 筆` : ""}`);
        }
      }

      // 4. Batch insert
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const inserts = batch.map((r) => {
          const row: Record<string, unknown> = {};

          // Copy direct fields (skip lookup-only fields)
          for (const [key, val] of Object.entries(r.mapped)) {
            if (LOOKUP_FIELDS.includes(key)) continue;
            row[key] = val;
          }

          // Resolve references
          const memberNo = r.mapped.member_no as string | undefined;
          if (memberNo && memberNoToId[memberNo]) {
            row.member_id = memberNoToId[memberNo];
          }

          const courseCode = r.mapped.course_code as string | undefined;
          if (courseCode && codeToId[courseCode]) {
            row.course_id = codeToId[courseCode];
          }

          const orderNo = r.mapped.order_no as string | undefined;
          if (orderNo && orderNoToId[orderNo]) {
            row.order_id = orderNoToId[orderNo];
          }

          return row;
        });

        const { error } = await supabase.from("reg_enrollments").insert(inserts as any);
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
      if (result.failed === 0 && result.errors.length === 0) {
        toast.success(`成功匯入 ${result.success} 筆報名明細`);
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
      "member_no", "course_code", "order_no", "course_type", "session_date",
      "status", "payment_status", "paid_at", "invoice_title",
      "dealer_id", "referrer", "is_retrain", "checked_in",
      "certificate", "test_score", "points_awarded", "notes", "enrolled_at",
    ];
    const csv = templateHeaders.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enrollments-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewCols = ["member_no", "course_code", "order_no", "status", "payment_status", "notes"];

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-foreground">上傳報名明細 CSV</h2>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" />
            下載範本
          </Button>
        </div>

        {!fileName ? (
          <label className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">點擊或拖曳 CSV 檔案至此</p>
            <p className="text-xs text-muted-foreground">必填欄位：學員編號 (member_no)、課程代碼 (course_code)</p>
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
              匯入 {validRows.length} 筆報名明細
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
          <p>2. 必填欄位：<code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_no</code>（學員編號）、<code className="px-1.5 py-0.5 rounded bg-muted text-xs">course_code</code>（課程代碼）</p>
          <p>3. 系統會自動將學員編號對應到 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_id</code>，課程代碼對應到 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">course_id</code></p>
          <p>4. 若有填寫 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">order_no</code>，系統會自動對應到訂單 ID</p>
          <p>5. 支援中英文欄位名稱</p>
          <p>6. 日期欄位支援 ISO 格式及 Excel 序列日期數字</p>
          <p>7. 狀態預設為 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">enrolled</code></p>
        </div>
      </motion.div>
    </div>
  );
}
