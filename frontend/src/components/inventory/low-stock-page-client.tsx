"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { InventoryDetailsDrawer } from "@/components/inventory/inventory-details-drawer";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { FilteredState } from "@/components/shared/collection-state";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdjustStock,
  useExpiryBatches,
  useInventoryItemMovements,
  useLowStock,
} from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { InventoryItem, LowStockFilters, StockAdjustmentPayload } from "@/types/inventory";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/types/product";

const defaultFilters: LowStockFilters = {
  search: "",
  branchId: "",
  itemType: "all",
  productType: "all",
};

export function LowStockPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.inventoryLowStockView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryOpeningStock,
  ]);
  const [filters, setFilters] = useState<LowStockFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  // The list dropped to eight columns, so Reorder level, Current, Reserved,
  // Avg cost and Type now live in the details drawer. This page previously had
  // no drawer at all, which would have made those unreachable here -- and
  // reorder level is this page's whole subject, since "low stock" is defined
  // against it. Same drawer, same hooks the main inventory page already uses.
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const movementsQuery = useInventoryItemMovements(
    selectedItem?.id ?? null,
    {},
    selectedItem !== null,
  );
  const batchesQuery = useExpiryBatches(
    selectedItem?.id ?? null,
    selectedItem?.isExpiryTracked === true,
  );
  const debouncedSearch = useDebouncedValue(filters.search);
  const lowStockQueryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const lowStockQuery = useLowStock(lowStockQueryFilters, canView && branchScope.hasBranchScope);
  const branchesQuery = useBranches(canView);
  const adjustmentMutation = useAdjustStock();
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely quiet alert list read as a narrow search.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.itemType !== defaultFilters.itemType ||
    filters.productType !== defaultFilters.productType;

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

  const handleAdjustment = async (id: string, payload: StockAdjustmentPayload): Promise<void> => {
    try {
      await adjustmentMutation.mutateAsync({ id, payload });
      toast.success("Stock adjusted.");
      setAdjustmentItem(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Low Stock Alerts"
        description="Items where available quantity is at or below reorder level."
      />
      <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-card/70 p-4 shadow-soft md:grid-cols-5">
        <Input
          aria-label="Search low stock"
          onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          placeholder="Search item..."
          value={filters.search}
        />
        <Select
          onValueChange={(branchId) => setFilters({ ...filters, branchId })}
          value={filters.branchId}
        >
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
            setFilters({ ...filters, itemType: itemType as LowStockFilters["itemType"] })
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
          </SelectContent>
        </Select>
        <Select
          onValueChange={(productType) =>
            setFilters({
              ...filters,
              productType: productType as LowStockFilters["productType"],
            })
          }
          value={filters.productType}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All product types</SelectItem>
            {PRODUCT_TYPES.map((productType) => (
              <SelectItem key={productType} value={productType}>
                {PRODUCT_TYPE_LABELS[productType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })}
          type="button"
          variant="outline"
        >
          Reset
        </Button>
      </div>

      {lowStockQuery.isLoading ? <InventoryTableSkeleton /> : null}
      {!lowStockQuery.isLoading && lowStockQuery.error ? (
        <InventoryErrorState
          description={getErrorMessage(lowStockQuery.error)}
          onRetry={() => {
            void lowStockQuery.refetch();
          }}
        />
      ) : null}
      {/* Filtered and empty need opposite remedies. "No low stock items right
          now" is a relief to read and flatly untrue when a product-type filter
          is hiding the items that are actually short. DESIGN.md §8. */}
      {!lowStockQuery.isLoading &&
      !lowStockQuery.error &&
      (lowStockQuery.data ?? []).length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="low stock items"
          onClearFilters={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}
      {!lowStockQuery.isLoading &&
      !lowStockQuery.error &&
      (lowStockQuery.data ?? []).length === 0 &&
      !hasActiveFilters ? (
        <InventoryEmptyState
          description="Every tracked item is above its reorder level. Items will appear here once available quantity drops to or below reorder level."
          title="No low stock items right now."
        />
      ) : null}
      {!lowStockQuery.isLoading && !lowStockQuery.error && (lowStockQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <InventoryTable
              canManage={canManage}
              items={lowStockQuery.data ?? []}
              onAddBatch={() => undefined}
              onAddOpeningStock={() => undefined}
              onAdjust={setAdjustmentItem}
              onView={setSelectedItem}
              showBatchAction={false}
            />
          </CardContent>
        </Card>
      ) : null}

      <InventoryDetailsDrawer
        batches={batchesQuery.data ?? []}
        batchesLoading={batchesQuery.isLoading}
        canManage={canManage}
        item={selectedItem}
        movements={movementsQuery.data ?? []}
        movementsLoading={movementsQuery.isLoading}
        onAddBatch={() => undefined}
        onAdjust={(item) => {
          setSelectedItem(null);
          setAdjustmentItem(item);
        }}
        onBatchStatusChange={() => undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        open={selectedItem !== null}
        showBatchActions={false}
      />

      <StockAdjustmentDialog
        isSubmitting={adjustmentMutation.isPending}
        item={adjustmentItem}
        onClose={() => setAdjustmentItem(null)}
        onSubmit={handleAdjustment}
        open={adjustmentItem !== null}
      />
    </div>
  );
}
