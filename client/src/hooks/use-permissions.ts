import { useAuth } from "@/hooks/use-auth";
import {
  type ModuleKey,
  canViewModule,
  isSuperAdminUser,
  isAdminUser,
  normalizePermissions,
  userCanSeeOtherData,
} from "@shared/permissions";

export function usePermissions() {
  const { user } = useAuth();

  const permissions = normalizePermissions(user?.permissions);

  return {
    user,
    permissions,
    isSuperAdmin: isSuperAdminUser(user),
    isAdmin: isAdminUser(user),
    canSeeOtherData: userCanSeeOtherData(user),
    canView: (module: ModuleKey) => canViewModule(user, module),
  };
}
