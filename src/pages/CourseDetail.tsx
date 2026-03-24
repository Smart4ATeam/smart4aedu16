import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ContentRenderer } from "@/components/learning/ContentRenderer";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, instructors(name, bio, partners(name))")
        .eq("id", courseId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["course_units", courseId],
    enabled: !!courseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_units")
        .select("*, unit_sections(*)")
        .eq("course_id", courseId!)
        .order("sort_order");
      if (error) throw error;
      // Sort sections within each unit
      return (data || []).map((unit: any) => ({
        ...unit,
        unit_sections: (unit.unit_sections || []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        ),
      }));
    },
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/learning")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> 返回學習中心
      </Button>

      {course && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {course.cover_url ? (
            <img src={course.cover_url} alt={course.title} className="w-full h-48 object-cover" />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
              <BookOpen className="w-16 h-16 text-primary/30" />
            </div>
          )}
          <div className="p-6 space-y-2">
            <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
            <p className="text-muted-foreground">{course.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>講師：{(course as any).instructors?.name || "未指定"}</span>
              {(course as any).instructors?.partners?.name && (
                <span>單位：{(course as any).instructors.partners.name}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {units.length > 0 ? (
        <Accordion type="single" collapsible className="space-y-3">
          {units.map((unit: any) => (
            <AccordionItem key={unit.id} value={unit.id} className="glass-card rounded-xl border-none px-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <span className="text-lg font-bold text-foreground">{unit.title}</span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-8">
                  {unit.unit_sections.map((section: any) => (
                    <ContentRenderer key={section.id} section={section} />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>此課程尚未建立內容</p>
        </div>
      )}
    </div>
  );
}
