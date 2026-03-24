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
  GraduationCap,
  BookOpen,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoDark from "@/assets/logo-dark.png";
import logoLight from "@/assets/logo-light.png";

const navItems = [
  { title: "儀表板", url: "/", icon: LayoutDashboard },
  { title: "學習中心", url: "/learning", icon: BookOpen },
  { title: "任務中心", url: "/tasks", icon: Target },
  { title: "行事曆", url: "/calendar", icon: CalendarDays },
  { title: "資源中心", url: "/resources", icon: Gem },
  { title: "訊息中心", url: "/messages", icon: GraduationCap },
];

const bottomNavItems = [
  { title: "設定", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { isAdmin } = useAdminCheck();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const displayName = profile?.display_name || "使用者";
  const initials = displayName.slice(0, 1);
  const roleBadge = isAdmin ? "管理員" : "進階學員";

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col justify-between h-screen sticky top-0">
      <div className="p-5">
        {/* Logo */}
        <div className="mb-10 px-2">
          <img
            src={isDark ? logoDark : logoLight}
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
                activeClassName="bg-primary/10 text-primary font-medium glow-orange"
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Separator + Settings */}
        <div className="mt-4 pt-4 border-t border-sidebar-border">
          {bottomNavItems.map((item) => {
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
                activeClassName="bg-primary/10 text-primary font-medium glow-orange"
              >
                <item.icon className="w-[18px] h-[18px]" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom */}
      <div className="p-5">
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              ) : null}
              <AvatarFallback className="gradient-orange text-xs font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs font-medium text-foreground">{displayName}</p>
              <div className="flex items-center gap-1">
                {isAdmin && <ShieldCheck className="w-3 h-3 text-primary" />}
                <p className="text-[10px] text-muted-foreground">{roleBadge}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
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
          <ThemeToggle />
        </div>
        <button
          onClick={async () => { await signOut(); navigate("/auth"); }}
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>登出</span>
        </button>
      </div>
    </aside>
  );
}
