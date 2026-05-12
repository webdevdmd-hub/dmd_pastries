"use client";

import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect } from "react";

import { AccessDeniedCard } from "@/components/dashboard/access-denied-card";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { usePermission } from "@/hooks/use-permission";

function hasRole(roles: string[], roleName: string): boolean {
  return roles.some((role) => role.toLowerCase().includes(roleName));
}

export function DashboardRouter(): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const { hasAnyPermission } = usePermission();
  const roles = user?.roles ?? [];
  const isAdmin =
    hasRole(roles, "owner") ||
    hasRole(roles, "admin") ||
    hasAnyPermission([
      PERMISSIONS.usersView,
      PERMISSIONS.rolesView,
      PERMISSIONS.settingsView,
      PERMISSIONS.reportsView,
    ]);
  const isCashier = hasAnyPermission([
    PERMISSIONS.posView,
    PERMISSIONS.posSell,
    PERMISSIONS.posCheckout,
  ]);
  const isProduction = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.recipesView]);
  const isPurchasing = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canView =
    hasAnyPermission([PERMISSIONS.dashboardView]) ||
    isAdmin ||
    isCashier ||
    isProduction ||
    isPurchasing;

  useEffect(() => {
    if (!canView) return;
    if (isAdmin) {
      router.replace(ROUTES.dashboardAdmin);
      return;
    }
    if (isCashier) {
      router.replace(ROUTES.dashboardCashier);
      return;
    }
    if (isProduction) {
      router.replace(ROUTES.dashboardProduction);
      return;
    }
    if (isPurchasing) {
      router.replace(ROUTES.dashboardPurchasing);
    }
  }, [canView, isAdmin, isCashier, isProduction, isPurchasing, router]);

  if (!canView || (!isAdmin && !isCashier && !isProduction && !isPurchasing)) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <DashboardPageHeader
        eyebrow="Dashboard router"
        title="Opening your workspace"
        description="We are selecting the best dashboard based on your role and granted permissions."
      />
      <DashboardSkeleton />
    </div>
  );
}
