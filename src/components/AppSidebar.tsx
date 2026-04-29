import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import {
  LayoutDashboard,
  Target,
  CalendarDays,
  Gem,
  BookOpen,
  Coins,
  LogOut,
  ShieldCheck,
  Bot,
  Sun,
  Moon,
  Monitor,
  Bell,
  User,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import logoFed from "@/assets/logo-fed.png";
import logoW from "@/assets/logo-w.png";

const navItems = [
  { title: "儀表板", url: "/", icon: LayoutDashboard },
  { title: "學習中心", url: "/learning", icon: BookOpen },
  { title: "任務中心", url: "/tasks", icon: Target },
  { title: "行事曆", url: "/calendar", icon: CalendarDays },
  { title: "資源中心", url: "/resources", icon: Gem },
  { title: "我的點數", url: "/points", icon: Coins },
];

export function AppSidebar() {
  const { theme, setTheme } = useTheme();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { isAdmin } = useAdminCheck();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count + real-time subscription
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("conversation_participants")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("unread", true);
      setUnreadCount(count ?? 0);
    };
    fetchUnread();

    const channel = supabase
      .channel("sidebar_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const displayName = profile?.display_name || "使用者";
  const initials = displayName.slice(0, 1);
  const emailText = profile?.email || user?.email || "";
  const isMessagesActive = location.pathname === "/messages";

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.3)] flex flex-col justify-between h-screen sticky top-0">
      <div className="p-5">
        {/* Logo */}
        <div className="mb-10 px-2">
          <img
            src={isDark ? logoW : logoFed}
            alt="Smart4A"
            className="h-7 w-auto object-contain"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5">智慧學習．無限可能</p>
        </div>

        {/* Nav */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive
                    ? ""
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                activeClassName="bg-accent/10 text-accent font-medium"
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span className="flex-1">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="p-5 space-y-2">
        {/* 管理者介面入口（僅 admin 可見） */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>管理者介面</span>
          </NavLink>
        )}

        {/* Avatar + Bell row */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left min-w-0">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                  {emailText && (
                    <p className="text-[10px] text-muted-foreground truncate">{emailText}</p>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="min-w-[220px]">
              <div className="px-2 py-2">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                {emailText && (
                  <p className="text-xs text-muted-foreground truncate">{emailText}</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <User className="mr-2 h-4 w-4" />
                <span>個人資料</span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>外觀模式</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun className="mr-2 h-4 w-4" />
                      <span className="flex-1">淺色模式</span>
                      {theme === "light" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon className="mr-2 h-4 w-4" />
                      <span className="flex-1">深色模式</span>
                      {theme === "dark" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                      <Monitor className="mr-2 h-4 w-4" />
                      <span className="flex-1">系統預設</span>
                      {theme === "system" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => navigate("/agent")}>
                <Bot className="mr-2 h-4 w-4" />
                <span>個人 Agent</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => { await signOut(); navigate("/auth"); }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>登出</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 訊息中心：僅圖示 */}
          <NavLink
            to="/messages"
            aria-label="訊息中心"
            title="訊息中心"
            className={`relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
              isMessagesActive
                ? "bg-accent/10 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Bell className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-sidebar" />
            )}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
