import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  ClipboardCheck,
  FolderOpen,
  Users,
  Megaphone,
  CalendarDays,
  LogOut,
  ShieldCheck,
  Plug,
  BookOpen,
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
  { title: "營運看板", url: "/admin", icon: LayoutDashboard },
  { title: "使用者管理", url: "/admin/students", icon: Users },
  { title: "學習中心", url: "/admin/learning", icon: BookOpen },
  { title: "任務管理", url: "/admin/tasks", icon: ClipboardCheck },
  { title: "資源管理", url: "/admin/resources", icon: FolderOpen },
  { title: "訊息廣播", url: "/admin/broadcast", icon: Megaphone },
  { title: "行事曆管理", url: "/admin/calendar", icon: CalendarDays },
  { title: "API 串接", url: "/admin/integrations", icon: Plug },
  { title: "管理者 Agent", url: "/admin/agent", icon: Bot },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const displayName = profile?.display_name || "管理員";
  const initials = displayName.slice(0, 1);
  const emailText = profile?.email || user?.email || "";
  const [unreadCount, setUnreadCount] = useState(0);

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
      .channel("admin_sidebar_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
          <p className="text-[10px] text-muted-foreground mt-1.5">Admin Console</p>
        </div>

        {/* Nav */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.url === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(item.url);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/admin"}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive
                    ? ""
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                activeClassName="bg-primary/10 text-primary font-medium glow-orange"
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom */}
      <div className="p-5 space-y-2">
        {/* 返回學員端入口 */}
        <NavLink
          to="/"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>返回學員端</span>
        </NavLink>

        {/* Avatar + Bell row */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left min-w-0">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
                  <AvatarFallback className="gradient-purple text-xs font-bold text-primary-foreground">
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
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 訊息中心：僅圖示 */}
          <NavLink
            to="/messages"
            aria-label="訊息中心"
            title="訊息中心"
            className={`relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
              isMessagesActive
                ? "bg-primary/10 text-primary"
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
