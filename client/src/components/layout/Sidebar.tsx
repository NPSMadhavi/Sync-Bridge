import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MonitorIcon,
  UsersIcon,
  FileTextIcon,
  Store,
  Settings,
  FileBarChart,
  ClipboardListIcon,
  LogOut,
  Key,
  Receipt,
  UserCheck,
  Menu,
  X,
  Package
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const mainMenuItems: MenuItem[] = [
    {
      name: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Assets",
      href: "/assets",
      icon: <MonitorIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Licenses",
      href: "/licenses",
      icon: <Key className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Employees",
      href: "/employees",
      icon: <UsersIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Documents",
      href: "/documents",
      icon: <FileTextIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Vendors",
      href: "/vendors",
      icon: <Store className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Customers",
      href: "/customers",
      icon: <UserCheck className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Invoices",
      href: "/invoices",
      icon: <Receipt className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
  ];

  const managementMenuItems: MenuItem[] = [
    {
      name: "User Management",
      href: "/users",
      icon: <UsersIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      roles: ["super_admin", "admin"],
    },
    {
      name: "Settings",
      href: "/settings",
      icon: <Settings className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Reports",
      href: "/reports",
      icon: <FileBarChart className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Audit Logs",
      href: "/audit-logs",
      icon: <ClipboardListIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      roles: ["super_admin", "admin"],
    },
  ];

  return (
    <div className={cn(
      "h-screen bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-300 text-white",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">SyncBridge</h1>
                <p className="text-xs text-slate-400">Asset Management</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Main Menu */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              MAIN
            </h3>
          )}
          <div className="space-y-1">
            {mainMenuItems.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActive={location === item.href}
                userRole={user?.role}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>

        {/* Management Menu */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              MANAGEMENT
            </h3>
          )}
          <div className="space-y-1">
            {managementMenuItems.map((item) => (
              <SidebarItem
                key={item.name}
                item={item}
                isActive={location === item.href}
                userRole={user?.role}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-slate-400 truncate capitalize">
                {user?.role?.replace('_', ' ') || 'Employee'}
              </p>
            </div>
          )}
          <button
            onClick={() => logoutMutation.mutate()}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SidebarItemProps {
  item: MenuItem;
  isActive: boolean;
  userRole?: string;
  isCollapsed?: boolean;
}

function SidebarItem({ item, isActive, userRole, isCollapsed }: SidebarItemProps) {
  // Check if user has permission to access this item
  if (item.roles && userRole && !item.roles.includes(userRole)) {
    return null;
  }

  return (
    <Link href={item.href}>
      <div
        className={cn(
          "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer group relative",
          isActive
            ? "bg-teal-500/20 text-teal-400 border-r-2 border-teal-400"
            : "text-slate-300 hover:text-white hover:bg-slate-800"
        )}
        title={isCollapsed ? item.name : undefined}
      >
        {item.icon}
        {!isCollapsed && <span>{item.name}</span>}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
            {item.name}
          </div>
        )}
      </div>
    </Link>
  );
}