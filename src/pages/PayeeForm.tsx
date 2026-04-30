import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Wallet, ShieldCheck, FileEdit, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Profile = {
  id: string;
  user_id: string;
  name: string;
  id_number: string;
  phone: string | null;
  email: string | null;
  registered_address: string;
  bank_code: string;
  bank_name: string;
  branch_code: string | null;
  branch_name: string | null;
  account_number: string;
  account_name: string;
  id_card_front_url: string | null;
  id_card_back_url: string | null;
  bankbook_cover_url: string | null;
  id_card_front_cloud_url: string | null;
  id_card_back_cloud_url: string | null;
  bankbook_cover_cloud_url: string | null;
  first_submitted_at: string | null;
  attachments_purged_at: string | null;
};

const empty = {
  name: "",
  id_number: "",
  phone: "",
  email: "",
  registered_address: "",
  bank_code: "",
  bank_name: "",
  branch_code: "",
  branch_name: "",
  account_number: "",
  account_name: "",
};

export default function PayeeForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; webhook_sent_at: string | null } | null>(null);
  const [form, setForm] = useState(empty);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<{ front?: File; back?: File; bankbook?: File }>({});
  const [consent, setConsent] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: p } = await supabase
      .from("payee_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (p) {
      setProfile(p as Profile);
      setForm({
        name: p.name ?? "",
        id_number: p.id_number ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        registered_address: p.registered_address ?? "",
        bank_code: p.bank_code ?? "",
        bank_name: p.bank_name ?? "",
        branch_code: p.branch_code ?? "",
        branch_name: p.branch_name ?? "",
        account_number: p.account_number ?? "",
        account_name: p.account_name ?? "",
      });
    }

    // Look for an in-flight update request
    const { data: upd } = await supabase
      .from("payee_profile_updates")
      .select("id, webhook_sent_at, purged_at")
      .eq("user_id", user.id)
      .is("purged_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingUpdate(upd ? { id: upd.id, webhook_sent_at: upd.webhook_sent_at } : null);

    setLoading(false);
  }

  async function uploadFile(file: File, key: "id_front" | "id_back" | "bankbook"): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user!.id}/${key}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("payee-documents").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  async function handleCreate() {
    if (!user) return;
    if (!consent) return toast.error("請勾選個資使用同意");
    if (!form.name || !form.id_number || !form.registered_address || !form.bank_code || !form.bank_name || !form.account_number || !form.account_name) {
      return toast.error("請完整填寫必填欄位");
    }
    if (!files.front || !files.back || !files.bankbook) {
      return toast.error("請上傳身分證正反面與存摺封面");
    }
    setSaving(true);
    try {
      const [front, back, bb] = await Promise.all([
        uploadFile(files.front, "id_front"),
        uploadFile(files.back, "id_back"),
        uploadFile(files.bankbook, "bankbook"),
      ]);

      const { error } = await supabase.from("payee_profiles").insert({
        user_id: user.id,
        ...form,
        id_card_front_url: front,
        id_card_back_url: back,
        bankbook_cover_url: bb,
        consent_at: new Date().toISOString(),
        last_updated_via: "initial",
      });
      if (error) throw error;

      // Trigger first-time create webhook (sends all 3 attachments)
      const { error: fnErr } = await supabase.functions.invoke("send-payee-create-webhook", {
        body: {},
      });
      if (fnErr) throw fnErr;

      toast.success("收款資料已建立，已通知外部系統進行歸檔");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("建立失敗：" + msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestUpdate() {
    if (!user || !profile) return;
    if (!reason.trim()) return toast.error("請填寫修改原因");
    if (!files.bankbook) return toast.error("修改收款資料必須重新上傳存摺封面");
    setSaving(true);
    try {
      const newBankbook = await uploadFile(files.bankbook, "bankbook");
      const newFront = files.front ? await uploadFile(files.front, "id_front") : null;
      const newBack = files.back ? await uploadFile(files.back, "id_back") : null;

      const oldSnap = { ...profile };
      const newSnap = { ...form };

      const updates = {
        ...form,
        bankbook_cover_url: newBankbook,
        bankbook_cover_cloud_url: null as string | null,
        ...(newFront ? { id_card_front_url: newFront, id_card_front_cloud_url: null as string | null } : {}),
        ...(newBack ? { id_card_back_url: newBack, id_card_back_cloud_url: null as string | null } : {}),
      };

      const { error: upErr } = await supabase
        .from("payee_profiles")
        .update(updates)
        .eq("user_id", user.id);
      if (upErr) throw upErr;

      const { data: updRow, error: insErr } = await supabase
        .from("payee_profile_updates")
        .insert({
          user_id: user.id,
          changed_fields: Object.keys(form),
          old_snapshot: oldSnap,
          new_snapshot: newSnap,
          reason,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Trigger webhook
      const { error: fnErr } = await supabase.functions.invoke("send-payee-update-webhook", {
        body: { update_id: updRow.id },
      });
      if (fnErr) throw fnErr;

      toast.success("修改申請已送出，等待外部歸檔完成");
      setEditing(false);
      setReason("");
      setFiles({});
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("送出失敗：" + msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ===== State 1: empty / first time =====
  if (!profile) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <PageHeader icon={<Wallet className="w-6 h-6" />} title="收款資料" description="首次接案付款前需完成收款資料填寫" />
        <Card className="p-6 space-y-4">
          <FormFields form={form} setForm={setForm} />
          <FileFields files={files} setFiles={setFiles} requireAll />
          <div className="flex items-start gap-2 pt-2">
            <input id="consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <label htmlFor="consent" className="text-sm text-muted-foreground">
              本人同意禹動科技整合股份有限公司 Smart4A 為勞務報酬給付、扣繳申報及二代健保補充保費等用途，蒐集、處理與利用本人之個人資料。
            </label>
          </div>
          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            送出收款資料
          </Button>
        </Card>
      </motion.div>
    );
  }

  // ===== State 2: read-only with optional pending banner =====
  if (!editing) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <PageHeader icon={<Wallet className="w-6 h-6" />} title="收款資料" description="您的收款資料目前為唯讀，如需修改請點選下方申請修改" />

        {pendingUpdate && (
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 text-amber-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">您有一筆修改申請正在外部歸檔中，完成前無法再次申請修改。</span>
            </div>
          </Card>
        )}

        <Card className="p-6 space-y-2">
          <RowKV k="姓名" v={profile.name} />
          <RowKV k="身分證字號" v={mask(profile.id_number)} />
          <RowKV k="聯絡電話" v={profile.phone ?? "-"} />
          <RowKV k="Email" v={profile.email ?? "-"} />
          <RowKV k="戶籍地址" v={profile.registered_address} />
          <hr className="my-2" />
          <RowKV k="銀行" v={`${profile.bank_code} ${profile.bank_name}`} />
          <RowKV k="分行" v={profile.branch_name ? `${profile.branch_code ?? ""} ${profile.branch_name}` : "-"} />
          <RowKV k="戶名" v={profile.account_name} />
          <RowKV k="帳號" v={maskAccount(profile.account_number)} />
          <hr className="my-2" />
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            {profile.first_submitted_at
              ? `已完成首次外部歸檔（${new Date(profile.first_submitted_at).toLocaleDateString("zh-TW")}）`
              : "尚未完成首次外部歸檔，等待管理員確認後產生勞報單"}
          </div>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/tasks")}>返回任務</Button>
          <Button
            variant="default"
            disabled={!!pendingUpdate}
            onClick={() => setEditing(true)}
            className="gap-2"
          >
            <FileEdit className="w-4 h-4" /> 申請修改
          </Button>
        </div>
      </motion.div>
    );
  }

  // ===== State 3: editing (request update) =====
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader icon={<FileEdit className="w-6 h-6" />} title="申請修改收款資料" description="修改後將觸發重新歸檔，並重設雲端附件連結" />
      <Card className="p-6 space-y-4">
        <FormFields form={form} setForm={setForm} />
        <div className="space-y-2">
          <Label>修改原因 <span className="text-red-500">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="請說明修改原因（如：更換銀行帳戶）" />
        </div>
        <FileFields files={files} setFiles={setFiles} requireBankbookOnly />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditing(false); setFiles({}); }}>取消</Button>
          <Button onClick={handleRequestUpdate} disabled={saving} className="flex-1 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            送出修改申請
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function FormFields({ form, setForm }: { form: typeof empty; setForm: (f: typeof empty) => void }) {
  const set = (k: keyof typeof empty, v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="姓名 *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
      <Field label="身分證字號 *"><Input value={form.id_number} onChange={(e) => set("id_number", e.target.value.toUpperCase())} maxLength={10} /></Field>
      <Field label="聯絡電話"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="戶籍地址 *" full><Input value={form.registered_address} onChange={(e) => set("registered_address", e.target.value)} /></Field>
      <Field label="銀行代號 *"><Input value={form.bank_code} onChange={(e) => set("bank_code", e.target.value)} maxLength={4} /></Field>
      <Field label="銀行名稱 *"><Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} /></Field>
      <Field label="分行代號"><Input value={form.branch_code} onChange={(e) => set("branch_code", e.target.value)} /></Field>
      <Field label="分行名稱"><Input value={form.branch_name} onChange={(e) => set("branch_name", e.target.value)} /></Field>
      <Field label="戶名 *"><Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} /></Field>
      <Field label="帳號 *" full><Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} /></Field>
    </div>
  );
}

function FileFields({
  files, setFiles, requireAll, requireBankbookOnly,
}: {
  files: { front?: File; back?: File; bankbook?: File };
  setFiles: (f: typeof files) => void;
  requireAll?: boolean;
  requireBankbookOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <FileSlot label={`身分證正面${requireAll ? " *" : ""}`} file={files.front} onChange={(f) => setFiles({ ...files, front: f })} />
      <FileSlot label={`身分證反面${requireAll ? " *" : ""}`} file={files.back} onChange={(f) => setFiles({ ...files, back: f })} />
      <FileSlot label={`存摺封面${requireAll || requireBankbookOnly ? " *" : ""}`} file={files.bankbook} onChange={(f) => setFiles({ ...files, bankbook: f })} />
    </div>
  );
}

function FileSlot({ label, file, onChange }: { label: string; file?: File; onChange: (f?: File) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="file" accept="image/*,application/pdf" onChange={(e) => onChange(e.target.files?.[0])} />
      {file && <p className="text-xs text-muted-foreground truncate">{file.name}</p>}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-2 ${full ? "md:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-foreground">{v}</span>
    </div>
  );
}

function mask(s: string) {
  if (!s) return "-";
  if (s.length <= 4) return s;
  return s.slice(0, 1) + "*".repeat(s.length - 4) + s.slice(-3);
}
function maskAccount(s: string) {
  if (!s) return "-";
  if (s.length <= 4) return s;
  return "*".repeat(Math.max(0, s.length - 4)) + s.slice(-4);
}
