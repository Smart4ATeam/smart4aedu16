import { Bot, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import AdminAgentTokenManager from "@/components/settings/AdminAgentTokenManager";
import AdminAgentSkillViewer from "@/components/settings/AdminAgentSkillViewer";

export default function AdminAgent() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        icon={<Bot className="w-6 h-6" />}
        title="管理者 Agent"
        description="建立 Admin API Token 並取得 Agent Skill，讓您的 AI 工具以您的管理員身份操作後台"
      />

      <div className="glass-card p-4 border-l-2 border-warning">
        <div className="flex gap-2">
          <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">安全提醒</p>
            <p className="text-xs text-muted-foreground">
              此 Token 具備您的管理員權限，可搜尋學員、變更密碼、調整點數。請妥善保管，勿提交至公開程式碼或未受信任的環境。如有外流疑慮請立即撤銷。
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Token 設定</h2>
        </div>
        <AdminAgentTokenManager />
      </div>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Agent Skill</h2>
        </div>
        <AdminAgentSkillViewer />
      </div>

      <div className="h-6" />
    </div>
  );
}
