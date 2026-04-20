import { useState } from "react";
import { FileText, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ADMIN_AGENT_SKILL_MD } from "@/lib/agent-skills/admin-skill";
import { toast } from "sonner";

export default function AdminAgentSkillViewer() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(ADMIN_AGENT_SKILL_MD);
    setCopied(true);
    toast.success("已複製到剪貼簿");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([ADMIN_AGENT_SKILL_MD], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "smart4a-admin-agent-skill.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <p className="text-sm font-medium text-foreground">管理者 Agent Skill</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "已複製" : "複製"}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" /> 下載 .md
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        將此 Skill 貼到您的 AI 工具（Claude / ChatGPT / Cursor 等）作為系統提示，Agent 即可用您的 Admin Token 操作後台功能。
      </p>
      <div className="bg-muted border border-border rounded-lg p-3 max-h-80 overflow-auto">
        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
          {ADMIN_AGENT_SKILL_MD}
        </pre>
      </div>
    </div>
  );
}
