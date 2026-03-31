import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconBoxVariant = "primary" | "success" | "warning" | "info" | "muted";

const variantClasses: Record<IconBoxVariant, string> = {
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  info:    "bg-chart-cyan/12 text-chart-cyan",
  muted:   "bg-muted text-muted-foreground",
};

interface IconBoxProps {
  children: ReactNode;
  variant?: IconBoxVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * 圖示容器 — 使用透明度背景色，取代大色塊漸層。
 * 用於 StatCard、API 端點等圖示區域。
 */
export function IconBox({ children, variant = "primary", size = "md", className }: IconBoxProps) {
  const sizeClasses = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-10 h-10 rounded-xl",
    lg: "w-12 h-12 rounded-xl",
  };

  return (
    <div className={cn(sizeClasses[size], variantClasses[variant], "flex items-center justify-center", className)}>
      {children}
    </div>
  );
}
