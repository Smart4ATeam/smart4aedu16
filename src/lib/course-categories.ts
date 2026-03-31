// ===== 課程分類 =====
export const categoryLabels: Record<string, string> = {
  quest: "入門班",
  basic: "基礎班",
  intermediate: "中階班",
  advanced: "高階班",
  special: "特殊課程",
};

export const categoryColors: Record<string, string> = {
  quest: "bg-primary/10 text-primary border border-primary/20",
  basic: "bg-accent/10 text-accent border border-accent/20",
  intermediate: "bg-chart-cyan/10 text-chart-cyan border border-chart-cyan/20",
  advanced: "bg-success/10 text-success border border-success/20",
  special: "bg-destructive/10 text-destructive border border-destructive/20",
};

// ===== 任務等級 =====
export const difficultyColors: Record<string, string> = {
  "初級": "text-accent bg-accent/10 border-accent/20",
  "中級": "text-chart-cyan bg-chart-cyan/10 border-chart-cyan/20",
  "中階": "text-chart-cyan bg-chart-cyan/10 border-chart-cyan/20",
  "高階": "text-success bg-success/10 border-success/20",
};
