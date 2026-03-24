import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ContentRenderer } from "@/components/learning/ContentRenderer";
import { Plus, Pencil, Trash2, ArrowLeft, GripVertical, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface CourseContentEditorProps {
  course: { id: string; title: string };
  onBack: () => void;
}

const SECTION_TYPES = [
  { value: "text", label: "文字段落" },
  { value: "card_grid", label: "卡片網格" },
  { value: "highlight", label: "重點區塊" },
  { value: "list", label: "條列清單" },
  { value: "bordered_list", label: "邊框清單" },
  { value: "flow", label: "流程圖" },
  { value: "link", label: "外部連結" },
  { value: "image", label: "圖片" },
];

export function CourseContentEditor({ course, onBack }: CourseContentEditorProps) {
  const queryClient = useQueryClient();
  const [unitDialog, setUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any>(null);
  const [unitTitle, setUnitTitle] = useState("");

  const [sectionDialog, setSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<any>(null);
  const [sectionUnitId, setSectionUnitId] = useState("");
  const [sectionType, setSectionType] = useState("text");
  const [sectionJson, setSectionJson] = useState("{}");
  const [sectionOrder, setSectionOrder] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: units = [] } = useQuery({
    queryKey: ["course_units", course.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_units")
        .select("*")
        .eq("course_id", course.id)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["unit_sections", course.id],
    queryFn: async () => {
      const unitIds = units.map((u: any) => u.id);
      if (!unitIds.length) return [];
      const { data } = await supabase
        .from("unit_sections")
        .select("*")
        .in("unit_id", unitIds)
        .order("sort_order");
      return data || [];
    },
    enabled: units.length > 0,
  });

  // ===== Unit mutations =====
  const saveUnit = useMutation({
    mutationFn: async () => {
      if (editingUnit) {
        const { error } = await supabase.from("course_units").update({ title: unitTitle }).eq("id", editingUnit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_units").insert({
          course_id: course.id,
          title: unitTitle,
          sort_order: units.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingUnit ? "單元已更新" : "單元已新增");
      queryClient.invalidateQueries({ queryKey: ["course_units", course.id] });
      setUnitDialog(false);
    },
    onError: () => toast.error("操作失敗"),
  });

  const deleteUnit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("單元已刪除");
      queryClient.invalidateQueries({ queryKey: ["course_units", course.id] });
      queryClient.invalidateQueries({ queryKey: ["unit_sections", course.id] });
    },
  });

  // ===== Section mutations =====
  const saveSection = useMutation({
    mutationFn: async () => {
      let parsed: any;
      try {
        parsed = JSON.parse(sectionJson);
      } catch {
        throw new Error("JSON 格式錯誤");
      }
      const payload = {
        unit_id: sectionUnitId,
        type: sectionType,
        content_json: parsed,
        sort_order: sectionOrder,
      };
      if (editingSection) {
        const { error } = await supabase.from("unit_sections").update(payload).eq("id", editingSection.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("unit_sections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSection ? "區塊已更新" : "區塊已新增");
      queryClient.invalidateQueries({ queryKey: ["unit_sections", course.id] });
      setSectionDialog(false);
    },
    onError: (e: any) => toast.error(e.message || "操作失敗"),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unit_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("區塊已刪除");
      queryClient.invalidateQueries({ queryKey: ["unit_sections", course.id] });
    },
  });

  const openCreateUnit = () => {
    setEditingUnit(null);
    setUnitTitle("");
    setUnitDialog(true);
  };

  const openEditUnit = (u: any) => {
    setEditingUnit(u);
    setUnitTitle(u.title);
    setUnitDialog(true);
  };

  const openCreateSection = (unitId: string) => {
    setEditingSection(null);
    setSectionUnitId(unitId);
    setSectionType("text");
    setSectionJson(JSON.stringify(getDefaultJson("text"), null, 2));
    setSectionOrder((sections.filter((s: any) => s.unit_id === unitId)).length);
    setPreviewMode(false);
    setSectionDialog(true);
  };

  const openEditSection = (s: any) => {
    setEditingSection(s);
    setSectionUnitId(s.unit_id);
    setSectionType(s.type);
    setSectionJson(JSON.stringify(s.content_json, null, 2));
    setSectionOrder(s.sort_order);
    setPreviewMode(false);
    setSectionDialog(true);
  };

  const handleTypeChange = (newType: string) => {
    setSectionType(newType);
    setSectionJson(JSON.stringify(getDefaultJson(newType), null, 2));
  };

  const getSectionsForUnit = (unitId: string) =>
    sections.filter((s: any) => s.unit_id === unitId).sort((a: any, b: any) => a.sort_order - b.sort_order);

  const typeLabel = (type: string) => SECTION_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">課程內容管理</h2>
          <p className="text-sm text-muted-foreground">{course.title}</p>
        </div>
      </div>

      {/* Units */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">課程單元 ({units.length})</h3>
        <Button size="sm" onClick={openCreateUnit} className="gap-1">
          <Plus className="w-4 h-4" />新增單元
        </Button>
      </div>

      {units.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">尚無課程單元，請點擊上方按鈕新增。</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {units.map((unit: any, idx: number) => {
            const unitSections = getSectionsForUnit(unit.id);
            return (
              <AccordionItem key={unit.id} value={unit.id} className="glass-card rounded-xl border-border overflow-hidden">
                <AccordionTrigger className="px-5 py-4 hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 text-left">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">第 {idx + 1} 單元</Badge>
                    <span className="font-medium text-foreground">{unit.title}</span>
                    <Badge variant="secondary" className="text-xs ml-auto mr-4">{unitSections.length} 個區塊</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Button size="sm" variant="outline" onClick={() => openEditUnit(unit)} className="gap-1">
                      <Pencil className="w-3.5 h-3.5" />編輯單元
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("刪除此單元及所有內容區塊？")) deleteUnit.mutate(unit.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />刪除
                    </Button>
                    <div className="flex-1" />
                    <Button size="sm" onClick={() => openCreateSection(unit.id)} className="gap-1">
                      <Plus className="w-3.5 h-3.5" />新增區塊
                    </Button>
                  </div>

                  {unitSections.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">尚無內容區塊</p>
                  ) : (
                    <div className="space-y-3">
                      {unitSections.map((s: any, sIdx: number) => (
                        <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <span className="text-xs text-muted-foreground font-mono">#{sIdx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">{typeLabel(s.type)}</Badge>
                              {(s.content_json as any)?.title && (
                                <span className="text-sm text-foreground font-medium truncate">
                                  {(s.content_json as any).title}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {JSON.stringify(s.content_json).slice(0, 120)}...
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditSection(s)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => { if (confirm("確定刪除此區塊？")) deleteSection.mutate(s.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Unit Dialog */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? "編輯單元" : "新增單元"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>單元標題</Label>
              <Input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder="例如：認識 AI 智慧自動化" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialog(false)}>取消</Button>
            <Button onClick={() => saveUnit.mutate()} disabled={!unitTitle.trim()}>
              {editingUnit ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section Dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSection ? "編輯內容區塊" : "新增內容區塊"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>區塊類型</Label>
                <Select value={sectionType} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>排序</Label>
                <Input type="number" value={sectionOrder} onChange={(e) => setSectionOrder(+e.target.value)} />
              </div>
            </div>

            {/* Template hint */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground font-medium mb-1">📝 {typeLabel(sectionType)} JSON 結構說明：</p>
              <p className="text-xs text-muted-foreground">{getTypeHint(sectionType)}</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>內容 JSON</Label>
              <Button
                size="sm"
                variant="ghost"
                className="gap-1 text-xs"
                onClick={() => setPreviewMode(!previewMode)}
              >
                {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {previewMode ? "編輯" : "預覽"}
              </Button>
            </div>

            {previewMode ? (
              <div className="p-4 rounded-xl border border-border bg-background min-h-[120px]">
                {(() => {
                  try {
                    const parsed = JSON.parse(sectionJson);
                    return <ContentRenderer section={{ id: "preview", type: sectionType, content_json: parsed, sort_order: 0 }} />;
                  } catch {
                    return <p className="text-destructive text-sm">JSON 格式錯誤，無法預覽</p>;
                  }
                })()}
              </div>
            ) : (
              <Textarea
                value={sectionJson}
                onChange={(e) => setSectionJson(e.target.value)}
                className="font-mono text-xs min-h-[200px]"
                placeholder='{"title": "...", "body": "..."}'
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(false)}>取消</Button>
            <Button onClick={() => saveSection.mutate()} disabled={!sectionJson.trim()}>
              {editingSection ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Helpers =====
function getDefaultJson(type: string): Record<string, unknown> {
  switch (type) {
    case "text":
      return { title: "", body: "" };
    case "card_grid":
      return { title: "", cards: [{ icon: "📌", title: "卡片標題", desc: "說明文字", note: "" }] };
    case "highlight":
      return { title: "", body: "", link_url: "", link_text: "" };
    case "list":
      return { title: "", items: ["項目一", "項目二"], ordered: false };
    case "bordered_list":
      return { title: "", items: [{ title: "標題", desc: "說明", color: "primary" }] };
    case "flow":
      return { title: "", steps: [{ label: "步驟一", sub: "" }, { label: "步驟二", sub: "" }] };
    case "link":
      return { text: "連結文字", url: "https://", icon: "🔗" };
    case "image":
      return { url: "", alt: "", caption: "" };
    default:
      return {};
  }
}

function getTypeHint(type: string): string {
  switch (type) {
    case "text":
      return '{ "title": "標題", "subtitle": "副標題(選填)", "body": "內文" }';
    case "card_grid":
      return '{ "title": "區塊標題", "cards": [{ "icon": "emoji", "title": "卡片標題", "desc": "說明", "note": "備註" }] }';
    case "highlight":
      return '{ "title": "標題", "body": "內文", "link_url": "連結(選填)", "link_text": "連結文字(選填)" }';
    case "list":
      return '{ "title": "標題", "items": ["項目1", "項目2"], "ordered": false }';
    case "bordered_list":
      return '{ "title": "標題", "items": [{ "title": "小標", "desc": "說明", "color": "primary|accent" }] }';
    case "flow":
      return '{ "title": "標題", "steps": [{ "label": "步驟名", "sub": "補充" }] }';
    case "link":
      return '{ "text": "顯示文字", "url": "https://...", "icon": "emoji" }';
    case "image":
      return '{ "url": "圖片網址", "alt": "替代文字", "caption": "圖說" }';
    default:
      return "{}";
  }
}
