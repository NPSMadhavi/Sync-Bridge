import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { 
  Search, 
  Bell, 
  HelpCircle, 
  User,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { type Notification } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function Navbar({ toggleMobileSidebar }: { toggleMobileSidebar: () => void }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch user notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });
  
  const unseenNotificationsCount = notifications.filter(n => !n.seen).length;
  
  // Mark notification as seen
  const markNotificationAsSeen = async (id: number) => {
    try {
      await apiRequest("PUT", `/api/notifications/${id}/seen`);
      // Invalidate notifications query to refresh the data
      // This is handled automatically by the mutation in a real implementation
    } catch (error) {
      console.error("Failed to mark notification as seen", error);
    }
  };
  
  return (
    <header className="bg-card border-b border-border flex items-center h-16 px-4 md:px-6">
      <button 
        className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mr-4 md:hidden"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex-1 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </span>
          <Input 
            type="text" 
            className="w-full pl-10 pr-4 py-2 bg-background text-foreground" 
            placeholder="Search assets, employees, documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 rounded-full"
            >
              <Bell className="h-5 w-5" />
              {unseenNotificationsCount > 0 && (
                <span className="absolute top-0 right-0 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
                  {unseenNotificationsCount}
                </span>
              )}
            </Button>
            
            {/* Notification dropdown would go here in a real implementation */}
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-800 rounded-full"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
          
          {/* <ThemeToggle /> */}
          
          <div className="relative">
            <Link href="/settings">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-200"
              >
                <User className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
