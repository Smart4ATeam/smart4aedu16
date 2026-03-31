import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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
} from "lucide-react";
import logoFed from "@/assets/logo-fed.png";
import logoW from "@/assets/logo-w.png";

const navItems = [
  { title: "營運看板", url: "/admin", icon: LayoutDashboard },
  { title: "使用者管理", url: "/admin/students", icon: Users },
  { title: "學習中心", url: "/admin/learning", icon: BookOpen },
  { title: "任務審核", url: "/admin/tasks", icon: ClipboardCheck },
  { title: "資源管理", url: "/admin/resources", icon: FolderOpen },
  { title: "訊息廣播", url: "/admin/broadcast", icon: Megaphone },
  { title: "行事曆管理", url: "/admin/settings", icon: CalendarDays },
  { title: "API 串接", url: "/admin/integrations", icon: Plug },
];

export function AdminSidebar() {
  const location = useLocation();
  const { profile } = useProfile();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const displayName = profile?.display_name || "管理員";
  const initials = displayName.slice(0, 1);

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col justify-between h-screen sticky top-0">
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
      <div className="p-5">
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              ) : null}
              <AvatarFallback className="gradient-purple text-xs font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium text-foreground">{displayName}</p>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-primary" />
                <p className="text-[10px] text-muted-foreground">管理員</p>
              </div>
            </div>
          </div>
        </div>
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
