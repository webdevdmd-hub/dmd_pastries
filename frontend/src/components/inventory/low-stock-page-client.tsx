"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
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
import { useAdjustStock, useLowStock } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { getErrorMessage } from "@/lib/api/client";
import type { InventoryItem, LowStockFilters, StockAdjustmentPayload } from "@/types/inventory";

const defaultFilters: LowStockFilters = {
  search: "",
  branchId: "",
  itemType: "all",
};

export function LowStockPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
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
  const lowStockQuery = useLowStock(filters, canView && branchScope.hasBranchScope);
  const branchesQuery = useBranches(canView);
  const adjustmentMutation = useAdjustStock();

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = branchScope.normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [branchScope]);

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
      <div className="grid gap-3 rounded-3xl border border-brand-cappuccino bg-white/70 p-4 shadow-soft md:grid-cols-4">
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
            <SelectItem value="ingredient">Ingredients</SelectItem>
            <SelectItem value="packaging">Packaging</SelectItem>
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
      {!lowStockQuery.isLoading &&
      !lowStockQuery.error &&
      (lowStockQuery.data ?? []).length === 0 ? (
        <InventoryEmptyState
          description="No low stock items right now."
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
              onView={() => undefined}
              showBatchAction={false}
              showViewAction={false}
            />
          </CardContent>
        </Card>
      ) : null}

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
