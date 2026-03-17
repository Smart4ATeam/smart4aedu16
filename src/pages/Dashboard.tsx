import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { RevenueChart } from "@/components/RevenueChart";
import { AchievementSection } from "@/components/AchievementSection";
import { LearningPath } from "@/components/LearningPath";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  Zap,
  Award,
  TrendingUp,
} from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{
    display_name: string;
    learning_days: number;
    total_points: number;
    total_badges: number;
    total_revenue: number;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, learning_days, total_points, total_badges, total_revenue")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  const displayName = profile?.display_name || "學員";

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold text-foreground">歡迎回來，{displayName} 👋</h2>
        <p className="text-sm text-muted-foreground mt-1">
          今天是你學習的第 {profile?.learning_days ?? 0} 天，繼續加油！
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<CalendarDays className="w-5 h-5 text-primary-foreground" />}
          value={profile?.learning_days ?? 0}
          label="學習天數"
          gradient="gradient-orange"
          delay={0}
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-primary-foreground" />}
          value={(profile?.total_points ?? 0).toLocaleString()}
          label="累計點數"
          gradient="gradient-purple"
          delay={0.05}
        />
        <StatCard
          icon={<Award className="w-5 h-5 text-primary-foreground" />}
          value={profile?.total_badges ?? 0}
          label="獲得勳章"
          gradient="gradient-lime"
          delay={0.1}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-primary-foreground" />}
          value={`$${(profile?.total_revenue ?? 0).toLocaleString()}`}
          label="總收益"
          gradient="gradient-orange"
          delay={0.15}
        />
      </div>

      {/* Chart + Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div>
          <AchievementSection />
        </div>
      </div>

      {/* Learning Path */}
      <LearningPath />
    </div>
  );
};

export default Dashboard;
