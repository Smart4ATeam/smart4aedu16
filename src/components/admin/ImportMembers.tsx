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
  name: "name",
  姓名: "name",
  phone: "phone",
  電話: "phone",
  email: "email",
  信箱: "email",
  course_level: "course_level",
  課程等級: "course_level",
  points: "points",
  點數: "points",
  referral_code: "referral_code",
  推薦碼: "referral_code",
  notes: "notes",
  備註: "notes",
};

const REQUIRED_FIELDS = ["name"];

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
      if (dbCol === "points") val = parseInt(val as string, 10) || 0;
      // Clean phone: remove dashes, spaces, parentheses
      if (dbCol === "phone") val = (val as string).replace(/[-\s()]/g, "");
      mapped[dbCol] = val;
    }
  });

  for (const field of REQUIRED_FIELDS) {
    if (!mapped[field]) errors.push(`缺少必要欄位: ${field}`);
  }

  // Defaults
  if (mapped.points === undefined) mapped.points = 0;

  return { raw, mapped, errors, rowIndex };
}

const BATCH_SIZE = 50;

export default function ImportMembers() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importResult, setImportResult] = useState<{ success: number; failed: number; skipped: number; errors: string[] } | null>(null);
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
      let skipped = 0;
      const errors: string[] = [];

      // Check existing member_no to avoid duplicates
      const allMemberNos = validRows
        .map((r) => r.mapped.member_no as string | undefined)
        .filter(Boolean) as string[];

      let existingNos = new Set<string>();
      if (allMemberNos.length > 0) {
        // Query in batches of 100 to handle large sets
        for (let i = 0; i < allMemberNos.length; i += 100) {
          const batch = allMemberNos.slice(i, i + 100);
          const { data } = await supabase
            .from("reg_members")
            .select("member_no")
            .in("member_no", batch);
          if (data) data.forEach((d) => { if (d.member_no) existingNos.add(d.member_no); });
        }
      }

      // Filter out duplicates
      const rowsToInsert = validRows.filter((r) => {
        const no = r.mapped.member_no as string | undefined;
        if (no && existingNos.has(no)) {
          skipped++;
          return false;
        }
        return true;
      });

      if (skipped > 0) {
        errors.push(`已跳過 ${skipped} 筆重複學員編號`);
      }

      // Batch insert
      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
        const inserts = batch.map((r) => {
          const row = { ...r.mapped };
          return row;
        });

        const { error } = await supabase.from("reg_members").insert(inserts as any);
        if (error) {
          failed += batch.length;
          errors.push(`批次 ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else {
          success += batch.length;
        }
        setProgress(Math.round(((i + batch.length) / Math.max(rowsToInsert.length, 1)) * 100));
      }

      return { success, failed, skipped, errors };
    },
    onSuccess: (result) => {
      setImportResult(result);
      if (result.failed === 0) {
        toast.success(`成功匯入 ${result.success} 筆學員${result.skipped ? `，跳過 ${result.skipped} 筆重複` : ""}`);
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
      "member_no", "name", "phone", "email",
      "course_level", "points", "referral_code", "notes",
    ];
    const csv = templateHeaders.join(",") + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewCols = ["member_no", "name", "phone", "email", "course_level", "points"];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-foreground">上傳學員 CSV</h2>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="w-4 h-4" />
            下載範本
          </Button>
        </div>

        {!fileName ? (
          <label className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
            <Upload className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">點擊或拖曳 CSV 檔案至此</p>
            <p className="text-xs text-muted-foreground">必填欄位：姓名 (name)；學員編號由系統自動產生（也可手動填寫）</p>
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
              匯入 {validRows.length} 筆學員
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
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-foreground">匯入完成</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
              <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
              <p className="text-xs text-muted-foreground">成功匯入</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border text-center">
              <p className="text-2xl font-bold text-muted-foreground">{importResult.skipped}</p>
              <p className="text-xs text-muted-foreground">重複跳過</p>
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6"
      >
        <h3 className="font-semibold text-foreground mb-3">使用說明</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>1. 下載 CSV 範本，依照欄位格式填入學員資料</p>
          <p>2. 必填欄位：<code className="px-1.5 py-0.5 rounded bg-muted text-xs">name</code>（姓名）</p>
          <p>3. <code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_no</code> 若未填寫，系統會自動產生編號（格式：SA + YYMM + 流水號）</p>
          <p>4. 若 CSV 中的 <code className="px-1.5 py-0.5 rounded bg-muted text-xs">member_no</code> 已存在於系統，該筆會自動跳過不重複匯入</p>
          <p>5. 電話欄位會自動移除橫線、空格等格式符號</p>
          <p>6. 支援中英文欄位名稱</p>
        </div>
      </motion.div>
    </div>
  );
}
