import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { ScrollToTop } from "./ScrollToTop";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
      <ScrollToTop />
    </div>
  );
}
