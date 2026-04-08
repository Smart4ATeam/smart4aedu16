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

const COLUMN_MAP: Record<string, string> = {
  member_no: "member_no",
  學員編號: "member_no",
  points_delta: "points_delta",
  點數異動: "points_delta",
  異動點數: "points_delta",
  type: "type",
  類型: "type",
  description: "description",
  說明: "description",
  備註: "description",
  order_no: "order_no",
  訂單編號: "order_no",
  created_at: "created_at",
  建立時間: "created_at",
  異動時間: "created_at",
};

const REQUIRED_FIELDS = ["member_no", "points_delta"];

const DATE_FIELDS = ["created_at"];

function excelDateToISO(value: string): string {
  const num = parseFloat(value);
  if (!isNaN(num) && num > 25000 && num < 60000) {
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString();
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
      if (dbCol === "points_delta") val = parseInt(val as string, 10) || 0;
      if (DATE_FIELDS.includes(dbCol)) val = excelDateToISO(val as string);
      mapped[dbCol] = val;
    }
  });

  for (const field of REQUIRED_FIELDS) {
    if (!mapped[field]) errors.push(`缺少必要欄位: ${field}`);
  }

  if (!mapped.type) mapped.type = "manual";

  return { raw, mapped, errors, rowIndex };
}

const BATCH_SIZE = 50;

const previewCols = ["member_no", "points_delta", "type", "description", "order_no"];

export default function ImportPointTransactions() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[]; failedRows: ParsedRow[] } | null>(null);
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
      const failedRows: ParsedRow[] = [];

      // Resolve member_no → member_id
      const allMemberNos = new Set<string>();
      const allOrderNos = new Set<string>();
      for (const r of validRows) {
        if (r.mapped.member_no) allMemberNos.add(r.mapped.member_no as string);
        if (r.mapped.order_no) allOrderNos.add(r.mapped.order_no as string);
      }

      let memberNoToId: Record<string, string> = {};
      if (allMemberNos.size > 0) {
        const { data, error } = await supabase
          .from("reg_members")
          .select("id, member_no")
          .in("member_no", Array.from(allMemberNos));
        if (error) throw error;
        memberNoToId = Object.fromEntries((data || []).map((m) => [m.member_no, m.id]));
        const missing = Array.from(allMemberNos).filter((n) => !memberNoToId[n]);
        if (missing.length > 0) {
          errors.push(`找不到學員編號: ${missing.join(", ")}`);
        }
      }

      let orderNoToId: Record<string, string> = {};
      if (allOrderNos.size > 0) {
        const { data, error } = await supabase
          .from("reg_orders")
          .select("id, order_no")
          .in("order_no", Array.from(allOrderNos));
        if (error) throw error;
        orderNoToId = Object.fromEntries((data || []).map((o) => [o.order_no, o.id]));
        const missing = Array.from(allOrderNos).filter((n) => !orderNoToId[n]);
        if (missing.length > 0) {
          errors.push(`找不到訂單編號: ${missing.join(", ")}`);
        }
      }

      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const successRows: ParsedRow[] = [];
        const batchFailedRows: ParsedRow[] = [];

        for (const r of batch) {
          const memberNo = r.mapped.member_no as string;
          const memberId = memberNoToId[memberNo];
          if (!memberId) {
            batchFailedRows.push({ ...r, errors: [...r.errors, `找不到學員編號: ${memberNo}`] });
          } else {
            successRows.push(r);
          }
        }

        if (successRows.length > 0) {
          const inserts = successRows.map((r) => {
            const row: Record<string, unknown> = {};
            row.member_id = memberNoToId[r.mapped.member_no as string];
            row.points_delta = r.mapped.points_delta;
            if (r.mapped.type) row.type = r.mapped.type;
            if (r.mapped.description) row.description = r.mapped.description;
            if (r.mapped.created_at) row.created_at = r.mapped.created_at;
            const orderNo = r.mapped.order_no as string | undefined;
            if (orderNo && orderNoToId[orderNo]) row.order_id = orderNoToId[orderNo];
            return row;
          });

          const { error } = await supabase.from("reg_point_transactions").insert(inserts as any);
          if (error) {
            for (const r of successRows) batchFailedRows.push({ ...r, errors: [...r.errors, error.message] });
            errors.push(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          } else {
            success += successRows.length;
          }
        }

        failed += batchFailedRows.length;
        failedRows.push(...batchFailedRows);
        setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
      }

      return { success, failed, errors, failedRows };
    },
    onSuccess: (result) => {
      setImportResult(result);
      if (result.failed === 0) {
        toast.success(`成功匯入 ${result.success} 筆點數異動`);
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
    const templateHeaders = ["member_no", "points_delta", "type", "description", "order_no", "created_at"];
    const csv = templateHeaders.join(",") + "\n";
    downloadCSV(csv, "point-transactions-import-template.csv");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFailedRows = () => {
    if (!importResult?.failedRows.length) return;
    const cols = ["member_no", "points_delta", "type", "description", "order_no", "created_at", "失敗原因"];
    const lines = importResult.failedRows.map((r) => {
      const vals = ["member_no", "points_delta", "type", "description", "order_no", "created_at"].map(
        (c) => `"${String(r.mapped[c] ?? "").replace(/"/g, '""')}"`
      );
      vals.push(`"${r.errors.join("; ").replace(/"/g, '""')}"`);
      return vals.join(",");
    });
    downloadCSV(cols.join(",") + "\n" + lines.join("\n"), "point-transactions-failed.csv");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-foreground">上傳點數異動 CSV</h2>
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
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
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
                  <Badge key={h} variant={mapped ? "default" : "outline"} className={`text-[10px] px-1.5 py-0 ${!mapped ? "border-destructive text-destructive" : ""}`}>
                    {h} → {mapped || "❌ 未識別"}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

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

      {validRows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground">預覽（前 20 筆）</h2>
            </div>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !!importResult} className="gap-2">
              <Upload className="w-4 h-4" />
              匯入 {validRows.length} 筆點數異動
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

      {importResult && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6">
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
          {importResult.failedRows.length > 0 && (
            <Button variant="destructive" size="sm" className="mt-4 gap-2" onClick={downloadFailedRows}>
              <Download className="w-4 h-4" />
              下載失敗資料 CSV（{importResult.failedRows.length} 筆）
            </Button>
          )}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={handleClear}>
              匯入新檔案
            </Button>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6">
        <h3 className="font-semibold text-foreground mb-3">使用說明</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>1. 下載 CSV 範本，依照欄位格式填入資料</p>
          <p>2. 必填欄位：<code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_no</code>（學員編號）、<code className="px-1.5 py-0.5 rounded bg-muted text-xs">points_delta</code>（異動點數）</p>
          <p>3. <code className="px-1.5 py-0.5 rounded bg-muted text-xs">type</code> 預設為 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">manual</code>，可填入 earn / redeem / manual / adjustment</p>
          <p>4. <code className="px-1.5 py-0.5 rounded bg-muted text-xs">order_no</code> 為選填，系統會自動對應訂單 ID</p>
          <p>5. 支援中英文欄位名稱（如 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">學員編號</code> 或 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_no</code>）</p>
        </div>
      </motion.div>
    </div>
  );
}
