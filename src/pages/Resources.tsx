import { useState, useEffect } from "react";
import { Search, Play, Flame, Star, FolderOpen, Wrench, Puzzle, LayoutTemplate, Video, ExternalLink, Download, Clock, Tag, Copy, Check, Eye, EyeOff, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { difficultyColors } from "@/lib/category-colors";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Resource = Tables<"resources"> & {
  sub_category?: string | null;
  tags?: string[];
  hot_rank?: number | null;
  flow_count?: number | null;
  usage_count?: number | null;
  industry_tag?: string | null;
  duration?: string | null;
  video_type?: string | null;
  app_id?: string | null;
  trial_enabled?: boolean;
};

type SubCategory = {
  id: string;
  category: string;
  label: string;
  sort_order: number;
};

type Trial = {
  id: string;
  resource_id: string;
  organization_id: string;
  app_id: string;
  resource_category: string;
  api_key: string | null;
  webhook_status: string;
  created_at: string;
  member_no: string | null;
};

const categoryMeta = [
  { id: "plugins", label: "應用插件", icon: Wrench },
  { id: "extensions", label: "應用套件", icon: Puzzle },
  { id: "templates", label: "場景範本", icon: LayoutTemplate },
  { id: "videos", label: "教學影片", icon: Video },
];

/* ─── Sub-components ─── */

function SubCategoryFilter({ subCategories, active, onChange }: {
  subCategories: SubCategory[];
  active: string;
  onChange: (v: string) => void;
}) {
  if (!subCategories.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onChange("")}
        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          !active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary hover:text-foreground"
        }`}
      >
        全部
      </button>
      {subCategories.map(sc => (
        <button
          key={sc.id}
          onClick={() => onChange(sc.label)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
            active === sc.label ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          {sc.label}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ href, label, disabled }: { href?: string | null; label: string; disabled?: boolean }) {
  if (!href) {
    return (
      <button className="bg-primary/10 text-primary py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>
        即將推出
      </button>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="bg-primary text-primary-foreground py-2 rounded-lg text-xs font-bold hover:bg-primary/90 transition text-center flex items-center justify-center gap-1.5"
    >
      <ExternalLink className="w-3.5 h-3.5" /> {label}
    </a>
  );
}

function TagList({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {tags.map(t => (
        <span key={t} className="bg-muted text-muted-foreground text-[10px] px-2 py-0.5 rounded-full">{t}</span>
      ))}
    </div>
  );
}

function CardThumbnail({ url, icon: Icon }: { url?: string | null; icon?: React.ElementType }) {
  return (
    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-muted/50 flex items-center justify-center border border-border/50">
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : Icon ? (
        <Icon className="w-8 h-8 text-muted-foreground/40" />
      ) : (
        <Package className="w-8 h-8 text-muted-foreground/40" />
      )}
    </div>
  );
}

function ResourceMeta({ r }: { r: Resource }) {
  return (
    <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-4 border-t border-border pt-3">
      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" /> {Number(r.rating).toFixed(1)} 評分</span>
      <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {r.installs} 安裝</span>
      {r.hot_rank && <span className="text-primary flex items-center gap-1"><Flame className="w-3 h-3" /> 熱門 #{r.hot_rank}</span>}
      {r.is_hot && !r.hot_rank && <span className="text-primary flex items-center gap-1"><Flame className="w-3 h-3" /> 熱門</span>}
    </div>
  );
}

function TrialButton({ r, onClaim, claiming, trialRecord }: {
  r: Resource;
  onClaim: (resourceId: string, resourceTitle: string, resourceCategory: string) => void;
  claiming: string | null;
  trialRecord?: Trial;
}) {
  if (!r.trial_enabled) return null;

  if (trialRecord) {
    return (
      <button className="bg-muted text-muted-foreground py-2 rounded-lg text-xs font-bold cursor-not-allowed" disabled>
        ✅ 已領用
      </button>
    );
  }

  return (
    <button
      onClick={() => onClaim(r.id, r.title, r.category)}
      disabled={claiming === r.id}
      className="bg-accent text-accent-foreground py-2 rounded-lg text-xs font-bold hover:opacity-90 transition text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
    >
      {claiming === r.id ? (
        <div className="w-3.5 h-3.5 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
      ) : (
        <Package className="w-3.5 h-3.5" />
      )}
      {claiming === r.id ? "領用中..." : "🧪 領用試用"}
    </button>
  );
}

/* ─── Card layouts ─── */

function PluginCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-5">
      <div className="flex gap-4 mb-4">
        <CardThumbnail url={r.thumbnail_url} icon={Wrench} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-bold text-foreground leading-tight">{r.title}</h4>
              <p className="text-[11px] text-primary font-medium mt-0.5">{r.author || "—"}</p>
            </div>
            <span className="text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded flex-shrink-0">v{r.version || "—"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed line-clamp-2">{r.description}</p>
        </div>
      </div>
      <TagList tags={r.tags} />
      <ResourceMeta r={r} />
      <div className="grid grid-cols-2 gap-3">
        <ActionButton href={r.download_url} label="立即安裝" />
        {r.detail_url ? (
          <a href={r.detail_url} target="_blank" rel="noreferrer" className="border border-primary text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary/10 transition text-center flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> 詳細介紹</a>
        ) : (
          <button className="border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>詳細介紹</button>
        )}
      </div>
    </div>
  );
}

function ExtensionCard({ r, onClaim, claiming, trialRecord }: { r: Resource; onClaim: (id: string, title: string, cat: string) => void; claiming: string | null; trialRecord?: Trial }) {
  const hasTrialBtn = r.trial_enabled;
  const gridCols = 2 + (hasTrialBtn ? 1 : 0);

  return (
    <div className="glass-card p-5">
      <div className="flex gap-4 mb-4">
        <CardThumbnail url={r.thumbnail_url} icon={Puzzle} />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="text-sm font-bold text-foreground leading-tight">{r.title}</h4>
              <p className="text-[11px] text-primary font-medium mt-0.5">{r.author || "—"}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {r.trial_enabled && <Badge className="text-[10px]">🧪 可試用</Badge>}
              <span className="text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">v{r.version || "—"}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed line-clamp-2">{r.description}</p>
        </div>
      </div>
      <TagList tags={r.tags} />
      <ResourceMeta r={r} />
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        <ActionButton href={r.download_url} label="安裝套件" />
        {r.detail_url ? (
          <a href={r.detail_url} target="_blank" rel="noreferrer" className="border border-primary text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary/10 transition text-center flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> 詳細介紹</a>
        ) : (
          <button className="border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>詳細介紹</button>
        )}
        <TrialButton r={r} onClaim={onClaim} claiming={claiming} trialRecord={trialRecord} />
      </div>
    </div>
  );
}

function TemplateCard({ r, onClaim, claiming, trialRecord }: { r: Resource; onClaim: (id: string, title: string, cat: string) => void; claiming: string | null; trialRecord?: Trial }) {
  const hasTrialBtn = r.trial_enabled;
  const gridCols = hasTrialBtn ? 3 : 2;

  return (
    <div className="glass-card p-6 border-l-4 border-l-primary">
      <ThumbnailImage url={r.thumbnail_url} />
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-lg font-bold text-foreground">{r.title}</h4>
          <p className="text-xs text-primary font-medium">{r.author || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {r.trial_enabled && <Badge className="text-[10px]">🧪 可試用</Badge>}
          {r.industry_tag && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{r.industry_tag}</span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{r.description}</p>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-4 border-t border-border pt-3">
        {r.flow_count != null && <span>🔗 {r.flow_count} 個流程</span>}
        {r.usage_count != null && <span>👥 {r.usage_count} 次使用</span>}
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" /> {Number(r.rating).toFixed(1)}</span>
        {r.is_hot && <span className="text-primary flex items-center gap-1"><Flame className="w-3 h-3" /> 熱門</span>}
      </div>
      <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        <ActionButton href={r.download_url} label="使用範本" />
        {r.detail_url ? (
          <a href={r.detail_url} target="_blank" rel="noreferrer" className="border border-primary text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary/10 transition text-center flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> 預覽流程</a>
        ) : (
          <button className="border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>預覽流程</button>
        )}
        <TrialButton r={r} onClaim={onClaim} claiming={claiming} trialRecord={trialRecord} />
      </div>
    </div>
  );
}

function VideoCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-4">
      <div className="aspect-video bg-muted rounded-xl relative mb-3 overflow-hidden group cursor-pointer">
        {r.thumbnail_url ? (
          <img src={r.thumbnail_url} alt={r.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        {r.download_url ? (
          <a href={r.download_url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-primary/15 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-3 h-3 text-primary ml-0.5" />
            </div>
          </a>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
            <div className="w-10 h-10 bg-muted-foreground/30 rounded-full flex items-center justify-center">
              <Play className="w-3 h-3 text-muted-foreground ml-0.5" />
            </div>
          </div>
        )}
      </div>
      <h5 className="text-xs font-bold mb-2 leading-snug text-foreground">{r.title}</h5>
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full border ${difficultyColors[r.difficulty || "初級"] || "bg-secondary/20 text-secondary-foreground"}`}>{r.difficulty || "初級"}</span>
          {r.video_type && <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{r.video_type}</span>}
        </div>
        <div className="flex items-center gap-2">
          {r.duration && <span className="flex items-center gap-0.5 text-muted-foreground"><Clock className="w-3 h-3" />{r.duration}</span>}
          {r.is_hot && <Flame className="w-3 h-3 text-primary" />}
        </div>
      </div>
    </div>
  );
}

/* ─── API Key display ─── */

function ApiKeyCell({ apiKey }: { apiKey: string | null }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!apiKey) return <span className="text-muted-foreground">等待回傳中...</span>;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("已複製");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[10px]">{visible ? apiKey : "••••••••••••"}</span>
      <button onClick={() => setVisible(!visible)} className="p-0.5 hover:text-primary">
        {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
      <button onClick={handleCopy} className="p-0.5 hover:text-primary">
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

/* ─── My Trials Tab ─── */

function MyTrialsTab({ trials, resources }: { trials: Trial[]; resources: Resource[] }) {
  const resourceMap = new Map(resources.map(r => [r.id, r]));

  if (!trials.length) {
    return <div className="glass-card p-8 text-center text-muted-foreground">尚未領用任何試用資源</div>;
  }

  return (
    <div className="space-y-3">
      {trials.map(t => {
        const res = resourceMap.get(t.resource_id);
        return (
          <div key={t.id} className="glass-card p-4 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-foreground">{res?.title || "—"}</h4>
                <Badge variant="outline" className="text-[10px]">{t.resource_category === "extensions" ? "套件" : "模板"}</Badge>
                <Badge variant={t.webhook_status === "completed" ? "default" : "secondary"} className="text-[10px]">
                  {t.webhook_status === "completed" ? "✅ 金鑰已回傳" : t.webhook_status === "sent" ? "⏳ 處理中" : "⏳ 等待中"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span>APP ID: {t.app_id}</span>
                <span>組織: {t.organization_id}</span>
                <span>領用時間: {new Date(t.created_at).toLocaleString("zh-TW")}</span>
              </div>
            </div>
            <div className="text-xs">
              <ApiKeyCell apiKey={t.api_key} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main ─── */

export default function Resources() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("plugins");
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [activeSubCategory, setActiveSubCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [trials, setTrials] = useState<Trial[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("browse");

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<{ id: string; title: string; category: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [resResult, scResult] = await Promise.all([
        supabase.from("resources").select("*").eq("status", "approved").order("sort_order"),
        supabase.from("resource_sub_categories").select("*").order("sort_order"),
      ]);
      if (resResult.data) setResources(resResult.data as Resource[]);
      if (scResult.data) setSubCategories(scResult.data as SubCategory[]);
      setLoading(false);
    };
    load();
  }, []);

  // Fetch trials for logged-in user
  useEffect(() => {
    if (!user) return;
    const fetchTrials = async () => {
      const { data } = await supabase
        .from("resource_trials")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) setTrials(data as Trial[]);
    };
    fetchTrials();
  }, [user]);

  // Reset sub-category when category changes
  useEffect(() => { setActiveSubCategory(""); }, [activeCategory]);

  const trialMap = new Map(trials.map(t => [t.resource_id, t]));

  // Step 1: Check org ID, then show confirmation dialog
  const requestClaim = async (resourceId: string, resourceTitle: string, resourceCategory: string) => {
    if (!user) {
      toast.error("請先登入");
      return;
    }

    // Check organization_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      toast.error("請先在「設定」頁面填寫您的組織編號（Organization ID），才能領用試用資源。");
      return;
    }

    // Show confirmation dialog
    setPendingClaim({ id: resourceId, title: resourceTitle, category: resourceCategory });
    setConfirmOpen(true);
  };

  // Step 2: User confirmed — actually invoke the edge function
  const handleConfirmedClaim = async () => {
    if (!pendingClaim || !user) return;
    setConfirmOpen(false);
    const resourceId = pendingClaim.id;
    setClaiming(resourceId);
    try {
      const { data, error } = await supabase.functions.invoke("api-resource-trial", {
        body: { resource_id: resourceId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(data?.data?.message || "領用成功！");
        const { data: newTrials } = await supabase
          .from("resource_trials")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (newTrials) setTrials(newTrials as Trial[]);
      }
    } catch (err: any) {
      toast.error(err.message || "領用失敗");
    } finally {
      setClaiming(null);
      setPendingClaim(null);
    }
  };

  const categoryCounts = categoryMeta.map(c => ({
    ...c,
    count: resources.filter(r => r.category === c.id).length,
  }));

  const currentSubCategories = subCategories.filter(sc => sc.category === activeCategory);

  const filtered = resources.filter(r => {
    if (r.category !== activeCategory) return false;
    if (activeSubCategory && (r as any).sub_category !== activeSubCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
    }
    return true;
  });

  const categoryLabel = (cat: string) => {
    if (cat === "extensions") return "套件";
    if (cat === "templates") return "模板";
    return "資源";
  };

  const renderCards = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (filtered.length === 0) {
      return <div className="glass-card p-8 text-center text-muted-foreground">此分類暫無資源</div>;
    }

    switch (activeCategory) {
      case "plugins":
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map(r => <PluginCard key={r.id} r={r} />)}</div>;
      case "extensions":
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map(r => <ExtensionCard key={r.id} r={r} onClaim={requestClaim} claiming={claiming} trialRecord={trialMap.get(r.id)} />)}</div>;
      case "templates":
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filtered.map(r => <TemplateCard key={r.id} r={r} onClaim={requestClaim} claiming={claiming} trialRecord={trialMap.get(r.id)} />)}</div>;
      case "videos":
        return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{filtered.map(r => <VideoCard key={r.id} r={r} />)}</div>;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認領用</AlertDialogTitle>
            <AlertDialogDescription>
              今天確定要領用「<strong>{pendingClaim?.title}</strong>」{categoryLabel(pendingClaim?.category || "")}嗎？
              <br /><br />
              每個分類每天只能領用一個，確認後將無法取消。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedClaim}>確認領用</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="browse">🔍 資源瀏覽</TabsTrigger>
          <TabsTrigger value="trials">🧪 我的試用 {trials.length > 0 && `(${trials.length})`}</TabsTrigger>
        </TabsList>

        <TabsContent value="browse">
          {/* Search */}
          <header className="mb-8 mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="搜尋課程內容、文件、工具..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-background/60 border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
              />
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors">
                <Search className="w-4 h-4" />
                <span>搜尋</span>
              </button>
            </div>
          </header>

          {/* Categories */}
          <section className="mb-10 p-5 glass-card">
            <h3 className="text-sm font-bold mb-5 flex items-center">
              <FolderOpen className="w-4 h-4 text-primary mr-2" />
              資源分類
            </h3>
            <div className="flex gap-4">
              {categoryCounts.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-1 p-4 flex items-center gap-4 rounded-xl border transition-all duration-200 ${
                    activeCategory === cat.id
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "border-border hover:border-primary hover:bg-primary/5 text-muted-foreground"
                  }`}
                >
                  <cat.icon className={`w-5 h-5 ${activeCategory === cat.id ? "" : "text-muted-foreground"}`} />
                  <div className="text-left">
                    <p className="text-xs font-bold">{cat.label}</p>
                    <p className="text-[9px] mt-0.5 opacity-80">{cat.count} 個</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Resource list */}
          <section className="mb-10">
            <h3 className="text-sm font-bold mb-4 flex items-center">
              <Flame className="w-4 h-4 text-primary mr-2" />
              {categoryMeta.find(c => c.id === activeCategory)?.label || "資源"}
            </h3>

            {/* Sub-category filter for extensions & templates */}
            {(activeCategory === "extensions" || activeCategory === "templates") && (
              <SubCategoryFilter
                subCategories={currentSubCategories}
                active={activeSubCategory}
                onChange={setActiveSubCategory}
              />
            )}

            {renderCards()}
          </section>
        </TabsContent>

        <TabsContent value="trials">
          <div className="mt-4">
            <h3 className="text-sm font-bold mb-4 flex items-center">
              <Package className="w-4 h-4 text-primary mr-2" />
              我的試用紀錄
            </h3>
            <MyTrialsTab trials={trials} resources={resources} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
