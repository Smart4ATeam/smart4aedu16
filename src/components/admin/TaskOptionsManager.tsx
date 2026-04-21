import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTaskOptions, type TaskDifficulty, type TaskCategory } from "@/hooks/useTaskOptions";

const TaskOptionsManager = () => {
  const { difficulties, categories, refetch, loading } = useTaskOptions();

  // 新增等級
  const [newDiffLabel, setNewDiffLabel] = useState("");
  const [newDiffOrder, setNewDiffOrder] = useState(0);

  // 新增類別
  const [newCatValue, setNewCatValue] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatOrder, setNewCatOrder] = useState(0);

  // 編輯中
  const [editingDiff, setEditingDiff] = useState<TaskDifficulty | null>(null);
  const [editingCat, setEditingCat] = useState<TaskCategory | null>(null);

  const addDifficulty = async () => {
    if (!newDiffLabel.trim()) { toast.error("請填寫等級名稱"); return; }
    const { error } = await supabase.from("task_difficulties").insert({
      label: newDiffLabel.trim(),
      sort_order: newDiffOrder,
    });
    if (error) { toast.error("新增失敗：" + error.message); return; }
    toast.success("已新增等級");
    setNewDiffLabel(""); setNewDiffOrder(0);
    refetch();
  };

  const saveDifficulty = async () => {
    if (!editingDiff) return;
    const { error } = await supabase.from("task_difficulties").update({
      label: editingDiff.label,
      sort_order: editingDiff.sort_order,
      is_active: editingDiff.is_active,
    }).eq("id", editingDiff.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已更新");
    setEditingDiff(null);
    refetch();
  };

  const toggleDifficultyActive = async (d: TaskDifficulty) => {
    const { error } = await supabase.from("task_difficulties")
      .update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    refetch();
  };

  const deleteDifficulty = async (id: string) => {
    if (!confirm("確定刪除此等級？舊任務的等級欄位會保留原字串。")) return;
    const { error } = await supabase.from("task_difficulties").delete().eq("id", id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("已刪除");
    refetch();
  };

  const addCategory = async () => {
    if (!newCatValue.trim() || !newCatLabel.trim()) {
      toast.error("請填寫識別碼與顯示名稱");
      return;
    }
    const { error } = await supabase.from("task_categories").insert({
      value: newCatValue.trim(),
      label: newCatLabel.trim(),
      sort_order: newCatOrder,
    });
    if (error) { toast.error("新增失敗：" + error.message); return; }
    toast.success("已新增類別");
    setNewCatValue(""); setNewCatLabel(""); setNewCatOrder(0);
    refetch();
  };

  const saveCategory = async () => {
    if (!editingCat) return;
    const { error } = await supabase.from("task_categories").update({
      value: editingCat.value,
      label: editingCat.label,
      sort_order: editingCat.sort_order,
      is_active: editingCat.is_active,
    }).eq("id", editingCat.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    toast.success("已更新");
    setEditingCat(null);
    refetch();
  };

  const toggleCategoryActive = async (c: TaskCategory) => {
    const { error } = await supabase.from("task_categories")
      .update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast.error("更新失敗：" + error.message); return; }
    refetch();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("確定刪除此類別？舊任務的類別欄位會保留原字串。")) return;
    const { error } = await supabase.from("task_categories").delete().eq("id", id);
    if (error) { toast.error("刪除失敗：" + error.message); return; }
    toast.success("已刪除");
    refetch();
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">載入中...</div>;
  }

  return (
    <div className="space-y-8">
      {/* 任務等級 */}
      <section className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">任務等級</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            設定發布任務時可選的等級選項。停用後新建任務不再出現，但既有任務不受影響。
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Label className="text-xs">等級名稱</Label>
            <Input
              value={newDiffLabel}
              onChange={(e) => setNewDiffLabel(e.target.value)}
              placeholder="例：中高級"
            />
          </div>
          <div className="w-24">
            <Label className="text-xs">排序</Label>
            <Input
              type="number"
              value={newDiffOrder || ""}
              onChange={(e) => setNewDiffOrder(Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <Button onClick={addDifficulty} className="gap-1"><Plus className="w-4 h-4" />新增</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名稱</TableHead>
              <TableHead className="w-20">排序</TableHead>
              <TableHead className="w-24">啟用</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {difficulties.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm">尚無等級</TableCell></TableRow>
            ) : difficulties.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  {editingDiff?.id === d.id ? (
                    <Input value={editingDiff.label} onChange={(e) => setEditingDiff({ ...editingDiff, label: e.target.value })} />
                  ) : (
                    <span className="font-medium">{d.label}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingDiff?.id === d.id ? (
                    <Input type="number" value={editingDiff.sort_order} onChange={(e) => setEditingDiff({ ...editingDiff, sort_order: Number(e.target.value) })} />
                  ) : d.sort_order}
                </TableCell>
                <TableCell>
                  <Switch checked={d.is_active} onCheckedChange={() => toggleDifficultyActive(d)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {editingDiff?.id === d.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={saveDifficulty}><Check className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingDiff(null)}><X className="w-3.5 h-3.5" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setEditingDiff(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteDifficulty(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* 任務類別 */}
      <section className="glass-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">任務類別</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            類別用於任務分類與篩選。「識別碼」是程式儲存用的英文 key，「顯示名稱」是給管理員與學員看的中文名稱。
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-32">
            <Label className="text-xs">識別碼（英文）</Label>
            <Input value={newCatValue} onChange={(e) => setNewCatValue(e.target.value)} placeholder="例：development" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label className="text-xs">顯示名稱</Label>
            <Input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="例：開發" />
          </div>
          <div className="w-24">
            <Label className="text-xs">排序</Label>
            <Input type="number" value={newCatOrder || ""} onChange={(e) => setNewCatOrder(Number(e.target.value))} placeholder="0" />
          </div>
          <Button onClick={addCategory} className="gap-1"><Plus className="w-4 h-4" />新增</Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>識別碼</TableHead>
              <TableHead>顯示名稱</TableHead>
              <TableHead className="w-20">排序</TableHead>
              <TableHead className="w-24">啟用</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm">尚無類別</TableCell></TableRow>
            ) : categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {editingCat?.id === c.id ? (
                    <Input value={editingCat.value} onChange={(e) => setEditingCat({ ...editingCat, value: e.target.value })} />
                  ) : (
                    <code className="text-xs px-1.5 py-0.5 rounded bg-muted">{c.value}</code>
                  )}
                </TableCell>
                <TableCell>
                  {editingCat?.id === c.id ? (
                    <Input value={editingCat.label} onChange={(e) => setEditingCat({ ...editingCat, label: e.target.value })} />
                  ) : (
                    <span className="font-medium">{c.label}</span>
                  )}
                </TableCell>
                <TableCell>
                  {editingCat?.id === c.id ? (
                    <Input type="number" value={editingCat.sort_order} onChange={(e) => setEditingCat({ ...editingCat, sort_order: Number(e.target.value) })} />
                  ) : c.sort_order}
                </TableCell>
                <TableCell>
                  <Switch checked={c.is_active} onCheckedChange={() => toggleCategoryActive(c)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {editingCat?.id === c.id ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={saveCategory}><Check className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingCat(null)}><X className="w-3.5 h-3.5" /></Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setEditingCat(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteCategory(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
};

export default TaskOptionsManager;
