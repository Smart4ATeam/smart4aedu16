import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Mail, Lock, IdCard, UserCheck, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/contexts/ThemeContext";
import logoFed from "@/assets/logo-fed.png";
import logoW from "@/assets/logo-w.png";

type AuthMode = "login" | "activate" | "forgot";

const GoogleIcon = () =>
<svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>;


export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Verify Google activation after OAuth redirect
  const verifyGoogleActivation = useCallback(async (userId: string, userEmail: string | undefined) => {
    const pendingStudentId = sessionStorage.getItem("pending_activation_student_id");
    const pendingEmail = sessionStorage.getItem("pending_activation_email");
    if (!pendingStudentId) return false; // Not a pending activation

    sessionStorage.removeItem("pending_activation_student_id");
    sessionStorage.removeItem("pending_activation_email");

    // Verify the Google account email matches the registration email
    if (pendingEmail && userEmail && userEmail.toLowerCase() !== pendingEmail.toLowerCase()) {
      toast.error(`啟用失敗：您使用的 Google 帳號 (${userEmail}) 與報名時提供的 Email (${pendingEmail}) 不一致。`);
      await supabase.auth.signOut();
      return true;
    }

    const { data: profile } = await supabase.
    from("profiles").
    select("student_id, activated").
    eq("id", userId).
    single();

    if (profile?.student_id === pendingStudentId && profile?.activated) {
      toast.success("帳號啟用成功！已透過 Google 帳號綁定。");
      return true; // Verified, proceed to dashboard
    } else {
      toast.error("啟用失敗：學員編號與 Google 帳號不匹配，請確認您使用的是報名時提供的 Email。");
      await supabase.auth.signOut();
      return true; // Handled, don't navigate
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const handled = await verifyGoogleActivation(user.id, user.email);
      if (!handled) {
        // Normal login — redirect to dashboard
        navigate("/", { replace: true });
      } else {
        // If activation succeeded, also redirect
        const pendingCleared = !sessionStorage.getItem("pending_activation_student_id");
        // verifyGoogleActivation returns true in both cases
        // Check if user is still signed in (activation success) or signed out (failure)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate("/", { replace: true });
        }
      }
    };
    check();
  }, [user, navigate, verifyGoogleActivation]);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("登入成功！");
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
    });
    if (error) toast.error(error.message);
  };

  const handleGoogleActivate = async () => {
    if (!studentId.trim()) {
      toast.error("請先輸入學員編號");
      return;
    }
    if (!email.trim()) {
      toast.error("請先輸入報名時提供的 Email");
      return;
    }
    // Store student_id + email for post-OAuth verification
    sessionStorage.setItem("pending_activation_student_id", studentId.trim());
    sessionStorage.setItem("pending_activation_email", email.trim().toLowerCase());

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`
      }
    });
    if (error) {
      sessionStorage.removeItem("pending_activation_student_id");
      sessionStorage.removeItem("pending_activation_email");
      toast.error(error.message);
    }
  };

  const handleActivate = async () => {
    if (!email.trim()) {toast.error("請輸入電子信箱");return;}
    if (!studentId.trim()) {toast.error("請輸入學員編號");return;}
    if (!password.trim() || password.length < 6) {toast.error("密碼至少需要 6 個字元");return;}

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-account", {
        body: { email, student_id: studentId, password }
      });

      if (error) {toast.error("啟用失敗，請稍後再試");setLoading(false);return;}
      if (data?.error) {toast.error(data.error);setLoading(false);return;}

      toast.success("帳號啟用成功！正在為您登入⋯");
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        toast.error("自動登入失敗，請手動登入");
        setMode("login");
      }
    } catch {
      toast.error("啟用失敗，請稍後再試");
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {toast.error("請輸入電子信箱");return;}
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("密碼重設連結已寄出，請檢查信箱。");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") handleLogin();else
    if (mode === "activate") handleActivate();else
    handleForgotPassword();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <img
            src={theme === "dark" || theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? logoW : logoFed}
            alt="Smart4A Logo"
            className="h-7 mx-auto mb-2 object-contain" />
          
          <h1 className="text-2xl font-bold text-foreground">學員俱樂部</h1>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "login" ?
            "bg-primary text-primary-foreground" :
            "bg-muted text-muted-foreground hover:text-foreground"}`
            }>
            
            <LogIn className="w-4 h-4" />
            登入
          </button>
          <button
            type="button"
            onClick={() => setMode("activate")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            mode === "activate" ?
            "bg-primary text-primary-foreground" :
            "bg-muted text-muted-foreground hover:text-foreground"}`
            }>
            
            <UserCheck className="w-4 h-4" />
            啟用帳號
          </button>
        </div>

        {/* Form Card */}
        <div className="glass-card p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email - shown in login & forgot modes */}
            {mode !== "activate" &&
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">電子信箱</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 bg-muted border-border"
                  required />
                
                </div>
              </div>
            }

            {/* Activate mode fields */}
            {mode === "activate" &&
            <>
                {/* Section 1: Google 啟用 */}
                <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">方式一：使用 Google 帳號啟用</p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      學員編號 <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="例：SA26011001"
                      className="pl-10 bg-muted border-border"
                      required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      報名時提供的 Email <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-10 bg-muted border-border"
                      required />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      您的 Google 帳號 Email 必須與此 Email 一致才能成功啟用
                    </p>
                  </div>
                  <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-2 font-medium"
                  onClick={handleGoogleActivate}>
                    <GoogleIcon />
                    使用 Google 帳號啟用
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">或</span>
                  <Separator className="flex-1" />
                </div>

                {/* Section 2: Email 啟用 */}
                <div className="space-y-3 p-4 rounded-lg border border-border/50 bg-muted/30">
                  <p className="text-sm font-semibold text-foreground">方式二：使用 Email 啟用</p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      學員編號 <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="例：SA26011001"
                      className="pl-10 bg-muted border-border" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      電子信箱 <span className="text-destructive">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-10 bg-muted border-border" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      請使用報名時提供的E-mail帳號或是學員綁定的E-mail帳號啟用
                    </p>
                  </div>
                </div>
              </>
            }

            {/* Password - login & activate modes */}
            {mode !== "forgot" &&
            <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {mode === "activate" ? "設定密碼" : "密碼"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-muted border-border"
                  required={mode === "login"}
                  minLength={6} />
                
                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "activate" &&
              <p className="text-[11px] text-muted-foreground">密碼至少 6 個字元</p>
              }
              </div>
            }

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-semibold hover:bg-primary/90">
              
              {loading ?
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> :
              mode === "login" ?
              "登入" :
              mode === "activate" ?
              "以 Email 啟用帳號" :

              "寄送重設連結"
              }
            </Button>
          </form>

          {/* Google login - only in login mode */}
          {mode === "login" &&
          <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">或</span>
                <Separator className="flex-1" />
              </div>
              <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2 font-medium"
              onClick={handleGoogleLogin}>
              
                <GoogleIcon />
                使用 Google 帳號登入
              </Button>
            </>
          }

          {/* Extra links */}
          <div className="text-center text-sm">
            {mode === "login" &&
            <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-primary transition-colors">
                忘記密碼？
              </button>
            }
            {mode === "forgot" &&
            <button onClick={() => setMode("login")} className="text-primary font-medium hover:underline">
                ← 返回登入
              </button>
            }
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          Smart4A × make.fan · 學員俱樂部專區
        </p>
      </motion.div>
    </div>);

}