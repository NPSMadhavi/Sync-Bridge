import { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export default function Dashboard({ children, title, description }: DashboardLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="bg-background min-h-screen">
      {/* Fixed Sidebar - desktop only */}
      <div className="hidden md:block">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "md:hidden fixed inset-0 bg-gray-800 bg-opacity-50 z-20 transition-opacity duration-200",
          isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobileSidebar}
      >
        <div
          className={cn(
            "bg-card w-64 h-full transition-transform duration-200 flex",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full">
            <Sidebar
              isCollapsed={isSidebarCollapsed}
              onCollapsedChange={setIsSidebarCollapsed}
            />
          </div>
        </div>
      </div>

      {/* Main content — offset by sidebar width */}
      <div
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          isSidebarCollapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <Navbar toggleMobileSidebar={toggleMobileSidebar} />

        <main className="flex-1 bg-background p-4 md:p-6 overflow-y-auto overflow-x-hidden">
          {(title || description) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-bold text-foreground">{title}</h1>}
              {description && <p className="text-muted-foreground">{description}</p>}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
