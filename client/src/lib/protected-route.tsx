import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import type { ModuleKey } from "@shared/permissions";
import { getDefaultRouteForUser, isSuperAdminUser, isVendorUser } from "@shared/permissions";

export function ProtectedRoute({
  path,
  component: Component,
  module,
  adminOnly = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  module?: ModuleKey;
  adminOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const { canView, isAdmin } = usePermissions();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  const defaultRoute = getDefaultRouteForUser(user);

  const redirectTo = (target: string) => {
    if (target === path) {
      return (
        <Route path={path}>
          <Redirect to="/no-access" />
        </Route>
      );
    }
    return (
      <Route path={path}>
        <Redirect to={target} />
      </Route>
    );
  };

  if (adminOnly && !isAdmin) {
    return redirectTo(defaultRoute);
  }

  if (module && !canView(module)) {
    return redirectTo(defaultRoute);
  }

  if (isSuperAdminUser(user) && path !== "/users" && module && module !== "userManagement") {
    return redirectTo("/users");
  }

  if (isVendorUser(user) && module && !["settings"].includes(module)) {
    const vendorPaths = ["/vendor-dashboard", "/vendor-orders", "/products", "/vendor-settings"];
    if (!vendorPaths.includes(path)) {
      return redirectTo("/vendor-dashboard");
    }
  }

  return <Route path={path} component={Component} />;
}
