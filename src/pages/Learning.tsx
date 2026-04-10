import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, GraduationCap, ClipboardCheck, MapPin, CalendarDays, Users, ArrowRight, Award } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { categoryLabels, categoryColors } from "@/lib/category-colors";

export default function Learning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Fetch courses with instructor + partner
  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, instructors(name, partner_id, partners(name))")
        .eq("status", "published")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ["course_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_sessions")
        .select("*, registration_url")
        .in("status", ["open", "scheduled"])
        .order("start_date");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch user enrollments (by direct user_id OR via reg_members.user_id linkage)
  const { data: enrollments = [] } = useQuery({
    queryKey: ["my_enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // First try direct user_id match
      const { data: directData } = await supabase
        .from("reg_enrollments")
        .select("*, courses(id, title, category, cover_url, instructors(name)), course_sessions(*, courses(id, title, category, cover_url, instructors(name)))")
        .eq("user_id", user!.id);

      // Also find via reg_members linkage
      const { data: memberData } = await supabase
        .from("reg_members" as any)
        .select("id")
        .eq("user_id", user!.id);

      const memberIds = (memberData || []).map((m: any) => m.id);
      let memberEnrollments: any[] = [];
      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("reg_enrollments")
          .select("*, courses(id, title, category, cover_url, instructors(name)), course_sessions(*, courses(id, title, category, cover_url, instructors(name)))")
          .in("member_id", memberIds);
        memberEnrollments = data || [];
      }

      // Merge and deduplicate by id
      const allEnrollments = [...(directData || []), ...memberEnrollments];
      const seen = new Set<string>();
      return allEnrollments.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    },
  });

  // Fetch enrollment counts per session
  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["enrollment_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reg_enrollments").select("session_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((e: { session_id: string }) => { counts[e.session_id] = (counts[e.session_id] || 0) + 1; });
      return counts;
    },
  });

  // Fetch quiz attempts
  const { data: quizAttempts = [] } = useQuery({
    queryKey: ["my_quiz_attempts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, course_quizzes(title, course_id, courses(title))")
        .eq("user_id", user!.id)
        .order("attempted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from("reg_enrollments").insert({
        user_id: user!.id,
        session_id: sessionId,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("報名成功！請等待確認。");
      queryClient.invalidateQueries({ queryKey: ["my_enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["enrollment_counts"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("duplicate") ? "您已報名此梯次" : "報名失敗"),
  });

  const selectedCourseData = courses.find((c: { id: string }) => c.id === selectedCourse);
  const courseSessions = sessions.filter((s: { course_id: string }) => s.course_id === selectedCourse);
  const enrolledSessionIds = new Set(enrollments.map((e: { session_id: string }) => e.session_id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">學習中心</h1>
        <p className="text-muted-foreground text-sm mt-1">探索課程、追蹤學習進度</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2"><BookOpen className="w-4 h-4" />課程總覽</TabsTrigger>
          <TabsTrigger value="my" className="gap-2"><GraduationCap className="w-4 h-4" />我的課程</TabsTrigger>
          <TabsTrigger value="quiz" className="gap-2"><ClipboardCheck className="w-4 h-4" />測驗與成績</TabsTrigger>
        </TabsList>

        {/* Tab 1: Course Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course: any) => (
              <div
                key={course.id}
                className="glass-card rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all group"
                onClick={() => setSelectedCourse(course.id)}
              >
                {course.cover_url ? (
                  <img src={course.cover_url} alt={course.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                    <BookOpen className="w-12 h-12 text-primary/40" />
                  </div>
                )}
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={categoryColors[course.category] || ""}>{categoryLabels[course.category] || course.category}</Badge>
                    {course.price === 0 && <Badge variant="outline" className="text-xs">免費</Badge>}
                  </div>
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{course.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{course.description}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{course.instructors?.name || "未指定講師"}</span>
                    {course.price > 0 && <span className="text-primary font-bold">NT$ {course.price.toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            ))}
            {courses.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>目前沒有可報名的課程</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: My Courses */}
        <TabsContent value="my">
          <div className="space-y-4">
            {enrollments.map((enrollment: any) => {
              const session = enrollment.course_sessions;
              const course = session?.courses || enrollment.courses;
              const courseTitle = course?.title || "未知課程";
              const courseId = course?.id || enrollment.course_id;
              return (
                <div key={enrollment.id} className="glass-card rounded-xl p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-foreground truncate">{courseTitle}</h3>
                      <Badge
                        variant={enrollment.status === "cancelled" ? "destructive" : enrollment.payment_status === "paid" ? "default" : "outline"}
                        className="text-xs shrink-0"
                      >
                        {enrollment.status === "cancelled" ? "已取消" : enrollment.payment_status === "paid" ? "已繳費" : "待繳費"}
                      </Badge>
                      {enrollment.is_retrain && <Badge variant="secondary" className="text-xs">複訓</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {enrollment.session_date && (
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{enrollment.session_date}</span>
                      )}
                      {!enrollment.session_date && session?.start_date && (
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{session.start_date} ~ {session.end_date || "未定"}</span>
                      )}
                      {session?.location && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{session.location}</span>
                      )}
                    </div>
                  </div>
                  {enrollment.payment_status === "paid" && courseId && (
                    <Button size="sm" onClick={() => navigate(`/learning/course/${courseId}`)} className="shrink-0 gap-1">
                      查看內容 <ArrowRight className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              );
            })}
            {enrollments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>您尚未報名任何課程</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Quizzes */}
        <TabsContent value="quiz">
          <div className="space-y-4">
            {quizAttempts.length > 0 ? quizAttempts.map((attempt: any) => (
              <div key={attempt.id} className="glass-card rounded-xl p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{attempt.course_quizzes?.title}</h3>
                  <p className="text-xs text-muted-foreground">{attempt.course_quizzes?.courses?.title} · {new Date(attempt.attempted_at).toLocaleDateString("zh-TW")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${attempt.passed ? "text-green-500" : "text-destructive"}`}>{attempt.score} 分</span>
                  <Badge variant={attempt.passed ? "default" : "destructive"}>{attempt.passed ? "通過" : "未通過"}</Badge>
                </div>
              </div>
            )) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>尚無測驗紀錄</p>
              </div>
            )}
            <div className="glass-card rounded-xl p-5 text-center border-dashed border-2 border-border">
              <Award className="w-8 h-8 mx-auto mb-2 text-primary/40" />
              <p className="text-sm text-muted-foreground">🎓 證書下載功能即將推出</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Course Detail Dialog */}
      <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          {/* Cover */}
          {selectedCourseData?.cover_url ? (
            <img src={selectedCourseData.cover_url} alt={selectedCourseData.title} className="w-full h-48 object-cover rounded-t-lg" />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center rounded-t-lg">
              <BookOpen className="w-16 h-16 text-primary/30" />
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* Title + badges */}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className={categoryColors[selectedCourseData?.category || ""] || ""}>{categoryLabels[selectedCourseData?.category || ""] || selectedCourseData?.category}</Badge>
                {selectedCourseData?.price === 0 && <Badge variant="outline" className="text-xs">免費</Badge>}
                {(selectedCourseData?.tags as string[])?.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedCourseData?.title}</DialogTitle>
              </DialogHeader>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{selectedCourseData?.description}</p>

            {/* Long description */}
            {selectedCourseData?.long_description && (
              <div className="pt-2 border-t border-border space-y-2">
                <h4 className="font-semibold text-foreground text-sm">課程詳細介紹</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{selectedCourseData.long_description}</p>
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                <GraduationCap className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xs text-muted-foreground">講師</p>
                <p className="text-sm font-medium text-foreground">{(selectedCourseData as any)?.instructors?.name || "未指定"}</p>
              </div>
              {(selectedCourseData as any)?.instructors?.partners?.name && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <Users className="w-4 h-4 mx-auto mb-1 text-accent" />
                  <p className="text-xs text-muted-foreground">單位</p>
                  <p className="text-sm font-medium text-foreground">{(selectedCourseData as any).instructors.partners.name}</p>
                </div>
              )}
              {selectedCourseData?.total_hours > 0 && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <CalendarDays className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <p className="text-xs text-muted-foreground">總時數</p>
                  <p className="text-sm font-medium text-foreground">{selectedCourseData.total_hours} 小時</p>
                </div>
              )}
              {selectedCourseData?.price > 0 && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border text-center">
                  <Award className="w-4 h-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">費用</p>
                  <p className="text-sm font-bold text-primary">NT$ {selectedCourseData.price.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Materials link */}
            {selectedCourseData?.materials_url && (
              <a
                href={selectedCourseData.materials_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <BookOpen className="w-4 h-4" />
                📄 課前教材
              </a>
            )}
            {selectedCourseData?.detail_url && (
              <a
                href={selectedCourseData.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ArrowRight className="w-4 h-4" />
                🔗 查看完整課程介紹
              </a>
            )}

            {/* Registration */}
            <div className="pt-2 border-t border-border space-y-3">
              {courseSessions.some((s: any) => s.status === "open") ? (
                <>
                  <h4 className="font-semibold text-foreground text-sm">近期開課日期</h4>
                  <div className="flex flex-wrap gap-2">
                    {courseSessions.filter((s: any) => s.status === "open").map((s: any) => (
                      <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-sm text-foreground">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" />
                        {s.start_date}{s.end_date && s.end_date !== s.start_date ? ` ~ ${s.end_date}` : ""}
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => {
                      const url = selectedCourseData?.registration_url || courseSessions[0]?.registration_url || "https://dao.smart4a.tw/registration";
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    前往報名
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center">目前沒有開放報名的梯次</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
