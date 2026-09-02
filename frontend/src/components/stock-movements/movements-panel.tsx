"use client";

import { Plus, X } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
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
  useInventoryItemMovements,
  useReverseStockMovement,
  useStockMovements,
  useStockMovementSummary,
} from "@/hooks/use-stock-movements";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { movementTypeLabel } from "@/lib/inventory/stock-movement-display";
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

type MovementsPanelProps = {
  /**
   * From `?item=` on the module URL. "Movements for [item]" links elsewhere in
   * the app deep-link here; when present the ledger is scoped to that one item
   * instead of silently showing everything with the param ignored.
   */
  itemId: string | null;
  onClearItemScope: () => void;
};

/**
 * The "Movements" tab. Was /inventory/movements, a sibling route with its own
 * H1 and breadcrumb. The item deep-link now lives on the module URL as
 * `/inventory?view=movements&item=<id>`, which is why this takes `itemId` as a
 * prop rather than reading the URL itself -- the container owns the URL.
 */
export function MovementsPanel({ itemId, onClearItemScope }: MovementsPanelProps): JSX.Element {
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
  const movementsQuery = useStockMovements(
    filters,
    canView && branchScope.hasBranchScope && !itemId,
  );
  const itemMovementsQuery = useInventoryItemMovements(
    itemId,
    filters,
    canView && branchScope.hasBranchScope && Boolean(itemId),
  );
  const activeMovementsQuery = itemId ? itemMovementsQuery : movementsQuery;
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
    canView && branchScope.hasBranchScope && !itemId,
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
    activeMovementsQuery.error instanceof ApiError && activeMovementsQuery.error.status === 403;
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty ledger look like a narrow search and the
  // empty state would never appear. The item deep-link is a filter too -- an
  // item with zero movements should read as "narrowed", not "ledger is empty".
  const hasActiveFilters =
    Boolean(itemId) ||
    filters.search.trim().length > 0 ||
    filters.itemType !== defaultFilters.itemType ||
    filters.productType !== defaultFilters.productType ||
    filters.movementType !== defaultFilters.movementType ||
    filters.direction !== defaultFilters.direction ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0 ||
    filters.createdBy.trim().length > 0;

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

  const movements = activeMovementsQuery.data ?? [];
  const scopedItemName = itemId ? (movements[0]?.itemName ?? "this item") : null;

  const clearItemScope = (): void => {
    setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId });
    onClearItemScope();
  };

  return (
    <>
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={() => setManualOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            Manual movement
          </Button>
        </div>
      ) : null}

      {itemId ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground-muted">
          <span>
            Showing movements for{" "}
            <span className="font-semibold text-foreground">{scopedItemName}</span> only.
          </span>
          <Button onClick={clearItemScope} size="sm" type="button" variant="ghost">
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      ) : (
        <>
          <MovementsSummaryCards summary={summaryQuery.data} />

          {summaryQuery.data?.byMovementType.length ? (
            <Card>
              <CardContent className="flex flex-wrap gap-2 p-4">
                {summaryQuery.data.byMovementType.map((entry) => (
                  <span
                    className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-foreground-muted"
                    key={entry.movementType}
                  >
                    {movementTypeLabel(entry.movementType)} - {entry.quantity} - {entry.count} moves
                  </span>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}

      <MovementsToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
      />

      {activeMovementsQuery.isLoading ? <MovementsTableSkeleton /> : null}

      {!activeMovementsQuery.isLoading && activeMovementsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to stock movements." />
        ) : (
          <MovementsErrorState
            description={getErrorMessage(activeMovementsQuery.error)}
            onRetry={() => {
              void activeMovementsQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Filtered and empty need opposite remedies. "No stock movements yet" on a
          screen narrowed to Wastage in one date range says nothing has ever moved,
          which is untrue whenever the ledger holds anything at all. DESIGN.md 8. */}
      {!activeMovementsQuery.isLoading &&
      !activeMovementsQuery.error &&
      movements.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="stock movements"
          onClearFilters={clearItemScope}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!activeMovementsQuery.isLoading &&
      !activeMovementsQuery.error &&
      movements.length === 0 &&
      !hasActiveFilters ? (
        <MovementsEmptyState />
      ) : null}

      {!activeMovementsQuery.isLoading && !activeMovementsQuery.error && movements.length > 0 ? (
        <Card className="overflow-hidden">
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
        inventoryItems={inventoryQuery.data?.items ?? []}
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
    </>
  );
}
