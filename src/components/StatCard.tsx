import { motion } from "framer-motion";
import { ReactNode } from "react";
import { IconBox } from "@/components/ui/icon-box";

type StatVariant = "primary" | "success" | "warning" | "info";

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  /** @deprecated Use `variant` instead. Kept for backward compatibility. */
  gradient?: string;
  variant?: StatVariant;
  delay?: number;
}

const gradientToVariant: Record<string, StatVariant> = {
  "gradient-orange": "primary",
  "gradient-purple": "info",
  "gradient-lime": "success",
  "gradient-green": "success",
  "gradient-cyan": "info",
};

export function StatCard({ icon, value, label, gradient, variant, delay = 0 }: StatCardProps) {
  const resolvedVariant = variant ?? gradientToVariant[gradient ?? ""] ?? "primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 flex items-center gap-4 hover:border-accent/40 transition-colors"
    >
      <IconBox variant={resolvedVariant}>
        {icon}
      </IconBox>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}
