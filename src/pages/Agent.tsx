import { Bot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import AgentTokenManager from "@/components/settings/AgentTokenManager";
import AgentSkillViewer from "@/components/settings/AgentSkillViewer";

export default function Agent() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        icon={<Bot className="w-6 h-6" />}
        title="個人 Agent"
        description="建立 API Token 並取得 Agent Skill，讓您的 AI 工具以您的身份存取學習中心"
      />

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Token 設定</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          建立 API Token，讓您的 AI Agent（Claude / ChatGPT / Cursor 等）以您的身份查詢學習中心資料。
        </p>
        <AgentTokenManager />
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Agent Skill</h2>
        </div>
        <AgentSkillViewer />
      </div>

      <div className="h-6" />
    </div>
  );
}
