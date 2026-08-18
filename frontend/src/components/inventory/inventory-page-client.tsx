"use client";

import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
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
import type { InventoryView } from "@/components/inventory/inventory-view-tabs";
import { InventoryViewTabs } from "@/components/inventory/inventory-view-tabs";
import { OpeningStockDialog } from "@/components/inventory/opening-stock-dialog";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAdjustStock,
  useCreateExpiryBatch,
  useCreateOpeningStock,
  useExpiryAlerts,
  useExpiryBatches,
  useInventory,
  useInventoryItemMovements,
  useStockLocations,
  useUpdateExpiryBatchStatus,
} from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { useProductReferenceData, useProducts } from "@/hooks/use-products";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";
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
    productType: "all",
    status: "all",
    lowStockOnly: false,
    expiryTrackedOnly: false,
    includeUninitialized: false,
  };
}

export function InventoryPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
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
  const canViewStockMovements = hasAnyPermission([
    PERMISSIONS.stockMovementsView,
    PERMISSIONS.inventoryMovementsView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewLowStock = hasAnyPermission([
    PERMISSIONS.inventoryLowStockView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewExpiryAlerts = hasAnyPermission([
    PERMISSIONS.inventoryExpiryView,
    PERMISSIONS.inventoryView,
  ]);
  const canViewStockTransfers = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryTransferCreate,
    PERMISSIONS.inventoryTransferComplete,
    PERMISSIONS.inventoryTransferCancel,
  ]);
  const canViewStockLocations = hasAnyPermission([
    PERMISSIONS.inventoryView,
    PERMISSIONS.inventoryLocationsManage,
  ]);
  const [filters, setFilters] = useState<InventoryFilters>(() =>
    buildDefaultFilters(branchScope.defaultBranchId),
  );
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  const [batchItem, setBatchItem] = useState<InventoryItem | null>(null);
  const [openingStockItem, setOpeningStockItem] = useState<InventoryItem | null>(null);
  const timezone = useMemo(resolveDashboardTimezone, []);
  // Keystrokes land in filters immediately; only the debounced search may key
  // the query, or every keystroke fetches and caches a new list.
  const debouncedSearch = useDebouncedValue(filters.search);
  const inventoryQueryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [debouncedSearch, filters],
  );
  const inventoryQuery = useInventory(inventoryQueryFilters, canView && branchScope.hasBranchScope);
  const expiryAlertsQuery = useExpiryAlerts(
    {
      branchId: filters.branchId,
      itemType: "all",
      productType: "all",
      expiryState: "all",
      timezone,
      days: 30,
    },
    canView && branchScope.hasBranchScope,
  );
  const branchesQuery = useBranches(canView);
  const productsQuery = useProducts(
    {
      search: "",
      categoryId: "all",
      productType: "all",
      itemStructure: "all",
      status: "active",
      isPosVisible: "all",
      isSellable: "all",
      isPurchasable: "all",
      page: 1,
      limit: 200,
      sortBy: "product_name",
      sortOrder: "asc",
    },
    canView,
  );
  const referencesQuery = useProductReferenceData(canView);
  const stockLocationsQuery = useStockLocations(canManage && branchScope.hasBranchScope);
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
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty inventory read as a narrow search.
  const filterDefaults = buildDefaultFilters(filters.branchId);
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.itemType !== filterDefaults.itemType ||
    filters.productType !== filterDefaults.productType ||
    filters.status !== filterDefaults.status ||
    filters.lowStockOnly !== filterDefaults.lowStockOnly ||
    filters.expiryTrackedOnly !== filterDefaults.expiryTrackedOnly ||
    filters.includeUninitialized !== filterDefaults.includeUninitialized;

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
      const normalizedBranchId = normalizeBranchId(currentFilters.branchId);

      if (currentFilters.branchId === normalizedBranchId) {
        return currentFilters;
      }

      return { ...currentFilters, branchId: normalizedBranchId };
    });
  }, [normalizeBranchId]);

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
      setOpeningStockItem(null);
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
  const expiryAlerts = expiryAlertsQuery.data ?? [];
  const lowStockCount = items.filter((item) => item.lowStock).length;

  // The tab is the filter. Selecting "Low stock" sets the same lowStockOnly
  // field the toolbar checkbox always set, so nothing about the query shape
  // changes -- only where the control lives.
  const view: InventoryView = filters.lowStockOnly ? "low_stock" : "all";
  const handleViewChange = (nextView: InventoryView): void => {
    setFilters({ ...filters, lowStockOnly: nextView === "low_stock" });
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Track product stock, branch quantities, movements, low stock, and expiry-sensitive items."
        actions={
          <div className="flex items-center gap-2">
            {canViewStockLocations ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label="More inventory options" size="icon" variant="outline">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={ROUTES.inventoryStockLocations}>Manage stock locations</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {canManage ? (
              <Button onClick={() => setOpeningStockOpen(true)} type="button">
                <Plus className="h-4 w-4" />
                Opening Stock
              </Button>
            ) : null}
          </div>
        }
      />

      <InventorySummaryCards expiryAlerts={expiryAlerts} items={items} />

      <InventoryViewTabs
        canViewExpiryAlerts={canViewExpiryAlerts}
        canViewLocationBalances={hasAnyPermission([PERMISSIONS.inventoryView])}
        canViewLowStock={canViewLowStock}
        canViewStockMovements={canViewStockMovements}
        canViewStockTransfers={canViewStockTransfers}
        expiringCount={expiryAlerts.length}
        lowStockCount={lowStockCount}
        onViewChange={handleViewChange}
        view={view}
      />

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

      {/* Filtered and empty need opposite remedies. "Add opening stock" is the
          wrong next step for someone who typed a code that matched nothing while
          the branch holds hundreds of stocked items. DESIGN.md §8. */}
      {!inventoryQuery.isLoading &&
      !inventoryQuery.error &&
      items.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="inventory items"
          onClearFilters={() => setFilters(buildDefaultFilters(branchScope.defaultBranchId))}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!inventoryQuery.isLoading &&
      !inventoryQuery.error &&
      items.length === 0 &&
      !hasActiveFilters ? (
        <InventoryEmptyState canManage={canManage} onCreate={() => setOpeningStockOpen(true)} />
      ) : null}

      {!inventoryQuery.isLoading && !inventoryQuery.error && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <InventoryTable
              canManage={canManage}
              items={items}
              onAddBatch={setBatchItem}
              onAddOpeningStock={(item) => {
                setOpeningStockItem(item);
                setOpeningStockOpen(true);
              }}
              onAdjust={setAdjustmentItem}
              onView={setSelectedItem}
            />
          </CardContent>
        </Card>
      ) : null}

      <OpeningStockDialog
        branches={branchOptions}
        isSubmitting={openingStockMutation.isPending}
        onClose={() => {
          setOpeningStockOpen(false);
          setOpeningStockItem(null);
        }}
        onSubmit={handleOpeningStock}
        open={openingStockOpen}
        preselectedItem={openingStockItem}
        products={productsQuery.data?.items ?? []}
        stockLocations={stockLocationsQuery.data ?? []}
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
