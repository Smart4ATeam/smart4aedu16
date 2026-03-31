import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Step {
  label: string;
  status: "done" | "current" | "locked";
  category: string;
}

interface SpecialCourse {
  title: string;
  enrolled: boolean;
}

// Extract short label like "入門班" from full title
function extractShortLabel(title: string): string {
  const match = title.match(/(入門班|基礎班|中階班|高階班|特訓班)/);
  return match ? match[1] : title;
}

export function LearningPath() {
  const { user } = useAuth();
  const [steps, setSteps] = useState<Step[]>([]);
  const [specials, setSpecials] = useState<SpecialCourse[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchPath = async () => {
      // 1. Get main courses (non-special), ordered by sort_order
      const { data: courses } = await supabase
        .from("courses")
        .select("id, title, category, sort_order")
        .neq("category", "special")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      // 2. Get user's enrollments joined with sessions to get course_id
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("paid, status, session_id, course_sessions(course_id)")
        .eq("user_id", user.id);

      // Build set of enrolled course IDs (paid + confirmed)
      const enrolledCourseIds = new Set<string>();
      if (enrollments) {
        for (const e of enrollments) {
          if (e.paid && e.status === "confirmed") {
            const session = e.course_sessions as any;
            if (session?.course_id) {
              enrolledCourseIds.add(session.course_id);
            }
          }
        }
      }

      // 3. Build main path steps
      if (courses && courses.length > 0) {
        let foundCurrent = false;
        const result: Step[] = courses.map((course) => {
          const label = extractShortLabel(course.title);
          const category = course.category;
          if (enrolledCourseIds.has(course.id)) {
            return { label, status: "done" as const, category };
          }
          if (!foundCurrent) {
            foundCurrent = true;
            return { label, status: "current" as const, category };
          }
          return { label, status: "locked" as const, category };
        });
        setSteps(result);
      } else {
        setSteps([]);
      }

      // 4. Get special courses
      const { data: specialCourses } = await supabase
        .from("courses")
        .select("id, title")
        .eq("category", "special")
        .eq("status", "published")
        .order("sort_order", { ascending: true });

      if (specialCourses && specialCourses.length > 0) {
        setSpecials(
          specialCourses.map((c) => ({
            title: extractShortLabel(c.title),
            enrolled: enrolledCourseIds.has(c.id),
          }))
        );
      } else {
        setSpecials([]);
      }
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
          className="absolute top-4 left-[10%] h-0.5 bg-muted-foreground/30"
          style={{ width: `${Math.min(progressPercent * 0.8, 80)}%` }}
        />

        {steps.map((step, i) => {
          // Category-based circle colors
          const categoryCircleColors: Record<string, string> = {
            quest: "bg-primary text-primary-foreground",
            basic: "bg-accent text-accent-foreground",
            intermediate: "bg-chart-cyan text-white",
            advanced: "bg-success text-white",
            special: "bg-destructive text-white",
          };
          const activeColor = categoryCircleColors[step.category] || "bg-primary text-primary-foreground";
          const circleClass =
            step.status === "done"
              ? activeColor
              : step.status === "current"
              ? `${activeColor} ring-2 ring-offset-2 ring-offset-background ring-accent/50`
              : "bg-muted text-muted-foreground";

          return (
            <div key={i} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${circleClass}`}
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
          );
        })}
      </div>

      {/* Special courses */}
      {specials.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">特訓課程</p>
          <div className="flex flex-wrap gap-2">
            {specials.map((s, i) => (
              <Badge
                key={i}
                variant={s.enrolled ? "default" : "outline"}
                className={s.enrolled ? "bg-success/15 text-success border-success/20" : ""}
              >
                {s.enrolled && <Check className="w-3 h-3 mr-1" />}
                {s.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
