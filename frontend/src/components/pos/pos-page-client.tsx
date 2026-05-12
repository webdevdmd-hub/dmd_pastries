"use client";

import type { JSX } from "react";

import { POSAccessDenied } from "@/components/pos/pos-access-denied";
import { POSWorkspace } from "@/components/pos/pos-workspace";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";

export function PosPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canViewPos = hasAnyPermission([PERMISSIONS.posView, PERMISSIONS.posSell]);

  if (!canViewPos) {
    return <POSAccessDenied />;
  }

  return <POSWorkspace />;
}
