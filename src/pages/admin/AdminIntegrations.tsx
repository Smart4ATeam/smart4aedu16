import { useState, useEffect } from "react";
import { Plug, Copy, Check, ChevronDown, ChevronUp, Server, BookOpen, Send, CalendarPlus, ClipboardList, Users, Shield, CreditCard, Save, Webhook, Award } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ApiKeyManager } from "@/components/admin/ApiKeyManager";
import { IconBox } from "@/components/ui/icon-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  extraExamples?: { title: string; body: Record<string, unknown> }[];
}

const endpoints: ApiEndpoint[] = [
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
    id: "api-reg-order",
    name: "建立報名訂單",
    icon: <ClipboardList className="w-4 h-4" />,
    method: "POST",
    path: "/api-reg-order",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "供 Make.com 呼叫，只寫入 reg_orders（payment_status=pending）。不會建立學員或報名明細，待付款後再呼叫 api-reg-split 拆解。支援 1~3 人 × 1~4 課程。可透過 course_codes 或 course_names 指定課程。",
    requiredFields: [
      { name: "order_no", type: "string", required: true, desc: "訂單編號（唯一）" },
      { name: "course_codes 或 course_names", type: "string[]", required: true, desc: "課程代碼或課程名稱陣列（二擇一，最多 4 個）" },
      { name: "persons", type: "object[]", required: true, desc: "報名人員陣列（1~3 人），每人需有 name，可選 phone、email" },
    ],
    optionalFields: [
      { name: "session_dates", type: "string[]", desc: "每門課的上課日期陣列，與 course_codes 一一對應（自動補零，如 2026/4/16 → 2026/04/16）" },
      { name: "payment_status", type: "string", desc: "付款狀態（預設 pending）" },
      { name: "payment_method", type: "string", desc: "付款方式：信用卡 / 匯款 / 現金 / Line Pay" },
      { name: "total_amount", type: "number", desc: "總金額（預設 0）" },
      { name: "person_count", type: "number", desc: "訂單報名人數（預設為 persons 陣列長度）" },
      { name: "tax_id", type: "string", desc: "統一編號" },
      { name: "discount_plan", type: "string", desc: "折扣方案" },
      { name: "invoice_type", type: "string", desc: "發票類型：二聯式 / 三聯式 / 電子發票 / 免開發票" },
      { name: "invoice_title", type: "string", desc: "發票抬頭" },
      { name: "dealer_id", type: "string", desc: "經銷商 ID" },
      { name: "notes", type: "string", desc: "備註" },
      { name: "is_retrain", type: "boolean", desc: "是否為複訓（預設 false）。設為 true 即為複訓，使用相同課程代碼即可" },
      { name: "referrer", type: "string", desc: "推薦人" },
    ],
    exampleBody: {
      order_no: "ORD20250401001",
      course_codes: ["beginner_01", "basic_01"],
      session_dates: ["2025/12/20-12/21", "2026/1/17-1/18"],
      persons: [
        { name: "王小明", phone: "0912345678", email: "ming@example.com" },
        { name: "李小花", phone: "0987654321", email: "hua@example.com" },
      ],
      payment_method: "信用卡",
      total_amount: 12000,
      person_count: 2,
      tax_id: "12345678",
      invoice_type: "三聯式",
      invoice_title: "某某有限公司",
      discount_plan: "duo",
      dealer_id: "D001",
      is_retrain: false,
    },
    exampleResponse: {
      success: true,
      data: {
        order_id: "uuid-xxx",
        order_no: "ORD20250401001",
        payment_status: "pending",
        courses: [{ course_code: "beginner_01", course_name: "初階課程", price: 6000 }],
        persons_count: 2,
        message: "訂單已建立，待付款後呼叫 api-reg-split 拆解",
      },
    },
    extraExamples: [
      {
        title: "複訓訂單範例（is_retrain = true）",
        body: {
          order_no: "ORD20250402001",
          course_codes: ["beginner_01"],
          session_dates: ["2026/5/10-5/11"],
          persons: [
            { name: "張大偉", phone: "0922333444", email: "david@example.com" },
          ],
          payment_method: "匯款",
          total_amount: 3000,
          person_count: 1,
          invoice_type: "二聯式",
          is_retrain: true,
          referrer: "林老師",
          notes: "複訓學員，曾於 2025/03 完課",
        },
      },
    ],
  },
  {
    id: "api-reg-split",
    name: "拆解訂單（建立學員+報名明細）",
    icon: <Users className="w-4 h-4" />,
    method: "POST",
    path: "/api-reg-split",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "付款確認後呼叫，根據 order_no 自動拆解：從訂單的 p1~p3 比對/建立 reg_members（比對順序：Email → 姓名+電話 → 新建），再為每人 × 每課程建立 reg_enrollments。上課日期（session_date）從訂單的 session_dates 陣列帶入。需訂單 payment_status=paid 才可拆解，且不可重複拆解。",
    requiredFields: [
      { name: "order_no", type: "string", required: true, desc: "訂單編號（對應 reg_orders.order_no）" },
    ],
    optionalFields: [],
    exampleBody: {
      order_no: "ORD20250401001",
    },
    exampleResponse: {
      success: true,
      data: {
        order_id: "uuid-xxx",
        order_no: "ORD20250401001",
        member_ids: ["uuid-xxx", "uuid-yyy"],
        enrollments_count: 4,
        message: "訂單拆解完成，學員與報名明細已建立",
      },
    },
    extraExamples: [
      {
        title: "錯誤回應：訂單尚未付款",
        body: { error: "訂單尚未付款，請先呼叫 api-reg-payment 更新為 paid" },
      },
      {
        title: "錯誤回應：訂單已拆解過",
        body: { error: "此訂單已拆解過，不可重複拆解" },
      },
    ],
  },
  {
    id: "api-reg-payment",
    name: "付款狀態更新",
    icon: <CreditCard className="w-4 h-4" />,
    method: "POST",
    path: "/api-reg-payment",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "供 Make.com 呼叫，根據訂單編號更新付款狀態。同時會同步更新該訂單下所有 reg_enrollments 的付款欄位（payment_status、paid_at、invoice_title），並寫入操作紀錄。",
    requiredFields: [
      { name: "order_no", type: "string", required: true, desc: "訂單編號（對應 reg_orders.order_no）" },
      { name: "payment_status", type: "string", required: true, desc: "付款狀態：paid / pending" },
    ],
    optionalFields: [
      { name: "payment_method", type: "string", desc: "付款方式：信用卡 / 匯款 / 現金 / Line Pay" },
      { name: "paid_at", type: "string", desc: "付款時間（ISO 8601，預設為當前時間）" },
      { name: "invoice_number", type: "string", desc: "發票號碼" },
      { name: "invoice_title", type: "string", desc: "發票抬頭" },
      { name: "invoice_type", type: "string", desc: "發票類型：二聯式 / 三聯式 / 電子發票 / 免開發票" },
    ],
    exampleBody: {
      order_no: "ORD20250401001",
      payment_status: "paid",
      payment_method: "信用卡",
      paid_at: "2025-04-08T14:30:00Z",
      invoice_number: "AB12345678",
      invoice_title: "某某有限公司",
      invoice_type: "三聯式",
    },
    exampleResponse: {
      success: true,
      order_id: "uuid-xxx",
      order_no: "ORD20250401001",
      payment_status: "paid",
    },
  },
  {
    id: "api-resource-trial-callback",
    name: "資源試用 Webhook 金鑰回傳",
    icon: <Webhook className="w-4 h-4" />,
    method: "POST",
    path: "/api-resource-trial-callback",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "資源試用 Webhook 串接的回傳端點。當學員領用試用資源時，系統會 POST Webhook 到您設定的 URL（含 trial_id、app_id、organization_id 等）。您的系統產生 API Key 後，呼叫此端點將金鑰寫回平台，學員即可查看。完整流程：①學員領用 → ②系統發送 Webhook → ③您產生 Key → ④呼叫此 API 回傳 → ⑤學員可見金鑰",
    requiredFields: [
      { name: "trial_id", type: "string", required: true, desc: "領用記錄 ID（來自 Webhook Payload）" },
      { name: "api_key", type: "string", required: true, desc: "您產生的 API Key" },
    ],
    optionalFields: [],
    exampleBody: { trial_id: "uuid-xxx", api_key: "sk-xxxxxxxxxxxxxxxxxxxxxxxx" },
    exampleResponse: { success: true, data: { trial_id: "uuid-xxx", message: "API Key 已更新", key: "sk-xxxxxxxxxxxxxxxxxxxxxxxx" } },
    extraExamples: [
      {
        title: "系統發送的 Webhook Payload 範例（您的系統會收到）",
        body: {
          trial_id: "uuid-xxx",
          organization_id: "org-123456",
          app_id: "richmenu-yrfqmv",
          member_no: "SA26040001",
          category: "extensions",
          resource_title: "Rich Menu 管理套件",
        },
      },
    ],
  },
  {
    id: "api-reg-order-query",
    name: "查詢報名訂單",
    icon: <ClipboardList className="w-4 h-4" />,
    method: "GET",
    path: "/api-reg-order",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "根據訂單編號查詢完整訂單資料，包含所有報名人員、課程快照、付款資訊、發票資訊、備註等所有欄位。",
    requiredFields: [
      { name: "order_no", type: "string (query param)", required: true, desc: "訂單編號" },
    ],
    optionalFields: [],
    exampleBody: {},
    exampleResponse: {
      success: true,
      data: {
        id: "uuid-xxx",
        order_no: "ORD20250401001",
        p1_name: "王小明", p1_phone: "0912345678", p1_email: "ming@example.com",
        p2_name: "李小花", p2_phone: "0987654321", p2_email: "hua@example.com",
        p3_name: null, p3_phone: null, p3_email: null,
        course_ids: ["uuid-c1", "uuid-c2"],
        course_snapshot: [{ course_code: "beginner_01", course_name: "入門課-設計流程", price: 6000 }],
        session_dates: ["2025/12/20-12/21"],
        payment_status: "paid", payment_method: "信用卡", paid_at: "2025-04-08T14:30:00Z",
        total_amount: 12000, discount_plan: "duo", person_count: 2,
        invoice_type: "三聯式", invoice_title: "某某有限公司", invoice_number: "AB12345678",
        invoice_status: "active", invoice_date: "2025-04-08",
        tax_id: "12345678", dealer_id: "D001", referrer: "林老師",
        is_retrain: false, notes: "備註內容", created_at: "2025-04-01T10:00:00Z",
      },
    },
    extraExamples: [
      {
        title: "cURL 範例（GET 請求無需 Body）",
        body: { "說明": "GET 請求使用 Query Parameter，不需要 Body" },
      },
    ],
  },
  {
    id: "api-reg-enrollments",
    name: "查詢報名明細",
    icon: <Users className="w-4 h-4" />,
    method: "GET",
    path: "/api-reg-enrollments",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "根據課程名稱（模糊比對）與/或上課日期查詢所有報名明細，回傳學員完整資料（姓名、學員編號、電話、email）與報名狀態、付款狀態、報到狀態等。已取消的報名不會回傳。",
    requiredFields: [
      { name: "course_name", type: "string (query param)", required: true, desc: "課程名稱（模糊比對，至少提供 course_name 或 session_date 其一）" },
    ],
    optionalFields: [
      { name: "session_date", type: "string (query param)", desc: "上課日期（精確比對，如 2026/04/16）" },
      { name: "pre_notification_sent", type: "string (query param)", desc: "行前通知篩選（true 或 false）" },
    ],
    exampleBody: {},
    exampleResponse: {
      success: true,
      total: 3,
      data: [
        {
          enrollment_id: "uuid-xxx", order_no: "ORD20250401001",
          member_name: "王小明", member_no: "SA26040001", member_phone: "0912345678", member_email: "ming@example.com",
          course_name: "入門課-設計流程", course_code: "beginner_01", course_category: "basic",
          session_date: "2026/04/16", status: "enrolled", payment_status: "paid", checked_in: true,
          is_retrain: false, enrolled_at: "2026-04-01T10:00:00Z", paid_at: "2026-04-08T14:30:00Z",
          invoice_title: "某某有限公司", dealer_id: "D001", referrer: "林老師",
          notes: null, test_score: 85, certificate: "CERT-001", points_awarded: 10,
          pre_notification_sent: true,
        },
      ],
    },
    extraExamples: [
      {
        title: "cURL 範例（GET 請求無需 Body）",
        body: { "說明": "GET 請求使用 Query Parameter，不需要 Body" },
      },
    ],
  },
  {
    id: "api-reg-pre-notification",
    name: "更新行前通知狀態",
    icon: <Send className="w-4 h-4" />,
    method: "POST",
    path: "/api-reg-pre-notification",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "根據訂單編號更新行前通知狀態。可搭配 member_no 指定更新單一學員，不帶則更新整張訂單所有人。已取消的報名不會被更新。",
    requiredFields: [
      { name: "order_no", type: "string", required: true, desc: "訂單編號（對應 reg_orders.order_no）" },
      { name: "pre_notification_sent", type: "boolean", required: true, desc: "行前通知狀態（true = 已發送）" },
    ],
    optionalFields: [
      { name: "member_no", type: "string", desc: "學員編號（指定只更新該學員，不帶則更新整張訂單）" },
    ],
    exampleBody: {
      order_no: "ORD20250401001",
      member_no: "SA26040001",
      pre_notification_sent: true,
    },
    exampleResponse: {
      success: true,
      data: {
        order_no: "ORD20250401001",
        member_no: "SA26040001",
        pre_notification_sent: true,
        updated_count: 1,
        message: "已更新 學員 SA26040001 共 1 筆報名明細的行前通知狀態",
      },
    },
  },
  {
    id: "api-certificate-callback",
    name: "證書產生回調",
    icon: <Award className="w-4 h-4" />,
    method: "POST",
    path: "/api-certificate-callback",
    authType: "x-api-key (API_INTEGRATION_KEY)",
    description: "供 Make.com 產生證書後回調，更新證書狀態與圖片 URL。完整流程：①學員通過測驗 → ②申請證書（系統呼叫 Make.com Webhook）→ ③Make.com 產生證書圖檔 → ④Make.com 呼叫此 API 回傳圖片 URL → ⑤學員可預覽/下載證書。",
    requiredFields: [
      { name: "certificate_id", type: "string", required: true, desc: "證書 ID（來自 Webhook Payload）" },
    ],
    optionalFields: [
      { name: "image_url", type: "string", desc: "證書圖片 URL（Make.com 上傳至 Storage 後的公開或簽名 URL）" },
      { name: "status", type: "string", desc: "狀態：issued（預設）或 failed" },
    ],
    exampleBody: {
      certificate_id: "uuid-xxx",
      image_url: "https://clwruolkostoirdwnnuy.supabase.co/storage/v1/object/public/certificates/cert-001.png",
      status: "issued",
    },
    exampleResponse: {
      success: true,
      data: { certificate_id: "uuid-xxx", status: "issued" },
    },
    extraExamples: [
      {
        title: "系統發送至 Make.com 的 Webhook Payload 範例（Make.com 會收到）",
        body: {
          action: "generate_certificate",
          certificate_id: "uuid-xxx",
          student_name: "王小明",
          student_id: "SA26040001",
          course_name: "MAKE基礎訓練Workshop",
          training_date: "2026-05-09~2026-05-10",
          total_hours: 12,
          score: 85,
          suggested_filename: "MK01",
          callback_url: "https://clwruolkostoirdwnnuy.supabase.co/functions/v1/api-certificate-callback",
        },
      },
      {
        title: "失敗回調範例",
        body: {
          certificate_id: "uuid-xxx",
          status: "failed",
        },
      },
    ],
  },
  {
    id: "payment-webhook-callback",
    name: "勞報單 / 收款資料歸檔回調",
    icon: <Webhook className="w-4 h-4" />,
    method: "POST",
    path: "/payment-webhook-callback",
    authType: "callback_token（每次外送 webhook 隨附的一次性 token，非 x-api-key）",
    description:
      "外部系統（Make.com 等）將勞報單簽回檔或收款人個資/附件歸檔到雲端後，呼叫此端點回寫雲端連結並觸發後續流程。本端點不使用 x-api-key，改以 outbound webhook 內帶的 callback_token 對應原始請求。\n\n支援兩種事件（以 payload 的 event 欄位區分）：\n① payment_document_archived：學員簽回的勞報單 PDF 已歸檔 → 寫入 signed_file_cloud_url，並刪除 storage 內的簽回檔。\n② payee_profile_archived：學員的個資/存摺/身分證附件已歸檔 → 寫入三個 *_cloud_url，刪除 storage 附件，若為首次歸檔則寫入 first_submitted_at，自動觸發所有 payment_pending_info 任務升級為 payment_pending_signature。\n\n注意：send-payment-webhook 是否帶附件，是依 payee_profiles.*_cloud_url 是否齊備來判斷，因此務必正確回傳三個 cloud url，否則下次送單會重複帶附件。",
    requiredFields: [
      { name: "event", type: "string", required: true, desc: "事件類型：payment_document_archived 或 payee_profile_archived" },
      { name: "callback_token", type: "string", required: true, desc: "outbound webhook payload 內的 callback_token（每次請求皆不同，一次性使用）" },
    ],
    optionalFields: [
      { name: "signed_pdf_cloud_url", type: "string", desc: "【event = payment_document_archived 時必填】簽回勞報單 PDF 的雲端永久連結" },
      { name: "id_card_front_cloud_url", type: "string", desc: "【event = payee_profile_archived】身分證正面的雲端連結" },
      { name: "id_card_back_cloud_url", type: "string", desc: "【event = payee_profile_archived】身分證反面的雲端連結" },
      { name: "bankbook_cover_cloud_url", type: "string", desc: "【event = payee_profile_archived】存摺封面的雲端連結" },
    ],
    exampleBody: {
      event: "payment_document_archived",
      callback_token: "ab12cd34-...-xxxx",
      signed_pdf_cloud_url: "https://drive.example.com/archive/labor-report/LR-202604-0001-signed.pdf",
    },
    exampleResponse: { success: true },
    extraExamples: [
      {
        title: "事件 ②：個資/附件歸檔（payee_profile_archived）",
        body: {
          event: "payee_profile_archived",
          callback_token: "ef56gh78-...-yyyy",
          id_card_front_cloud_url: "https://drive.example.com/archive/payee/uuid/id_front.jpg",
          id_card_back_cloud_url: "https://drive.example.com/archive/payee/uuid/id_back.jpg",
          bankbook_cover_cloud_url: "https://drive.example.com/archive/payee/uuid/bankbook.jpg",
        },
      },
      {
        title: "系統送出的 outbound payload 範例 ①（send-payment-webhook → 您的系統會收到）",
        body: {
          event: "payment_document",
          callback_token: "ab12cd34-...-xxxx",
          callback_url: "https://clwruolkostoirdwnnuy.supabase.co/functions/v1/payment-webhook-callback",
          document: {
            doc_no: "LR-202604-0001",
            application_id: "uuid-xxx",
            task_title: "設計 CRM 自動化流程",
            gross_amount: 20000,
            tax_amount: 2000,
            nhi_amount: 422,
            net_amount: 17578,
            generated_at: "2026-04-30T08:00:00Z",
            signed_pdf_signed_url: "https://...supabase.co/.../signed.pdf?token=...",
          },
          payee: {
            user_id: "uuid-user",
            name: "王小明",
            id_number: "A123456789",
            phone: "0912345678",
            email: "ming@example.com",
            registered_address: "台北市...",
            bank_code: "812",
            bank_name: "台新銀行",
            branch_code: "0011",
            branch_name: "城東分行",
            account_number: "1234567890",
            account_name: "王小明",
          },
          attachments: {
            id_card_front: "https://...supabase.co/.../id_front.jpg?token=...（首次才會帶；雲端已歸檔則為 null）",
            id_card_back: "https://...?token=...（同上）",
            bankbook_cover: "https://...?token=...（同上）",
          },
          company: { name: "禹動科技整合股份有限公司", brand: "Smart4A" },
        },
      },
      {
        title: "系統送出的 outbound payload 範例 ②（send-payee-update-webhook → 學員自助修改收款資料）",
        body: {
          event: "payee_profile_update_request",
          callback_token: "ef56gh78-...-yyyy",
          callback_url: "https://clwruolkostoirdwnnuy.supabase.co/functions/v1/payment-webhook-callback",
          update_id: "uuid-update",
          reason: "更換銀行帳號",
          changed_fields: ["bank_code", "account_number", "bankbook_cover_url"],
          payee: {
            user_id: "uuid-user",
            name: "王小明",
            bank_code: "822",
            bank_name: "中國信託",
            account_number: "9999888877",
            account_name: "王小明",
          },
          attachments: {
            id_card_front: "https://...?token=...（自助修改一律重帶新上傳的附件）",
            id_card_back: "https://...?token=...",
            bankbook_cover: "https://...?token=...",
          },
          company: { name: "禹動科技整合股份有限公司", brand: "Smart4A" },
        },
      },
      {
        title: "錯誤回應：callback_token 無效或不存在",
        body: { error: "Invalid callback_token" },
      },
      {
        title: "錯誤回應：未指定 event",
        body: { error: "Unknown event" },
      },
    ],
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

  const isGet = endpoint.method === "GET";
  const usesApiKey = !endpoint.authType.toLowerCase().startsWith("callback_token");
  const authHeader = usesApiKey ? `  -H "x-api-key: <YOUR_API_KEY>" \\\n` : "";
  const curlExample = isGet
    ? `curl -X GET "${fullUrl}?order_no=ORD20250401001"${usesApiKey ? ` \\\n  -H "x-api-key: <YOUR_API_KEY>"` : ""}`
    : `curl -X ${endpoint.method} "${fullUrl}" \\
  -H "Content-Type: application/json" \\
${authHeader}  -d '${JSON.stringify(endpoint.exampleBody, null, 2)}'`;

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <IconBox variant="primary" size="sm">
            {endpoint.icon}
          </IconBox>
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

          {/* Extra Examples */}
          {endpoint.extraExamples && endpoint.extraExamples.length > 0 && (
            endpoint.extraExamples.map((ex, idx) => {
              const isJsonOnly =
                ex.title.startsWith("錯誤回應") ||
                ex.title.startsWith("系統發送") ||
                ex.title.startsWith("系統送出") ||
                ex.title.includes("Webhook Payload") ||
                ex.title.includes("outbound payload");
              return (
                <div key={idx}>
                  <p className="text-xs font-medium text-foreground mb-1">{ex.title}</p>
                  <CodeBlock
                    code={
                      isJsonOnly
                        ? JSON.stringify(ex.body, null, 2)
                        : `curl -X ${endpoint.method} "${fullUrl}" \\\n  -H "Content-Type: application/json" \\\n${usesApiKey ? `  -H "x-api-key: <YOUR_API_KEY>" \\\n` : ""}  -d '${JSON.stringify(ex.body, null, 2)}'`
                    }
                    language={isJsonOnly ? "json" : "bash"}
                  />
                </div>
              );
            })
          )}

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

function WebhookUrlSettingItem({
  keyName,
  label,
  description,
  placeholder,
}: {
  keyName: string;
  label: string;
  description: string;
  placeholder: string;
}) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from("system_settings").select("value").eq("key_name", keyName).maybeSingle().then(({ data }) => {
      if (data) setUrl(data.value);
      setLoaded(true);
    });
  }, [keyName]);

  const handleSave = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from("system_settings").select("id").eq("key_name", keyName).maybeSingle();
    const trimmed = url.trim();
    if (existing) {
      const { error } = await supabase.from("system_settings").update({ value: trimmed }).eq("key_name", keyName);
      if (error) { toast.error("儲存失敗：" + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("system_settings").insert({ key_name: keyName, value: trimmed, description: label });
      if (error) { toast.error("儲存失敗：" + error.message); setSaving(false); return; }
    }
    toast.success(`${label}已儲存`);
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Input placeholder={placeholder} value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1 text-xs" />
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? "儲存中..." : "儲存"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminIntegrations() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Plug className="w-6 h-6" />}
        title="API 串接管理"
        description="管理外部系統（Make.com、AI Agent）串接所需的 API 端點與認證設定"
      />

      {/* API Key Management */}
      <ApiKeyManager />

      {/* Stats */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground">可用 API 端點</p>
        </div>
        <p className="text-2xl font-bold text-foreground">{endpoints.length}</p>
      </div>

      {/* Info */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-foreground">認證方式說明</h2>
        </div>
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>• 所有 API 端點使用 <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono">x-api-key</code> Header 進行認證</p>
          <p>• 所有端點統一使用 <code className="px-1 py-0.5 rounded bg-muted text-primary font-mono">API_INTEGRATION_KEY</code></p>
          <p>• 學員個人的 AI 與 Make.com Key 可於「學員設定頁 → 平台連線設定」中自行設定</p>
          <p>• 所有回應格式：成功 <code className="px-1 py-0.5 rounded bg-muted font-mono">{"{ success: true, data: {...} }"}</code>，失敗 <code className="px-1 py-0.5 rounded bg-muted font-mono">{"{ error: \"...\" }"}</code></p>
        </div>
      </div>

      {/* Webhook URL Settings */}
      <div className="glass-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-accent" />
          <h2 className="text-sm font-semibold text-foreground">Webhook URL 設定</h2>
        </div>
        <WebhookUrlSettingItem
          keyName="trial_webhook_url"
          label="資源試用 Webhook URL"
          description="學員領用試用資源（套件 / 範本）時，系統會自動 POST 到此 URL，對應端點：api-resource-trial-callback"
          placeholder="https://hook.example.com/trial"
        />
        <div className="border-t border-border" />
        <WebhookUrlSettingItem
          keyName="cert_webhook_url"
          label="證書產生 Webhook URL"
          description="學員申請結訓證書時，系統會 POST 到此 URL 請求產生證書，對應端點：api-certificate-callback"
          placeholder="https://hook.example.com/certificate"
        />
        <div className="border-t border-border" />
        <WebhookUrlSettingItem
          keyName="PAYMENT_WEBHOOK_URL"
          label="勞報單 / 付款 Webhook URL"
          description="管理員確認簽回勞報單後，系統會 POST 學員個資與勞報單資料到此 URL；學員自助修改收款資料時亦會送出。callback 端點：payment-webhook-callback。此 URL 不與其他功能共用。"
          placeholder="https://hook.example.com/payment"
        />
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
