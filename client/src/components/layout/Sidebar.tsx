import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MonitorIcon,
  UsersIcon,
  FileTextIcon,
  Store,
  Settings,
  FileBarChart,
  ClipboardListIcon,
  LogOut
} from "lucide-react";

type MenuItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const mainMenuItems: MenuItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="mr-3 text-primary-500" />,
    },
    {
      name: "Assets",
      href: "/assets",
      icon: <MonitorIcon className="mr-3 text-gray-500" />,
      roles: ['admin', 'it_manager']
    },
    {
      name: "Employees",
      href: "/employees",
      icon: <UsersIcon className="mr-3 text-gray-500" />,
      roles: ['admin', 'hr']
    },
    {
      name: "Documents",
      href: "/documents",
      icon: <FileTextIcon className="mr-3 text-gray-500" />,
    },
    {
      name: "Vendors",
      href: "/vendors",
      icon: <Store className="mr-3 text-gray-500" />,
      roles: ['admin', 'it_manager']
    },
  ];

  const managementMenuItems: MenuItem[] = [
    {
      name: "Settings",
      href: "/settings",
      icon: <Settings className="mr-3 text-gray-500" />,
      roles: ['admin']
    },
    {
      name: "Reports",
      href: "/reports",
      icon: <FileBarChart className="mr-3 text-gray-500" />,
      roles: ['admin', 'hr', 'it_manager']
    },
    {
      name: "Audit Logs",
      href: "/audit-logs",
      icon: <ClipboardListIcon className="mr-3 text-gray-500" />,
      roles: ['admin']
    },
  ];

  // Filter menu items based on user role
  const filteredMainMenuItems = mainMenuItems.filter(item => 
    !item.roles || (user && item.roles.includes(user.role))
  );
  
  const filteredManagementMenuItems = managementMenuItems.filter(item => 
    !item.roles || (user && item.roles.includes(user.role))
  );

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <aside className="bg-white w-64 border-r border-gray-200 h-full flex-shrink-0 hidden md:flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex items-center justify-center h-10 w-10 rounded bg-primary-500 text-white font-bold text-lg">SB</div>
          <h1 className="ml-3 text-lg font-semibold text-gray-800">SyncBridge</h1>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Main</p>
          <ul>
            {filteredMainMenuItems.map((item) => (
              <li key={item.name} className="mb-2">
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center p-2 rounded-md font-medium",
                    location === item.href
                      ? "text-gray-800 bg-primary-50"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {item.icon}
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {filteredManagementMenuItems.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Management</p>
            <ul>
              {filteredManagementMenuItems.map((item) => (
                <li key={item.name} className="mb-2">
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center p-2 rounded-md font-medium",
                      location === item.href
                        ? "text-gray-800 bg-primary-50"
                        : "text-gray-600 hover:bg-gray-100"
                    )}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
            <UsersIcon size={16} />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-800">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
          <button 
            className="ml-auto text-gray-400 hover:text-gray-500"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
