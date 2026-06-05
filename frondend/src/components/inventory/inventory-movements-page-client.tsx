"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { StockMovementsTable } from "@/components/inventory/stock-movements-table";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useInventoryMovements } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { StockMovementFilters } from "@/types/inventory";

const defaultFilters: StockMovementFilters = {
  search: "",
  branchId: "",
  itemType: "all",
  movementType: "all",
  dateFrom: "",
  dateTo: "",
};

export function InventoryMovementsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.inventoryMovementsView, PERMISSIONS.inventoryView]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const movementsQuery = useInventoryMovements(filters, canView && branchScope.hasBranchScope);
  const branchesQuery = useBranches(canView);
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

  const updateFilters = (nextFilters: Partial<StockMovementFilters>): void => {
    setFilters({ ...filters, ...nextFilters });
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Stock Movements"
        description="Review every stock change including opening stock, adjustments, sales, purchases, wastage, and transfers."
      />

      <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-white/70 p-4 shadow-soft lg:grid-cols-6">
        <Input
          aria-label="Search stock movements"
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search item..."
          value={filters.search}
        />
        <Select onValueChange={(branchId) => updateFilters({ branchId })} value={filters.branchId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branchScope.canAccessAllBranches ? (
              <SelectItem value="all">All branches</SelectItem>
            ) : null}
            {branchOptions.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(itemType) =>
            updateFilters({ itemType: itemType as StockMovementFilters["itemType"] })
          }
          value={filters.itemType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="product">Products</SelectItem>
            <SelectItem value="product_variant">Variants</SelectItem>
            <SelectItem value="ingredient">Ingredients</SelectItem>
            <SelectItem value="packaging">Packaging</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilters({ dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          onChange={(event) => updateFilters({ dateTo: event.target.value })}
          type="date"
          value={filters.dateTo}
        />
        <Button
          onClick={() => setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {movementsQuery.isLoading ? <InventoryTableSkeleton /> : null}
      {!movementsQuery.isLoading && movementsQuery.error ? (
        <InventoryErrorState
          description={getErrorMessage(movementsQuery.error)}
          onRetry={() => {
            void movementsQuery.refetch();
          }}
        />
      ) : null}
      {!movementsQuery.isLoading &&
      !movementsQuery.error &&
      (movementsQuery.data ?? []).length === 0 ? (
        <InventoryEmptyState
          description="Stock changes will appear here after opening stock, sales, purchases, or adjustments."
          title="No stock movements found."
        />
      ) : null}
      {!movementsQuery.isLoading &&
      !movementsQuery.error &&
      (movementsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <StockMovementsTable movements={movementsQuery.data ?? []} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
