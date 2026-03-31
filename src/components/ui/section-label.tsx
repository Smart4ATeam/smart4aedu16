import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 區段標題 — 左側帶有主色豎條的段落標題。
 */
export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="w-1 h-5 rounded-full bg-accent" />
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
    </div>
  );
}
