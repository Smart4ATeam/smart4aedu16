import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Resources from "./pages/Resources";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminContent from "./pages/admin/AdminContent";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminIntegrations from "./pages/admin/AdminIntegrations";
import AdminLearning from "./pages/admin/AdminLearning";

import AdminImport from "./pages/admin/AdminImport";
import Learning from "./pages/Learning";
import CourseDetail from "./pages/CourseDetail";
import Points from "./pages/Points";
import QuizEntry from "./pages/QuizEntry";
import QuizExam from "./pages/QuizExam";
import QuizResult from "./pages/QuizResult";
import CertificateView from "./pages/CertificateView";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected student routes */}
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
            <Route path="/resources" element={<ProtectedRoute><AppLayout><Resources /></AppLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><AppLayout><Calendar /></AppLayout></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute><AppLayout><Messages /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="/learning" element={<ProtectedRoute><AppLayout><Learning /></AppLayout></ProtectedRoute>} />
            <Route path="/learning/course/:courseId" element={<ProtectedRoute><AppLayout><CourseDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/points" element={<ProtectedRoute><AppLayout><Points /></AppLayout></ProtectedRoute>} />
            <Route path="/quiz/:quizId" element={<ProtectedRoute><AppLayout><QuizEntry /></AppLayout></ProtectedRoute>} />
            <Route path="/quiz/:quizId/exam" element={<ProtectedRoute><AppLayout><QuizExam /></AppLayout></ProtectedRoute>} />
            <Route path="/quiz/:quizId/result/:attemptId" element={<ProtectedRoute><AppLayout><QuizResult /></AppLayout></ProtectedRoute>} />
            <Route path="/certificate/:certificateId" element={<ProtectedRoute><AppLayout><CertificateView /></AppLayout></ProtectedRoute>} />

            {/* Protected admin routes */}
            <Route path="/admin" element={<AdminProtectedRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/tasks" element={<AdminProtectedRoute><AdminLayout><AdminTasks /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/resources" element={<AdminProtectedRoute><AdminLayout><AdminContent /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/broadcast" element={<AdminProtectedRoute><AdminLayout><AdminBroadcast /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/settings" element={<AdminProtectedRoute><AdminLayout><AdminSettings /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/students" element={<AdminProtectedRoute><AdminLayout><AdminStudents /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/integrations" element={<AdminProtectedRoute><AdminLayout><AdminIntegrations /></AdminLayout></AdminProtectedRoute>} />
            <Route path="/admin/learning" element={<AdminProtectedRoute><AdminLayout><AdminLearning /></AdminLayout></AdminProtectedRoute>} />
            
            <Route path="/admin/import" element={<AdminProtectedRoute><AdminLayout><AdminImport /></AdminLayout></AdminProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
