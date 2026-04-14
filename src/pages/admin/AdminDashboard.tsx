import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatCard } from "@/components/StatCard";
import { Users, UserCheck, FileText, DollarSign } from "lucide-react";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface StudentRow {
  display_name: string;
  learning_days: number;
  member_points: number;
  total_revenue: number;
}

interface RevenueMonth {
  month: string;
  revenue: number;
}

const AdminDashboard = () => {
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [monthlyTasks, setMonthlyTasks] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueMonth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [membersRes, profilesRes, loginRes, tasksRes, revenueRes, regMembersRes] = await Promise.all([
        // Total students = reg_members count
        supabase.from("reg_members").select("id", { count: "exact", head: true }),
        // All activated profiles for active student check & progress table
        supabase.from("profiles").select("id, display_name, learning_days, total_points, total_revenue, activated"),
        // Login tracks in last 3 months
        supabase.from("login_tracks").select("user_id, login_date")
          .gte("login_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
        supabase.from("tasks").select("id, created_at"),
        supabase.from("revenue_records").select("amount, recorded_at"),
        // reg_members with points for the progress table
        supabase.from("reg_members").select("user_id, points"),
      ]);

      // Total students from reg_members
      setTotalStudents(membersRes.count || 0);

      // Build member points map (user_id -> points)
      const memberPointsMap = new Map<string, number>();
      if (regMembersRes.data) {
        for (const m of regMembersRes.data) {
          if (m.user_id) memberPointsMap.set(m.user_id, m.points || 0);
        }
      }

      // Active students: activated profiles with login in last 3 months
      if (profilesRes.data) {
        const recentLoginUserIds = new Set(
          (loginRes.data || []).map((l: any) => l.user_id)
        );
        const activatedProfiles = profilesRes.data.filter(p => p.activated);
        const activeCount = activatedProfiles.filter(p => recentLoginUserIds.has(p.id)).length;
        setActiveStudents(activeCount);

        // Student progress table: show all activated profiles with member points
        setStudents(activatedProfiles.map(p => ({
          display_name: p.display_name,
          learning_days: p.learning_days,
          member_points: memberPointsMap.get(p.id) || 0,
          total_revenue: p.total_revenue,
        })));
      }

      if (tasksRes.data) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        setMonthlyTasks(tasksRes.data.filter(t => t.created_at >= monthStart).length);
      }

      if (revenueRes.data) {
        const total = revenueRes.data.reduce((sum, r) => sum + Number(r.amount), 0);
        setTotalRevenue(total);

        // Group by month
        const monthMap: Record<string, number> = {};
        revenueRes.data.forEach(r => {
          const d = new Date(r.recorded_at);
          const key = `${d.getMonth() + 1}月`;
          monthMap[key] = (monthMap[key] || 0) + Number(r.amount);
        });
        setRevenueData(Object.entries(monthMap).map(([month, revenue]) => ({ month, revenue })));
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h2 className="text-2xl font-bold text-foreground">營運數據看板</h2>
        <p className="text-sm text-muted-foreground mt-1">俱樂部整體運營狀況一覽</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Users className="w-5 h-5" />} value={totalStudents} label="總學員數" variant="primary" delay={0} />
        <StatCard icon={<UserCheck className="w-5 h-5" />} value={activeStudents} label="活躍學員" variant="info" delay={0.05} />
        <StatCard icon={<FileText className="w-5 h-5" />} value={monthlyTasks} label="本月任務發布" variant="success" delay={0.1} />
        <StatCard icon={<DollarSign className="w-5 h-5" />} value={`$${totalRevenue.toLocaleString()}`} label="總發放收益" variant="warning" delay={0.15} />
      </div>

      {revenueData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">收益趨勢</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="adminGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(180, 60%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(180, 60%, 50%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 18%)" />
                <XAxis dataKey="month" tick={{ fill: "hsl(220, 9%, 56%)", fontSize: 11 }} axisLine={{ stroke: "hsl(0, 0%, 18%)" }} tickLine={false} />
                <YAxis tick={{ fill: "hsl(220, 9%, 56%)", fontSize: 11 }} axisLine={{ stroke: "hsl(0, 0%, 18%)" }} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0, 0%, 12%)", border: "1px solid hsl(0, 0%, 18%)", borderRadius: "8px", fontSize: "12px", color: "hsl(220, 13%, 91%)" }} formatter={(value: number) => [`$${value.toLocaleString()}`, "收益"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(180, 60%, 50%)" strokeWidth={2} fill="url(#adminGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">學員進度監控</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>連續學習天數</TableHead>
              <TableHead>總點數</TableHead>
              <TableHead>總收益</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.display_name}>
                <TableCell className="font-medium">{s.display_name}</TableCell>
                <TableCell>{s.learning_days} 天</TableCell>
                <TableCell>{s.total_points.toLocaleString()}</TableCell>
                <TableCell>${Number(s.total_revenue).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
