"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/stock-movements/access-denied-card";
import {
  type MovementDetailTabKey,
  parseMovementDetailTab,
} from "@/components/stock-movements/movement-detail-tabs";
import {
  formatMovementDateTime,
  MovementDetailsPanel,
} from "@/components/stock-movements/movement-details-panel";
import { MovementDirectionBadge } from "@/components/stock-movements/movement-direction-badge";
import { MovementTypeBadge } from "@/components/stock-movements/movement-type-badge";
import { MovementsErrorState } from "@/components/stock-movements/movements-error-state";
import { MovementsTableSkeleton } from "@/components/stock-movements/movements-table-skeleton";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { useStockMovement } from "@/hooks/use-stock-movements";
import { getErrorMessage } from "@/lib/api/client";

type MovementDetailsPageClientProps = {
  movementId: string;
};

export function MovementDetailsPageClient({
  movementId,
}: MovementDetailsPageClientProps): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const movementQuery = useStockMovement(movementId, canView);

  const activeTab = parseMovementDetailTab(searchParams.get("tab"));

  const changeTab = (tab: MovementDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "movement") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (movementQuery.isLoading) {
    return <MovementsTableSkeleton />;
  }

  if (movementQuery.error || !movementQuery.data) {
    return (
      <MovementsErrorState
        description={
          movementQuery.error ? getErrorMessage(movementQuery.error) : "Stock movement not found."
        }
        onRetry={() => {
          void movementQuery.refetch();
        }}
      />
    );
  }

  const movement = movementQuery.data;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* The item is the heading, not "Movement Details". A page titled after
          its own component tells a reader nothing they did not already know. */}
      <div className="min-w-0">
        <Link
          className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
          href={ROUTES.inventoryMovements}
        >
          Back to stock movements
        </Link>
        <h1 className="mt-2 text-page">{movement.itemName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <MovementTypeBadge type={movement.movementType} />
          <MovementDirectionBadge direction={movement.movementDirection} />
        </div>
        <p className="mt-2 text-meta text-foreground-muted">
          {movement.branchName} ·{" "}
          <span className="tabular-nums">{formatMovementDateTime(movement.createdAt)}</span> ·{" "}
          {movement.createdByUserName}
        </p>
      </div>

      <MovementDetailsPanel activeTab={activeTab} movement={movement} onTabChange={changeTab} />
    </div>
  );
}
