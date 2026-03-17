import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Star, Flame, Gem, Rocket } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "🏆": Trophy,
  "⭐": Star,
  "🔥": Flame,
  "💎": Gem,
  "🚀": Rocket,
};

interface AchievementDisplay {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  earned: boolean;
}

const colorMap: Record<string, string> = {
  general: "text-warning",
  streak: "text-primary",
  task: "text-chart-cyan",
  knowledge: "text-accent",
  growth: "text-success",
};

export function AchievementSection() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<AchievementDisplay[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchAchievements = async () => {
      const { data: allAchievements } = await supabase
        .from("achievements")
        .select("id, name, icon, category")
        .order("created_at", { ascending: true });

      const { data: userAchievements } = await supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", user.id);

      const earnedIds = new Set(userAchievements?.map((ua) => ua.achievement_id) ?? []);

      const display: AchievementDisplay[] = (allAchievements ?? []).map((a) => ({
        icon: iconMap[a.icon] ?? Trophy,
        label: a.name,
        color: colorMap[a.category] ?? "text-warning",
        earned: earnedIds.has(a.id),
      }));

      setAchievements(display);
    };

    fetchAchievements();
  }, [user]);

  if (achievements.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="glass-card p-5 h-full"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">成就勳章</h3>
        <p className="text-xs text-muted-foreground">尚無成就資料</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className="glass-card p-5 h-full"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">成就勳章</h3>
      <div className="space-y-3">
        {achievements.map((a, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              a.earned ? "bg-muted" : "bg-muted/40 opacity-40"
            }`}
          >
            <a.icon className={`w-5 h-5 ${a.color}`} />
            <span className="text-xs font-medium text-foreground">{a.label}</span>
            {a.earned && (
              <span className="ml-auto text-[10px] text-primary font-medium">已獲得</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
