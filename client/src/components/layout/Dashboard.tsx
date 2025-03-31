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
  
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };
  
  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };
  
  return (
    <div className="bg-gray-50 h-screen flex overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar />
      
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
            "bg-white w-64 h-full transition-transform duration-200 flex",
            isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full">
            <Sidebar />
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar toggleMobileSidebar={toggleMobileSidebar} />
        
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          {(title || description) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-bold text-gray-800">{title}</h1>}
              {description && <p className="text-gray-600">{description}</p>}
            </div>
          )}
          
          {children}
        </main>
      </div>
    </div>
  );
}
