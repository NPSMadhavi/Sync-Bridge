type SettingsUser = {
  role?: string | null;
  isSuperAdmin?: boolean | null;
};

/** Roles that can view and configure Employee running numbers in Settings. */
export function canManageRunningNumber(user?: SettingsUser | null): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return ["admin", "super_admin", "hr_manager"].includes(user.role ?? "");
}
