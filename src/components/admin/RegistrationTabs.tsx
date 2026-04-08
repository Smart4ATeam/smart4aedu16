import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Search, FileText, Eye, Pencil, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { categoryLabels } from "@/lib/category-colors";

// ── Types ──
type RegOrder = {
  id: string; order_no: string; course_ids: string[]; course_snapshot: any;
  p1_name: string | null; p1_phone: string | null; p1_email: string | null;
  p2_name: string | null; p2_phone: string | null; p2_email: string | null;
  p3_name: string | null; p3_phone: string | null; p3_email: string | null;
  payment_status: string; paid_at: string | null; payment_method: string | null;
  total_amount: number; discount_plan: string | null;
  invoice_type: string | null; invoice_title: string | null; invoice_number: string | null;
  invoice_status: string; invoice_void_reason: string | null; invoice_void_at: string | null;
  invoice_reissued_number: string | null; invoice_reissued_at: string | null;
  invoice_date: string | null;
  dealer_id: string | null; notes: string | null; created_at: string;
  session_dates: string[]; is_retrain: boolean; referrer: string | null;
  person_count: number; tax_id: string | null;
};

type RegEnrollment = {
  id: string; order_id: string | null; member_id: string | null; course_id: string | null;
  course_type: string | null; status: string; payment_status: string | null;
  paid_at: string | null; invoice_title: string | null;
  dealer_id: string | null; referrer: string | null; checked_in: boolean;
  post_survey: string | null; post_test: string | null; test_score: number | null;
  certificate: string | null; pre_notification_sent: boolean;
  points_awarded: number; lovable_invite: string | null; notes: string | null;
  enrolled_at: string; session_date: string | null;
  reg_members?: { id: string; member_no: string | null; name: string; phone: string | null; email: string | null } | null;
  courses?: { id: string; course_code: string | null; title: string; category: string } | null;
};

type RegCourse = {
  id: string; course_code: string | null; title: string; category: string;
};

type SortDir = "asc" | "desc" | null;
type SortState = { key: string; dir: SortDir };

// ── Helpers ──
function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    enrolled: { label: "已報名", variant: "default" },
    completed: { label: "已完課", variant: "secondary" },
    cancelled: { label: "已取消", variant: "destructive" },
    no_show: { label: "未到課", variant: "destructive" },
    attended: { label: "已出席", variant: "default" },
    absent: { label: "缺席", variant: "destructive" },
    transferred: { label: "已轉班", variant: "secondary" },
  };
  const m = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={m.variant} className="text-[10px] px-1.5 py-0">{m.label}</Badge>;
}

function paymentBadge(status: string) {
  return status === "paid"
    ? <Badge variant="default" className="text-[10px] px-1.5 py-0">已付款</Badge>
    : <Badge variant="secondary" className="text-[10px] px-1.5 py-0">未付款</Badge>;
}

function invoiceBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
    active: { label: "有效", variant: "default" },
    voided: { label: "已作廢", variant: "destructive" },
    reissued: { label: "已重開", variant: "secondary" },
  };
  const m = map[status] || { label: status, variant: "default" as const };
  return <Badge variant={m.variant} className="text-[10px] px-1.5 py-0">{m.label}</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-TW");
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
  return dir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
}

function SortableHead({ label, sortKey, sort, onSort, className }: { label: string; sortKey: string; sort: SortState; onSort: (k: string) => void; className?: string }) {
  return (
    <TableHead className={`cursor-pointer select-none whitespace-nowrap text-xs ${className || ""}`} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center">{label}<SortIcon active={sort.key === sortKey} dir={sort.key === sortKey ? sort.dir : null} /></span>
    </TableHead>
  );
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort.key !== key) return { key, dir: "asc" };
  if (sort.dir === "asc") return { key, dir: "desc" };
  return { key: "", dir: null };
}

function PageSizeSelector({ pageSize, setPageSize }: { pageSize: number; setPageSize: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">每頁</span>
      <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
        <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="20">20</SelectItem>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
          <SelectItem value="200">200</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">筆</span>
    </div>
  );
}

function Pagination({ page, setPage, totalPages, total }: { page: number; setPage: (n: number) => void; totalPages: number; total: number }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground">共 {total} 筆，第 {page}/{totalPages} 頁</span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Main exported component
// ═══════════════════════════════════════
export function RegistrationTabs() {
  const [mainTab, setMainTab] = useState("orders");

  return (
    <div className="space-y-4">
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="orders" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />訂單</TabsTrigger>
          <TabsTrigger value="enrollments" className="gap-1.5 text-xs"><ClipboardList className="w-3.5 h-3.5" />報名明細</TabsTrigger>
        </TabsList>

        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="enrollments"><EnrollmentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════
// Orders Tab
// ═══════════════════════════════════════
function OrdersTab() {
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<RegOrder | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "created_at", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [editInvoiceStatus, setEditInvoiceStatus] = useState("");
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editReason, setEditReason] = useState("");

  const openOrderDetail = (o: RegOrder) => {
    setSelectedOrder(o);
    setEditInvoiceStatus(o.invoice_status);
    setEditInvoiceNumber(o.invoice_number || "");
    setEditReason("");
  };

  const invoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error("無訂單");
      if (!editReason.trim()) throw new Error("請填寫變更原因");

      const updates: Record<string, any> = { invoice_status: editInvoiceStatus };
      if (editInvoiceStatus === "voided") {
        updates.invoice_void_reason = editReason;
        updates.invoice_void_at = new Date().toISOString();
      } else if (editInvoiceStatus === "reissued") {
        updates.invoice_reissued_number = editInvoiceNumber;
        updates.invoice_reissued_at = new Date().toISOString();
      }
      if (editInvoiceNumber !== (selectedOrder.invoice_number || "")) {
        updates.invoice_number = editInvoiceNumber || null;
      }

      const { error } = await supabase.from("reg_orders" as any).update(updates as any).eq("id", selectedOrder.id);
      if (error) throw error;

      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "order", entity_id: selectedOrder.id, action: "update_invoice",
        old_value: { invoice_status: selectedOrder.invoice_status, invoice_number: selectedOrder.invoice_number },
        new_value: updates,
        reason: editReason, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => { toast.success("發票已更新"); queryClient.invalidateQueries({ queryKey: ["reg-orders"] }); setSelectedOrder(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["reg-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_orders" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RegOrder[];
    },
  });

  const filtered = orders.filter(o =>
    !search || o.order_no?.toLowerCase().includes(search.toLowerCase()) ||
    o.p1_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.p1_email?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return filtered;
    const arr = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va = "", vb = "";
      switch (sort.key) {
        case "order_no": va = a.order_no || ""; vb = b.order_no || ""; break;
        case "p1_name": va = a.p1_name || ""; vb = b.p1_name || ""; break;
        case "total_amount": return (Number(a.total_amount) - Number(b.total_amount)) * dir;
        case "payment_status": va = a.payment_status || ""; vb = b.payment_status || ""; break;
        case "paid_at": va = a.paid_at || ""; vb = b.paid_at || ""; break;
        case "invoice_status": va = a.invoice_status || ""; vb = b.invoice_status || ""; break;
        case "created_at": va = a.created_at || ""; vb = b.created_at || ""; break;
        default: return 0;
      }
      return va.localeCompare(vb) * dir;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const onSort = (key: string) => { setSort(s => toggleSort(s, key)); setPage(1); };

  const hasInvoiceChanges = selectedOrder && (
    editInvoiceStatus !== selectedOrder.invoice_status ||
    editInvoiceNumber !== (selectedOrder.invoice_number || "")
  );

  // Parse course_snapshot for order detail
  const getOrderCourses = (order: RegOrder) => {
    const snap = order.course_snapshot;
    if (!snap) return [];
    if (Array.isArray(snap)) return snap;
    if (typeof snap === "object") return Object.values(snap);
    return [];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜尋訂單編號、姓名、信箱..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
        </div>
        <PageSizeSelector pageSize={pageSize} setPageSize={n => { setPageSize(n); setPage(1); }} />
        <Badge variant="outline">{filtered.length} 筆訂單</Badge>
      </div>

      <div className="glass-card overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <SortableHead label="訂單編號" sortKey="order_no" sort={sort} onSort={onSort} className="min-w-[10rem]" />
              <SortableHead label="報名人" sortKey="p1_name" sort={sort} onSort={onSort} className="min-w-[5rem]" />
              <SortableHead label="金額" sortKey="total_amount" sort={sort} onSort={onSort} />
              <SortableHead label="付款狀態" sortKey="payment_status" sort={sort} onSort={onSort} />
              <TableHead className="whitespace-nowrap text-xs">付款方式</TableHead>
              <SortableHead label="付款日期" sortKey="paid_at" sort={sort} onSort={onSort} />
              <TableHead className="whitespace-nowrap text-xs">優惠方案</TableHead>
              <SortableHead label="發票狀態" sortKey="invoice_status" sort={sort} onSort={onSort} />
              <TableHead className="whitespace-nowrap text-xs">發票號碼</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票類型</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票抬頭</TableHead>
              <TableHead className="whitespace-nowrap text-xs">經銷商</TableHead>
              <SortableHead label="建立日期" sortKey="created_at" sort={sort} onSort={onSort} />
              <TableHead className="whitespace-nowrap text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">尚無訂單資料</TableCell></TableRow>
            ) : paged.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_no}</TableCell>
                <TableCell>
                  <div className="text-sm">{o.p1_name || "—"}</div>
                  {o.p2_name && <div className="text-xs text-muted-foreground">{o.p2_name}{o.p3_name ? `, ${o.p3_name}` : ""}</div>}
                </TableCell>
                <TableCell className="text-sm">NT${Number(o.total_amount).toLocaleString()}</TableCell>
                <TableCell>{paymentBadge(o.payment_status)}</TableCell>
                <TableCell className="text-xs">{o.payment_method || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(o.paid_at)}</TableCell>
                <TableCell className="text-xs">{o.discount_plan || "—"}</TableCell>
                <TableCell>{invoiceBadge(o.invoice_status)}</TableCell>
                <TableCell className="text-xs font-mono">{o.invoice_number || "—"}</TableCell>
                <TableCell className="text-xs">{o.invoice_type || "—"}</TableCell>
                <TableCell className="text-xs">{o.invoice_title || "—"}</TableCell>
                <TableCell className="text-xs">{o.dealer_id || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(o.created_at)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openOrderDetail(o)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={safePage} setPage={setPage} totalPages={totalPages} total={filtered.length} />

      {/* Order Detail + Invoice Edit Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={v => { if (!v) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>訂單詳情</DialogTitle>
            <DialogDescription>{selectedOrder?.order_no}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">金額：</span>NT${Number(selectedOrder.total_amount).toLocaleString()}</div>
                <div><span className="text-muted-foreground">折扣方案：</span>{selectedOrder.discount_plan || "—"}</div>
                <div><span className="text-muted-foreground">付款方式：</span>{selectedOrder.payment_method || "—"}</div>
                <div><span className="text-muted-foreground">付款狀態：</span>{paymentBadge(selectedOrder.payment_status)}</div>
                <div><span className="text-muted-foreground">經銷商：</span>{selectedOrder.dealer_id || "—"}</div>
                <div><span className="text-muted-foreground">發票抬頭：</span>{selectedOrder.invoice_title || "—"}</div>
                <div><span className="text-muted-foreground">統一編號：</span>{selectedOrder.tax_id || "—"}</div>
                <div><span className="text-muted-foreground">報名人數：</span>{selectedOrder.person_count || "—"}</div>
                <div><span className="text-muted-foreground">推薦人：</span>{selectedOrder.referrer || "—"}</div>
                <div><span className="text-muted-foreground">複訓：</span>{selectedOrder.is_retrain ? "是" : "否"}</div>
              </div>

              {/* 報名人員 - 完整顯示所有人的聯絡資訊 */}
              <div className="border-t border-border pt-2">
                <p className="text-xs font-medium mb-1">報名人員</p>
                {[
                  { name: selectedOrder.p1_name, phone: selectedOrder.p1_phone, email: selectedOrder.p1_email },
                  { name: selectedOrder.p2_name, phone: selectedOrder.p2_phone, email: selectedOrder.p2_email },
                  { name: selectedOrder.p3_name, phone: selectedOrder.p3_phone, email: selectedOrder.p3_email },
                ].filter(p => p.name).map((p, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    P{i + 1}: {p.name}
                    {p.phone ? ` / ${p.phone}` : ""}
                    {p.email ? ` / ${p.email}` : ""}
                  </div>
                ))}
              </div>

              {/* 報名課程 */}
              {(() => {
                const courses = getOrderCourses(selectedOrder);
                const dates = selectedOrder.session_dates || [];
                if (courses.length === 0 && dates.length === 0) return null;
                return (
                  <div className="border-t border-border pt-2">
                    <p className="text-xs font-medium mb-1">報名課程</p>
                    {courses.length > 0 ? courses.map((c: any, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground flex justify-between py-0.5">
                        <span>{c.course_name || c.title || c.course_code || `課程 ${i + 1}`}</span>
                        <span className="flex gap-3">
                          {dates[i] && <span>📅 {dates[i]}</span>}
                          {c.price != null && <span>NT${Number(c.price).toLocaleString()}</span>}
                        </span>
                      </div>
                    )) : dates.map((d: string, i: number) => (
                      <div key={i} className="text-xs text-muted-foreground py-0.5">📅 {d}</div>
                    ))}
                  </div>
                );
              })()}

              {selectedOrder.notes && (
                <div className="border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Invoice Edit Section */}
              <div className="border-t border-border pt-3 space-y-3">
                <p className="text-xs font-medium">發票管理</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">發票狀態</label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={editInvoiceStatus}
                      onChange={e => setEditInvoiceStatus(e.target.value)}
                    >
                      <option value="pending">待開立</option>
                      <option value="active">有效</option>
                      <option value="voided">已作廢</option>
                      <option value="reissued">已重開</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">發票號碼</label>
                    <Input value={editInvoiceNumber} onChange={e => setEditInvoiceNumber(e.target.value)} placeholder="輸入發票號碼" className="h-9" />
                  </div>
                </div>
                {hasInvoiceChanges && (
                  <div className="space-y-2">
                    <Textarea placeholder="變更原因（必填）" value={editReason} onChange={e => setEditReason(e.target.value)} className="h-16" />
                    <Button size="sm" onClick={() => invoiceMutation.mutate()} disabled={invoiceMutation.isPending || !editReason.trim()}>
                      儲存發票變更
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════
// Enrollments Tab
// ═══════════════════════════════════════
function EnrollmentsTab() {
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "", dir: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingEnroll, setEditingEnroll] = useState<RegEnrollment | null>(null);
  const [editSessionDate, setEditSessionDate] = useState("");
  const [editReason, setEditReason] = useState("");
  const [cancellingEnroll, setCancellingEnroll] = useState<RegEnrollment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: regCourses = [] } = useQuery({
    queryKey: ["reg-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, course_code, title, category")
        .eq("status", "published")
        .order("category")
        .order("title");
      if (error) throw error;
      return (data || []) as unknown as RegCourse[];
    },
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["reg-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_enrollments" as any)
        .select("*, reg_members(id, member_no, name, phone, email), courses(id, course_code, title, category)")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RegEnrollment[];
    },
  });

  // Extract unique session dates for filter
  const uniqueDates = useMemo(() => {
    const dates = new Set<string>();
    enrollments.forEach(e => { if (e.session_date) dates.add(e.session_date); });
    return [...dates].sort();
  }, [enrollments]);

  const sessionDateMutation = useMutation({
    mutationFn: async () => {
      if (!editingEnroll) throw new Error("無資料");
      if (!editReason.trim()) throw new Error("請填寫變更原因");
      const { error } = await supabase.from("reg_enrollments" as any)
        .update({ session_date: editSessionDate || null } as any)
        .eq("id", editingEnroll.id);
      if (error) throw error;
      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "enrollment", entity_id: editingEnroll.id, action: "update_session_date",
        old_value: { session_date: editingEnroll.session_date },
        new_value: { session_date: editSessionDate || null },
        reason: editReason, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => { toast.success("上課日期已更新"); queryClient.invalidateQueries({ queryKey: ["reg-enrollments"] }); queryClient.invalidateQueries({ queryKey: ["admin_session_enrollment_counts"] }); setEditingEnroll(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancellingEnroll) throw new Error("無資料");
      if (!cancelReason.trim()) throw new Error("請填寫取消原因");
      const { error } = await supabase.from("reg_enrollments" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", cancellingEnroll.id);
      if (error) throw error;
      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "enrollment", entity_id: cancellingEnroll.id, action: "cancel",
        old_value: { status: cancellingEnroll.status, payment_status: cancellingEnroll.payment_status },
        new_value: { status: "cancelled" },
        reason: cancelReason, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => { toast.success("已取消報名"); queryClient.invalidateQueries({ queryKey: ["reg-enrollments"] }); queryClient.invalidateQueries({ queryKey: ["admin_session_enrollment_counts"] }); queryClient.invalidateQueries({ queryKey: ["admin_enrollment_count"] }); setCancellingEnroll(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEditDate = (e: RegEnrollment) => {
    setEditingEnroll(e);
    setEditSessionDate(e.session_date || "");
    setEditReason("");
  };

  const openCancel = (e: RegEnrollment) => {
    setCancellingEnroll(e);
    setCancelReason("");
  };

  const filtered = enrollments.filter(e => {
    if (selectedCourse !== "all" && e.course_id !== selectedCourse) return false;
    if (selectedDate !== "all" && e.session_date !== selectedDate) return false;
    if (search) {
      const s = search.toLowerCase();
      const memberName = (e.reg_members as any)?.name?.toLowerCase() || "";
      const memberNo = (e.reg_members as any)?.member_no?.toLowerCase() || "";
      const courseName = (e.courses as any)?.title?.toLowerCase() || "";
      const memberEmail = (e.reg_members as any)?.email?.toLowerCase() || "";
      const memberPhone = (e.reg_members as any)?.phone || "";
      if (!memberName.includes(s) && !memberNo.includes(s) && !courseName.includes(s) && !memberEmail.includes(s) && !memberPhone.includes(s)) return false;
    }
    return true;
  });

  const sorted = useMemo(() => {
    if (!sort.key || !sort.dir) return filtered;
    const arr = [...filtered];
    const dir = sort.dir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      let va = "", vb = "";
      switch (sort.key) {
        case "member_name": va = a.reg_members?.name || ""; vb = b.reg_members?.name || ""; break;
        case "course_title": va = a.courses?.title || ""; vb = b.courses?.title || ""; break;
        case "session_date": va = a.session_date || ""; vb = b.session_date || ""; break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
        case "payment_status": va = a.payment_status || ""; vb = b.payment_status || ""; break;
        case "paid_at": va = a.paid_at || ""; vb = b.paid_at || ""; break;
        case "enrolled_at": va = a.enrolled_at || ""; vb = b.enrolled_at || ""; break;
        default: return 0;
      }
      return va.localeCompare(vb) * dir;
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const onSort = (key: string) => { setSort(s => toggleSort(s, key)); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={selectedCourse} onValueChange={v => { setSelectedCourse(v); setPage(1); }}>
          <TabsList className="flex-wrap h-auto gap-0.5">
            <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
            {regCourses.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs">
                {c.title}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={selectedDate} onValueChange={v => { setSelectedDate(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="篩選上課日期" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部日期</SelectItem>
            {uniqueDates.map(d => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜尋學員、課程、信箱、電話..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9" />
        </div>
        <PageSizeSelector pageSize={pageSize} setPageSize={n => { setPageSize(n); setPage(1); }} />
        <Badge variant="outline">{filtered.length} 筆</Badge>
      </div>

      <div className="glass-card overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-card z-10">
            <TableRow>
              <SortableHead label="學員" sortKey="member_name" sort={sort} onSort={onSort} />
              <TableHead className="whitespace-nowrap text-xs">電話</TableHead>
              <TableHead className="whitespace-nowrap text-xs">信箱</TableHead>
              <SortableHead label="課程" sortKey="course_title" sort={sort} onSort={onSort} />
              <SortableHead label="上課日期" sortKey="session_date" sort={sort} onSort={onSort} className="w-28" />
              <SortableHead label="狀態" sortKey="status" sort={sort} onSort={onSort} className="w-20" />
              <SortableHead label="付款" sortKey="payment_status" sort={sort} onSort={onSort} className="w-20" />
              <TableHead className="w-16 whitespace-nowrap text-xs">出席</TableHead>
              <TableHead className="w-16 whitespace-nowrap text-xs">測驗</TableHead>
              <TableHead className="w-16 whitespace-nowrap text-xs">證書</TableHead>
              <SortableHead label="繳費日期" sortKey="paid_at" sort={sort} onSort={onSort} className="w-28" />
              <TableHead className="whitespace-nowrap text-xs">備註</TableHead>
              <TableHead className="w-16 whitespace-nowrap text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : paged.length === 0 ? (
              <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">尚無報名資料</TableCell></TableRow>
            ) : paged.map(e => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{(e.reg_members as any)?.name || "—"}</span>
                    {e.is_retrain && <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-400 text-orange-600 dark:text-orange-400">複訓</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{(e.reg_members as any)?.member_no || ""}</div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{(e.reg_members as any)?.phone || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[10rem] truncate">{(e.reg_members as any)?.email || "—"}</TableCell>
                <TableCell>
                  <div className="text-sm">{(e.courses as any)?.title || "—"}</div>
                  <div className="text-xs text-muted-foreground">{categoryLabels[e.course_type || ""] || e.course_type}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{e.session_date || "—"}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditDate(e)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{statusBadge(e.status)}</TableCell>
                <TableCell>{e.payment_status ? paymentBadge(e.payment_status) : "—"}</TableCell>
                <TableCell className="text-center">{e.checked_in ? "✅" : "—"}</TableCell>
                <TableCell className="text-center text-xs">{e.test_score != null ? e.test_score : "—"}</TableCell>
                <TableCell className="text-center">{e.certificate ? "✅" : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.paid_at ? formatDate(e.paid_at) : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[8rem] truncate" title={e.notes || ""}>{e.notes || "—"}</TableCell>
                <TableCell>
                  {e.status !== "cancelled" && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => openCancel(e)} title="取消報名">
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={safePage} setPage={setPage} totalPages={totalPages} total={filtered.length} />

      {/* Edit Session Date Dialog */}
      <Dialog open={!!editingEnroll} onOpenChange={v => { if (!v) setEditingEnroll(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>修改上課日期</DialogTitle>
            <DialogDescription>
              學員：{(editingEnroll?.reg_members as any)?.name || "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">上課日期</label>
              <Input value={editSessionDate} onChange={e => setEditSessionDate(e.target.value)} placeholder="例：2025/05/17-05/18" className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">變更原因（必填）</label>
              <Textarea placeholder="例：轉班至 6 月梯次" value={editReason} onChange={e => setEditReason(e.target.value)} className="h-16" />
            </div>
            <Button size="sm" onClick={() => sessionDateMutation.mutate()} disabled={sessionDateMutation.isPending || !editReason.trim()}>
              儲存變更
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Enrollment Dialog */}
      <Dialog open={!!cancellingEnroll} onOpenChange={v => { if (!v) setCancellingEnroll(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">取消報名</DialogTitle>
            <DialogDescription>
              確定要取消 {(cancellingEnroll?.reg_members as any)?.name || "—"} 的報名嗎？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-destructive/10 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">課程：</span>{(cancellingEnroll?.courses as any)?.title || "—"}</div>
              <div><span className="text-muted-foreground">上課日期：</span>{cancellingEnroll?.session_date || "—"}</div>
              <div><span className="text-muted-foreground">付款狀態：</span>{cancellingEnroll?.payment_status === "paid" ? "已付款" : "未付款"}</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">取消原因（必填）</label>
              <Textarea placeholder="例：學員申請退費取消" value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="h-16" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setCancellingEnroll(null)}>返回</Button>
              <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || !cancelReason.trim()}>
                確認取消報名
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
