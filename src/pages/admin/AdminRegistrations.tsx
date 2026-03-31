import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList, Search, CreditCard, FileText,
  Eye, RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { categoryLabels } from "@/lib/category-colors";

// ── Types ──
type RegOrder = {
  id: string; order_no: string; course_ids: string[]; course_snapshot: any;
  p1_name: string | null; p1_phone: string | null; p1_email: string | null;
  p2_name: string | null; p3_name: string | null;
  payment_status: string; paid_at: string | null; payment_method: string | null;
  total_amount: number; discount_plan: string | null;
  invoice_type: string | null; invoice_title: string | null; invoice_number: string | null;
  invoice_status: string; invoice_void_reason: string | null; invoice_void_at: string | null;
  invoice_reissued_number: string | null; invoice_reissued_at: string | null;
  dealer_id: string | null; notes: string | null; created_at: string;
};

type RegEnrollment = {
  id: string; order_id: string | null; member_id: string | null; course_id: string | null;
  course_type: string | null; status: string; payment_status: string | null;
  paid_at: string | null; invoice_title: string | null;
  dealer_id: string | null; referrer: string | null; checked_in: boolean;
  post_survey: string | null; post_test: string | null; test_score: number | null;
  certificate: string | null; pre_notification_sent: boolean;
  points_awarded: number; lovable_invite: string | null; notes: string | null;
  enrolled_at: string;
  reg_members?: { id: string; member_no: string | null; name: string; phone: string | null; email: string | null } | null;
  reg_courses?: { id: string; course_code: string; course_name: string; course_type: string } | null;
};

type RegCourse = {
  id: string; course_code: string; course_name: string; course_type: string;
};

// ── Helpers ──
function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    enrolled: { label: "已報名", variant: "default" },
    attended: { label: "已出席", variant: "default" },
    absent: { label: "缺席", variant: "destructive" },
    transferred: { label: "已轉班", variant: "secondary" },
  };
  const m = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function paymentBadge(status: string) {
  return status === "paid"
    ? <Badge variant="default">已付款</Badge>
    : <Badge variant="secondary">未付款</Badge>;
}

function invoiceBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
    active: { label: "有效", variant: "default" },
    voided: { label: "已作廢", variant: "destructive" },
    reissued: { label: "已重開", variant: "secondary" },
  };
  const m = map[status] || { label: status, variant: "default" as const };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("zh-TW");
}

// ═══════════════════════════════════════
// Main Page
// ═══════════════════════════════════════
export default function AdminRegistrations() {
  const [mainTab, setMainTab] = useState("orders");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<ClipboardList className="w-6 h-6" />}
        title="報名管理"
        description="管理課程報名訂單與報名明細"
      />

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
  const [invoiceDialog, setInvoiceDialog] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜尋訂單編號、姓名、信箱..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Badge variant="outline">{filtered.length} 筆訂單</Badge>
      </div>

      <div className="glass-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[10rem] whitespace-nowrap text-xs">訂單編號</TableHead>
              <TableHead className="min-w-[5rem] whitespace-nowrap text-xs">報名人</TableHead>
              <TableHead className="whitespace-nowrap text-xs">金額</TableHead>
              <TableHead className="whitespace-nowrap text-xs">付款狀態</TableHead>
              <TableHead className="whitespace-nowrap text-xs">付款方式</TableHead>
              <TableHead className="whitespace-nowrap text-xs">付款日期</TableHead>
              <TableHead className="whitespace-nowrap text-xs">優惠方案</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票狀態</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票號碼</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票類型</TableHead>
              <TableHead className="whitespace-nowrap text-xs">發票抬頭</TableHead>
              <TableHead className="whitespace-nowrap text-xs">經銷商</TableHead>
              <TableHead className="whitespace-nowrap text-xs">建立日期</TableHead>
              <TableHead className="whitespace-nowrap text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">尚無訂單資料</TableCell></TableRow>
            ) : filtered.map(o => (
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
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedOrder(o)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedOrder(o); setInvoiceDialog(true); }}>
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder && !invoiceDialog} onOpenChange={v => { if (!v) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>訂單詳情</DialogTitle>
            <DialogDescription>{selectedOrder?.order_no}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">金額：</span>NT${Number(selectedOrder.total_amount).toLocaleString()}</div>
                <div><span className="text-muted-foreground">折扣方案：</span>{selectedOrder.discount_plan || "—"}</div>
                <div><span className="text-muted-foreground">付款方式：</span>{selectedOrder.payment_method || "—"}</div>
                <div><span className="text-muted-foreground">付款狀態：</span>{paymentBadge(selectedOrder.payment_status)}</div>
                <div><span className="text-muted-foreground">經銷商：</span>{selectedOrder.dealer_id || "—"}</div>
                <div><span className="text-muted-foreground">發票抬頭：</span>{selectedOrder.invoice_title || "—"}</div>
                <div><span className="text-muted-foreground">發票號碼：</span>{selectedOrder.invoice_number || "—"}</div>
                <div><span className="text-muted-foreground">發票狀態：</span>{invoiceBadge(selectedOrder.invoice_status)}</div>
              </div>
              <div className="border-t border-border pt-2">
                <p className="text-xs font-medium mb-1">報名人員</p>
                {[
                  { name: selectedOrder.p1_name, phone: selectedOrder.p1_phone, email: selectedOrder.p1_email },
                  { name: selectedOrder.p2_name },
                  { name: selectedOrder.p3_name },
                ].filter(p => p.name).map((p, i) => (
                  <div key={i} className="text-xs text-muted-foreground">P{i + 1}: {p.name} {('phone' in p && p.phone) ? `/ ${p.phone}` : ""} {('email' in p && p.email) ? `/ ${p.email}` : ""}</div>
                ))}
              </div>
              {selectedOrder.notes && (
                <div className="border-t border-border pt-2">
                  <p className="text-xs text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Management Dialog */}
      {selectedOrder && (
        <InvoiceDialog
          open={invoiceDialog}
          onOpenChange={v => { setInvoiceDialog(v); if (!v) setSelectedOrder(null); }}
          order={selectedOrder}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Invoice Dialog
// ═══════════════════════════════════════
function InvoiceDialog({ open, onOpenChange, order }: { open: boolean; onOpenChange: (v: boolean) => void; order: RegOrder }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [voidReason, setVoidReason] = useState("");
  const [reissuedNumber, setReissuedNumber] = useState("");

  const voidMutation = useMutation({
    mutationFn: async () => {
      if (!voidReason.trim()) throw new Error("請填寫作廢原因");
      const { error } = await supabase.from("reg_orders" as any).update({
        invoice_status: "voided",
        invoice_void_reason: voidReason,
        invoice_void_at: new Date().toISOString(),
      } as any).eq("id", order.id);
      if (error) throw error;
      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "order", entity_id: order.id, action: "void_invoice",
        old_value: { invoice_status: order.invoice_status, invoice_number: order.invoice_number },
        new_value: { invoice_status: "voided", void_reason: voidReason },
        reason: voidReason, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => { toast.success("發票已作廢"); queryClient.invalidateQueries({ queryKey: ["reg-orders"] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reissueMutation = useMutation({
    mutationFn: async () => {
      if (!reissuedNumber.trim()) throw new Error("請填寫新發票號碼");
      const { error } = await supabase.from("reg_orders" as any).update({
        invoice_status: "reissued",
        invoice_reissued_number: reissuedNumber,
        invoice_reissued_at: new Date().toISOString(),
      } as any).eq("id", order.id);
      if (error) throw error;
      await supabase.from("reg_operation_logs" as any).insert({
        entity_type: "order", entity_id: order.id, action: "reissue_invoice",
        old_value: { invoice_status: order.invoice_status },
        new_value: { invoice_status: "reissued", reissued_number: reissuedNumber },
        reason: `重開發票：${reissuedNumber}`, operated_by: user?.id,
      } as any);
    },
    onSuccess: () => { toast.success("發票已重開"); queryClient.invalidateQueries({ queryKey: ["reg-orders"] }); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>發票管理</DialogTitle>
          <DialogDescription>訂單 {order.order_no} — 目前狀態：{invoiceBadge(order.invoice_status)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">發票號碼：</span>{order.invoice_number || "—"}</div>
            <div><span className="text-muted-foreground">發票抬頭：</span>{order.invoice_title || "—"}</div>
            {order.invoice_status === "voided" && (
              <div><span className="text-muted-foreground">作廢原因：</span>{order.invoice_void_reason}</div>
            )}
            {order.invoice_status === "reissued" && (
              <div><span className="text-muted-foreground">新發票號碼：</span>{order.invoice_reissued_number}</div>
            )}
          </div>

          {order.invoice_status === "active" && (
            <div className="space-y-2">
              <p className="text-xs font-medium">作廢發票</p>
              <Textarea placeholder="作廢原因（必填）" value={voidReason} onChange={e => setVoidReason(e.target.value)} className="h-20" />
              <Button variant="destructive" size="sm" onClick={() => voidMutation.mutate()} disabled={voidMutation.isPending}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />作廢
              </Button>
            </div>
          )}

          {order.invoice_status === "voided" && (
            <div className="space-y-2">
              <p className="text-xs font-medium">重開發票</p>
              <Input placeholder="新發票號碼" value={reissuedNumber} onChange={e => setReissuedNumber(e.target.value)} />
              <Button size="sm" onClick={() => reissueMutation.mutate()} disabled={reissueMutation.isPending}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />重開發票
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════
// Enrollments Tab (with dynamic course sub-tabs)
// ═══════════════════════════════════════
function EnrollmentsTab() {
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [search, setSearch] = useState("");

  const { data: regCourses = [] } = useQuery({
    queryKey: ["reg-courses-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_courses" as any)
        .select("id, course_code, course_name, course_type")
        .eq("status", "active")
        .order("course_type")
        .order("course_name");
      if (error) throw error;
      return (data || []) as unknown as RegCourse[];
    },
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["reg-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reg_enrollments" as any)
        .select("*, reg_members(id, member_no, name, phone, email), reg_courses(id, course_code, course_name, course_type)")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RegEnrollment[];
    },
  });

  const filtered = enrollments.filter(e => {
    if (selectedCourse !== "all" && e.course_id !== selectedCourse) return false;
    if (search) {
      const s = search.toLowerCase();
      const memberName = (e.reg_members as any)?.name?.toLowerCase() || "";
      const memberNo = (e.reg_members as any)?.member_no?.toLowerCase() || "";
      const courseName = (e.reg_courses as any)?.course_name?.toLowerCase() || "";
      if (!memberName.includes(s) && !memberNo.includes(s) && !courseName.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={selectedCourse} onValueChange={setSelectedCourse}>
          <TabsList className="flex-wrap h-auto gap-0.5">
            <TabsTrigger value="all" className="text-xs">全部</TabsTrigger>
            {regCourses.map(c => (
              <TabsTrigger key={c.id} value={c.id} className="text-xs">
                {c.course_name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="搜尋學員、課程..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Badge variant="outline">{filtered.length} 筆</Badge>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>學員</TableHead>
              <TableHead>課程</TableHead>
              <TableHead className="w-20">狀態</TableHead>
              <TableHead className="w-20">付款</TableHead>
              <TableHead className="w-16">出席</TableHead>
              <TableHead className="w-16">測驗</TableHead>
              <TableHead className="w-16">證書</TableHead>
              <TableHead className="w-28">報名日期</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">載入中...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">尚無報名資料</TableCell></TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="text-sm font-medium">{(e.reg_members as any)?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{(e.reg_members as any)?.member_no || ""}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{(e.reg_courses as any)?.course_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{categoryLabels[e.course_type || ""] || e.course_type}</div>
                </TableCell>
                <TableCell>{statusBadge(e.status)}</TableCell>
                <TableCell>{e.payment_status ? paymentBadge(e.payment_status) : "—"}</TableCell>
                <TableCell className="text-center">{e.checked_in ? "✅" : "—"}</TableCell>
                <TableCell className="text-center text-xs">{e.test_score != null ? e.test_score : "—"}</TableCell>
                <TableCell className="text-center">{e.certificate ? "✅" : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(e.enrolled_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
