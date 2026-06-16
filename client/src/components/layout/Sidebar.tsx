import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  MonitorIcon,
  UsersIcon,
  FileTextIcon,
  Store,
  Settings,
  LogOut,
  Key,
  UserCheck,
  Menu,
  X,
  Package,
  Calculator,
  TrendingUp,
  ShoppingCart,
  Building2,
} from "lucide-react";
import type { ModuleKey } from "@shared/permissions";
import { isVendorUser } from "@shared/permissions";

type MenuItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  module?: ModuleKey;
  roles?: string[];
  hideForRoles?: string[];
};

export default function Sidebar({ isCollapsed, onCollapsedChange }: {
  isCollapsed: boolean;
  onCollapsedChange: (val: boolean) => void;
}) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { canView } = usePermissions();

  const isVendor = isVendorUser(user);

  const mainMenuItems: MenuItem[] = [
    {
      name: "Dashboard",
      href: "/",
      module: "dashboard",
      icon: <LayoutDashboard className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Vendor Dashboard",
      href: "/vendor-dashboard",
      icon: <TrendingUp className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      roles: ["vendor"],
    },
    {
      name: "Assets",
      href: "/assets",
      module: "assets",
      icon: <MonitorIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Licenses",
      href: "/licenses",
      module: "licenses",
      icon: <Key className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Company",
      href: "/company",
      module: "company",
      icon: <Building2 className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Employees",
      href: "/employees",
      module: "employee",
      icon: <UsersIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Payroll",
      href: "/payroll",
      module: "payroll",
      icon: <Calculator className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Documents",
      href: "/documents",
      module: "documents",
      icon: <FileTextIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Vendors",
      href: "/vendors",
      module: "vendors",
      icon: <Store className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
    {
      name: "Vendor Orders",
      href: "/vendor-orders",
      icon: <Package className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      roles: ["vendor"],
    },
    {
      name: "Products",
      href: "/products",
      icon: <ShoppingCart className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      roles: ["vendor"],
    },
    {
      name: "Customers",
      href: "/customers",
      module: "customers",
      icon: <UserCheck className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
      hideForRoles: ["vendor"],
    },
  ];

  const managementMenuItems: MenuItem[] = [
    {
      name: "User Management",
      href: "/users",
      module: "userManagement",
      icon: <UsersIcon className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
    {
      name: "Settings",
      href: "/settings",
      module: "settings",
      icon: <Settings className={cn(isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3", "text-slate-400")} />,
    },
  ];

  return (
    <div className={cn(
      "fixed top-0 left-0 h-screen bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-300 text-white z-30",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-6 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">SyncBridge</h1>
                <p className="text-xs text-slate-400">
                  {isVendor ? "Vendor Portal" : "Asset Management"}
                </p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-2"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
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
                canView={canView}
              />
            ))}
          </div>
        </div>

        {!isVendor && (
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
                  canView={canView}
                />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-700 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
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
            className="text-slate-400 hover:text-white p-1 rounded transition-colors flex-shrink-0"
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
  canView: (module: ModuleKey) => boolean;
}

function SidebarItem({ item, isActive, userRole, isCollapsed, canView }: SidebarItemProps) {
  if (item.roles && userRole && !item.roles.includes(userRole)) {
    return null;
  }

  if (item.hideForRoles && userRole && item.hideForRoles.includes(userRole)) {
    return null;
  }

  if (item.module && !canView(item.module)) {
    return null;
  }

  return (
    <Link
      href={item.href}
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
    </Link>
  );
}
