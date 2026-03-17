import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface MonthData {
  month: string;
  revenue: number;
}

function getCSSVar(name: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : undefined;
}

export function RevenueChart() {
  const { user } = useAuth();
  const [data, setData] = useState<MonthData[]>([]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("revenue_records")
      .select("amount, recorded_at")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true })
      .then(({ data: records }) => {
        if (!records || records.length === 0) {
          setData([]);
          return;
        }

        const monthMap = new Map<string, number>();
        records.forEach((r) => {
          const date = new Date(r.recorded_at);
          const key = `${date.getFullYear()}-${date.getMonth()}`;
          monthMap.set(key, (monthMap.get(key) ?? 0) + Number(r.amount));
        });

        const sorted = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, revenue]) => {
            const month = parseInt(key.split("-")[1]) + 1;
            return { month: `${month}月`, revenue };
          });

        setData(sorted);
      });
  }, [user]);

  const primaryColor = getCSSVar("--primary") ?? "hsl(20, 90%, 54%)";
  const borderColor = getCSSVar("--border") ?? "hsl(230, 10%, 90%)";
  const mutedFgColor = getCSSVar("--muted-foreground") ?? "hsl(230, 8%, 50%)";
  const cardColor = getCSSVar("--card") ?? "hsl(0, 0%, 100%)";
  const fgColor = getCSSVar("--foreground") ?? "hsl(230, 20%, 15%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-foreground mb-4">收益趨勢</h3>
      <div className="h-[280px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            尚無收益紀錄
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={borderColor} />
              <XAxis
                dataKey="month"
                tick={{ fill: mutedFgColor, fontSize: 11 }}
                axisLine={{ stroke: borderColor }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: mutedFgColor, fontSize: 11 }}
                axisLine={{ stroke: borderColor }}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: cardColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: fgColor,
                }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "收益"]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={primaryColor}
                strokeWidth={2}
                fill="url(#primaryGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
