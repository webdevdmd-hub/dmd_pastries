"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/inventory/access-denied-card";
import { ExpiryBatchDialog } from "@/components/inventory/expiry-batch-dialog";
import { InventoryDetailsDrawer } from "@/components/inventory/inventory-details-drawer";
import { InventoryEmptyState } from "@/components/inventory/inventory-empty-state";
import { InventoryErrorState } from "@/components/inventory/inventory-error-state";
import { InventorySummaryCards } from "@/components/inventory/inventory-summary-cards";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { InventoryTableSkeleton } from "@/components/inventory/inventory-table-skeleton";
import { InventoryToolbar } from "@/components/inventory/inventory-toolbar";
import { OpeningStockDialog } from "@/components/inventory/opening-stock-dialog";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useIngredients } from "@/hooks/use-ingredients";
import {
  useAdjustStock,
  useCreateExpiryBatch,
  useCreateOpeningStock,
  useExpiryAlerts,
  useExpiryBatches,
  useInventory,
  useInventoryItemMovements,
  useUpdateExpiryBatchStatus,
} from "@/hooks/use-inventory";
import { usePackaging } from "@/hooks/use-packaging";
import { usePermission } from "@/hooks/use-permission";
import { useProductReferenceData, useProducts } from "@/hooks/use-products";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { Branch } from "@/types/branch";
import type {
  CreateExpiryBatchPayload,
  ExpiryBatchStatus,
  InventoryFilters,
  InventoryItem,
  OpeningStockPayload,
  StockAdjustmentPayload,
} from "@/types/inventory";

function buildDefaultFilters(branchId: string): InventoryFilters {
  return {
    search: "",
    branchId,
    itemType: "all",
    status: "all",
    lowStockOnly: false,
    expiryTrackedOnly: false,
  };
}

export function InventoryPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryLowStockView,
    PERMISSIONS.inventoryExpiryView,
  ]);
  const canManage = hasAnyPermission([
    PERMISSIONS.inventoryOpeningStock,
    PERMISSIONS.inventoryAdjust,
    PERMISSIONS.inventoryExpiryBatchesManage,
  ]);
  const [filters, setFilters] = useState<InventoryFilters>(() =>
    buildDefaultFilters(branchScope.defaultBranchId),
  );
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  const [batchItem, setBatchItem] = useState<InventoryItem | null>(null);
  const inventoryQuery = useInventory(filters, canView && branchScope.hasBranchScope);
  const expiryAlertsQuery = useExpiryAlerts(
    { branchId: filters.branchId, itemType: "all", status: "all", days: 30 },
    canView && branchScope.hasBranchScope,
  );
  const branchesQuery = useBranches(canView);
  const productsQuery = useProducts(
    {
      search: "",
      categoryId: "all",
      productType: "all",
      status: "active",
      isPosVisible: "all",
      page: 1,
      limit: 200,
      sortBy: "product_name",
      sortOrder: "asc",
    },
    canView,
  );
  const ingredientsQuery = useIngredients(
    {
      categoryId: "all",
      search: "",
      status: "active",
      stockTracked: "all",
      supplierId: "all",
    },
    canView,
  );
  const packagingQuery = usePackaging(
    {
      categoryId: "all",
      search: "",
      status: "active",
      stockTracked: "all",
      supplierId: "all",
    },
    canView,
  );
  const referencesQuery = useProductReferenceData(canView);
  const movementsQuery = useInventoryItemMovements(
    selectedItem?.id ?? null,
    {},
    selectedItem !== null,
  );
  const batchesQuery = useExpiryBatches(
    selectedItem?.id ?? null,
    selectedItem?.isExpiryTracked === true,
  );
  const openingStockMutation = useCreateOpeningStock();
  const adjustmentMutation = useAdjustStock();
  const createBatchMutation = useCreateExpiryBatch();
  const batchStatusMutation = useUpdateExpiryBatchStatus();
  const isPermissionDenied =
    inventoryQuery.error instanceof ApiError && inventoryQuery.error.status === 403;

  const branchOptions = useMemo<Branch[]>(() => {
    const backendBranches = (branchesQuery.data ?? []).filter(
      (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
    );

    if (backendBranches.length > 0 || !branchScope.effectiveBranchId) {
      return backendBranches;
    }

    return [
      {
        address: "",
        businessId: "",
        code: branchScope.effectiveBranchId,
        createdAt: "",
        email: null,
        id: branchScope.effectiveBranchId,
        isDefault: false,
        managerUserId: null,
        name: branchScope.effectiveBranchName ?? "Current branch",
        phone: null,
        status: "active",
        timezone: "",
        updatedAt: "",
      },
    ];
  }, [branchScope, branchesQuery.data]);

  useEffect(() => {
    setFilters((currentFilters) => {
      const normalizedBranchId = branchScope.normalizeBranchId(currentFilters.branchId);

      if (currentFilters.branchId === normalizedBranchId) {
        return currentFilters;
      }

      return { ...currentFilters, branchId: normalizedBranchId };
    });
  }, [branchScope]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleOpeningStock = async (payload: OpeningStockPayload): Promise<void> => {
    try {
      await openingStockMutation.mutateAsync(payload);
      toast.success("Opening stock created.");
      setOpeningStockOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAdjustment = async (id: string, payload: StockAdjustmentPayload): Promise<void> => {
    try {
      await adjustmentMutation.mutateAsync({ id, payload });
      toast.success("Stock adjusted.");
      setAdjustmentItem(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCreateBatch = async (
    inventoryItemId: string,
    payload: CreateExpiryBatchPayload,
  ): Promise<void> => {
    try {
      await createBatchMutation.mutateAsync({ inventoryItemId, payload });
      toast.success("Expiry batch added.");
      setBatchItem(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleBatchStatus = (batchId: string, status: ExpiryBatchStatus): void => {
    batchStatusMutation.mutate(
      { batchId, payload: { status } },
      {
        onSuccess: () => toast.success("Batch status updated."),
        onError: (error) => toast.error(getErrorMessage(error)),
      },
    );
  };

  const items = inventoryQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Track product stock, branch quantities, movements, low stock, and expiry-sensitive items."
        actions={
          canManage ? (
            <Button onClick={() => setOpeningStockOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Opening Stock
            </Button>
          ) : undefined
        }
      />

      <InventorySummaryCards items={items} expiryAlerts={expiryAlertsQuery.data ?? []} />

      <InventoryToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
      />

      {inventoryQuery.isLoading ? <InventoryTableSkeleton /> : null}

      {!inventoryQuery.isLoading && inventoryQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the inventory endpoint." />
        ) : (
          <InventoryErrorState
            description={getErrorMessage(inventoryQuery.error)}
            onRetry={() => {
              void inventoryQuery.refetch();
            }}
          />
        )
      ) : null}

      {!inventoryQuery.isLoading && !inventoryQuery.error && items.length === 0 ? (
        <InventoryEmptyState canManage={canManage} onCreate={() => setOpeningStockOpen(true)} />
      ) : null}

      {!inventoryQuery.isLoading && !inventoryQuery.error && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <InventoryTable
              canManage={canManage}
              items={items}
              onAddBatch={setBatchItem}
              onAdjust={setAdjustmentItem}
              onView={setSelectedItem}
            />
          </CardContent>
        </Card>
      ) : null}

      <OpeningStockDialog
        branches={branchOptions}
        isSubmitting={openingStockMutation.isPending}
        ingredients={ingredientsQuery.data ?? []}
        onClose={() => setOpeningStockOpen(false)}
        onSubmit={handleOpeningStock}
        open={openingStockOpen}
        packagingItems={packagingQuery.data ?? []}
        products={productsQuery.data?.items ?? []}
        units={referencesQuery.data?.units ?? []}
      />

      <StockAdjustmentDialog
        isSubmitting={adjustmentMutation.isPending}
        item={adjustmentItem}
        onClose={() => setAdjustmentItem(null)}
        onSubmit={handleAdjustment}
        open={adjustmentItem !== null}
      />

      <ExpiryBatchDialog
        isSubmitting={createBatchMutation.isPending}
        item={batchItem}
        onClose={() => setBatchItem(null)}
        onSubmit={handleCreateBatch}
        open={batchItem !== null}
      />

      <InventoryDetailsDrawer
        batches={batchesQuery.data ?? []}
        batchesLoading={batchesQuery.isLoading}
        canManage={canManage}
        item={selectedItem}
        movements={movementsQuery.data ?? []}
        movementsLoading={movementsQuery.isLoading}
        onAddBatch={setBatchItem}
        onAdjust={setAdjustmentItem}
        onBatchStatusChange={handleBatchStatus}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        open={selectedItem !== null}
      />
    </div>
  );
}
