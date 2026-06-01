"use client";

import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@/types/permission";

export function usePermission() {
  const { user } = useAuth();

  const hasPermission = (permission: Permission): boolean => {
    return user?.permissions.includes(permission) ?? false;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((permission) => hasPermission(permission));
  };

  return {
    hasPermission,
    hasAnyPermission,
    permissions: user?.permissions ?? [],
  };
}
