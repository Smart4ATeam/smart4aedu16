import { useState, useEffect, useRef } from "react";
import { Settings as SettingsIcon, User, Globe, Bell, Eye, Target, Link, BarChart3, Info, Camera } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [orgId, setOrgId] = useState("");
  const [serverLocation, setServerLocation] = useState("US1");
  const [learningGoal, setLearningGoal] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [dailyTime, setDailyTime] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [autoSync, setAutoSync] = useState(true);

  // Notification settings
  const [courseReminder, setCourseReminder] = useState(true);
  const [deadlineReminder, setDeadlineReminder] = useState(true);
  const [communityNotify, setCommunityNotify] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showSuccess, setShowSuccess] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [showError, setShowError] = useState(true);

  const servers = ["US1", "US2", "US3", "EU1", "EU2", "EU3"];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [{ data: profile }, { data: notif }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("notification_settings").select("*").eq("user_id", user.id).single(),
      ]);
      if (profile) {
        setDisplayName(profile.display_name || "");
        setStudentId(profile.student_id || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setBio(profile.bio || "");
        setOrgId(profile.organization_id || "");
        setServerLocation(profile.server_location || "US1");
        setLearningGoal(profile.learning_goal || "");
        setDifficulty(profile.difficulty_preference || "");
        setDailyTime(profile.daily_learning_time || "");
        setWebhookUrl(profile.webhook_url || "");
        setAutoSync(profile.auto_sync ?? true);
        setAvatarUrl(profile.avatar_url || null);
      }
      if (notif) {
        setCourseReminder(notif.course_reminder);
        setDeadlineReminder(notif.deadline_reminder);
        setCommunityNotify(notif.community_notify);
        setShowInfo(notif.show_info);
        setShowSuccess(notif.show_success);
        setShowWarning(notif.show_warning);
        setShowError(notif.show_error);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("圖片大小不能超過 2MB");
      return;
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error("上傳失敗：" + uploadError.message);
      setUploadingAvatar(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
    setAvatarUrl(publicUrl);
    setUploadingAvatar(false);
    toast.success("大頭貼已更新");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const [{ error: pErr }, { error: nErr }] = await Promise.all([
      supabase.from("profiles").update({
        display_name: displayName,
        email,
        phone,
        bio,
        organization_id: orgId,
        server_location: serverLocation,
        learning_goal: learningGoal,
        difficulty_preference: difficulty,
        daily_learning_time: dailyTime,
        webhook_url: webhookUrl,
        auto_sync: autoSync,
      } as any).eq("id", user.id),
      supabase.from("notification_settings").update({
        course_reminder: courseReminder,
        deadline_reminder: deadlineReminder,
        community_notify: communityNotify,
        show_info: showInfo,
        show_success: showSuccess,
        show_warning: showWarning,
        show_error: showError,
      }).eq("user_id", user.id),
    ]);
    setSaving(false);
    if (pErr || nErr) {
      toast.error("儲存失敗，請稍後再試");
    } else {
      toast.success("設定已儲存");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        icon={<SettingsIcon className="w-6 h-6" />}
        title="學員俱樂部專區設定"
        description="個人化您的學習體驗"
      />

      {/* 個人資料 */}
      <SectionCard icon={<User className="w-5 h-5 text-primary" />} title="個人資料">
        {/* Avatar upload */}
        <div className="flex items-center gap-4 mb-2">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <Avatar className="w-16 h-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-bold">
                {displayName.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-primary-foreground" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">點擊頭像可更換大頭貼</p>
            {uploadingAvatar && <p className="text-xs text-primary mt-1">上傳中...</p>}
          </div>
        </div>

        <FieldGroup label="顯示名稱">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="學員編號">
          <Input value={studentId} readOnly className="bg-muted border-border opacity-70" />
        </FieldGroup>
        <FieldGroup label="電子信箱">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="聯絡電話">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="個人簡介">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-muted border-border min-h-[60px]" />
        </FieldGroup>
      </SectionCard>

      {/* 環境資料 */}
      <SectionCard icon={<Globe className="w-5 h-5 text-primary" />} title="環境資料">
        <FieldGroup label="組織編號（Organization ID）">
          <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="Make 主機位置">
          <div className="flex gap-2 flex-wrap">
            {servers.map((s) => (
              <button
                key={s}
                onClick={() => setServerLocation(s)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  serverLocation === s
                    ? "gradient-orange text-primary-foreground"
                    : "bg-muted border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </FieldGroup>
      </SectionCard>

      {/* 通知設定 */}
      <SectionCard icon={<Bell className="w-5 h-5 text-warning" />} title="通知設定">
        <ToggleRow title="課程提醒" desc="在課程開始前 15 分鐘提醒" checked={courseReminder} onChange={setCourseReminder} />
        <ToggleRow title="作業截止提醒" desc="在作業截止前 1 天提醒" checked={deadlineReminder} onChange={setDeadlineReminder} />
        <ToggleRow title="社群動態通知" desc="收到回覆或提及時通知" checked={communityNotify} onChange={setCommunityNotify} />
        <div className="border-t border-border my-4" />
        <p className="text-sm font-medium text-foreground mb-3">提示訊息顯示設定</p>
        <ToggleRow
          title={<><span className="text-xs px-1.5 py-0.5 rounded bg-chart-cyan/20 text-chart-cyan font-medium mr-2">資訊</span>一般資訊提示</>}
          desc="如切換頁籤、載入資料等操作提示" checked={showInfo} onChange={setShowInfo}
        />
        <ToggleRow
          title={<><span className="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success font-medium mr-2">成功</span>成功訊息提示</>}
          desc="如儲存成功、操作完成等確認提示" checked={showSuccess} onChange={setShowSuccess}
        />
        <ToggleRow
          title={<><span className="text-xs px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium mr-2">警告</span>警告訊息提示</>}
          desc="如輸入錯誤、需要注意的重要提醒" checked={showWarning} onChange={setShowWarning}
        />
        <ToggleRow
          title={<><span className="text-xs px-1.5 py-0.5 rounded bg-destructive/20 text-destructive font-medium mr-2">錯誤</span>錯誤訊息提示</>}
          desc="如操作失敗、系統錯誤等重要提醒" checked={showError} onChange={setShowError}
        />
      </SectionCard>

      {/* 學習偏好 */}
      <SectionCard icon={<Target className="w-5 h-5 text-primary" />} title="學習偏好">
        <FieldGroup label="學習目標">
          <Input value={learningGoal} onChange={(e) => setLearningGoal(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="難度偏好">
          <Input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
        <FieldGroup label="每日學習時間">
          <Input value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} className="bg-muted border-border" />
        </FieldGroup>
      </SectionCard>

      {/* 平台連線設定 */}
      <SectionCard icon={<Link className="w-5 h-5 text-primary" />} title="平台連線設定">
        <FieldGroup label="Webhook URL">
          <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="bg-muted border-border" />
          <p className="text-xs text-muted-foreground mt-1">請輸入 Smart4A 提供的完整 Webhook URL，用於同步學習資料</p>
        </FieldGroup>
        <ToggleRow title="自動同步學習進度" desc="開啟後會自動將您的學習進度同步至雲端" checked={autoSync} onChange={setAutoSync} />

        <Button variant="outline" className="w-full mt-2 border-warning/50 text-warning hover:bg-warning/10">
          🔧 測試連線
        </Button>
      </SectionCard>

      {/* 數據管理 */}
      <SectionCard icon={<BarChart3 className="w-5 h-5 text-primary" />} title="數據管理">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button className="gradient-orange text-primary-foreground hover:opacity-90">📤 匯出學習資料</Button>
          <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">🔄 同步雲端資料</Button>
          <Button variant="outline" className="text-muted-foreground hover:text-foreground">🗑 清除快取</Button>
          <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">⚠ 重置所有設定</Button>
        </div>
      </SectionCard>

      {/* 關於 */}
      <SectionCard icon={<Info className="w-5 h-5 text-chart-cyan" />} title="關於">
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Smart4A 學員俱樂部專區 v0.2.2</h3>
            <span className="text-xs text-primary font-medium">最新版本</span>
          </div>
          <p className="text-sm text-primary">Smart4A × make.fan</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            結合 Smart4A 的專業自動化課程內容與 make.com 的智能學習輔助，為您打造最佳的流程自動化學習體驗。此為測試體驗版 0.2.2 (2025/09/24)，所有功能開發尚未齊全，如學員有任何想法或建議，歡迎提供反饋。
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span>📘 Smart4A 官方授權</span>
            <span>🌐 make.fan 技術支援</span>
            <span>📧 應用反饋：service@fans.tw</span>
          </div>
        </div>
      </SectionCard>

      {/* 儲存按鈕 */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-12 text-base font-semibold gradient-orange text-primary-foreground hover:opacity-90 rounded-xl"
      >
        {saving ? "儲存中..." : "💾 儲存所有設定"}
      </Button>

      <div className="h-6" />
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1 h-5 rounded-full bg-primary" />
        {icon}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange }: { title: React.ReactNode; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="glass-card p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
