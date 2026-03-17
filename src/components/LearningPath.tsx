import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Step {
  label: string;
  status: "done" | "current" | "locked";
}

export function LearningPath() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchPath = async () => {
      // Get first learning path
      const { data: paths } = await supabase
        .from("learning_paths")
        .select("id, title, total_steps")
        .order("sort_order", { ascending: true })
        .limit(1);

      if (!paths || paths.length === 0) {
        setSteps([]);
        return;
      }

      const path = paths[0];

      // Get user progress
      const { data: progress } = await supabase
        .from("user_learning_progress")
        .select("current_step, completed")
        .eq("user_id", user.id)
        .eq("learning_path_id", path.id)
        .maybeSingle();

      const currentStep = progress?.current_step ?? 0;
      const stepLabels = ["基礎入門", "工具實作", "進階應用", "專案實戰", "認證結業"];

      const result: Step[] = [];
      for (let i = 0; i < path.total_steps; i++) {
        const label = stepLabels[i] ?? `步驟 ${i + 1}`;
        if (i < currentStep) {
          result.push({ label, status: "done" });
        } else if (i === currentStep) {
          result.push({ label, status: progress?.completed ? "done" : "current" });
        } else {
          result.push({ label, status: "locked" });
        }
      }

      setSteps(result);
    };

    fetchPath();
  }, [user]);

  if (steps.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="glass-card p-5"
      >
        <h3 className="text-sm font-semibold text-foreground mb-6">學習路徑</h3>
        <p className="text-xs text-muted-foreground">尚無學習路徑資料</p>
      </motion.div>
    );
  }

  const doneCount = steps.filter((s) => s.status === "done").length;
  const progressPercent = steps.length > 1 ? (doneCount / (steps.length - 1)) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="glass-card p-5"
    >
      <h3 className="text-sm font-semibold text-foreground mb-6">學習路徑</h3>
      <div className="flex items-center justify-between relative px-4">
        {/* Connecting line */}
        <div className="absolute top-4 left-[10%] right-[10%] h-0.5 bg-border" />
        <div
          className="absolute top-4 left-[10%] h-0.5 bg-chart-green"
          style={{ width: `${Math.min(progressPercent * 0.8, 80)}%` }}
        />

        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center relative z-10 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                step.status === "done"
                  ? "gradient-lime text-primary-foreground"
                  : step.status === "current"
                  ? "gradient-orange text-primary-foreground ring-2 ring-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step.status === "done" ? (
                <Check className="w-4 h-4" />
              ) : step.status === "locked" ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`text-[11px] ${
                step.status === "current"
                  ? "text-primary font-medium"
                  : step.status === "done"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
