import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Target,
  CalendarDays,
  Gem,
  GraduationCap,
  BookOpen,
  Coins,
  Settings,
  LogOut,
  ShieldCheck,
  Bot,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
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
  const roleBadge = isAdmin ? "管理員" : "進階學員";
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
      <div className="p-5 space-y-3">
        {/* Avatar Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="glass-card p-3 w-full text-left hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                  <div className="flex items-center gap-1">
                    {isAdmin && <ShieldCheck className="w-3 h-3 text-primary" />}
                    <p className="text-[10px] text-muted-foreground">{roleBadge}</p>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="min-w-[200px]">
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              <span>設定</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/agent")}>
              <Bot className="mr-2 h-4 w-4" />
              <span>個人 Agent</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">主題</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")} className={theme === "light" ? "text-primary font-medium" : ""}>
              <Sun className="mr-2 h-4 w-4" />
              <span>淺色模式</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")} className={theme === "dark" ? "text-primary font-medium" : ""}>
              <Moon className="mr-2 h-4 w-4" />
              <span>深色模式</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")} className={theme === "system" ? "text-primary font-medium" : ""}>
              <Monitor className="mr-2 h-4 w-4" />
              <span>系統預設</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => { await signOut(); navigate("/auth"); }}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>登出</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 訊息中心入口 */}
        <NavLink
          to="/messages"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
            isMessagesActive
              ? "bg-accent/10 text-accent font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-[18px] h-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive border border-sidebar" />
            )}
          </div>
          <span className="flex-1">訊息中心</span>
          {unreadCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0 h-4 min-w-[18px] justify-center border-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </NavLink>

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
      </div>
    </aside>
  );
}
