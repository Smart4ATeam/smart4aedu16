import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { ScrollToTop } from "../ScrollToTop";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
      <ScrollToTop />
    </div>
  );
}
