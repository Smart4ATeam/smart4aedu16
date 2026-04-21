import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Star, Upload, X, FileSpreadsheet, Settings2, Download, ImagePlus, Pencil, Eye, EyeOff, Copy, Check, Search, FileUp, Package, Flame, FlaskConical, DownloadCloud, LayoutGrid, Beaker } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from
"@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from
"@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ─── Types ─── */

type Resource = Record<string, any>;

type SubCategory = {
  id: string;
  category: string;
  label: string;
  sort_order: number;
};

type NewResource = {
  title: string;description: string;category: string;difficulty: string;
  author: string;version: string;download_url: string;thumbnail_url: string;
  detail_url: string;sub_category: string;tags: string;hot_rank: string;
  flow_count: string;usage_count: string;industry_tag: string;
  duration: string;video_type: string;is_hot: boolean;sort_order: string;
  app_id: string;trial_enabled: boolean;template_file_path: string;
};

const emptyResource = (): NewResource => ({
  title: "", description: "", category: "plugins", difficulty: "初級",
  author: "", version: "", download_url: "", thumbnail_url: "",
  detail_url: "", sub_category: "", tags: "", hot_rank: "",
  flow_count: "", usage_count: "", industry_tag: "",
  duration: "", video_type: "", is_hot: false, sort_order: "",
  app_id: "", trial_enabled: false, template_file_path: "",
});

const categoryOptions = [
{ value: "plugins", label: "插件" },
{ value: "templates", label: "模板" },
{ value: "extensions", label: "套件" },
{ value: "videos", label: "影片" }];


const categoryLabel: Record<string, string> = { plugins: "插件", templates: "模板", extensions: "套件", videos: "影片" };

/* ─── Sub-category Management Dialog ─── */

function SubCategoryManager({ open, onOpenChange, subCategories, onRefresh




}: {open: boolean;onOpenChange: (v: boolean) => void;subCategories: SubCategory[];onRefresh: () => void;}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState("extensions");
  const [newSort, setNewSort] = useState("0");

  const grouped = {
    extensions: subCategories.filter((s) => s.category === "extensions"),
    templates: subCategories.filter((s) => s.category === "templates")
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    const { error } = await supabase.from("resource_sub_categories").insert({
      category: newCategory, label: newLabel.trim(), sort_order: parseInt(newSort) || 0
    } as any);
    if (error) {toast.error("新增失敗：" + error.message);return;}
    toast.success("子分類已新增");
    setNewLabel("");
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("resource_sub_categories").delete().eq("id", id);
    if (error) {toast.error("刪除失敗：" + error.message);return;}
    toast.success("已刪除");
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>子分類管理</DialogTitle>
          <DialogDescription>管理應用套件與場景範本的篩選標籤</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">名稱</Label>
              <Input className="h-8 text-xs" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="如：熱門套件" />
            </div>
            <div className="w-28">
              <Label className="text-xs mb-1 block">父分類</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="extensions">套件</SelectItem>
                  <SelectItem value="templates">模板</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-16">
              <Label className="text-xs mb-1 block">排序</Label>
              <Input className="h-8 text-xs" type="number" value={newSort} onChange={(e) => setNewSort(e.target.value)} />
            </div>
            <Button size="sm" onClick={handleAdd} className="h-8"><Plus className="w-3.5 h-3.5" /></Button>
          </div>

          {/* List */}
          {(["extensions", "templates"] as const).map((cat) =>
          <div key={cat}>
              <h4 className="text-xs font-bold text-muted-foreground mb-2">{cat === "extensions" ? "應用套件" : "場景範本"}</h4>
              {grouped[cat].length === 0 ?
            <p className="text-xs text-muted-foreground">尚無子分類</p> :

            <div className="flex flex-wrap gap-2">
                  {grouped[cat].map((sc) =>
              <Badge key={sc.id} variant="secondary" className="gap-1 pr-1">
                      {sc.label}
                      <button onClick={() => handleDelete(sc.id)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
              )}
                </div>
            }
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>關閉</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}

/* ─── Template File Upload ─── */

function TemplateFileUpload({ filePath, onChange }: { filePath: string; onChange: (path: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("resource-templates").upload(path, file);
    if (error) { toast.error("上傳失敗：" + error.message); setUploading(false); return; }
    onChange(path);
    setUploading(false);
    toast.success("範本檔案已上傳");
  };

  return (
    <div>
      <Label className="text-xs">範本檔案（.zip / .json）</Label>
      <div className="flex items-center gap-3 mt-1">
        {filePath ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] font-mono">{filePath}</Badge>
            <button onClick={() => onChange("")} className="text-destructive hover:text-destructive/80"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition text-xs text-muted-foreground">
            <FileUp className="w-4 h-4" />
            {uploading ? "上傳中..." : "上傳範本檔案"}
            <input type="file" accept=".zip,.json" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}

/* ─── Dynamic form fields by category ─── */

function DynamicFields({ res, onChange, subCategories
}: {res: NewResource;onChange: (field: keyof NewResource, value: any) => void;subCategories: SubCategory[];}) {
  const filteredSubs = subCategories.filter((s) => s.category === res.category);
  const [uploading, setUploading] = useState(false);

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("resource-thumbnails").upload(path, file);
    if (error) { toast.error("上傳失敗：" + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("resource-thumbnails").getPublicUrl(path);
    onChange("thumbnail_url", urlData.publicUrl);
    setUploading(false);
    toast.success("縮圖已上傳");
  };

  return (
    <div className="space-y-3">
      {/* Shared: tags, hot_rank, is_hot, sort_order, thumbnail, detail_url */}
      <div>
        <Label className="text-xs">縮圖</Label>
        <div className="flex items-center gap-3 mt-1">
          {res.thumbnail_url ? (
            <div className="relative w-16 h-16 rounded border overflow-hidden">
              <img src={res.thumbnail_url} alt="縮圖" className="w-full h-full object-cover" />
              <button onClick={() => onChange("thumbnail_url", "")} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition text-xs text-muted-foreground">
              <ImagePlus className="w-4 h-4" />
              {uploading ? "上傳中..." : "上傳縮圖"}
              <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} disabled={uploading} />
            </label>
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs">詳細介紹連結</Label>
        <Input className="h-8 text-xs mt-1" placeholder="https://..." value={res.detail_url} onChange={(e) => onChange("detail_url", e.target.value)} />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label className="text-xs">標籤（逗號分隔）</Label>
          <Input className="h-8 text-xs mt-1" placeholder="Button, Chrome, LINE" value={res.tags} onChange={(e) => onChange("tags", e.target.value)} />
        </div>
        <div className="w-24">
          <Label className="text-xs">熱門排名</Label>
          <Input className="h-8 text-xs mt-1" type="number" placeholder="1" value={res.hot_rank} onChange={(e) => onChange("hot_rank", e.target.value)} />
        </div>
        <div className="w-20">
          <Label className="text-xs">排序</Label>
          <Input className="h-8 text-xs mt-1" type="number" placeholder="0" value={res.sort_order} onChange={(e) => onChange("sort_order", e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_hot"
          checked={res.is_hot}
          onChange={(e) => onChange("is_hot", e.target.checked)}
          className="rounded border-border"
        />
        <Label htmlFor="is_hot" className="text-xs cursor-pointer">🔥 標記為熱門</Label>
      </div>

      {/* Sub-category for extensions & templates */}
      {(res.category === "extensions" || res.category === "templates") && filteredSubs.length > 0 &&
      <div>
          <Label className="text-xs">子分類</Label>
          <Select value={res.sub_category} onValueChange={(v) => onChange("sub_category", v)}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="選擇子分類" /></SelectTrigger>
            <SelectContent>
              {filteredSubs.map((s) => <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }




      {/* APP ID & Trial toggle for extensions & templates */}
      {(res.category === "extensions" || res.category === "templates") &&
      <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs">APP ID（應用編號）</Label>
            <Input className="h-8 text-xs mt-1" placeholder="richmenu-yrfqmv" value={res.app_id} onChange={(e) => onChange("app_id", e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="trial_enabled"
              checked={res.trial_enabled}
              onChange={(e) => onChange("trial_enabled", e.target.checked)}
              className="rounded border-border"
            />
            <Label htmlFor="trial_enabled" className="text-xs cursor-pointer">🧪 開放試用</Label>
          </div>
        </div>
      }

      {/* Templates: file upload, flow_count, usage_count, industry_tag */}
      {res.category === "templates" &&
      <>
        <TemplateFileUpload filePath={(res as any).template_file_path || ""} onChange={(path) => onChange("template_file_path" as any, path)} />
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">流程數</Label>
            <Input className="h-8 text-xs mt-1" type="number" value={res.flow_count} onChange={(e) => onChange("flow_count", e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">使用次數</Label>
            <Input className="h-8 text-xs mt-1" type="number" value={res.usage_count} onChange={(e) => onChange("usage_count", e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">行業標籤</Label>
            <Input className="h-8 text-xs mt-1" placeholder="電商專用" value={res.industry_tag} onChange={(e) => onChange("industry_tag", e.target.value)} />
          </div>
        </div>
      </>
      }

      {/* Videos: duration, video_type */}
      {res.category === "videos" &&
      <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">時長</Label>
            <Input className="h-8 text-xs mt-1" placeholder="12:30" value={res.duration} onChange={(e) => onChange("duration", e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">影片類型</Label>
            <Input className="h-8 text-xs mt-1" placeholder="套件教學" value={res.video_type} onChange={(e) => onChange("video_type", e.target.value)} />
          </div>
        </div>
      }
    </div>);

}

/* ─── Admin Callback Value Cell ─── */

function AdminCallbackValueCell({ apiKey, category }: { apiKey: string | null; category: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!apiKey) return <span className="text-muted-foreground">等待中...</span>;

  if (category === "templates") {
    return (
      <a href={apiKey} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[10px] font-mono truncate max-w-[180px] inline-block">
        🔗 下載連結
      </a>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[10px]">{visible ? apiKey : "••••••••"}</span>
      <button onClick={() => setVisible(!visible)} className="p-0.5 hover:text-primary">
        {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button onClick={handleCopy} className="p-0.5 hover:text-primary">
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

/* ─── Main ─── */

const AdminContent = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [showSubCatDialog, setShowSubCatDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRes, setEditRes] = useState<NewResource>(emptyResource());
  const [newRes, setNewRes] = useState<NewResource>(emptyResource());
  const [batchRows, setBatchRows] = useState<NewResource[]>([emptyResource(), emptyResource(), emptyResource()]);
  const [batchUploading, setBatchUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [adminTab, setAdminTab] = useState("resources");
  const [trials, setTrials] = useState<any[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, any>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterAuthor, setFilterAuthor] = useState("all");
  const [trialTotalCount, setTrialTotalCount] = useState<number>(0);

  const fetchAll = async () => {
    const [resResult, scResult, trialCountResult] = await Promise.all([
    supabase.from("resources").select("*").order("sort_order"),
    supabase.from("resource_sub_categories").select("*").order("sort_order"),
    supabase.from("resource_trials").select("id", { count: "exact", head: true })]
    );
    if (resResult.data) setResources(resResult.data);
    if (scResult.data) setSubCategories(scResult.data as SubCategory[]);
    setTrialTotalCount(trialCountResult.count || 0);
    setLoading(false);
  };

  useEffect(() => {fetchAll();}, []);

  const fetchTrials = async () => {
    setTrialsLoading(true);
    const { data } = await supabase
      .from("resource_trials")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setTrials(data);
      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(data.map((t: any) => t.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email, student_id")
          .in("id", userIds);
        if (profs) setProfiles(new Map(profs.map((p: any) => [p.id, p])));
      }
    }
    setTrialsLoading(false);
  };

  useEffect(() => { if (adminTab === "trials") fetchTrials(); }, [adminTab]);

  const buildInsertPayload = (r: NewResource) => ({
    title: r.title.trim(),
    description: r.description.trim(),
    category: r.category,
    difficulty: r.difficulty,
    author: r.author.trim(),
    version: r.version.trim(),
    download_url: r.download_url.trim() || null,
    detail_url: r.detail_url.trim() || null,
    thumbnail_url: r.thumbnail_url.trim() || null,
    status: "approved" as const,
    sub_category: r.sub_category || null,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    hot_rank: r.hot_rank ? parseInt(r.hot_rank) : null,
    flow_count: r.flow_count ? parseInt(r.flow_count) : null,
    usage_count: r.usage_count ? parseInt(r.usage_count) : null,
    industry_tag: r.industry_tag.trim() || null,
    duration: r.duration.trim() || null,
    video_type: r.video_type.trim() || null,
    is_hot: r.is_hot,
    sort_order: r.sort_order ? parseInt(r.sort_order) : 0,
    app_id: r.app_id?.trim() || null,
    trial_enabled: r.trial_enabled || false,
    template_file_path: (r as any).template_file_path?.trim() || null,
  });

  const handleAdd = async () => {
    if (!newRes.title) return;
    const { error } = await supabase.from("resources").insert(buildInsertPayload(newRes) as any);
    if (error) {toast.error("新增失敗：" + error.message);return;}
    toast.success("資源已新增");
    setNewRes(emptyResource());
    setShowDialog(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("resources").delete().eq("id", id);
    if (error) {toast.error("刪除失敗：" + error.message);return;}
    toast.success("已刪除");
    setResources(resources.filter((r) => r.id !== id));
  };

  const openEdit = (r: Resource) => {
    setEditingId(r.id);
    setEditRes({
      title: r.title || "",
      description: r.description || "",
      category: r.category || "plugins",
      difficulty: r.difficulty || "初級",
      author: r.author || "",
      version: r.version || "",
      download_url: r.download_url || "",
      thumbnail_url: r.thumbnail_url || "",
      detail_url: r.detail_url || "",
      sub_category: r.sub_category || "",
      tags: (r.tags || []).join(", "),
      hot_rank: r.hot_rank != null ? String(r.hot_rank) : "",
      flow_count: r.flow_count != null ? String(r.flow_count) : "",
      usage_count: r.usage_count != null ? String(r.usage_count) : "",
      industry_tag: r.industry_tag || "",
      duration: r.duration || "",
      video_type: r.video_type || "",
      is_hot: r.is_hot || false,
      sort_order: r.sort_order != null ? String(r.sort_order) : "",
      app_id: r.app_id || "",
      trial_enabled: r.trial_enabled || false,
      template_file_path: r.template_file_path || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editingId || !editRes.title) return;
    const payload = buildInsertPayload(editRes);
    const { error } = await supabase.from("resources").update(payload as any).eq("id", editingId);
    if (error) {toast.error("更新失敗：" + error.message);return;}
    toast.success("資源已更新");
    setShowEditDialog(false);
    setEditingId(null);
    fetchAll();
  };

  /* ─── Batch ─── */

  const updateBatchRow = (i: number, field: keyof NewResource, value: string) => {
    setBatchRows((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  };
  const addBatchRow = () => setBatchRows((prev) => [...prev, emptyResource()]);
  const removeBatchRow = (i: number) => {if (batchRows.length > 1) setBatchRows((prev) => prev.filter((_, idx) => idx !== i));};

  const handleBatchUpload = async () => {
    const validRows = batchRows.filter((r) => r.title.trim());
    if (!validRows.length) {toast.error("請至少填寫一筆資源名稱");return;}
    setBatchUploading(true);
    const { error } = await supabase.from("resources").insert(
      validRows.map((r) => buildInsertPayload(r)) as any
    );
    setBatchUploading(false);
    if (error) {toast.error("批次新增失敗：" + error.message);return;}
    toast.success(`已新增 ${validRows.length} 筆資源`);
    setBatchRows([emptyResource(), emptyResource(), emptyResource()]);
    setShowBatchDialog(false);
    fetchAll();
  };

  const parseCSVLine = (line: string) => {
    const result: string[] = [];let cur = "";let inQ = false;
    for (const c of line) {if (c === '"') inQ = !inQ;else if (c === "," && !inQ) {result.push(cur);cur = "";} else cur += c;}
    result.push(cur);return result;
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = (evt.target?.result as string).split("\n").filter((l) => l.trim());
      if (lines.length < 2) {toast.error("CSV 格式不正確");return;}
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const col = (names: string[]) => headers.findIndex((h) => names.includes(h));
      const ti = col(["title", "名稱"]);
      if (ti === -1) {toast.error("CSV 需包含 title 欄位");return;}

      const parsed: NewResource[] = lines.slice(1).map((line) => {
        const c = parseCSVLine(line);
        const get = (i: number) => i >= 0 ? c[i]?.trim() || "" : "";
        return {
          title: get(ti),
          description: get(col(["description", "說明"])),
          category: get(col(["category", "分類"])) || "plugins",
          difficulty: get(col(["difficulty", "難度"])) || "初級",
          author: get(col(["author", "作者"])),
          version: get(col(["version", "版本"])),
          download_url: get(col(["download_url", "連結"])),
          detail_url: get(col(["detail_url", "詳細介紹"])),
          sub_category: get(col(["sub_category", "子分類"])),
          tags: get(col(["tags", "標籤"])),
          hot_rank: get(col(["hot_rank", "熱門排名"])),
          flow_count: get(col(["flow_count", "流程數"])),
          usage_count: get(col(["usage_count", "使用次數"])),
          industry_tag: get(col(["industry_tag", "行業標籤"])),
          duration: get(col(["duration", "時長"])),
          video_type: get(col(["video_type", "影片類型"])),
          thumbnail_url: get(col(["thumbnail_url", "縮圖"])),
          is_hot: get(col(["is_hot", "熱門"])) === "true",
          sort_order: get(col(["sort_order", "排序"])),
          app_id: get(col(["app_id", "應用編號"])),
          trial_enabled: get(col(["trial_enabled", "開放試用"])) === "true",
          template_file_path: "",
        };
      }).filter((r) => r.title);

      if (!parsed.length) {toast.error("未解析到有效資料");return;}
      setBatchRows(parsed);
      toast.success(`已匯入 ${parsed.length} 筆`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await fetch("/templates/resources-import-template.csv");
      if (!response.ok) throw new Error("下載失敗");

      const text = await response.text();
      const bom = "\uFEFF";
      const blob = new Blob([bom + text], { type: "text/csv;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "resources-import-template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error("範本下載失敗，請重新整理後再試");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">資源管理</h2>
        <p className="text-sm text-muted-foreground mt-1">管理所有學習資源，上架供學員瀏覽與使用</p>
      </motion.div>

      <Tabs value={adminTab} onValueChange={setAdminTab}>
        <TabsList>
          <TabsTrigger value="resources">📦 資源列表</TabsTrigger>
          <TabsTrigger value="trials">🧪 試用紀錄</TabsTrigger>
        </TabsList>

        <TabsContent value="resources">
      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="搜尋資源名稱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="分類" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分類</SelectItem>
            {categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAuthor} onValueChange={setFilterAuthor}>
          <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="作者" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部作者</SelectItem>
            {[...new Set(resources.map((r) => r.author).filter(Boolean))].sort().map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowSubCatDialog(true)} className="gap-2"><Settings2 className="w-4 h-4" /> 子分類管理</Button>
        <Button variant="outline" onClick={() => setShowBatchDialog(true)} className="gap-2"><Upload className="w-4 h-4" /> 批次上傳</Button>
        <Button onClick={() => setShowDialog(true)} className="gap-2"><Plus className="w-4 h-4" /> 新增資源</Button>
      </div>

      {/* Sub-category manager */}
      <SubCategoryManager open={showSubCatDialog} onOpenChange={setShowSubCatDialog} subCategories={subCategories} onRefresh={fetchAll} />

      {/* Single add dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增資源</DialogTitle><DialogDescription>填寫資源資訊，新增後直接上架</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="資源名稱" value={newRes.title} onChange={(e) => setNewRes({ ...newRes, title: e.target.value })} />
            <Textarea placeholder="說明" value={newRes.description} onChange={(e) => setNewRes({ ...newRes, description: e.target.value })} />
            <Select value={newRes.category} onValueChange={(v) => setNewRes({ ...newRes, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-3">
              <Input placeholder="作者" value={newRes.author} onChange={(e) => setNewRes({ ...newRes, author: e.target.value })} className="flex-1" />
              <Input placeholder="版本" value={newRes.version} onChange={(e) => setNewRes({ ...newRes, version: e.target.value })} className="w-28" />
            </div>
            <Input placeholder="資源連結（下載或申請連結）" value={newRes.download_url} onChange={(e) => setNewRes({ ...newRes, download_url: e.target.value })} />

            {/* Dynamic fields based on category */}
            <DynamicFields
              res={newRes}
              onChange={(field, value) => setNewRes((prev) => ({ ...prev, [field]: value }))}
              subCategories={subCategories} />
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
            <Button onClick={handleAdd}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>編輯資源</DialogTitle><DialogDescription>修改資源資訊後儲存</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="資源名稱" value={editRes.title} onChange={(e) => setEditRes({ ...editRes, title: e.target.value })} />
            <Textarea placeholder="說明" value={editRes.description} onChange={(e) => setEditRes({ ...editRes, description: e.target.value })} />
            <Select value={editRes.category} onValueChange={(v) => setEditRes({ ...editRes, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-3">
              <Input placeholder="作者" value={editRes.author} onChange={(e) => setEditRes({ ...editRes, author: e.target.value })} className="flex-1" />
              <Input placeholder="版本" value={editRes.version} onChange={(e) => setEditRes({ ...editRes, version: e.target.value })} className="w-28" />
            </div>
            <Input placeholder="資源連結（下載或申請連結）" value={editRes.download_url} onChange={(e) => setEditRes({ ...editRes, download_url: e.target.value })} />
            <DynamicFields
              res={editRes}
              onChange={(field, value) => setEditRes((prev) => ({ ...prev, [field]: value }))}
              subCategories={subCategories} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleUpdate}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Batch dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>批次上傳資源</DialogTitle><DialogDescription>手動填寫多筆資料，或匯入 CSV</DialogDescription></DialogHeader>
          <div className="flex gap-2 mb-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5"><FileSpreadsheet className="w-4 h-4" /> 匯入 CSV</Button>
            <Button type="button" variant="outline" size="sm" onClick={addBatchRow} className="gap-1.5"><Plus className="w-4 h-4" /> 新增一列</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleTemplateDownload} className="gap-1.5"><Download className="w-4 h-4" /> 下載範本</Button>
            <p className="text-xs text-muted-foreground ml-auto self-center">支援新欄位：tags, sub_category, duration, app_id, trial_enabled 等</p>
          </div>
          <div className="overflow-auto flex-1 border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="min-w-[120px]">名稱 *</TableHead>
                  <TableHead className="min-w-[140px]">說明</TableHead>
                  <TableHead className="min-w-[80px]">分類</TableHead>
                  <TableHead className="min-w-[70px]">作者</TableHead>
                  <TableHead className="w-[60px]">版本</TableHead>
                  <TableHead className="min-w-[120px]">資源連結</TableHead>
                  <TableHead className="min-w-[100px]">標籤</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchRows.map((row, i) =>
                <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.title} onChange={(e) => updateBatchRow(i, "title", e.target.value)} placeholder="必填" /></TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.description} onChange={(e) => updateBatchRow(i, "description", e.target.value)} /></TableCell>
                    <TableCell>
                      <Select value={row.category} onValueChange={(v) => updateBatchRow(i, "category", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{categoryOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.author} onChange={(e) => updateBatchRow(i, "author", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.version} onChange={(e) => updateBatchRow(i, "version", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.download_url} onChange={(e) => updateBatchRow(i, "download_url", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-8 text-xs" value={row.tags} onChange={(e) => updateBatchRow(i, "tags", e.target.value)} placeholder="逗號分隔" /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBatchRow(i)} disabled={batchRows.length <= 1}><X className="w-3.5 h-3.5" /></Button></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="mt-2">
            <p className="text-xs text-muted-foreground mr-auto">共 {batchRows.filter((r) => r.title.trim()).length} 筆有效資料</p>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>取消</Button>
            <Button onClick={handleBatchUpload} disabled={batchUploading} className="gap-1.5">
              {batchUploading ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
              {batchUploading ? "上傳中..." : "批次新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead>分類</TableHead>
              <TableHead>作者</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>試用</TableHead>
              <TableHead>評分</TableHead>
              <TableHead>資源連結</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const filtered = resources.filter((r) => {
                const q = searchQuery.toLowerCase();
                if (q && !r.title?.toLowerCase().includes(q)) return false;
                if (filterCategory !== "all" && r.category !== filterCategory) return false;
                if (filterAuthor !== "all" && r.author !== filterAuthor) return false;
                return true;
              });
              return filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">無符合條件的資源</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell><Badge variant="outline">{categoryLabel[r.category] || r.category}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.author || "—"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">v{r.version || "—"}</Badge></TableCell>
                  <TableCell>
                    {r.trial_enabled ? <Badge className="text-[10px]">🧪 開放</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs"><Star className="w-3 h-3 text-primary" /> {Number(r.rating).toFixed(1)}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {r.download_url ?
                      <a href={r.download_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{r.download_url}</a> :
                      "—"}
                  </TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ));
            })()}
          </TableBody>
        </Table>
      </motion.div>
        </TabsContent>

        <TabsContent value="trials">
          <div className="mt-4">
            {trialsLoading ? (
              <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : trials.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">尚無試用紀錄</div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="glass-card p-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>學員</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>資源名稱</TableHead>
                      <TableHead>分類</TableHead>
                      <TableHead>組織編號</TableHead>
                      <TableHead>APP ID</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>回傳值</TableHead>
                      <TableHead>領用時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trials.map((t: any) => {
                      const prof = profiles.get(t.user_id);
                      const res = resources.find((r) => r.id === t.resource_id);
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium text-xs">{prof?.display_name || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{prof?.email || "—"}</TableCell>
                          <TableCell className="text-xs">{res?.title || t.resource_id.slice(0, 8)}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{categoryLabel[t.resource_category] || t.resource_category}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{t.organization_id}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{t.app_id}</TableCell>
                          <TableCell>
                            {(() => {
                              const isTemplate = t.resource_category === "templates";
                              const isExpired = isTemplate && t.created_at
                                ? new Date().getTime() - new Date(t.created_at).getTime() > 24 * 60 * 60 * 1000
                                : false;
                              if (isExpired) {
                                return <Badge variant="destructive" className="text-[10px]">⏰ 已過期</Badge>;
                              }
                              return (
                                <Badge variant={t.webhook_status === "completed" ? "default" : "secondary"} className="text-[10px]">
                                  {t.webhook_status === "completed" ? "✅ 已回傳" : t.webhook_status === "sent" ? "⏳ 處理中" : "⏳ 等待中"}
                                </Badge>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-xs">
                            <AdminCallbackValueCell apiKey={t.api_key} category={t.resource_category} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.created_at).toLocaleString("zh-TW")}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>);

};

export default AdminContent;