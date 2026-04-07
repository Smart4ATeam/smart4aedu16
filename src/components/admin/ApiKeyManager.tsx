import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, Copy, Check, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ApiKeyManager() {
  const [apiKey, setApiKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchKey();
  }, []);

  const fetchKey = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key_name", "api_integration_key")
      .single();
    if (!error && data) {
      setApiKey(data.value);
    }
    setLoading(false);
  };

  const maskedKey = apiKey
    ? apiKey.slice(0, 6) + "•".repeat(Math.max(0, apiKey.length - 10)) + apiKey.slice(-4)
    : "(尚未設定)";

  const handleCopy = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success("已複製 API Key");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    setEditValue(apiKey);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ value: editValue, updated_at: new Date().toISOString() })
      .eq("key_name", "api_integration_key");

    if (error) {
      toast.error("儲存失敗：" + error.message);
    } else {
      setApiKey(editValue);
      setEditing(false);
      toast.success("API Key 已更新");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditValue("");
  };

  if (loading) {
    return (
      <div className="glass-card p-4 animate-pulse">
        <div className="h-5 w-40 bg-muted rounded mb-3" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">API_INTEGRATION_KEY</h3>
        {apiKey ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">已設定</span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">未設定</span>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="輸入新的 API Key"
            className="font-mono text-xs"
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={saving || !editValue.trim()}>
            <Save className="w-3.5 h-3.5 mr-1" />
            儲存
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-background/80 border border-border rounded-lg px-3 py-2">
            <code className="text-xs font-mono text-muted-foreground">
              {revealed ? apiKey || "(尚未設定)" : maskedKey}
            </code>
          </div>
          {apiKey && (
            <button
              onClick={() => setRevealed(!revealed)}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title={revealed ? "隱藏" : "顯示"}
            >
              {revealed ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
          {apiKey && (
            <button
              onClick={handleCopy}
              className="p-2 rounded-md hover:bg-muted transition-colors"
              title="複製"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
          <Button size="sm" variant="outline" onClick={handleEdit}>
            <Pencil className="w-3.5 h-3.5 mr-1" />
            {apiKey ? "修改" : "設定"}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        此金鑰供 Make.com、AI Agent 等外部系統呼叫 API 時使用，修改後立即生效。
      </p>
    </div>
  );
}
