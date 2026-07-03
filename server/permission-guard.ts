import type { Request, Response, NextFunction } from "express";
import {
  type ModuleKey,
  canViewModule,
  isSuperAdminUser,
  isAdminUser,
  resolveApiModule,
  PUBLIC_API_PREFIXES,
} from "@shared/permissions";

type PermissionUser = {
  role?: string | null;
  isSuperAdmin?: boolean | null;
  permissions?: Record<string, boolean> | null;
};

export function requireModuleAccess(module: ModuleKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = req.user as PermissionUser;
    if (!canViewModule(user, module)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export function assertCanManageUser(
  req: Request,
  res: Response,
  targetUser: { role?: string | null; isSuperAdmin?: boolean | null; tenantId?: number | null }
): boolean {
  const currentUser = req.user as PermissionUser & { tenantId?: number | null };

  if (isSuperAdminUser(targetUser) && !isSuperAdminUser(currentUser)) {
    res.status(403).json({ message: "Super admin accounts can only be managed by a Super Admin" });
    return false;
  }

  if (!isSuperAdminUser(currentUser) && !isAdminUser(currentUser)) {
    res.status(403).json({ message: "Access denied" });
    return false;
  }

  if (
    !isSuperAdminUser(currentUser) &&
    currentUser.tenantId != null &&
    targetUser.tenantId != null &&
    targetUser.tenantId !== currentUser.tenantId
  ) {
    res.status(403).json({ message: "Cannot manage users outside your organization" });
    return false;
  }

  return true;
}

export function enforceApiModuleAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api")) {
      return next();
    }

    if (PUBLIC_API_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
      return next();
    }

    if (!req.isAuthenticated()) {
      return next();
    }

    const module = resolveApiModule(req.path);
    if (!module) {
      return next();
    }

    const user = req.user as PermissionUser;
    if (!canViewModule(user, module)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
}
