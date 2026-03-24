import { useState } from "react";
import { Plug, Copy, Check, ChevronDown, ChevronUp, Server, BookOpen, Send, CalendarPlus, ClipboardList, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BASE_URL = "https://clwruolkostoirdwnnuy.supabase.co/functions/v1";

interface ApiEndpoint {
  id: string;
  name: string;
  icon: React.ReactNode;
  method: string;
  path: string;
  authType: string;
  description: string;
  requiredFields: { name: string; type: string; required: boolean; desc: string }[];
  optionalFields: { name: string; type: string; desc: string }[];
  exampleBody: Record<string, unknown>;
  exampleResponse: Record<string, unknown>;
}

const endpoints: ApiEndpoint[] = [
  {
    id: "enroll-student",
    name: "預建學員資料",
    icon: <Users className="w-4 h-4" />,
    method: "POST",
    path: "/enroll-student",
    authType: "x-api-key (ENROLL_API_KEY)",
    description: "從外部系統預建學員資料（未啟用狀態），學員後續可透過啟用流程綁定帳號。",
    requiredFields: [
      { name: "email", type: "string", required: true, desc: "學員電子信箱" },
      { name: "student_id", type: "string", required: true, desc: "學員編號" },
      { name: "display_name", type: "string", required: true, desc: "顯示名稱" },
    ],
    optionalFields: [],
    exampleBody: { email: "student@example.com", student_id: "S20250001", display_name: "王小明" },
    exampleResponse: { message: "學員資料已建立", id: "uuid-xxx" },
  },
  {
    id: "api-resources",
    name: "新增資源",
    icon: <BookOpen className="w-4 h-4" />,
    method: "POST",
    path: "/api-resources",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "新增套件、插件、模板或影片等資源。支援所有資源欄位。",
    requiredFields: [
      { name: "title", type: "string", required: true, desc: "資源標題" },
    ],
    optionalFields: [
      { name: "category", type: "string", desc: "分類：extensions, plugins, templates, videos" },
      { name: "description", type: "string", desc: "資源描述" },
      { name: "tags", type: "string[]", desc: "標籤陣列" },
      { name: "author", type: "string", desc: "作者" },
      { name: "difficulty", type: "string", desc: "難度（初級/中級/高級）" },
      { name: "download_url", type: "string", desc: "下載連結" },
      { name: "detail_url", type: "string", desc: "詳細介紹連結" },
      { name: "thumbnail_url", type: "string", desc: "縮圖 URL" },
      { name: "trial_url", type: "string", desc: "試用連結" },
      { name: "duration", type: "string", desc: "時長（影片用）" },
      { name: "video_type", type: "string", desc: "影片類型" },
      { name: "sub_category", type: "string", desc: "子分類" },
      { name: "version", type: "string", desc: "版本" },
      { name: "flow_count", type: "number", desc: "流程數量" },
      { name: "industry_tag", type: "string", desc: "產業標籤" },
      { name: "is_hot", type: "boolean", desc: "是否為熱門" },
      { name: "status", type: "string", desc: "狀態（預設 approved）" },
      { name: "hot_rank", type: "number", desc: "熱門排名" },
      { name: "usage_count", type: "number", desc: "使用次數" },
      { name: "sort_order", type: "number", desc: "排序順序（預設 0）" },
    ],
    exampleBody: { title: "Email 自動化模板", category: "templates", description: "自動發送歡迎信", tags: ["email", "automation"], difficulty: "初級" },
    exampleResponse: { success: true, data: { id: "uuid-xxx", title: "Email 自動化模板", category: "templates" } },
  },
  {
    id: "api-tasks",
    name: "新增任務",
    icon: <ClipboardList className="w-4 h-4" />,
    method: "POST",
    path: "/api-tasks",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "從外部系統建立新任務，學員可在任務大廳中接案。",
    requiredFields: [
      { name: "title", type: "string", required: true, desc: "任務標題" },
    ],
    optionalFields: [
      { name: "description", type: "string", desc: "任務描述" },
      { name: "difficulty", type: "string", desc: "難度（初級/中級/高級）" },
      { name: "amount", type: "number", desc: "獎勵金額" },
      { name: "deadline", type: "string", desc: "截止日期（YYYY-MM-DD）" },
      { name: "tags", type: "string[]", desc: "標籤陣列" },
      { name: "status", type: "string", desc: "狀態（預設 available）" },
    ],
    exampleBody: { title: "設計 CRM 自動化流程", description: "使用 Make.com 建立客戶管理流程", difficulty: "中級", amount: 500, deadline: "2025-12-31", tags: ["CRM", "automation"] },
    exampleResponse: { success: true, data: { id: "uuid-xxx", title: "設計 CRM 自動化流程", status: "available" } },
  },
  {
    id: "api-calendar-events",
    name: "新增行事曆活動",
    icon: <CalendarPlus className="w-4 h-4" />,
    method: "POST",
    path: "/api-calendar-events",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "從外部系統新增全域或個人行事曆活動。",
    requiredFields: [
      { name: "title", type: "string", required: true, desc: "活動標題" },
      { name: "event_date", type: "string", required: true, desc: "日期（YYYY-MM-DD）" },
    ],
    optionalFields: [
      { name: "event_time", type: "string", desc: "時間（HH:MM:SS）" },
      { name: "description", type: "string", desc: "活動描述" },
      { name: "color", type: "string", desc: "顏色 class（預設 gradient-orange）" },
      { name: "is_global", type: "boolean", desc: "是否為全域活動（預設 true）" },
    ],
    exampleBody: { title: "月度直播課程", event_date: "2025-10-15", event_time: "20:00:00", description: "Make.com 進階技巧", is_global: true },
    exampleResponse: { success: true, data: { id: "uuid-xxx", title: "月度直播課程", event_date: "2025-10-15" } },
  },
  {
    id: "api-messages",
    name: "發送系統訊息",
    icon: <Send className="w-4 h-4" />,
    method: "POST",
    path: "/api-messages",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "發送系統廣播訊息至所有已啟用學員，或指定特定學員。",
    requiredFields: [
      { name: "content", type: "string", required: true, desc: "訊息內容" },
    ],
    optionalFields: [
      { name: "title", type: "string", desc: "對話標題（預設「系統通知」）" },
      { name: "category", type: "string", desc: "分類（預設 system）" },
      { name: "target_user_ids", type: "string[]", desc: "指定收件人 UUID 陣列（空 = 全部學員）" },
    ],
    exampleBody: { title: "重要公告", content: "本週六 20:00 有直播課程，請準時參加！", category: "system" },
    exampleResponse: { success: true, data: { conversation_id: "uuid-xxx", recipients: 42 } },
  },
  {
    id: "api-courses",
    name: "新增課程/梯次",
    icon: <BookOpen className="w-4 h-4" />,
    method: "POST",
    path: "/api-courses",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "新增課程定義或開課梯次。透過 action 欄位區分操作類型：create_course 或 create_session。",
    requiredFields: [
      { name: "action", type: "string", required: true, desc: "操作類型：create_course / create_session" },
      { name: "title / course_id", type: "string", required: true, desc: "create_course 需 title；create_session 需 course_id" },
    ],
    optionalFields: [
      { name: "description", type: "string", desc: "課程描述" },
      { name: "category", type: "string", desc: "分類：quest/basic/intermediate/advanced/special" },
      { name: "price", type: "number", desc: "費用（預設 0）" },
      { name: "start_date", type: "string", desc: "開課日（YYYY-MM-DD）" },
      { name: "end_date", type: "string", desc: "結束日" },
      { name: "location", type: "string", desc: "地點" },
      { name: "max_students", type: "number", desc: "人數上限" },
      { name: "schedule_type", type: "string", desc: "recurring / ondemand" },
    ],
    exampleBody: { action: "create_course", title: "AI 實戰工作坊", category: "intermediate", price: 3500 },
    exampleResponse: { success: true, data: { id: "uuid-xxx", title: "AI 實戰工作坊" } },
  },
  {
    id: "api-enrollment-callback",
    name: "報名回呼",
    icon: <Users className="w-4 h-4" />,
    method: "POST",
    path: "/api-enrollment-callback",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "供外部報名系統（如 dao.smart4a.tw）在學員完成報名後，透過 HTTP POST 將資料回傳，系統會自動比對/建立學員 Profile 並建立報名紀錄。",
    requiredFields: [
      { name: "email", type: "string", required: true, desc: "報名者信箱" },
      { name: "name", type: "string", required: true, desc: "姓名" },
      { name: "course_code", type: "string", required: true, desc: "課程代碼（對應 courses.category，如 quest, basic 等）" },
    ],
    optionalFields: [
      { name: "phone", type: "string", desc: "電話" },
      { name: "session_date", type: "string", desc: "開課日期（YYYY-MM-DD），用於比對梯次；未提供則取最近 open 梯次" },
      { name: "paid", type: "boolean", desc: "是否已繳費（預設 false）" },
      { name: "notes", type: "string", desc: "備註" },
    ],
    exampleBody: { email: "student@example.com", name: "王小明", phone: "0912345678", course_code: "quest", session_date: "2026-05-15", paid: false },
    exampleResponse: { success: true, data: { enrollment_id: "uuid-xxx", user_id: "uuid-xxx", session_id: "uuid-xxx", message: "報名資料已建立" } },
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已複製到剪貼簿");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-muted transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-background/80 border border-border rounded-lg p-3 text-xs overflow-x-auto">
        <code className={`language-${language} text-muted-foreground`}>{code}</code>
      </pre>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  const fullUrl = `${BASE_URL}${endpoint.path}`;

  const curlExample = `curl -X ${endpoint.method} "${fullUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -d '${JSON.stringify(endpoint.exampleBody, null, 2)}'`;

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-orange flex items-center justify-center text-primary-foreground">
            {endpoint.icon}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                {endpoint.method}
              </span>
              <span className="text-sm font-medium text-foreground">{endpoint.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{endpoint.path}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{endpoint.description}</p>

          {/* URL */}
          <div>
            <p className="text-xs font-medium text-foreground mb-1">端點 URL</p>
            <div className="flex items-center gap-2 bg-background/80 border border-border rounded-lg px-3 py-2">
              <code className="text-xs text-primary flex-1 font-mono">{fullUrl}</code>
              <CopyButton text={fullUrl} />
            </div>
          </div>

          {/* Auth */}
          <div>
            <p className="text-xs font-medium text-foreground mb-1">認證方式</p>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <code className="text-xs text-muted-foreground font-mono">{endpoint.authType}</code>
            </div>
          </div>

          {/* Required Fields */}
          <div>
            <p className="text-xs font-medium text-foreground mb-2">必要欄位</p>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">欄位</th>
                    <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">型別</th>
                    <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">說明</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.requiredFields.map((f) => (
                    <tr key={f.name} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono text-primary">{f.name} <span className="text-destructive">*</span></td>
                      <td className="px-3 py-1.5 text-muted-foreground">{f.type}</td>
                      <td className="px-3 py-1.5 text-foreground">{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Optional Fields */}
          {endpoint.optionalFields.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">選填欄位</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">欄位</th>
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">型別</th>
                      <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.optionalFields.map((f) => (
                      <tr key={f.name} className="border-t border-border">
                        <td className="px-3 py-1.5 font-mono text-muted-foreground">{f.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{f.type}</td>
                        <td className="px-3 py-1.5 text-foreground">{f.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* cURL Example */}
          <div>
            <p className="text-xs font-medium text-foreground mb-1">cURL 範例</p>
            <CodeBlock code={curlExample} />
          </div>

          {/* Response Example */}
          <div>
            <p className="text-xs font-medium text-foreground mb-1">回應範例</p>
            <CodeBlock code={JSON.stringify(endpoint.exampleResponse, null, 2)} language="json" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminIntegrations() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 gradient-orange">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Plug className="w-6 h-6 text-primary-foreground" />
            <h1 className="text-2xl font-bold text-primary-foreground">API 串接管理</h1>
          </div>
          <p className="text-sm text-primary-foreground/80">管理外部系統（Make.com、AI Agent）串接所需的 API 端點與認證設定</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Server className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">可用 API 端點</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{endpoints.length}</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-success" />
            <p className="text-xs text-muted-foreground">系統級 API Key</p>
          </div>
          <p className="text-sm font-medium text-success">✓ 已設定 (API_INTEGRATION_KEY)</p>
        </div>
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-blue-400" />
            <p className="text-xs text-muted-foreground">學員註冊 API Key</p>
          </div>
          <p className="text-sm font-medium text-blue-400">✓ 已設定 (ENROLL_API_KEY)</p>
        </div>
      </div>

      {/* Info */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-foreground">認證方式說明</h2>
        </div>
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>• 所有 API 端點使用 <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono">x-api-key</code> Header 進行認證</p>
          <p>• <strong>enroll-student</strong> 使用獨立的 <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono">ENROLL_API_KEY</code></p>
          <p>• 其餘端點統一使用 <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono">API_INTEGRATION_KEY</code></p>
          <p>• 學員個人的 AI 與 Make.com Key 可於「學員設定頁 → 平台連線設定」中自行設定</p>
          <p>• 所有回應格式：成功 <code className="px-1 py-0.5 rounded bg-muted font-mono">{"{ success: true, data: {...} }"}</code>，失敗 <code className="px-1 py-0.5 rounded bg-muted font-mono">{"{ error: \"...\" }"}</code></p>
        </div>
      </div>

      {/* Endpoint List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <h2 className="text-lg font-semibold text-foreground">API 端點文件</h2>
        </div>
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <EndpointCard key={ep.id} endpoint={ep} />
          ))}
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
