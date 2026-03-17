import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  gradient?: string;
  delay?: number;
}

export function StatCard({ icon, value, label, gradient = "gradient-orange", delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 flex items-center gap-4 hover:border-primary/40 transition-colors"
    >
      <div className={`w-10 h-10 rounded-xl ${gradient} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}
