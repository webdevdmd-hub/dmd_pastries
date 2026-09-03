"use client";

import { BarChart3, Factory } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { BatchDetailsDrawer } from "@/components/manufacturing/batch-details-drawer";
import { BatchFormDialog } from "@/components/manufacturing/batch-form-dialog";
import { BatchWastageDialog } from "@/components/manufacturing/batch-wastage-dialog";
import { BatchesCardGrid } from "@/components/manufacturing/batches-card-grid";
import { BatchesTable } from "@/components/manufacturing/batches-table";
import { BatchesToolbar } from "@/components/manufacturing/batches-toolbar";
import { ManufacturingEmptyState } from "@/components/manufacturing/manufacturing-empty-state";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingTableSkeleton } from "@/components/manufacturing/manufacturing-table-skeleton";
import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import {
  useAddBatchWastage,
  useBatches,
  useCreateBatch,
  useCreateProduction,
  useDeleteBatch,
  useManufacturingBranches,
  useManufacturingInventory,
  useManufacturingProducts,
  useProduceBatch,
  useUpdateBatch,
} from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { canProduceBatch } from "@/lib/manufacturing/batch-status";
import { productionFailureMessage } from "@/lib/manufacturing/production-errors";
import type {
  BatchFilters,
  CreateBatchPayload,
  CreateProductionPayload,
  ProducePayload,
  ProductionBatch,
  UpdateBatchPayload,
  WastagePayload,
} from "@/types/manufacturing";

const defaultFilters: BatchFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  productId: "all",
  search: "",
  status: "all",
};

function formatMetric(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value);
}

export function BatchesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const canCreate = hasAnyPermission([PERMISSIONS.manufacturingBatchesCreate]);
  const canEdit = hasAnyPermission([PERMISSIONS.manufacturingBatchesEdit]);
  const canProduce = hasAnyPermission([PERMISSIONS.manufacturingBatchesProduce]);
  const canDelete = hasAnyPermission([PERMISSIONS.manufacturingBatchesDelete]);
  const canRecordWastage = hasAnyPermission([PERMISSIONS.manufacturingBatchesWastage]);
  const [filters, setFilters] = useState<BatchFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<ProductionBatch | null>(null);
  const [wastageBatch, setWastageBatch] = useState<ProductionBatch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [producingBatchId, setProducingBatchId] = useState<string | null>(null);
  // The record, not the id: the list rows already carry a full batch, so the
  // drawer only fetches its four component lists.
  const [drawerBatch, setDrawerBatch] = useState<ProductionBatch | null>(null);
  const batchesQuery = useBatches(filters, canView && branchScope.hasBranchScope);
  const productsQuery = useManufacturingProducts(canView);
  const branchesQuery = useManufacturingBranches(canView);
  const inventoryQuery = useManufacturingInventory(canView && canRecordWastage);
  const createPlannedMutation = useCreateBatch();
  const createProductionMutation = useCreateProduction();
  const updateBatchMutation = useUpdateBatch();
  const produceBatchMutation = useProduceBatch();
  const deleteBatchMutation = useDeleteBatch();
  const addWastageMutation = useAddBatchWastage();
  const isPermissionDenied =
    batchesQuery.error instanceof ApiError && batchesQuery.error.status === 403;
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty production log look like a narrow search and
  // the empty state would never appear.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.productId !== defaultFilters.productId ||
    filters.status !== defaultFilters.status ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

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

  const openCreate = (): void => {
    setEditingBatch(null);
    setFormOpen(true);
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before any of these open.
  const openEdit = (batch: ProductionBatch): void => {
    setDrawerBatch(null);
    setEditingBatch(batch);
    setFormOpen(true);
  };

  const askDelete = (batch: ProductionBatch): void => {
    setDrawerBatch(null);
    setDeleteBatchTarget(batch);
  };

  const openWastage = (batch: ProductionBatch): void => {
    setDrawerBatch(null);
    setWastageBatch(batch);
  };

  const updateFilter = (patch: Partial<BatchFilters>): void => {
    setFilters({ ...filters, ...patch });
  };

  const handleCreatePlanned = async (payload: CreateBatchPayload): Promise<void> => {
    try {
      await createPlannedMutation.mutateAsync(payload);
      toast.success("Planned production saved.");
      setFormOpen(false);
    } catch (error) {
      toast.error(productionFailureMessage(error));
    }
  };

  const handleProduceNow = async (payload: CreateProductionPayload): Promise<void> => {
    await createProductionMutation.mutateAsync(payload);
    toast.success("Production completed.");
    setFormOpen(false);
  };

  const handleUpdate = async (id: string, payload: UpdateBatchPayload): Promise<void> => {
    try {
      await updateBatchMutation.mutateAsync({ id, payload });
      toast.success("Planned production updated.");
      setEditingBatch(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(productionFailureMessage(error));
    }
  };

  const handleProducePlanned = async (
    id: string,
    producePayload: ProducePayload,
  ): Promise<void> => {
    await produceBatchMutation.mutateAsync({ id, payload: producePayload });
    toast.success("Planned production produced.");
    setEditingBatch(null);
    setFormOpen(false);
  };

  const handleProducePlannedFromRow = async (batch: ProductionBatch): Promise<void> => {
    if (produceBatchMutation.isPending || producingBatchId !== null) {
      return;
    }

    if (!canProduceBatch(batch)) {
      toast.error("Only planned, draft, or in-progress batches without output can be produced.");
      return;
    }

    setProducingBatchId(batch.id);
    try {
      await produceBatchMutation.mutateAsync({
        id: batch.id,
        payload: {
          ...(batch.productionDate ? { productionDate: batch.productionDate.slice(0, 10) } : {}),
          ...(batch.notes ? { notes: batch.notes } : {}),
          quantityProduced: batch.plannedQuantity,
        },
      });
      toast.success("Planned production produced.");
    } catch (error) {
      toast.error(productionFailureMessage(error));
    } finally {
      setProducingBatchId(null);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteBatchTarget) {
      return;
    }

    try {
      await deleteBatchMutation.mutateAsync(deleteBatchTarget.id);
      toast.success("Planned production deleted.");
      setDeleteBatchTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleWastage = async (payload: WastagePayload): Promise<void> => {
    if (!wastageBatch) {
      return;
    }

    try {
      await addWastageMutation.mutateAsync({ id: wastageBatch.id, payload });
      toast.success("Wastage recorded.");
      setWastageBatch(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const batches = batchesQuery.data ?? [];

  const listHandlers = {
    batches,
    canDelete,
    canEdit,
    canProduce,
    canRecordWastage,
    onDelete: askDelete,
    onEdit: openEdit,
    onProduce: (batch: ProductionBatch) => {
      void handleProducePlannedFromRow(batch);
    },
    onView: setDrawerBatch,
    onWastage: openWastage,
    producingBatchId,
  };
  const batchMetrics = {
    completed: batches.filter((batch) => batch.status === "completed").length,
    inProgress: batches.filter(
      (batch) => batch.status === "in_progress" || batch.status === "partially_completed",
    ).length,
    planned: batches.reduce((total, batch) => total + batch.plannedQuantity, 0),
    produced: batches.reduce((total, batch) => total + batch.producedQuantity, 0),
    total: batches.length,
    wastage: batches.reduce((total, batch) => total + batch.wastageQuantity, 0),
  };
  const metricCards = [
    { label: "Total Batches", meta: "visible", value: formatMetric(batchMetrics.total) },
    { label: "In Progress", meta: "active", value: formatMetric(batchMetrics.inProgress) },
    { label: "Completed", meta: "closed", value: formatMetric(batchMetrics.completed) },
    {
      label: "Wastage Recorded",
      meta: "units",
      tone: "danger",
      value: formatMetric(batchMetrics.wastage),
    },
    { label: "Planned Output", meta: "units", value: formatMetric(batchMetrics.planned) },
    { label: "Produced Output", meta: "units", value: formatMetric(batchMetrics.produced) },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold text-foreground-muted">Manufacturing</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">Production</h1>
          <p className="mt-2 max-w-2xl text-base text-foreground-muted">
            Choose a recipe and output quantity. Component consumption, packaging consumption,
            output stock, costing, and accounting are handled automatically by the backend.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="border-border bg-card text-foreground hover:bg-muted"
            variant="outline"
          >
            <Link href={ROUTES.reportsManufacturing}>
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Link>
          </Button>
          {canCreate ? (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary"
              onClick={openCreate}
              type="button"
            >
              <Factory className="h-4 w-4" />
              Create Production
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((metric) => (
          <section className="rounded-2xl border border-border bg-card p-5" key={metric.label}>
            <p className="text-xs font-bold text-foreground-muted">{metric.label}</p>
            <div className="mt-4 flex items-end gap-2">
              <p
                className={
                  metric.tone === "danger"
                    ? "text-kpi tabular-nums text-danger-text"
                    : "text-kpi tabular-nums text-foreground"
                }
              >
                {metric.value}
              </p>
              <p className="pb-1 text-sm text-foreground-muted">{metric.meta}</p>
            </div>
          </section>
        ))}
      </div>

      <BatchesToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={updateFilter}
        onReset={() => setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })}
        products={productsQuery.data ?? []}
        resetBranchId={branchScope.defaultBranchId}
      />

      {batchesQuery.isLoading ? <ManufacturingTableSkeleton /> : null}

      {!batchesQuery.isLoading && batchesQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to manufacturing batches." />
        ) : (
          <ManufacturingErrorState
            description={getErrorMessage(batchesQuery.error)}
            onRetry={() => {
              void batchesQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Filtered and empty need opposite remedies. Offering "Create Production"
          to someone who filtered to Cancelled in one date range implies nothing
          has ever been produced, and sends them off to do the wrong thing.
          DESIGN.md 8. */}
      {!batchesQuery.isLoading &&
      !batchesQuery.error &&
      batches.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="batches"
          onClearFilters={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!batchesQuery.isLoading &&
      !batchesQuery.error &&
      batches.length === 0 &&
      !hasActiveFilters ? (
        <ManufacturingEmptyState
          actionLabel={canCreate ? "Create Production" : undefined}
          description="Production batches turn recipes into finished stock. Creating one consumes its ingredients and adds the output to inventory."
          onAction={canCreate ? openCreate : undefined}
          title="No production batches yet"
        />
      ) : null}

      {!batchesQuery.isLoading && !batchesQuery.error && batches.length > 0 ? (
        <>
          <div className="md:hidden">
            <BatchesCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden rounded-2xl border-border bg-card shadow-none md:block">
            <CardContent className="p-0">
              <BatchesTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <BatchDetailsDrawer
        batch={drawerBatch}
        canDelete={canDelete}
        canProduce={canProduce}
        canRecordWastage={canRecordWastage}
        isProducing={producingBatchId === drawerBatch?.id}
        onDelete={askDelete}
        onOpenChange={(open) => (!open ? setDrawerBatch(null) : undefined)}
        onProduce={(batch) => {
          void handleProducePlannedFromRow(batch);
        }}
        onWastage={openWastage}
        open={drawerBatch !== null}
      />

      <BatchFormDialog
        batch={editingBatch}
        branches={branchOptions}
        canProducePlanned={canProduce}
        isSubmitting={
          createPlannedMutation.isPending ||
          createProductionMutation.isPending ||
          produceBatchMutation.isPending ||
          updateBatchMutation.isPending
        }
        onClose={() => {
          setEditingBatch(null);
          setFormOpen(false);
        }}
        onCreatePlanned={handleCreatePlanned}
        onProducePlanned={handleProducePlanned}
        onProduceNow={handleProduceNow}
        onUpdate={handleUpdate}
        open={formOpen}
        products={productsQuery.data ?? []}
      />

      <BatchWastageDialog
        inventory={inventoryQuery.data ?? []}
        isSubmitting={addWastageMutation.isPending}
        onClose={() => setWastageBatch(null)}
        onWastage={handleWastage}
        open={wastageBatch !== null}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteBatchTarget(null);
          }
        }}
        open={deleteBatchTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete planned production?</DialogTitle>
            <DialogDescription>
              This production has not posted stock or accounting yet. Deleting it cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteBatchTarget(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-danger text-primary-foreground hover:bg-danger"
              disabled={deleteBatchMutation.isPending}
              onClick={() => void confirmDelete()}
              type="button"
            >
              Delete planned production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
