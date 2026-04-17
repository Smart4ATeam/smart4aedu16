import { useEffect, useState } from "react";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
};

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
  { value: "60", label: "60 天" },
  { value: "90", label: "90 天" },
  { value: "never", label: "永久" },
];

function formatDate(s: string | null) {
  if (!s) return "永久";
  return new Date(s).toLocaleDateString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  });
}

export default function AgentTokenManager() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("30");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("user-token-manager", {
      method: "GET",
    });
    if (error) {
      toast.error("載入 Token 失敗");
    } else {
      setTokens(data?.tokens ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("請輸入 Token 名稱");
      return;
    }
    setCreating(true);
    const days = expiry === "never" ? null : Number(expiry);
    const { data, error } = await supabase.functions.invoke("user-token-manager/create", {
      method: "POST",
      body: { name: name.trim(), days },
    });
    setCreating(false);
    if (error || !data?.token) {
      toast.error("建立失敗：" + (error?.message ?? data?.error ?? "未知錯誤"));
      return;
    }
    setCreatedToken(data.token);
    await load();
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setName("");
    setExpiry("30");
    setCreatedToken(null);
    setCopied(false);
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("確定要撤銷這個 Token 嗎？此動作無法復原。")) return;
    const { error } = await supabase.functions.invoke("user-token-manager/revoke", {
      method: "POST",
      body: { id },
    });
    if (error) {
      toast.error("撤銷失敗");
    } else {
      toast.success("已撤銷");
      load();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">API Token</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> 建立 Token
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">載入中...</p>
      ) : tokens.length === 0 ? (
        <div className="glass-card p-4 text-center">
          <p className="text-sm text-muted-foreground">尚未建立任何 Token</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => {
            const expired = t.expires_at && new Date(t.expires_at).getTime() < Date.now();
            const status = t.revoked
              ? { label: "已撤銷", color: "bg-destructive/15 text-destructive" }
              : expired
              ? { label: "已過期", color: "bg-muted text-muted-foreground" }
              : { label: "有效", color: "bg-success/15 text-success" };
            return (
              <div key={t.id} className="glass-card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {t.token_prefix}••••••••
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    建立 {formatDate(t.created_at)} · 到期 {formatDate(t.expires_at)}
                    {t.last_used_at && ` · 最後使用 ${formatDate(t.last_used_at)}`}
                  </p>
                </div>
                {!t.revoked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRevoke(t.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleCloseDialog())}>
        <DialogContent>
          {!createdToken ? (
            <>
              <DialogHeader>
                <DialogTitle>建立新的 API Token</DialogTitle>
                <DialogDescription>
                  讓您的 AI Agent（Claude / ChatGPT / Cursor 等）以您的身份存取學習中心資料。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Token 名稱</Label>
                  <Input
                    placeholder="例如：我的 Claude Agent"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>有效期</Label>
                  <RadioGroup value={expiry} onValueChange={setExpiry} className="grid grid-cols-5 gap-2">
                    {EXPIRY_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                          expiry === o.value
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <RadioGroupItem value={o.value} className="sr-only" />
                        {o.label}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={handleCloseDialog}>取消</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "建立中..." : "建立"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Token 已建立</DialogTitle>
                <DialogDescription className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>請立即複製並妥善保存。<strong>關閉此視窗後將無法再查看完整 Token。</strong></span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-muted border border-border rounded-lg p-3 font-mono text-xs break-all">
                  {createdToken}
                </div>
                <Button onClick={handleCopy} className="w-full" variant="secondary">
                  {copied ? (
                    <><Check className="w-4 h-4 mr-2" /> 已複製</>
                  ) : (
                    <><Copy className="w-4 h-4 mr-2" /> 複製 Token</>
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDialog}>我已保存，關閉</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
