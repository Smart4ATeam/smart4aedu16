import { useState, useEffect } from "react";
import { Search, Play, Flame, Star, FolderOpen, Wrench, Puzzle, LayoutTemplate, Video, ExternalLink, Download, Clock, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Resource = Tables<"resources"> & {
  sub_category?: string | null;
  tags?: string[];
  hot_rank?: number | null;
  flow_count?: number | null;
  usage_count?: number | null;
  industry_tag?: string | null;
  duration?: string | null;
  video_type?: string | null;
  trial_url?: string | null;
};

type SubCategory = {
  id: string;
  category: string;
  label: string;
  sort_order: number;
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

/* ─── Card layouts ─── */

function PluginCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-6 border-l-4 border-l-primary">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-lg font-bold text-foreground">{r.title}</h4>
          <p className="text-xs text-primary font-medium">{r.author || "—"}</p>
        </div>
        <span className="text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">v{r.version || "—"}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{r.description}</p>
      <TagList tags={r.tags} />
      <ResourceMeta r={r} />
      <div className="grid grid-cols-2 gap-4">
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

function ExtensionCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-6 border-l-4 border-l-secondary">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-lg font-bold text-foreground">{r.title}</h4>
          <p className="text-xs text-primary font-medium">{r.author || "—"}</p>
        </div>
        <span className="text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">v{r.version || "—"}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{r.description}</p>
      <TagList tags={r.tags} />
      <ResourceMeta r={r} />
      <div className={`grid gap-4 ${r.trial_url ? "grid-cols-3" : "grid-cols-2"}`}>
        <ActionButton href={r.download_url} label="安裝套件" />
        {r.detail_url ? (
          <a href={r.detail_url} target="_blank" rel="noreferrer" className="border border-primary text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary/10 transition text-center flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> 詳細介紹</a>
        ) : (
          <button className="border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>詳細介紹</button>
        )}
        {r.trial_url && (
          <a
            href={r.trial_url}
            target="_blank"
            rel="noreferrer"
            className="bg-secondary text-secondary-foreground py-2 rounded-lg text-xs font-bold hover:opacity-90 transition text-center flex items-center justify-center gap-1.5"
          >
            <Tag className="w-3.5 h-3.5" /> 領取試用
          </a>
        )}
      </div>
    </div>
  );
}

function TemplateCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-6 border-l-4 border-l-primary">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="text-lg font-bold text-foreground">{r.title}</h4>
          <p className="text-xs text-primary font-medium">{r.author || "—"}</p>
        </div>
        {r.industry_tag && (
          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{r.industry_tag}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{r.description}</p>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-4 border-t border-border pt-3">
        {r.flow_count != null && <span>🔗 {r.flow_count} 個流程</span>}
        {r.usage_count != null && <span>👥 {r.usage_count} 次使用</span>}
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" /> {Number(r.rating).toFixed(1)}</span>
        {r.is_hot && <span className="text-primary flex items-center gap-1"><Flame className="w-3 h-3" /> 熱門</span>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ActionButton href={r.download_url} label="使用範本" />
        {r.detail_url ? (
          <a href={r.detail_url} target="_blank" rel="noreferrer" className="border border-primary text-primary py-2 rounded-lg text-xs font-bold hover:bg-primary/10 transition text-center flex items-center justify-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> 預覽流程</a>
        ) : (
          <button className="border border-border text-muted-foreground py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed" disabled>預覽流程</button>
        )}
      </div>
    </div>
  );
}

function VideoCard({ r }: { r: Resource }) {
  return (
    <div className="glass-card p-4">
      <div className="aspect-video bg-muted rounded-xl relative mb-3 overflow-hidden group cursor-pointer">
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
          <span className="bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded-full">{r.difficulty || "初級"}</span>
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

/* ─── Main ─── */

export default function Resources() {
  const [activeCategory, setActiveCategory] = useState("plugins");
  const [searchQuery, setSearchQuery] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [activeSubCategory, setActiveSubCategory] = useState("");
  const [loading, setLoading] = useState(true);

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

  // Reset sub-category when category changes
  useEffect(() => { setActiveSubCategory(""); }, [activeCategory]);

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
        return <div className="space-y-4">{filtered.map(r => <PluginCard key={r.id} r={r} />)}</div>;
      case "extensions":
        return <div className="space-y-4">{filtered.map(r => <ExtensionCard key={r.id} r={r} />)}</div>;
      case "templates":
        return <div className="space-y-4">{filtered.map(r => <TemplateCard key={r.id} r={r} />)}</div>;
      case "videos":
        return <div className="grid grid-cols-3 gap-6">{filtered.map(r => <VideoCard key={r.id} r={r} />)}</div>;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Search */}
      <header className="mb-8">
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
    </div>
  );
}
