"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDeniedCard } from "@/components/stock-movements/access-denied-card";
import { ManualMovementDialog } from "@/components/stock-movements/manual-movement-dialog";
import { MovementDetailsDrawer } from "@/components/stock-movements/movement-details-drawer";
import { MovementsEmptyState } from "@/components/stock-movements/movements-empty-state";
import { MovementsErrorState } from "@/components/stock-movements/movements-error-state";
import { MovementsSummaryCards } from "@/components/stock-movements/movements-summary-cards";
import { MovementsTable } from "@/components/stock-movements/movements-table";
import { MovementsTableSkeleton } from "@/components/stock-movements/movements-table-skeleton";
import { MovementsToolbar } from "@/components/stock-movements/movements-toolbar";
import { ReversalDialog } from "@/components/stock-movements/reversal-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useInventory } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateManualMovement,
  useReverseStockMovement,
  useStockMovements,
  useStockMovementSummary,
} from "@/hooks/use-stock-movements";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  ManualMovementPayload,
  ReversalPayload,
  StockMovement,
  StockMovementFilters,
} from "@/types/stock-movements";

const defaultFilters: StockMovementFilters = {
  search: "",
  branchId: "",
  itemType: "all",
  productType: "all",
  movementType: "all",
  direction: "all",
  dateFrom: "",
  dateTo: "",
  createdBy: "",
};

export function MovementsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const canManage = hasAnyPermission([
    PERMISSIONS.stockMovementsManualCreate,
    PERMISSIONS.stockMovementsReverse,
  ]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [reversalMovement, setReversalMovement] = useState<StockMovement | null>(null);
  const movementsQuery = useStockMovements(filters, canView && branchScope.hasBranchScope);
  const summaryQuery = useStockMovementSummary(
    {
      branchId: filters.branchId,
      itemType: filters.itemType,
      productType: filters.productType,
      movementType: filters.movementType,
      direction: filters.direction,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    },
    canView && branchScope.hasBranchScope,
  );
  const branchesQuery = useBranches(canView);
  const inventoryQuery = useInventory(
    {
      search: "",
      branchId: branchScope.defaultBranchId,
      itemType: "all",
      productType: "all",
      status: "active",
      lowStockOnly: false,
      expiryTrackedOnly: false,
      includeUninitialized: false,
    },
    canManage && branchScope.hasBranchScope,
  );
  const manualMutation = useCreateManualMovement();
  const reversalMutation = useReverseStockMovement();
  const isPermissionDenied =
    movementsQuery.error instanceof ApiError && movementsQuery.error.status === 403;

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleManualMovement = async (payload: ManualMovementPayload): Promise<void> => {
    try {
      await manualMutation.mutateAsync(payload);
      toast.success("Manual stock movement created.");
      setManualOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReverse = async (id: string, payload: ReversalPayload): Promise<void> => {
    try {
      await reversalMutation.mutateAsync({ id, payload });
      toast.success("Stock movement reversed.");
      setReversalMovement(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const movements = movementsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Stock Movements"
        description="Track every stock change including purchases, sales, adjustments, wastage, and transfers."
        actions={
          canManage ? (
            <Button onClick={() => setManualOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Manual movement
            </Button>
          ) : undefined
        }
      />

      <MovementsSummaryCards summary={summaryQuery.data} />

      {summaryQuery.data?.byMovementType.length ? (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            {summaryQuery.data.byMovementType.map((entry) => (
              <span
                className="rounded-full border border-brand-cappuccino bg-brand-latte px-3 py-1 text-xs font-semibold text-brand-mocha"
                key={entry.movementType}
              >
                {entry.movementType.replace(/_/g, " ")} · {entry.quantity} · {entry.count} moves
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <MovementsToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
      />

      {movementsQuery.isLoading ? <MovementsTableSkeleton /> : null}

      {!movementsQuery.isLoading && movementsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to stock movements." />
        ) : (
          <MovementsErrorState
            description={getErrorMessage(movementsQuery.error)}
            onRetry={() => {
              void movementsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!movementsQuery.isLoading && !movementsQuery.error && movements.length === 0 ? (
        <MovementsEmptyState />
      ) : null}

      {!movementsQuery.isLoading && !movementsQuery.error && movements.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <MovementsTable
              canReverse={canManage}
              movements={movements}
              onReverse={setReversalMovement}
              onView={setSelectedMovement}
            />
          </CardContent>
        </Card>
      ) : null}

      <MovementDetailsDrawer
        movement={selectedMovement}
        onOpenChange={(open) => {
          if (!open) setSelectedMovement(null);
        }}
        open={selectedMovement !== null}
      />

      <ManualMovementDialog
        inventoryItems={inventoryQuery.data ?? []}
        isSubmitting={manualMutation.isPending}
        onClose={() => setManualOpen(false)}
        onSubmit={handleManualMovement}
        open={manualOpen}
      />

      <ReversalDialog
        isSubmitting={reversalMutation.isPending}
        movement={reversalMovement}
        onClose={() => setReversalMovement(null)}
        onSubmit={handleReverse}
        open={reversalMovement !== null}
      />
    </div>
  );
}
