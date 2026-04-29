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
                  <AvatarFallback className="gradient-purple text-xs font-bold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-primary" />
                    <p className="text-[10px] text-muted-foreground">管理員</p>
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
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 訊息中心入口 */}
        <NavLink
          to="/messages"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
            isMessagesActive
              ? "bg-primary/10 text-primary font-medium"
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

        {/* 返回學員端入口 */}
        <NavLink
          to="/"
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>返回學員端</span>
        </NavLink>
      </div>
    </aside>
  );
}
