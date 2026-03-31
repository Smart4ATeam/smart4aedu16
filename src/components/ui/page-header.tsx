import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * 頁面標題區塊 — 使用透明度漸層背景，而非大色塊。
 * 統一用於 Admin 和學員頁面的頂部橫幅。
 */
export function PageHeader({ icon, title, description, className, children }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border p-6",
        "bg-gradient-to-br from-accent/8 via-accent/4 to-transparent",
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-1">
          {icon && (
            <div className="text-primary">{icon}</div>
          )}
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 ml-0">{description}</p>
        )}
        {children}
      </div>
      {/* 裝飾性背景元素 */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
    </div>
  );
}
