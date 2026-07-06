"use client";

import {
  ArrowLeftRight,
  ArrowRight,
  ListChecks,
  MapPinned,
  PackageOpen,
  Plus,
  Warehouse,
  Wheat,
} from "lucide-react";
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
import { OpeningStockDialog } from "@/components/inventory/opening-stock-dialog";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
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

type InventoryWorkspaceLink = {
  description: string;
  href: string;
  icon: typeof MapPinned;
  label: string;
  visible: boolean;
};

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
  const inventoryQuery = useInventory(filters, canView && branchScope.hasBranchScope);
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
  const workspaceLinks: InventoryWorkspaceLink[] = [
    {
      description: "See stock split by branch location, such as kitchen or display counter.",
      href: ROUTES.inventoryLocationBalances,
      icon: MapPinned,
      label: "Location balances",
      visible: hasAnyPermission([PERMISSIONS.inventoryView]),
    },
    {
      description: "Move stock between locations without changing the branch total.",
      href: ROUTES.inventoryStockTransfers,
      icon: ArrowLeftRight,
      label: "Stock transfers",
      visible: canViewStockTransfers,
    },
    {
      description: "Manage physical stock areas inside a branch.",
      href: ROUTES.inventoryStockLocations,
      icon: Warehouse,
      label: "Stock locations",
      visible: canViewStockLocations,
    },
    {
      description: "Audit stock in, stock out, adjustments, and transfer history.",
      href: ROUTES.inventoryMovements,
      icon: ListChecks,
      label: "Stock movements",
      visible: canViewStockMovements,
    },
    {
      description: "Review items at or below reorder level.",
      href: ROUTES.inventoryLowStock,
      icon: PackageOpen,
      label: "Low stock",
      visible: canViewLowStock,
    },
    {
      description: "Track batches expiring soon or already expired.",
      href: ROUTES.inventoryExpiryAlerts,
      icon: Wheat,
      label: "Expiry alerts",
      visible: canViewExpiryAlerts,
    },
  ];

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

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Inventory sections">
        {workspaceLinks
          .filter((link) => link.visible)
          .map((link) => {
            const Icon = link.icon;

            return (
              <Link
                className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-caramel/70 focus-visible:ring-offset-2"
                href={link.href}
                key={link.href}
              >
                <Card className="bg-white/80 transition-colors group-hover:border-brand-caramel/40 group-hover:bg-brand-latte/50">
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-cappuccino/45 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="truncate text-sm font-bold text-brand-espresso">
                          {link.label}
                        </h2>
                        <ArrowRight className="h-4 w-4 shrink-0 text-brand-mocha transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-brand-mocha">
                        {link.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
      </section>

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
